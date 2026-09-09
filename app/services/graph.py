import copy
import json
import logging
from typing import Annotated, Any, Dict, List, Literal, Optional, TypedDict

from langchain_core.messages import (
    AIMessage,
    BaseMessage,
    HumanMessage,
    SystemMessage,
    ToolMessage,
)
from langchain_core.tools import tool
from langchain_openai import ChatOpenAI
from langgraph.graph import END, StateGraph
from langgraph.graph.message import add_messages

from app.config import settings
from .mutator import mutate_template
from .pruner import prune_json_for_ai

logger = logging.getLogger(__name__)


# --- 1. STATE DEFINITION ---
class AgentState(TypedDict):
    messages: Annotated[List[BaseMessage], add_messages]
    template_json: Dict[str, Any]
    mutations_applied: List[str]
    target_layer_id: Optional[str]


# --- 2. TOOL DEFINITIONS ---
@tool
def update_text_content(layer_id: str, new_text: str) -> str:
    """Updates the visible text of a TextLayer with the given layer_id."""
    return f"Prepared to update text for {layer_id} to '{new_text}'"


@tool
def update_text_color(layer_id: str, new_color: str) -> str:
    """Updates the text color of a TextLayer (e.g., 'rgb(0,0,255)', '#0000FF', or named colors like 'blue')."""
    return f"Prepared to update color for {layer_id} to '{new_color}'"


@tool
def update_image_url(layer_id: str, new_image_url: str) -> str:
    """Replaces the image URL of a FrameLayer or Image layer with the given layer_id."""
    return f"Prepared to update image URL for {layer_id} to '{new_image_url}'"


@tool
def add_new_text(text: str, x: int = 60, y: int = 350, font_size: int = 20, color: str = "#ffffff", layer_id: str = "") -> str:
    """Adds a brand new text layer/element to the template at specified coordinates (x, y)."""
    return f"Prepared to create new text '{text}' at position x:{x}, y:{y}"


@tool
def move_layer(layer_id: str, x: int, y: int) -> str:
    """Moves an existing layer to new (x, y) coordinates on the canvas."""
    return f"Prepared to move layer {layer_id} to position x:{x}, y:{y}"


@tool
def delete_layer(layer_id: str) -> str:
    """Deletes an existing layer from the template canvas by layer_id."""
    return f"Prepared to delete layer {layer_id} from canvas"


TOOLS = [update_text_content, update_text_color, update_image_url, add_new_text, move_layer, delete_layer]




# --- 3. CUSTOM MUTATION NODE ---
def custom_tools_node(state: AgentState) -> Dict[str, Any]:
    """
    Safely intercepts tool calls made by the LLM and mutates the deep-nested
    production JSON without corrupting template structure.
    """
    current_json = copy.deepcopy(state["template_json"])
    mutations_applied = list(state.get("mutations_applied", []))
    last_message = state["messages"][-1]
    tool_calls = getattr(last_message, "tool_calls", []) or []
    tool_messages = []

    for tc in tool_calls:
        func_name = tc.get("name")
        args = tc.get("args", {})
        call_id = tc.get("id", "call_id")

        logger.info(f"Executing tool '{func_name}' with args: {args}")
        current_json, result_msg, is_success = mutate_template(current_json, func_name, args)

        if is_success:
            mutations_applied.append(f"{func_name}: {args}")

        tool_messages.append(ToolMessage(content=result_msg, tool_call_id=call_id))

    return {
        "template_json": current_json,
        "messages": tool_messages,
        "mutations_applied": mutations_applied,
    }


# --- 4. GRAPH BUILDER ---
def create_agent_node(llm_with_tools):
    """Factory to create an agent node bound with the configured LLM."""
    async def agent_node(state: AgentState) -> Dict[str, Any]:
        ai_context = prune_json_for_ai(state["template_json"])
        raw_json = state["template_json"]
        root_data = raw_json[0] if (isinstance(raw_json, list) and len(raw_json) > 0 and isinstance(raw_json[0], dict)) else raw_json
        canvas_info = root_data.get("canvas", {"width": 800, "height": 450}) if isinstance(root_data, dict) else {"width": 800, "height": 450}
        canvas_w = canvas_info.get("width", 800)
        canvas_h = canvas_info.get("height", 450)

        target_layer_id = state.get("target_layer_id")
        targeting_instruction = ""
        if target_layer_id:
            targeting_instruction = (
                f"\n\n🎯 TARGETED LAYER CONSTRAINTS:\n"
                f"The user has EXPLICITLY TARGETED the single layer ID: '{target_layer_id}'.\n"
                f"You MUST restrict all layer mutations (update_text_content, update_text_color, move_layer, delete_layer, update_image_url) ONLY to layer '{target_layer_id}'.\n"
                f"DO NOT modify any other existing layer unless the user asks to create a completely new text layer."
            )

        system_content = (
            "You are an expert AI design assistant for a template editor.\n"
            f"Canvas Dimensions: Width={canvas_w}px, Height={canvas_h}px.\n"
            "Below is the lightweight, editable structure of the user's template:\n"
            f"```json\n{json.dumps(ai_context, indent=2)}\n```"
            f"{targeting_instruction}\n\n"
            "Instructions & Design Intelligence:\n"
            "1. Users describe positions in natural language (e.g. 'at the bottom', 'top right corner', 'below the headline', 'centered', 'above the CTA button').\n"
            "2. YOU MUST USE YOUR DESIGN INTELLIGENCE to calculate the appropriate pixel coordinates (x, y) based on the canvas size and existing layers!\n"
            "   - 'top': y ≈ 40-70\n"
            "   - 'center / middle': x ≈ canvas_w / 4, y ≈ canvas_h / 2\n"
            "   - 'bottom': y ≈ canvas_h - 90 (e.g. y=360 for 450px canvas)\n"
            "   - 'top right': x ≈ canvas_w - 250, y ≈ 40\n"
            "   - 'below headline': look at the y coordinate of existing headline and set new y below it (e.g. y = headline.y + headline.height + 20)\n"
            "3. Available tools:\n"
            "   - `update_text_content(layer_id, new_text)`: Updates existing text content.\n"
            "   - `update_text_color(layer_id, new_color)`: Updates text color.\n"
            "   - `update_image_url(layer_id, new_image_url)`: Replaces image URL.\n"
            "   - `add_new_text(text, x, y, font_size, color)`: Creates a NEW text layer. ALWAYS calculate reasonable x, y pixel coordinates!\n"
            "   - `move_layer(layer_id, x, y)`: Repositions any layer to new calculated coordinates.\n"
            "4. NEVER tell the user that adding a text layer is unsupported or ask them for exact pixel numbers. Compute the best x, y yourself and call `add_new_text` or `move_layer`!"
        )




        messages_to_send = [SystemMessage(content=system_content)] + state["messages"]
        response = await llm_with_tools.ainvoke(messages_to_send)
        return {"messages": [response]}

    return agent_node


def should_continue(state: AgentState) -> Literal["tools", "end"]:
    """Determines whether to execute tool calls or terminate the agentic loop."""
    messages = state.get("messages", [])
    if not messages:
        return "end"

    last_message = messages[-1]

    # If the last message has tool calls, check if we've already run tools for it
    tool_calls = getattr(last_message, "tool_calls", None)
    if tool_calls:
        # Count consecutive tool steps to prevent runaway loops (max 3 loops)
        tool_msg_count = sum(1 for m in messages if isinstance(m, ToolMessage))
        if tool_msg_count >= 5:
            logger.warning("Reached maximum tool execution loop threshold. Force terminating loop.")
            return "end"
        return "tools"

    return "end"



def build_app_graph(custom_llm=None):
    """
    Constructs and compiles the LangGraph StateGraph workflow.
    """
    if custom_llm is not None:
        llm_with_tools = custom_llm.bind_tools(TOOLS)
    else:
        api_key = settings.openai_api_key or "sk-dummy-key"
        llm = ChatOpenAI(
            model=settings.openai_model_name,
            temperature=settings.openai_temperature,
            api_key=api_key,
        )
        llm_with_tools = llm.bind_tools(TOOLS)

    workflow = StateGraph(AgentState)
    workflow.add_node("agent", create_agent_node(llm_with_tools))
    workflow.add_node("tools", custom_tools_node)

    workflow.set_entry_point("agent")
    workflow.add_conditional_edges(
        "agent",
        should_continue,
        {
            "tools": "tools",
            "end": END,
        }
    )
    workflow.add_edge("tools", "agent")

    return workflow.compile()

