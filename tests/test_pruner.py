import json
from pathlib import Path
from app.services.pruner import prune_json_for_ai


def load_sample_template():
    template_path = Path(__file__).parent / "sample_template.json"
    with open(template_path, "r", encoding="utf-8") as f:
        return json.load(f)


def test_prune_json_skips_root():
    template = load_sample_template()
    pruned = prune_json_for_ai(template)
    assert "ROOT" not in pruned["layers"]


def test_prune_json_extracts_text_layers():
    template = load_sample_template()
    pruned = prune_json_for_ai(template)

    headline = pruned["layers"].get("layer-headline-001")
    assert headline is not None
    assert headline["id"] == "layer-headline-001"
    assert headline["type"] == "TextLayer"
    assert headline["ai_label"] == "Main Headline"
    assert headline["editable"]["text"] == "Summer Super Sale"
    assert headline["editable"]["color"] == "#1F2937"
    assert headline["editable"]["fontSize"] == 36

    discount = pruned["layers"].get("layer-discount-002")
    assert discount is not None
    assert discount["editable"]["text"] == "30% OFF"
    assert discount["editable"]["color"] == "#DC2626"


def test_prune_json_extracts_image_layers():
    template = load_sample_template()
    pruned = prune_json_for_ai(template)

    img_layer = pruned["layers"].get("layer-image-003")
    assert img_layer is not None
    assert img_layer["type"] == "FrameLayer"
    assert img_layer["ai_label"] == "Middle Food Image"
    assert "imageUrl" in img_layer["editable"]
    assert "unsplash.com" in img_layer["editable"]["imageUrl"]


def test_prune_json_token_reduction():
    template = load_sample_template()
    pruned = prune_json_for_ai(template)

    raw_len = len(json.dumps(template))
    pruned_len = len(json.dumps(pruned))
    # Pruned JSON should be significantly smaller
    assert pruned_len < raw_len * 0.7


def test_prune_json_handles_malformed_layers():
    malformed_template = {
        "layers": {
            "bad_1": None,
            "bad_2": {},
            "bad_text": {"type": {"resolvedName": "TextLayer"}},
            "bad_image": {"props": {"image": None}},
        }
    }
    pruned = prune_json_for_ai(malformed_template)
    assert isinstance(pruned, dict)
    assert "layers" in pruned
    assert "bad_text" in pruned["layers"]
