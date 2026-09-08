import re
from typing import Optional

try:
    import webcolors
except ImportError:
    webcolors = None

# Fallback basic color map in case webcolors isn't available
BASIC_COLOR_MAP = {
    "black": "#000000",
    "white": "#FFFFFF",
    "red": "#FF0000",
    "green": "#008000",
    "blue": "#0000FF",
    "yellow": "#FFFF00",
    "cyan": "#00FFFF",
    "magenta": "#FF00FF",
    "orange": "#FFA500",
    "purple": "#800080",
    "pink": "#FFC0CB",
    "gray": "#808080",
    "grey": "#808080",
    "silver": "#C0C0C0",
    "gold": "#FFD700",
    "navy": "#000080",
    "teal": "#008080",
    "lime": "#00FF00",
    "maroon": "#800000",
    "olive": "#808000",
    "aqua": "#00FFFF",
    "brown": "#A52A2A",
    "coral": "#FF7F50",
    "indigo": "#4B0082",
    "violet": "#EE82EE",
}

HEX_REGEX = re.compile(r"^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$")
RGB_REGEX = re.compile(r"^rgba?\s*\(\s*\d+\s*,\s*\d+\s*,\s*\d+(\s*,\s*[\d.]+\s*)?\)$", re.IGNORECASE)


def normalize_color(color_input: str) -> str:
    """
    Normalizes a color string from natural language or hex/rgb into standard CSS format.

    - Hex values like '#ff0000' or '#FFF' are validated and formatted.
    - RGB/RGBA values like 'rgb(255, 0, 0)' are trimmed and validated.
    - Named colors like 'blue' are converted to hex '#0000FF'.
    """
    if not color_input or not isinstance(color_input, str):
        return color_input

    cleaned = color_input.strip()

    # If it's already a valid hex string
    if HEX_REGEX.match(cleaned):
        return cleaned.upper() if len(cleaned) == 7 else cleaned

    # If it's already a valid rgb/rgba string
    if RGB_REGEX.match(cleaned):
        return cleaned

    # Try mapping name to hex
    color_name = cleaned.lower().replace(" ", "")

    if webcolors:
        try:
            return webcolors.name_to_hex(color_name).upper()
        except (ValueError, AttributeError):
            pass

    if color_name in BASIC_COLOR_MAP:
        return BASIC_COLOR_MAP[color_name]

    # If unable to normalize, return the original string to avoid throwing exceptions
    return cleaned
