"""
SVG to PNG conversion utility for Claude Vision analysis.

Uses CairoSVG to render SVG files to PNG format for vision model processing.
"""

import base64
import io
from typing import Optional

import cairosvg
from PIL import Image


def svg_to_png(
    svg_content: str,
    width: Optional[int] = None,
    height: Optional[int] = None,
    scale: float = 1.0,
) -> bytes:
    """
    Convert SVG content to PNG bytes.

    Args:
        svg_content: The SVG content as a string
        width: Optional output width in pixels
        height: Optional output height in pixels
        scale: Scale factor for the output (default 1.0)

    Returns:
        PNG image as bytes
    """
    png_bytes = cairosvg.svg2png(
        bytestring=svg_content.encode("utf-8"),
        output_width=width,
        output_height=height,
        scale=scale,
    )
    return png_bytes


def svg_to_base64_png(
    svg_content: str,
    width: Optional[int] = 512,
    height: Optional[int] = 512,
    scale: float = 2.0,
) -> str:
    """
    Convert SVG content to a base64-encoded PNG string.

    This format is suitable for sending to Claude Vision API.

    Args:
        svg_content: The SVG content as a string
        width: Output width in pixels (default 512)
        height: Output height in pixels (default 512)
        scale: Scale factor for quality (default 2.0 for retina)

    Returns:
        Base64-encoded PNG string (without data URI prefix)
    """
    png_bytes = svg_to_png(svg_content, width=width, height=height, scale=scale)
    return base64.b64encode(png_bytes).decode("utf-8")


def optimize_png_for_vision(png_bytes: bytes, max_size: int = 1024) -> bytes:
    """
    Optimize a PNG image for vision model processing.

    Resizes large images while maintaining aspect ratio.

    Args:
        png_bytes: The PNG image as bytes
        max_size: Maximum dimension (width or height) in pixels

    Returns:
        Optimized PNG bytes
    """
    img = Image.open(io.BytesIO(png_bytes))

    # Calculate new dimensions maintaining aspect ratio
    width, height = img.size
    if width > max_size or height > max_size:
        if width > height:
            new_width = max_size
            new_height = int(height * (max_size / width))
        else:
            new_height = max_size
            new_width = int(width * (max_size / height))
        img = img.resize((new_width, new_height), Image.Resampling.LANCZOS)

    # Convert to bytes
    buffer = io.BytesIO()
    img.save(buffer, format="PNG", optimize=True)
    return buffer.getvalue()
