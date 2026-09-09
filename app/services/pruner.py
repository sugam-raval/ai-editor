from typing import Any, Dict


def prune_json_for_ai(template_json: Any) -> Dict[str, Any]:
    """
    Converts heavy production JSON into a lightweight, AI-friendly schema.
    
    Filters out heavy renderer data (font URLs, matrix transforms, raw SVGs)
    and exposes only editable layers and properties (text, color, fontSize, imageUrl).
    """
    # If template_json is a top-level list (e.g. custom LidoJS template structure), extract the root dict
    if isinstance(template_json, list) and len(template_json) > 0 and isinstance(template_json[0], dict):
        root_data = template_json[0]
    elif isinstance(template_json, dict):
        root_data = template_json
    else:
        return {"layers": {}}

    ai_context: Dict[str, Any] = {"layers": {}}
    layers = root_data.get("layers", {})

    # Convert list format to dict format if needed
    if isinstance(layers, list):
        layers_dict = {item.get("id", f"layer_{idx}"): item for idx, item in enumerate(layers) if isinstance(item, dict)}
    elif isinstance(layers, dict):
        layers_dict = layers
    else:
        return ai_context


    for layer_id, layer_data in layers_dict.items():
        if not isinstance(layer_data, dict):
            continue

        # Skip non-editable ROOT canvas container
        if layer_id == "ROOT":
            continue

        resolved_type = layer_data.get("type")
        if isinstance(resolved_type, dict):
            layer_type = resolved_type.get("resolvedName", "Unknown")
        else:
            layer_type = str(resolved_type) if resolved_type else "Unknown"

        ai_label = layer_data.get("ai_label", layer_data.get("id", f"{layer_type} ({str(layer_id)[:8]})"))

        editable_props: Dict[str, Any] = {
            "id": layer_id,
            "type": layer_type,
            "ai_label": ai_label,
            "editable": {}
        }

        # 1. Safely extract Text Layer Properties
        if layer_type in ("TextLayer", "text"):
            text_extracted = layer_data.get("text")
            color_extracted = layer_data.get("color")
            font_size_extracted = layer_data.get("fontSize")

            try:
                # Primary structure: props -> doc -> content[0]
                content_nodes = layer_data.get("props", {}).get("doc", {}).get("content", [])
                if content_nodes and isinstance(content_nodes, list):
                    first_node = content_nodes[0]
                    attrs = first_node.get("attrs", {})
                    color_extracted = color_extracted or attrs.get("color")
                    font_size_extracted = font_size_extracted or attrs.get("fontSize")

                    # Extract text from child content
                    text_parts = []
                    for child in first_node.get("content", []):
                        if isinstance(child, dict) and "text" in child:
                            text_parts.append(child["text"])
                    if text_parts:
                        text_extracted = "".join(text_parts)
            except Exception:
                pass

            # Fallbacks for alternate text representations
            if text_extracted is None:
                text_extracted = (
                    (layer_data.get("type") if isinstance(layer_data.get("type"), dict) else {}).get("replacableText")
                    or layer_data.get("props", {}).get("text")
                    or layer_data.get("text")
                )
            if color_extracted is None:
                colors = layer_data.get("props", {}).get("colors", [])
                if colors and isinstance(colors, list):
                    color_extracted = colors[0]

            editable_props["editable"]["text"] = text_extracted or ""
            if color_extracted:
                editable_props["editable"]["color"] = color_extracted
            if font_size_extracted:
                editable_props["editable"]["fontSize"] = font_size_extracted

        # 2. Safely extract Image / Frame Layer Properties
        props = layer_data.get("props", {})
        if isinstance(props, dict) and "image" in props:
            image_obj = props.get("image", {})
            if isinstance(image_obj, dict):
                img_url = image_obj.get("url") or image_obj.get("thumb")
                if img_url:
                    editable_props["editable"]["imageUrl"] = img_url
        elif isinstance(props, dict) and "imageUrl" in props:
            editable_props["editable"]["imageUrl"] = props["imageUrl"]
        elif "backgroundColor" in layer_data:
            editable_props["editable"]["backgroundColor"] = layer_data["backgroundColor"]

        ai_context["layers"][layer_id] = editable_props

    return ai_context


