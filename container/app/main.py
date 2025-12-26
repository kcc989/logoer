"""
Logo Agent Container - FastAPI application for SVG logo generation.

This container is called from the Cloudflare Worker to generate logos
using the Node.js logo generation script.
"""

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from typing import Optional
import subprocess
import json
import tempfile
import os

app = FastAPI(
    title="Logo Agent",
    description="AI-powered SVG logo generation service",
    version="1.0.0",
)


class ColorConfig(BaseModel):
    primary: Optional[str] = "#0f172a"
    accent: Optional[str] = "#3b82f6"


class TypographyConfig(BaseModel):
    fontSize: Optional[int] = 48
    letterSpacing: Optional[int] = 4
    fontWeight: Optional[str] = "bold"
    fontFamily: Optional[str] = "Arial, sans-serif"


class LogoConfig(BaseModel):
    type: Optional[str] = Field(
        default="wordmark",
        description="Logo type: wordmark, lettermark, pictorial, abstract, mascot, combination, emblem",
    )
    text: Optional[str] = Field(default="BRAND", description="Text to display in the logo")
    shape: Optional[str] = Field(
        default="circle",
        description="Shape: circle, hexagon, triangle, diamond, star, shield",
    )
    theme: Optional[str] = Field(
        default=None,
        description="Theme preset: modern, minimal, bold, elegant, playful, tech, vintage, organic",
    )
    width: Optional[int] = Field(default=400, description="SVG width in pixels")
    height: Optional[int] = Field(default=200, description="SVG height in pixels")
    colors: Optional[ColorConfig] = None
    typography: Optional[TypographyConfig] = None


class GenerateRequest(BaseModel):
    description: Optional[str] = Field(
        default=None, description="Natural language description of the desired logo"
    )
    config: LogoConfig = Field(default_factory=LogoConfig)
    referenceImages: Optional[list[str]] = Field(
        default=None, description="Base64 encoded reference images for style inspiration"
    )
    previousFeedback: Optional[str] = Field(
        default=None, description="Feedback from previous iteration to address"
    )


class GenerateResponse(BaseModel):
    svg: str
    iterations: int = 1
    reasoning: Optional[str] = None


@app.get("/health")
async def health():
    """Health check endpoint."""
    return {"status": "ok", "service": "logo-agent"}


@app.post("/generate", response_model=GenerateResponse)
async def generate_logo(request: GenerateRequest):
    """
    Generate an SVG logo based on the provided configuration.

    The Node.js script handles the actual SVG generation.
    In the future, this will integrate with Claude Agent SDK for
    intelligent logo design iteration.
    """
    try:
        # Build config for the Node.js script
        config = request.config.model_dump(exclude_none=True)

        # Create a temporary config file
        with tempfile.NamedTemporaryFile(
            mode="w", suffix=".json", delete=False
        ) as f:
            json.dump(config, f)
            config_path = f.name

        try:
            # Run the Node.js logo generator
            result = subprocess.run(
                ["node", "/app/scripts/generate.js", "--config", config_path],
                capture_output=True,
                text=True,
                timeout=30,
            )

            if result.returncode != 0:
                raise HTTPException(
                    status_code=500,
                    detail=f"Logo generation failed: {result.stderr}",
                )

            svg = result.stdout.strip()

            if not svg.startswith("<svg"):
                raise HTTPException(
                    status_code=500,
                    detail="Invalid SVG output from generator",
                )

            return GenerateResponse(
                svg=svg,
                iterations=1,
                reasoning=f"Generated {config.get('type', 'wordmark')} logo with {config.get('theme', 'custom')} theme",
            )

        finally:
            # Clean up temp file
            os.unlink(config_path)

    except subprocess.TimeoutExpired:
        raise HTTPException(
            status_code=504,
            detail="Logo generation timed out",
        )
    except Exception as e:
        if isinstance(e, HTTPException):
            raise
        raise HTTPException(
            status_code=500,
            detail=f"Internal error: {str(e)}",
        )


@app.post("/validate")
async def validate_svg(svg: str):
    """Validate that an SVG is well-formed."""
    if not svg.strip().startswith("<svg"):
        return {"valid": False, "error": "Not an SVG"}

    if "</svg>" not in svg:
        return {"valid": False, "error": "Unclosed SVG tag"}

    return {"valid": True}
