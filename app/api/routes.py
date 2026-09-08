import logging
from typing import Optional

from fastapi import APIRouter, HTTPException, status
from langchain_core.messages import HumanMessage

from app.config import settings
from app.models.schemas import (
    AIEditRequest,
    AIEditResponse,
    HealthResponse,
    PruneRequest,
    PruneResponse,
)
from app.services.graph import build_app_graph
from app.services.pruner import prune_json_for_ai

logger = logging.getLogger(__name__)

router = APIRouter()

# Cached graph instance
_graph_instance = None


def get_graph():
    global _graph_instance
    if _graph_instance is None:
        _graph_instance = build_app_graph()
    return _graph_instance


def set_graph(custom_graph):
    """Allows setting a mock or customized graph for testing."""
    global _graph_instance
    _graph_instance = custom_graph


@router.get(
    "/health",
    response_model=HealthResponse,
    summary="Health check",
    tags=["System"],
)
async def health_check():
    """Returns the operational status and LLM configuration status."""
    has_api_key = bool(settings.openai_api_key and settings.openai_api_key.strip())
    return HealthResponse(
        status="ok",
        version="1.0.0",
        openai_configured=has_api_key,
        model_name=settings.openai_model_name,
        environment=settings.environment,
    )


@router.post(
    "/api/ai/prune-template",
    response_model=PruneResponse,
    summary="Prune template for AI context",
    tags=["Template AI"],
)
async def prune_template_endpoint(request: PruneRequest):
    """
    Returns the token-optimized lightweight JSON that is passed to the LLM.
    Useful for frontend previews, debugging, and testing layer extraction.
    """
    if not isinstance(request.template_json, dict):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="template_json must be a valid dictionary.",
        )

    pruned = prune_json_for_ai(request.template_json)
    layer_count = len(pruned.get("layers", {}))

    return PruneResponse(
        pruned_context=pruned,
        layer_count=layer_count,
    )


@router.post(
    "/api/ai/edit-template",
    response_model=AIEditResponse,
    summary="Edit template via AI agentic loop",
    tags=["Template AI"],
)
async def edit_template_endpoint(request: AIEditRequest):
    """
    Primary agentic endpoint:
    1. Prunes the incoming template to reduce token overhead.
    2. Runs the LangGraph agent loop.
    3. The LLM translates instructions into safe tool calls.
    4. Mutates deep properties in a clean copy of the production JSON.
    5. Returns the updated JSON and a conversational explanation.
    """
    if not isinstance(request.template_json, dict):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="template_json must be a valid dictionary.",
        )

    if not request.user_prompt or not request.user_prompt.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="user_prompt cannot be empty.",
        )

    # Check if OpenAI is configured or mock mode enabled
    has_api_key = bool(settings.openai_api_key and settings.openai_api_key.strip())
    if not has_api_key and not settings.enable_mock_mode and _graph_instance is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=(
                "OpenAI API key is not configured. Please set OPENAI_API_KEY in the .env "
                "file or start with ENABLE_MOCK_MODE=true."
            ),
        )

    initial_state = {
        "messages": [HumanMessage(content=request.user_prompt)],
        "template_json": request.template_json,
        "mutations_applied": [],
    }

    try:
        graph = get_graph()
        final_state = await graph.ainvoke(initial_state)

        last_message = final_state["messages"][-1]
        ai_message_content = (
            last_message.content if hasattr(last_message, "content") else str(last_message)
        )

        return AIEditResponse(
            updated_json=final_state["template_json"],
            ai_message=ai_message_content,
            success=True,
            mutations_applied=final_state.get("mutations_applied", []),
        )
    except Exception as e:
        logger.exception("Error executing template editing workflow")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Template editing failed: {str(e)}",
        )
