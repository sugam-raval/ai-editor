import json
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock
import pytest
from httpx import ASGITransport, AsyncClient
from langchain_core.messages import AIMessage

from app.api.routes import set_graph
from app.main import app
from app.services.graph import build_app_graph


def load_sample_template():
    template_path = Path(__file__).parent / "sample_template.json"
    with open(template_path, "r", encoding="utf-8") as f:
        return json.load(f)


@pytest.mark.asyncio
async def test_health_endpoint():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ok"
        assert "version" in data
        assert "openai_configured" in data


@pytest.mark.asyncio
async def test_prune_template_endpoint():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        payload = {"template_json": load_sample_template()}
        response = await client.post("/api/ai/prune-template", json=payload)

        assert response.status_code == 200
        data = response.json()
        assert "pruned_context" in data
        assert data["layer_count"] == 3
        assert "ROOT" not in data["pruned_context"]["layers"]


@pytest.mark.asyncio
async def test_edit_template_agentic_loop():
    # Construct a Mock LLM that simulates an agent tool call followed by a completion response
    class MockLLM:
        def __init__(self):
            self.call_count = 0

        def bind_tools(self, tools):
            return self

        async def ainvoke(self, messages):
            self.call_count += 1
            if self.call_count == 1:
                # Step 1: Agent decides to call update_text_color and update_text_content
                return AIMessage(
                    content="",
                    tool_calls=[
                        {
                            "name": "update_text_color",
                            "args": {
                                "layer_id": "layer-discount-002",
                                "new_color": "blue"
                            },
                            "id": "call_abc_1",
                        },
                        {
                            "name": "update_text_content",
                            "args": {
                                "layer_id": "layer-discount-002",
                                "new_text": "50% MEGA OFF"
                            },
                            "id": "call_abc_2",
                        }
                    ]
                )
            else:
                # Step 2: After tools execute, Agent returns conversational response
                return AIMessage(
                    content="Done! I updated the discount text to '50% MEGA OFF' and changed its color to blue."
                )

    mock_graph = build_app_graph(custom_llm=MockLLM())
    set_graph(mock_graph)

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        payload = {
            "user_prompt": "Change the discount badge to 50% MEGA OFF and make it blue",
            "template_json": load_sample_template(),
        }
        response = await client.post("/api/ai/edit-template", json=payload)

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert "Done! I updated" in data["ai_message"]
        assert len(data["mutations_applied"]) == 2

        # Verify mutated JSON in response
        updated_layers = data["updated_json"]["layers"]
        discount_layer = updated_layers["layer-discount-002"]

        # Text mutated
        assert discount_layer["type"]["replacableText"] == "50% MEGA OFF"
        assert discount_layer["props"]["doc"]["content"][0]["content"][0]["text"] == "50% MEGA OFF"

        # Color mutated & normalized to #0000FF
        assert discount_layer["props"]["doc"]["content"][0]["attrs"]["color"] == "#0000FF"
        assert discount_layer["props"]["colors"][0] == "#0000FF"


@pytest.mark.asyncio
async def test_edit_template_validation_error():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Missing user_prompt
        response = await client.post("/api/ai/edit-template", json={"user_prompt": "", "template_json": {}})
        assert response.status_code == 400


@pytest.mark.asyncio
async def test_edit_template_target_layer_id():
    class MockTargetedLLM:
        def bind_tools(self, tools):
            return self

        async def ainvoke(self, messages):
            # Check if system message includes targeted layer constraint
            sys_msg = messages[0].content
            assert "TARGETED LAYER CONSTRAINTS" in sys_msg
            assert "layer-discount-002" in sys_msg
            return AIMessage(
                content="Updated targeted layer",
                tool_calls=[{
                    "name": "update_text_color",
                    "args": {"layer_id": "layer-discount-002", "new_color": "#ff0000"},
                    "id": "call_target_1"
                }]
            )

    mock_graph = build_app_graph(custom_llm=MockTargetedLLM())
    set_graph(mock_graph)

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        payload = {
            "user_prompt": "make it red",
            "template_json": load_sample_template(),
            "target_layer_id": "layer-discount-002"
        }
        response = await client.post("/api/ai/edit-template", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["ai_message"] == "Updated targeted layer"

