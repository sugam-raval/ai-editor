import copy
import logging
from typing import Any, Dict, Tuple

from .color_utils import normalize_color

logger = logging.getLogger(__name__)


def apply_text_update(layer: Dict[str, Any], new_text: str) -> Tuple[bool, str]:
    """
    Safely mutates the text content of a TextLayer in production JSON.
    Updates replacableText, deep doc node, and optional fallback text properties.
    """
    try:
        # 1. Update replacableText if present in type
        if "type" in layer and isinstance(layer["type"], dict):
            layer["type"]["replacableText"] = new_text

        # 2. Update deep-nested TipTap/ProseMirror doc structure: props.doc.content[0].content[0].text
        props = layer.setdefault("props", {})
        doc = props.setdefault("doc", {})
        content = doc.setdefault("content", [])

        if not content:
            # Reconstruct content node if missing
            content.append({
                "type": "paragraph",
                "attrs": {"color": "#000000", "fontSize": 16},
                "content": [{"type": "text", "text": new_text}]
            })
        else:
            first_content = content[0]
            if not isinstance(first_content, dict):
                first_content = {"type": "paragraph", "content": []}
                content[0] = first_content

            inner_content = first_content.setdefault("content", [])
            if not inner_content:
                inner_content.append({"type": "text", "text": new_text})
            else:
                # Update first text node and collapse trailing spans if replacing full text
                inner_content[0]["text"] = new_text
                if len(inner_content) > 1:
                    inner_content[:] = [inner_content[0]]

        # 3. Fallback direct text prop if used
        if "text" in props:
            props["text"] = new_text

        return True, f"Successfully updated text to '{new_text}'"
    except Exception as e:
        logger.error(f"Error updating text content: {e}")
        return False, f"Failed to update text content: {str(e)}"


def apply_color_update(layer: Dict[str, Any], new_color: str) -> Tuple[bool, str]:
    """
    Safely mutates the text/fill color of a layer in production JSON.
    Normalizes color (e.g. named colors to hex) and updates doc attrs and colors array.
    """
    try:
        norm_color = normalize_color(new_color)
        props = layer.setdefault("props", {})

        # 1. Update deep nested doc attrs: props.doc.content[0].attrs.color
        doc = props.setdefault("doc", {})
        content = doc.setdefault("content", [])
        if not content:
            content.append({
                "type": "paragraph",
                "attrs": {"color": norm_color, "fontSize": 16},
                "content": []
            })
        else:
            first_content = content[0]
            if isinstance(first_content, dict):
                attrs = first_content.setdefault("attrs", {})
                attrs["color"] = norm_color

        # 2. Update colors array if present
        if "colors" in props and isinstance(props["colors"], list) and len(props["colors"]) > 0:
            props["colors"][0] = norm_color
        elif "colors" not in props:
            props["colors"] = [norm_color]

        # 3. Direct color or fill prop if present
        if "color" in props:
            props["color"] = norm_color
        if "fill" in props:
            props["fill"] = norm_color

        return True, f"Successfully updated color to {norm_color}"
    except Exception as e:
        logger.error(f"Error updating color: {e}")
        return False, f"Failed to update color: {str(e)}"


def apply_image_url_update(layer: Dict[str, Any], new_image_url: str) -> Tuple[bool, str]:
    """
    Safely mutates the image URL and thumbnail of an Image or FrameLayer.
    """
    try:
        props = layer.setdefault("props", {})

        # Update props.image.url and thumb
        if "image" in props and isinstance(props["image"], dict):
            props["image"]["url"] = new_image_url
            props["image"]["thumb"] = new_image_url
        else:
            props["image"] = {"url": new_image_url, "thumb": new_image_url}

        # Also update root imageUrl if present
        if "imageUrl" in props:
            props["imageUrl"] = new_image_url

        return True, "Successfully updated image URL"
    except Exception as e:
        logger.error(f"Error updating image URL: {e}")
        return False, f"Failed to update image URL: {str(e)}"


def apply_add_text_layer(template_json: Any, args: Dict[str, Any]) -> Tuple[Any, str, bool]:
    """
    Adds a brand new TextLayer to template_json.
    Supports LidoJS dict layer objects (with ROOT parent/child) and simple list/dict formats.
    """
    try:
        # Unwrap top-level array if present
        if isinstance(template_json, list) and len(template_json) > 0 and isinstance(template_json[0], dict):
            root_data = template_json[0]
        elif isinstance(template_json, dict):
            root_data = template_json
        else:
            return template_json, "Error: Invalid template structure for adding layer.", False

        layers = root_data.setdefault("layers", {})
        existing_count = len(layers) if isinstance(layers, list) else len(layers.keys())
        layer_id = args.get("layer_id") or f"text_layer_{existing_count + 1}"
        text = args.get("text", "New Text Element")
        x = float(args.get("x", 200))
        y = float(args.get("y", 200))
        color = normalize_color(args.get("color", "#000000"))
        font_size = float(args.get("font_size", 32))
        width = float(args.get("width", 300))
        height = float(args.get("height", 60))

        if isinstance(layers, dict):
            is_lido_js = "ROOT" in layers or any(isinstance(v, dict) and "type" in v for v in layers.values())

            if is_lido_js:
                new_layer = {
                    "type": {
                        "resolvedName": "TextLayer",
                        "type": "customText",
                        "replacableText": text,
                        "fixedText": ""
                    },
                    "child": [],
                    "props": {
                        "doc": {
                            "type": "doc",
                            "content": [
                                {
                                    "type": "paragraph",
                                    "attrs": {
                                        "color": color,
                                        "fontSize": f"{font_size}px",
                                        "fontFamily": "Roboto",
                                        "textAlign": "left"
                                    },
                                    "content": [
                                        {
                                            "type": "text",
                                            "text": text,
                                            "marks": [
                                                {
                                                    "type": "color",
                                                    "attrs": {"color": color}
                                                }
                                            ]
                                        }
                                    ]
                                }
                            ]
                        },
                        "colors": [color],
                        "fontSizes": [font_size],
                        "position": {"x": x, "y": y},
                        "boxSize": {"x": x, "y": y, "width": width, "height": height},
                        "rotate": 0,
                        "scale": 1.0
                    },
                    "locked": False,
                    "parent": "ROOT"
                }
                layers[layer_id] = new_layer

                # Attach to ROOT child list so LidoJS canvas renders it
                if "ROOT" in layers and isinstance(layers["ROOT"], dict):
                    root_layer = layers["ROOT"]
                    child_list = root_layer.setdefault("child", [])
                    if isinstance(child_list, list) and layer_id not in child_list:
                        child_list.append(layer_id)
            else:
                layers[layer_id] = {
                    "id": layer_id,
                    "type": "text",
                    "x": x,
                    "y": y,
                    "width": width,
                    "height": height,
                    "text": text,
                    "color": color,
                    "fontSize": font_size
                }

        elif isinstance(layers, list):
            layers.append({
                "id": layer_id,
                "type": "text",
                "x": x,
                "y": y,
                "width": width,
                "height": height,
                "text": text,
                "color": color,
                "fontSize": font_size
            })

        return template_json, f"Successfully created new text layer '{layer_id}' at x:{x}, y:{y} with text '{text}'", True
    except Exception as e:
        logger.error(f"Error adding new text layer: {e}")
        return template_json, f"Failed to add new text layer: {str(e)}", False


def apply_move_layer(layer: Dict[str, Any], x: int, y: int) -> Tuple[bool, str]:
    """
    Updates coordinates x and y of a layer (supporting direct x/y and LidoJS props.position).
    """
    try:
        layer["x"] = int(x)
        layer["y"] = int(y)
        props = layer.setdefault("props", {})
        if isinstance(props, dict):
            position = props.setdefault("position", {})
            if isinstance(position, dict):
                position["x"] = float(x)
                position["y"] = float(y)
            box_size = props.setdefault("boxSize", {})
            if isinstance(box_size, dict):
                box_size["x"] = float(x)
                box_size["y"] = float(y)
        return True, f"Moved layer to x:{x}, y:{y}"
    except Exception as e:
        logger.error(f"Error moving layer: {e}")
        return False, f"Failed to move layer: {str(e)}"


def apply_delete_layer(root_data: Dict[str, Any], layer_id: str) -> Tuple[bool, str]:
    """
    Deletes a layer by layer_id from root_data layers list or dict (and removes from ROOT child list).
    """
    try:
        layers = root_data.get("layers")
        if isinstance(layers, dict) and layer_id in layers:
            del layers[layer_id]
            if "ROOT" in layers and isinstance(layers["ROOT"], dict):
                child_list = layers["ROOT"].get("child", [])
                if isinstance(child_list, list) and layer_id in child_list:
                    child_list.remove(layer_id)
            return True, f"Successfully deleted layer '{layer_id}'"
        elif isinstance(layers, list):
            initial_len = len(layers)
            root_data["layers"] = [l for l in layers if isinstance(l, dict) and l.get("id") != layer_id]
            if len(root_data["layers"]) < initial_len:
                return True, f"Successfully deleted layer '{layer_id}'"
        return False, f"Layer '{layer_id}' not found for deletion"
    except Exception as e:
        logger.error(f"Error deleting layer: {e}")
        return False, f"Failed to delete layer: {str(e)}"


def mutate_template(template_json: Any, func_name: str, args: Dict[str, Any]) -> Tuple[Any, str, bool]:
    """
    Performs safe mutation on a deep copy of the template JSON.
    Returns (mutated_json, result_message, is_success).
    """
    current_json = copy.deepcopy(template_json)

    # Unwrap top-level array if present
    if isinstance(current_json, list) and len(current_json) > 0 and isinstance(current_json[0], dict):
        root_data = current_json[0]
    elif isinstance(current_json, dict):
        root_data = current_json
    else:
        return current_json, "Error: Invalid template_json structure.", False

    if func_name == "add_new_text":
        return apply_add_text_layer(current_json, args)

    layer_id = args.get("layer_id")
    if not layer_id:
        return current_json, "Error: layer_id argument is required.", False

    if func_name == "delete_layer":
        success, msg = apply_delete_layer(root_data, layer_id)
        return current_json, msg, success

    layers = root_data.get("layers")
    layer = None

    if isinstance(layers, dict) and layer_id in layers:
        layer = layers[layer_id]
    elif isinstance(layers, list):
        for l in layers:
            if isinstance(l, dict) and l.get("id") == layer_id:
                layer = l
                break

    if layer is None:
        return current_json, f"Error: Layer '{layer_id}' not found in template.", False

    if func_name == "update_text_content":
        new_text = args.get("new_text", "")
        if "text" in layer:
            layer["text"] = new_text
        success, msg = apply_text_update(layer, new_text)
        return current_json, msg, success

    elif func_name == "update_text_color":
        new_color = args.get("new_color", "")
        norm = normalize_color(new_color)
        if "color" in layer:
            layer["color"] = norm
        if "backgroundColor" in layer:
            layer["backgroundColor"] = norm
        success, msg = apply_color_update(layer, new_color)
        return current_json, msg, success

    elif func_name == "update_image_url":
        new_image_url = args.get("new_image_url", "")
        if "imageUrl" in layer:
            layer["imageUrl"] = new_image_url
        success, msg = apply_image_url_update(layer, new_image_url)
        return current_json, msg, success

    elif func_name == "move_layer":
        x = args.get("x", layer.get("x", 0))
        y = args.get("y", layer.get("y", 0))
        success, msg = apply_move_layer(layer, x, y)
        return current_json, msg, success

    else:
        return current_json, f"Error: Unsupported tool '{func_name}'.", False




