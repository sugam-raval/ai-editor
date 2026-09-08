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


def mutate_template(template_json: Dict[str, Any], func_name: str, args: Dict[str, Any]) -> Tuple[Dict[str, Any], str, bool]:
    """
    Performs safe mutation on a deep copy of the template JSON.
    Returns (mutated_json, result_message, is_success).
    """
    current_json = copy.deepcopy(template_json)
    layer_id = args.get("layer_id")
    if not layer_id:
        return current_json, "Error: layer_id argument is required.", False

    layers = current_json.get("layers", {})
    if not isinstance(layers, dict) or layer_id not in layers:
        return current_json, f"Error: Layer {layer_id} not found in template.", False

    layer = layers[layer_id]

    if func_name == "update_text_content":
        new_text = args.get("new_text", "")
        success, msg = apply_text_update(layer, new_text)
        return current_json, msg, success

    elif func_name == "update_text_color":
        new_color = args.get("new_color", "")
        success, msg = apply_color_update(layer, new_color)
        return current_json, msg, success

    elif func_name == "update_image_url":
        new_image_url = args.get("new_image_url", "")
        success, msg = apply_image_url_update(layer, new_image_url)
        return current_json, msg, success

    else:
        return current_json, f"Error: Unsupported tool '{func_name}'.", False
