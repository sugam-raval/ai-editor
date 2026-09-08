AI Template Editor: End-to-End Implementation Guide
1. Executive Summary
This document outlines the architecture and implementation details for the AI-driven Template Editor.
Instead of asking the Large Language Model (LLM) to rewrite the entire template JSON (which is highly error-prone and risks breaking the frontend renderer), this system uses an Agentic Tool-Calling Architecture powered by LangGraph.
The LLM acts as an "intent router," translating natural language into structured tool calls. The backend safely intercepts these calls, mutates the specific deep-nested properties of the production JSON, and returns a 100% structurally valid JSON to the frontend.
2. Core Architecture Principles
Zero JSON Corruption: The LLM never outputs raw JSON. It only outputs tool arguments. Standard Python code performs the actual JSON mutation.
Token Optimization (Prune & Map): The LLM is only shown a lightweight, "pruned" version of the JSON (editable fields only). The full, heavy production JSON is kept in memory and mutated silently.
Agentic Looping: LangGraph automatically handles multi-step requests (e.g., "Change the text to blue AND replace the image") by looping between the LLM and the Tool Executor until the task is complete.
Minimal Schema Impact: Existing production templates require zero structural changes. An optional ai_label field can be added for better AI context, but the system gracefully falls back to existing resolvedName fields.
3. End-to-End Data Flow
Frontend: User types a prompt (e.g., "Change the discount text to blue"). Frontend sends { user_prompt, template_json } to the FastAPI backend.
FastAPI Pruner: Backend runs prune_json_for_ai() to strip heavy data (font URLs, deep arrays) and create a lightweight ai_context.
LangGraph Initialization: The AgentState is initialized with the ai_context (for LLM understanding) and the full template_json (for safe mutation).
Agent Node (LLM): The LLM analyzes the prompt and the pruned JSON, and decides to call the update_text_color tool with layer_id and new_color.
Custom Tools Node (Mutation): The backend intercepts the tool call. It finds the layer_id in the full JSON and safely updates the deep nested path: layer["props"]["doc"]["content"][0]["attrs"]["color"].
Agent Node (Final Response): The LLM receives a "Success" message from the tool and generates a conversational reply (e.g., "Done! I changed the text to blue.").
Frontend Update: FastAPI returns the { updated_json, ai_message }. The frontend re-renders the canvas and displays the chat message.
4. Implementation Details
4.1. Minimal Schema Addition (Optional)
To help the AI understand layer purposes, optionally add an ai_label to your layer objects. If omitted, the system falls back to resolvedName.
"67f53dfa-da43-4094-bb7f-1f6f16aad7f4": {
  "ai_label": "Middle Food Image", 
  "type": { "resolvedName": "FrameLayer" },
  "props": { "image": { "url": "..." } }
}


json
12345
4.2. Dependencies
bash
pip install fastapi uvicorn langchain langchain-openai langgraph pydantic

1
4.3. The LangGraph State & Tools
python
import copy
import json
from typing import Annotated, TypedDict, Literal
from langchain_core.messages import AIMessage, ToolMessage, SystemMessage, HumanMessage
from langchain_core.tools import tool
from langchain_openai import ChatOpenAI
from langgraph.graph import StateGraph, END
from langgraph.graph.message import add_messages

# --- 1. STATE DEFINITION ---
class AgentState(TypedDict):
    messages: Annotated[list, add_messages]
    template_json: dict  # Holds the FULL production JSON

# --- 2. TOOL DEFINITIONS ---
@tool
def update_text_content(layer_id: str, new_text: str) -> str:
    """Updates the visible text of a TextLayer."""
    return f"Prepared to update text for {layer_id}"

@tool
def update_text_color(layer_id: str, new_color: str) -> str:
    """Updates the text color of a TextLayer (e.g., 'rgb(0,0,255)' or '#0000FF')."""
    return f"Prepared to update color for {layer_id}"

@tool
def update_image_url(layer_id: str, new_image_url: str) -> str:
    """Replaces the image URL of a FrameLayer or Image layer."""
    return f"Prepared to update image for {layer_id}"

llm = ChatOpenAI(model="gpt-4o", temperature=0).bind_tools([
    update_text_content, update_text_color, update_image_url
])


4.4. The JSON Pruner (Token Optimization)
python
def prune_json_for_ai(template_json: dict) -> dict:
    """Converts heavy production JSON into a lightweight, AI-friendly schema."""
    ai_context = {"layers": {}}
    layers_dict = template_json.get("layers", {})
    
    for layer_id, layer_data in layers_dict.items():
        if layer_id == "ROOT":
            continue
            
        layer_type = layer_data.get("type", {}).get("resolvedName", "Unknown")
        ai_label = layer_data.get("ai_label", f"{layer_type}")
        
        editable_props = {"id": layer_id, "type": layer_type, "ai_label": ai_label}
        
        # Extract Text Properties safely
        if layer_type == "TextLayer":
            try:
                content_node = layer_data["props"]["doc"]["content"][0]
                editable_props["editable"] = {
                    "text": content_node["content"][0]["text"],
                    "color": content_node["attrs"]["color"],
                    "fontSize": content_node["attrs"]["fontSize"]
                }
            except (KeyError, IndexError):
                pass
                
        # Extract Image Properties safely
        elif "image" in layer_data.get("props", {}):
            try:
                editable_props["editable"] = {
                    "imageUrl": layer_data["props"]["image"]["url"]
                }
            except KeyError:
                pass

        ai_context["layers"][layer_id] = editable_props
        
    return ai_context


4.5. The Custom Mutation Node (Safe Patching)
python
def custom_tools_node(state: AgentState):
    # Deep copy to prevent mutating the original request object
    current_json = copy.deepcopy(state["template_json"])
    last_message = state["messages"][-1]
    tool_calls = getattr(last_message, "tool_calls", [])
    tool_messages = []
    
    for tc in tool_calls:
        func_name = tc["name"]
        args = tc["args"]
        layer_id = args.get("layer_id")
        
        layer = current_json["layers"].get(layer_id)
        result_msg = ""
        
        if not layer:
            result_msg = f"Error: Layer {layer_id} not found."
            
        elif func_name == "update_text_content":
            layer["type"]["replacableText"] = args["new_text"]
            layer["props"]["doc"]["content"][0]["content"][0]["text"] = args["new_text"]
            result_msg = f"Success: Updated text to '{args['new_text']}'."
            
        elif func_name == "update_text_color":
            new_color = args["new_color"]
            layer["props"]["doc"]["content"][0]["attrs"]["color"] = new_color
            if "colors" in layer["props"] and len(layer["props"]["colors"]) > 0:
                layer["props"]["colors"][0] = new_color
            result_msg = f"Success: Updated color to {new_color}."
            
        elif func_name == "update_image_url":
            layer["props"]["image"]["url"] = args["new_image_url"]
            layer["props"]["image"]["thumb"] = args["new_image_url"]
            result_msg = f"Success: Updated image URL."
            
        tool_messages.append(ToolMessage(content=result_msg, tool_call_id=tc["id"]))

    return {"template_json": current_json, "messages": tool_messages}


4.6. Graph Construction & Routing
python
def agent_node(state: AgentState):
    ai_context_json = prune_json_for_ai(state["template_json"])
    system_msg = SystemMessage(
        content=f"You are an AI design assistant. Here is the editable template structure: {json.dumps(ai_context_json)}. Use the provided tools to update it based on the user's request."
    )
    messages = [system_msg] + state["messages"]
    response = llm.invoke(messages)
    return {"messages": [response]}

def should_continue(state: AgentState) -> Literal["tools", "end"]:
    last_message = state["messages"][-1]
    if getattr(last_message, "tool_calls", None):
        return "tools"
    return "end"

# Build Graph
workflow = StateGraph(AgentState)
workflow.add_node("agent", agent_node)
workflow.add_node("tools", custom_tools_node)

workflow.set_entry_point("agent")
workflow.add_conditional_edges("agent", should_continue, {"tools": "tools", "end": END})
workflow.add_edge("tools", "agent") # Loop back to agent after tool execution

app_graph = workflow.compile()


4.7. FastAPI Endpoint Integration
from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI()

class AIEditRequest(BaseModel):
    user_prompt: str
    template_json: dict

class AIEditResponse(BaseModel):
    updated_json: dict
    ai_message: str

@app.post("/api/ai/edit-template", response_model=AIEditResponse)
async def edit_template(request: AIEditRequest):
    initial_state = {
        "messages": [HumanMessage(content=request.user_prompt)],
        "template_json": request.template_json
    }
    
    # LangGraph handles the agentic loop automatically
    final_state = await app_graph.ainvoke(initial_state)
    
    return AIEditResponse(
        updated_json=final_state["template_json"],
        ai_message=final_state["messages"][-1].content
    )

    
5. Production Readiness & Guardrails
Async Execution: The endpoint uses ainvoke and ChatOpenAI async clients to prevent blocking the FastAPI event loop, ensuring high concurrency.
Deep Copying: copy.deepcopy is used in the mutation node to ensure the original incoming JSON object is never mutated by reference, preventing side effects.
Graceful Degradation: If the LLM hallucinates a layer_id that doesn't exist, the custom_tools_node catches it, returns an "Error: Layer not found" message to the LLM, and the LLM will either retry or inform the user, preventing a 500 server crash.
Color Format Normalization: (Future Enhancement) Add a utility in the update_text_color tool to convert named colors (e.g., "blue") to rgb(0, 0, 255) or hex codes before mutating the JSON, ensuring frontend compatibility.
6. Next Steps for Engineering Team
Environment Setup: Add OPENAI_API_KEY to environment variables.
Schema Audit: Verify that all production templates follow the props.doc.content[0]... structure (or add fallback try/except blocks in the pruner/mutator for edge cases).
Testing: Write unit tests for prune_json_for_ai and custom_tools_node using the provided sample JSON to guarantee zero structural breakage.
Frontend Integration: Update the frontend chat component to send the template_json alongside the prompt and handle the { updated_json, ai_message } response by triggering a canvas re-render.