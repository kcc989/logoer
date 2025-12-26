"""
Type definitions for the Logo RAG system.
"""

from dataclasses import dataclass
from typing import Optional
from pydantic import BaseModel, Field


@dataclass
class RAGConfig:
    """Configuration for connecting to ChromaDB Cloud."""

    api_token: str
    tenant: str
    database: str
    collection_name: str = "logos"


class LogoMetadata(BaseModel):
    """Metadata stored alongside logo embeddings in ChromaDB."""

    logo_id: str = Field(description="Unique identifier for the logo")
    name: Optional[str] = Field(default=None, description="Logo name")
    description: str = Field(description="AI-generated description of the logo")
    logo_type: str = Field(description="Type: wordmark, lettermark, pictorial, etc.")
    theme: Optional[str] = Field(default=None, description="Theme: modern, minimal, etc.")
    shape: Optional[str] = Field(default=None, description="Shape: circle, hexagon, etc.")
    primary_color: Optional[str] = Field(default=None, description="Primary color hex")
    accent_color: Optional[str] = Field(default=None, description="Accent color hex")
    text: Optional[str] = Field(default=None, description="Text content in the logo")
    svg_url: Optional[str] = Field(default=None, description="URL to the SVG file in R2")
    created_at: Optional[str] = Field(default=None, description="ISO timestamp of creation")


class LogoEmbedding(BaseModel):
    """A logo with its embedding vector ready for ChromaDB storage."""

    id: str = Field(description="Unique identifier")
    embedding: list[float] = Field(description="Embedding vector")
    metadata: LogoMetadata = Field(description="Logo metadata")
    document: str = Field(description="Text document for the embedding (description)")


class SimilarLogo(BaseModel):
    """A similar logo returned from a RAG query."""

    id: str = Field(description="Logo ID")
    score: float = Field(description="Similarity score (0-1, higher is more similar)")
    metadata: LogoMetadata = Field(description="Logo metadata")
    svg_url: Optional[str] = Field(default=None, description="URL to retrieve the SVG")
