"""
Query generator for converting LogoConfig to semantic search queries.

Transforms structured logo configuration into natural language descriptions
suitable for embedding-based similarity search.
"""

from typing import Optional


# Theme descriptions for richer queries
THEME_DESCRIPTIONS = {
    "modern": "clean, contemporary, sleek design with geometric precision",
    "minimal": "simple, understated, using negative space and clean lines",
    "bold": "strong, impactful, high contrast with commanding presence",
    "elegant": "sophisticated, refined, graceful with premium feel",
    "playful": "fun, energetic, vibrant with friendly personality",
    "tech": "digital, futuristic, innovative with technical aesthetic",
    "vintage": "retro, classic, nostalgic with timeless appeal",
    "organic": "natural, flowing, earthy with organic curves",
}

# Logo type descriptions
TYPE_DESCRIPTIONS = {
    "wordmark": "text-based logo featuring the brand name in stylized typography",
    "lettermark": "monogram or initials-based logo using abbreviated letters",
    "pictorial": "icon or symbol-based logo representing the brand visually",
    "abstract": "geometric or abstract shape logo with symbolic meaning",
    "mascot": "character or mascot-based logo with personality",
    "combination": "combined text and symbol logo with integrated elements",
    "emblem": "badge or seal-style logo with enclosed design",
}

# Shape descriptions
SHAPE_DESCRIPTIONS = {
    "circle": "circular, rounded, enclosed in a perfect circle",
    "hexagon": "hexagonal, six-sided geometric shape",
    "triangle": "triangular, three-pointed geometric form",
    "diamond": "diamond-shaped, rotated square form",
    "star": "star-shaped, pointed radiating design",
    "shield": "shield-shaped, protective badge form",
}


def config_to_query(
    logo_type: Optional[str] = None,
    theme: Optional[str] = None,
    shape: Optional[str] = None,
    primary_color: Optional[str] = None,
    accent_color: Optional[str] = None,
    text: Optional[str] = None,
    description: Optional[str] = None,
    industry: Optional[str] = None,
) -> str:
    """
    Convert logo configuration parameters into a semantic search query.

    Args:
        logo_type: Type of logo (wordmark, lettermark, etc.)
        theme: Visual theme (modern, minimal, etc.)
        shape: Geometric shape (circle, hexagon, etc.)
        primary_color: Primary color (hex or name)
        accent_color: Accent color (hex or name)
        text: Text content in the logo
        description: User-provided description
        industry: Target industry or business type

    Returns:
        Natural language query string for similarity search
    """
    parts = []

    # Start with user description if provided
    if description:
        parts.append(description)

    # Add logo type description
    if logo_type and logo_type in TYPE_DESCRIPTIONS:
        parts.append(TYPE_DESCRIPTIONS[logo_type])
    elif logo_type:
        parts.append(f"{logo_type} style logo")

    # Add theme description
    if theme and theme in THEME_DESCRIPTIONS:
        parts.append(THEME_DESCRIPTIONS[theme])
    elif theme:
        parts.append(f"{theme} aesthetic")

    # Add shape description
    if shape and shape in SHAPE_DESCRIPTIONS:
        parts.append(SHAPE_DESCRIPTIONS[shape])
    elif shape:
        parts.append(f"{shape} shape")

    # Add color information
    colors = []
    if primary_color:
        colors.append(f"primary color {_describe_color(primary_color)}")
    if accent_color:
        colors.append(f"accent color {_describe_color(accent_color)}")
    if colors:
        parts.append(", ".join(colors))

    # Add text if relevant for wordmark/lettermark types
    if text and logo_type in ("wordmark", "lettermark", "combination"):
        parts.append(f"featuring text '{text}'")

    # Add industry context
    if industry:
        parts.append(f"suitable for {industry} industry")

    # Join all parts into a coherent query
    if not parts:
        return "professional logo design"

    return " with ".join(parts[:3]) + (". " + ". ".join(parts[3:]) if len(parts) > 3 else "")


def _describe_color(color: str) -> str:
    """
    Convert a color value to a descriptive string.

    Args:
        color: Color as hex (#RRGGBB) or color name

    Returns:
        Descriptive color string
    """
    # Common color mappings for hex values
    color_names = {
        "#000000": "black",
        "#ffffff": "white",
        "#ff0000": "red",
        "#00ff00": "green",
        "#0000ff": "blue",
        "#ffff00": "yellow",
        "#ff00ff": "magenta",
        "#00ffff": "cyan",
        "#0f172a": "dark navy",
        "#3b82f6": "bright blue",
        "#10b981": "emerald green",
        "#f59e0b": "amber orange",
        "#ef4444": "red",
        "#8b5cf6": "purple",
        "#ec4899": "pink",
        "#6b7280": "gray",
    }

    color_lower = color.lower()
    if color_lower in color_names:
        return color_names[color_lower]

    # If it's a hex color, try to describe it
    if color.startswith("#") and len(color) == 7:
        return _hex_to_description(color)

    # Return as-is if it's already a color name
    return color


def _hex_to_description(hex_color: str) -> str:
    """
    Convert a hex color to a descriptive name.

    Args:
        hex_color: Color in #RRGGBB format

    Returns:
        Descriptive color name
    """
    try:
        r = int(hex_color[1:3], 16)
        g = int(hex_color[3:5], 16)
        b = int(hex_color[5:7], 16)

        # Determine brightness
        brightness = (r * 299 + g * 587 + b * 114) / 1000
        brightness_term = "dark" if brightness < 85 else "light" if brightness > 170 else ""

        # Determine dominant hue
        max_val = max(r, g, b)
        if max_val == 0:
            return "black"
        if r == g == b:
            return f"{brightness_term} gray".strip() if brightness_term else "gray"

        # Determine hue category
        if r >= g and r >= b:
            if g > b:
                hue = "orange" if g > r * 0.5 else "red"
            else:
                hue = "pink" if b > r * 0.3 else "red"
        elif g >= r and g >= b:
            if r > b:
                hue = "yellow-green" if r > g * 0.5 else "green"
            else:
                hue = "teal" if b > g * 0.3 else "green"
        else:  # b is dominant
            if r > g:
                hue = "purple" if r > b * 0.3 else "blue"
            else:
                hue = "cyan" if g > b * 0.3 else "blue"

        return f"{brightness_term} {hue}".strip()

    except (ValueError, IndexError):
        return hex_color


def generate_filter_from_config(
    logo_type: Optional[str] = None,
    theme: Optional[str] = None,
    shape: Optional[str] = None,
) -> Optional[dict]:
    """
    Generate ChromaDB filter conditions from config.

    Args:
        logo_type: Filter by logo type
        theme: Filter by theme
        shape: Filter by shape

    Returns:
        ChromaDB where clause or None if no filters
    """
    conditions = []

    if logo_type:
        conditions.append({"logo_type": {"$eq": logo_type}})
    if theme:
        conditions.append({"theme": {"$eq": theme}})
    if shape:
        conditions.append({"shape": {"$eq": shape}})

    if not conditions:
        return None
    if len(conditions) == 1:
        return conditions[0]

    return {"$and": conditions}
