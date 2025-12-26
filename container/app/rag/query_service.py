"""
RAG query service for finding similar logos.

Provides high-level functions for querying the logo database
with proper error handling and degraded mode support.
"""

import os
from typing import Optional

from pydantic import BaseModel, Field

from .chroma_client import ChromaLogoClient
from .query_generator import config_to_query, generate_filter_from_config
from .types import RAGConfig, SimilarLogo


class RAGQueryRequest(BaseModel):
    """Request for finding similar logos."""

    query: Optional[str] = Field(default=None, description="Natural language query")
    logo_type: Optional[str] = Field(default=None, description="Filter by logo type")
    theme: Optional[str] = Field(default=None, description="Filter by theme")
    shape: Optional[str] = Field(default=None, description="Filter by shape")
    primary_color: Optional[str] = Field(default=None, description="Primary color")
    accent_color: Optional[str] = Field(default=None, description="Accent color")
    text: Optional[str] = Field(default=None, description="Text in logo")
    n_results: int = Field(default=5, description="Number of results to return")


class RAGQueryResponse(BaseModel):
    """Response from RAG query."""

    success: bool
    results: list[SimilarLogo] = Field(default_factory=list)
    query_used: Optional[str] = None
    degraded: bool = Field(default=False, description="True if results are limited due to errors")
    error: Optional[str] = None


def get_rag_config() -> RAGConfig:
    """Get RAG configuration from environment."""
    return RAGConfig(
        api_token=os.environ.get("CHROMA_API_TOKEN", ""),
        tenant=os.environ.get("CHROMA_TENANT", ""),
        database=os.environ.get("CHROMA_DATABASE", ""),
        collection_name=os.environ.get("CHROMA_COLLECTION", "logos"),
    )


def is_rag_configured() -> bool:
    """Check if RAG is properly configured."""
    config = get_rag_config()
    return bool(config.api_token and config.tenant and config.database)


async def find_similar_logos(request: RAGQueryRequest) -> RAGQueryResponse:
    """
    Find similar logos based on query parameters.

    Handles degraded scenarios gracefully:
    - Missing ChromaDB configuration: Returns empty results with warning
    - Connection errors: Returns empty results with error message
    - Empty database: Returns empty results (not an error)

    Args:
        request: Query parameters

    Returns:
        Query response with results or error information
    """
    # Check configuration
    if not is_rag_configured():
        return RAGQueryResponse(
            success=True,
            results=[],
            degraded=True,
            error="RAG not configured - ChromaDB credentials missing",
        )

    try:
        config = get_rag_config()
        client = ChromaLogoClient(config)

        # Build the query from parameters
        if request.query:
            # User provided explicit query
            query_text = request.query
        else:
            # Generate query from config parameters
            query_text = config_to_query(
                logo_type=request.logo_type,
                theme=request.theme,
                shape=request.shape,
                primary_color=request.primary_color,
                accent_color=request.accent_color,
                text=request.text,
            )

        # Generate filter conditions
        where_filter = generate_filter_from_config(
            logo_type=request.logo_type,
            theme=request.theme,
            shape=request.shape,
        )

        # Query ChromaDB
        results = client.query_by_text(
            query_text=query_text,
            n_results=request.n_results,
            where=where_filter,
        )

        return RAGQueryResponse(
            success=True,
            results=results,
            query_used=query_text,
            degraded=False,
        )

    except Exception as e:
        # Return degraded response instead of failing
        return RAGQueryResponse(
            success=True,
            results=[],
            degraded=True,
            error=f"RAG query failed: {str(e)}",
        )


async def get_logo_count() -> int:
    """
    Get the total number of logos in the RAG database.

    Returns:
        Number of logos, or 0 if RAG is not configured/available
    """
    if not is_rag_configured():
        return 0

    try:
        config = get_rag_config()
        client = ChromaLogoClient(config)
        return client.count()
    except Exception:
        return 0


def format_similar_logos_for_context(logos: list[SimilarLogo]) -> str:
    """
    Format similar logos as context for the generation prompt.

    Args:
        logos: List of similar logos

    Returns:
        Formatted string for including in prompts
    """
    if not logos:
        return ""

    parts = ["Here are some similar logos for inspiration:\n"]

    for i, logo in enumerate(logos, 1):
        parts.append(f"\n{i}. **{logo.metadata.name or 'Unnamed Logo'}**")
        parts.append(f"   - Type: {logo.metadata.logo_type}")
        if logo.metadata.theme:
            parts.append(f"   - Theme: {logo.metadata.theme}")
        if logo.metadata.shape:
            parts.append(f"   - Shape: {logo.metadata.shape}")
        parts.append(f"   - Description: {logo.metadata.description}")
        parts.append(f"   - Similarity: {logo.score:.1%}")

    return "\n".join(parts)
