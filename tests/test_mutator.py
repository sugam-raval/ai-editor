import copy
import json
from pathlib import Path
from app.services.mutator import (
    apply_text_update,
    apply_color_update,
    apply_image_url_update,
    mutate_template,
)


def load_sample_template():
    template_path = Path(__file__).parent / "sample_template.json"
    with open(template_path, "r", encoding="utf-8") as f:
        return json.load(f)


def test_update_text_content():
    template = load_sample_template()
    layer = template["layers"]["layer-headline-001"]
    success, msg = apply_text_update(layer, "Winter Megasale 2026")

    assert success is True
    assert layer["type"]["replacableText"] == "Winter Megasale 2026"
    assert layer["props"]["doc"]["content"][0]["content"][0]["text"] == "Winter Megasale 2026"


def test_update_text_color_hex():
    template = load_sample_template()
    layer = template["layers"]["layer-headline-001"]
    success, msg = apply_color_update(layer, "#00FF00")

    assert success is True
    assert layer["props"]["doc"]["content"][0]["attrs"]["color"] == "#00FF00"
    assert layer["props"]["colors"][0] == "#00FF00"


def test_update_text_color_named_conversion():
    template = load_sample_template()
    layer = template["layers"]["layer-discount-002"]
    success, msg = apply_color_update(layer, "blue")

    assert success is True
    assert layer["props"]["doc"]["content"][0]["attrs"]["color"] == "#0000FF"
    assert layer["props"]["colors"][0] == "#0000FF"


def test_update_image_url():
    template = load_sample_template()
    layer = template["layers"]["layer-image-003"]
    new_url = "https://example.com/new-burger.png"
    success, msg = apply_image_url_update(layer, new_url)

    assert success is True
    assert layer["props"]["image"]["url"] == new_url
    assert layer["props"]["image"]["thumb"] == new_url


def test_mutate_template_deep_copy():
    original = load_sample_template()
    snapshot = copy.deepcopy(original)

    mutated, msg, success = mutate_template(
        original,
        "update_text_content",
        {"layer_id": "layer-discount-002", "new_text": "70% MEGA DISCOUNT"}
    )

    assert success is True
    # Original should be completely untouched
    assert original == snapshot
    # Mutated has change
    assert mutated["layers"]["layer-discount-002"]["type"]["replacableText"] == "70% MEGA DISCOUNT"


def test_mutate_template_missing_layer():
    template = load_sample_template()
    mutated, msg, success = mutate_template(
        template,
        "update_text_content",
        {"layer_id": "non-existent-layer-999", "new_text": "Something"}
    )

    assert success is False
    assert "not found" in msg.lower()

