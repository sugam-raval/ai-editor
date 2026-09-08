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


TOOLS = [update_text_content, update_text_color, update_image_url]


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
        system_content = (
            "You are an expert AI design assistant for a template editor.\n"
            "Below is the lightweight, editable structure of the user's template:\n"
            f"```json\n{json.dumps(ai_context, indent=2)}\n```\n\n"
            "Instructions:\n"
            "1. Analyze the user's request and identify which layers need modification based on their `ai_label`, `type`, and content.\n"
            "2. Use the provided tools (`update_text_content`, `update_text_color`, `update_image_url`) with the exact `layer_id`.\n"
            "3. You may call multiple tools in parallel if multiple layers or properties need updating.\n"
            "4. If a requested layer does not exist or the prompt is ambiguous, explain clearly in your conversational response.\n"
            "5. Once all tools have been executed and the tool outputs returned, provide a friendly and clear summary of the changes made."
        )

        messages_to_send = [SystemMessage(content=system_content)] + state["messages"]
        response = await llm_with_tools.ainvoke(messages_to_send)
        return {"messages": [response]}

    return agent_node


def should_continue(state: AgentState) -> Literal["tools", "end"]:
    """Determines whether to execute tool calls or terminate the agentic loop."""
    last_message = state["messages"][-1]
    if getattr(last_message, "tool_calls", None):
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
