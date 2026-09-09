import json
import pytest
from app.services.pruner import prune_json_for_ai
from app.services.mutator import mutate_template


def test_custom_template_pruning():
    with open("tests/custom_template.json", "r") as f:
        custom_data = json.load(f)

    pruned = prune_json_for_ai(custom_data)
    assert "layers" in pruned
    layers = pruned["layers"]
    assert len(layers) > 0

    # Check website layer extracted
    target_id = "e7f4321f-34c1-442a-8690-74037e3bf30d"
    assert target_id in layers
    website_layer = layers[target_id]
    assert website_layer["editable"]["text"] == "www.reallygreatsite.com"


def test_custom_template_mutation():
    with open("tests/custom_template.json", "r") as f:
        custom_data = json.load(f)

    target_id = "e7f4321f-34c1-442a-8690-74037e3bf30d"
    updated_json, msg, success = mutate_template(
        custom_data,
        "update_text_content",
        {"layer_id": target_id, "new_text": "www.mycustomdomain.com"}
    )

    assert success is True
    # Verify mutation in array-wrapped structure
    root = updated_json[0]
    layer = root["layers"][target_id]
    doc_content = layer["props"]["doc"]["content"][0]["content"][0]["text"]
    assert doc_content == "www.mycustomdomain.com"
