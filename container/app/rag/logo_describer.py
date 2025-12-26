"""
Claude Vision logo description generator.

Uses Claude's vision capabilities to generate detailed descriptions
of logos for semantic embedding and similarity search.
"""

import anthropic

from .svg_to_png import svg_to_base64_png


LOGO_DESCRIPTION_PROMPT = """Analyze this logo image and provide a detailed description suitable for similarity search.

Include the following aspects in your description:
1. **Visual Style**: Is it modern, vintage, minimalist, bold, elegant, playful, etc.?
2. **Type**: Is it a wordmark, lettermark, pictorial mark, abstract mark, mascot, combination mark, or emblem?
3. **Shape**: What geometric shapes are prominent (circle, square, triangle, hexagon, etc.)?
4. **Colors**: Describe the color palette and any gradients
5. **Typography**: If text is present, describe the font style (serif, sans-serif, script, etc.)
6. **Mood/Feeling**: What emotion or brand personality does it convey?
7. **Industry Fit**: What industries or businesses might use this style of logo?

Provide a single cohesive paragraph (2-4 sentences) that captures the essence of this logo design. Focus on visual characteristics that would help find similar logos. Do not speculate about the brand name or what company it belongs to."""


async def describe_logo(
    svg_content: str,
    api_key: str,
    model: str = "claude-sonnet-4-20250514",
) -> str:
    """
    Generate a detailed description of a logo using Claude Vision.

    Args:
        svg_content: The SVG logo content as a string
        api_key: Anthropic API key
        model: Claude model to use (default: claude-sonnet-4-20250514)

    Returns:
        A detailed text description of the logo suitable for embedding
    """
    # Convert SVG to base64 PNG for vision analysis
    png_base64 = svg_to_base64_png(svg_content, width=512, height=512, scale=2.0)

    client = anthropic.Anthropic(api_key=api_key)

    message = client.messages.create(
        model=model,
        max_tokens=500,
        messages=[
            {
                "role": "user",
                "content": [
                    {
                        "type": "image",
                        "source": {
                            "type": "base64",
                            "media_type": "image/png",
                            "data": png_base64,
                        },
                    },
                    {
                        "type": "text",
                        "text": LOGO_DESCRIPTION_PROMPT,
                    },
                ],
            }
        ],
    )

    # Extract the text content from the response
    return message.content[0].text


def describe_logo_sync(
    svg_content: str,
    api_key: str,
    model: str = "claude-sonnet-4-20250514",
) -> str:
    """
    Synchronous version of describe_logo.

    Args:
        svg_content: The SVG logo content as a string
        api_key: Anthropic API key
        model: Claude model to use

    Returns:
        A detailed text description of the logo
    """
    # Convert SVG to base64 PNG for vision analysis
    png_base64 = svg_to_base64_png(svg_content, width=512, height=512, scale=2.0)

    client = anthropic.Anthropic(api_key=api_key)

    message = client.messages.create(
        model=model,
        max_tokens=500,
        messages=[
            {
                "role": "user",
                "content": [
                    {
                        "type": "image",
                        "source": {
                            "type": "base64",
                            "media_type": "image/png",
                            "data": png_base64,
                        },
                    },
                    {
                        "type": "text",
                        "text": LOGO_DESCRIPTION_PROMPT,
                    },
                ],
            }
        ],
    )

    return message.content[0].text
