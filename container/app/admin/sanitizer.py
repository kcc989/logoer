"""
SVG sanitization for secure logo ingestion.

Removes potentially dangerous elements and attributes from SVG files
to prevent XSS and other security vulnerabilities.
"""

import re
from xml.etree import ElementTree as ET


class SVGSanitizationError(Exception):
    """Raised when SVG sanitization fails."""

    pass


# Allowed SVG elements (whitelist approach)
ALLOWED_ELEMENTS = {
    "svg",
    "g",
    "path",
    "rect",
    "circle",
    "ellipse",
    "line",
    "polyline",
    "polygon",
    "text",
    "tspan",
    "defs",
    "linearGradient",
    "radialGradient",
    "stop",
    "clipPath",
    "mask",
    "use",
    "symbol",
    "title",
    "desc",
    "metadata",
    "style",
    "font",
    "font-face",
    "glyph",
    "missing-glyph",
}

# Dangerous attributes to remove
DANGEROUS_ATTRIBUTES = {
    "onload",
    "onerror",
    "onclick",
    "onmouseover",
    "onmouseout",
    "onmousedown",
    "onmouseup",
    "onfocus",
    "onblur",
    "onkeydown",
    "onkeyup",
    "onkeypress",
    "onchange",
    "onsubmit",
    "onreset",
    "onselect",
    "onabort",
}

# Patterns for dangerous content in attributes
DANGEROUS_PATTERNS = [
    re.compile(r"javascript:", re.IGNORECASE),
    re.compile(r"data:", re.IGNORECASE),
    re.compile(r"vbscript:", re.IGNORECASE),
]


def sanitize_svg(svg_content: str) -> str:
    """
    Sanitize an SVG string to remove potentially dangerous content.

    Args:
        svg_content: The raw SVG content

    Returns:
        Sanitized SVG content

    Raises:
        SVGSanitizationError: If the SVG cannot be parsed or sanitized
    """
    if not svg_content or not svg_content.strip():
        raise SVGSanitizationError("Empty SVG content")

    # Basic validation
    content = svg_content.strip()
    if not content.startswith("<svg") and not content.startswith("<?xml"):
        raise SVGSanitizationError("Content does not appear to be SVG")

    try:
        # Parse the SVG
        # Handle namespace prefixes
        content = _normalize_namespaces(content)
        root = ET.fromstring(content)

        # Sanitize the tree
        _sanitize_element(root)

        # Convert back to string
        result = ET.tostring(root, encoding="unicode")

        # Re-add XML declaration if it was present
        if svg_content.strip().startswith("<?xml"):
            result = '<?xml version="1.0" encoding="UTF-8"?>\n' + result

        return result

    except ET.ParseError as e:
        raise SVGSanitizationError(f"Failed to parse SVG: {e}")


def _normalize_namespaces(content: str) -> str:
    """Normalize SVG namespace declarations."""
    # Add SVG namespace if missing
    if 'xmlns="http://www.w3.org/2000/svg"' not in content:
        content = content.replace("<svg", '<svg xmlns="http://www.w3.org/2000/svg"', 1)
    return content


def _sanitize_element(element: ET.Element) -> None:
    """
    Recursively sanitize an XML element.

    Args:
        element: The element to sanitize (modified in place)
    """
    # Get the tag name without namespace
    tag = element.tag.split("}")[-1] if "}" in element.tag else element.tag

    # Remove elements not in whitelist
    children_to_remove = []
    for child in element:
        child_tag = child.tag.split("}")[-1] if "}" in child.tag else child.tag
        if child_tag.lower() not in ALLOWED_ELEMENTS:
            children_to_remove.append(child)
        else:
            _sanitize_element(child)

    for child in children_to_remove:
        element.remove(child)

    # Remove dangerous attributes
    attrs_to_remove = []
    for attr in element.attrib:
        attr_name = attr.split("}")[-1] if "}" in attr else attr
        if attr_name.lower() in DANGEROUS_ATTRIBUTES:
            attrs_to_remove.append(attr)
        else:
            # Check attribute value for dangerous patterns
            value = element.attrib[attr]
            for pattern in DANGEROUS_PATTERNS:
                if pattern.search(value):
                    attrs_to_remove.append(attr)
                    break

    for attr in attrs_to_remove:
        del element.attrib[attr]

    # Sanitize text content in style elements
    if tag.lower() == "style" and element.text:
        element.text = _sanitize_css(element.text)


def _sanitize_css(css: str) -> str:
    """
    Sanitize CSS content within style elements.

    Args:
        css: The CSS content

    Returns:
        Sanitized CSS
    """
    # Remove expressions and url() with javascript/data
    sanitized = css

    # Remove expression() - IE-specific XSS vector
    sanitized = re.sub(r"expression\s*\([^)]*\)", "", sanitized, flags=re.IGNORECASE)

    # Remove url() with javascript/data protocols
    def sanitize_url(match):
        url = match.group(1)
        for pattern in DANGEROUS_PATTERNS:
            if pattern.search(url):
                return ""
        return match.group(0)

    sanitized = re.sub(r"url\s*\(\s*([^)]*)\s*\)", sanitize_url, sanitized, flags=re.IGNORECASE)

    return sanitized


def validate_svg_structure(svg_content: str) -> dict:
    """
    Validate SVG structure and extract basic metadata.

    Args:
        svg_content: The SVG content to validate

    Returns:
        Dictionary with validation results and metadata
    """
    result = {
        "valid": False,
        "has_viewbox": False,
        "has_dimensions": False,
        "element_count": 0,
        "errors": [],
    }

    try:
        root = ET.fromstring(svg_content)

        # Check root element
        tag = root.tag.split("}")[-1] if "}" in root.tag else root.tag
        if tag.lower() != "svg":
            result["errors"].append("Root element is not <svg>")
            return result

        # Check for viewBox
        result["has_viewbox"] = "viewBox" in root.attrib

        # Check for dimensions
        result["has_dimensions"] = "width" in root.attrib and "height" in root.attrib

        # Count elements
        result["element_count"] = sum(1 for _ in root.iter())

        result["valid"] = True

    except ET.ParseError as e:
        result["errors"].append(f"Parse error: {e}")

    return result
