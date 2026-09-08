from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class AIEditRequest(BaseModel):
    """Incoming request payload for editing a template."""
    user_prompt: str = Field(
        ...,
        description="Natural language instruction from the user detailing edits.",
        examples=["Change the discount badge text to 50% OFF and make it red."]
    )
    template_json: Dict[str, Any] = Field(
        ...,
        description="Full production template JSON to be safely mutated."
    )


class AIEditResponse(BaseModel):
    """Response payload containing the mutated JSON and AI explanation."""
    updated_json: Dict[str, Any] = Field(
        ...,
        description="Updated production template JSON with mutations applied."
    )
    ai_message: str = Field(
        ...,
        description="Conversational response from the AI explaining the modifications."
    )
    success: bool = Field(
        default=True,
        description="Whether the edit operation was successfully executed."
    )
    mutations_applied: List[str] = Field(
        default_factory=list,
        description="List of mutation events performed during the edit loop."
    )


class PruneRequest(BaseModel):
    """Request payload to inspect the pruned template context sent to the AI."""
    template_json: Dict[str, Any] = Field(
        ...,
        description="Full production template JSON to prune."
    )


class PruneResponse(BaseModel):
    """Response payload showing the pruned AI context."""
    pruned_context: Dict[str, Any] = Field(
        ...,
        description="Lightweight schema optimized for LLM token usage."
    )
    layer_count: int = Field(
        ...,
        description="Number of editable layers extracted."
    )


class HealthResponse(BaseModel):
    """Service health and diagnostic status."""
    model_config = {"protected_namespaces": ()}

    status: str = "ok"
    version: str = "1.0.0"
    openai_configured: bool
    model_name: str
    environment: str
