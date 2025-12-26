"""
RAG API routes for logo similarity search.
"""

from fastapi import APIRouter
from pydantic import BaseModel, Field

from .query_service import (
    RAGQueryRequest,
    RAGQueryResponse,
    find_similar_logos,
    get_logo_count,
    is_rag_configured,
)

router = APIRouter(prefix="/rag", tags=["rag"])


class RAGStatusResponse(BaseModel):
    """Response for RAG system status."""

    configured: bool = Field(description="Whether RAG is properly configured")
    logo_count: int = Field(description="Number of logos in the database")


@router.get(
    "/status",
    response_model=RAGStatusResponse,
    summary="Get RAG status",
    description="Check if RAG is configured and get logo count",
)
async def get_rag_status() -> RAGStatusResponse:
    """
    Get the current status of the RAG system.

    Returns configuration status and the number of indexed logos.
    """
    return RAGStatusResponse(
        configured=is_rag_configured(),
        logo_count=await get_logo_count(),
    )


@router.post(
    "/similar",
    response_model=RAGQueryResponse,
    summary="Find similar logos",
    description="Query for similar logos based on description or config",
)
async def query_similar_logos(request: RAGQueryRequest) -> RAGQueryResponse:
    """
    Find similar logos in the RAG database.

    Supports both natural language queries and structured config-based queries.
    Results include similarity scores and full metadata.

    The endpoint handles degraded scenarios gracefully:
    - If RAG is not configured, returns empty results with a warning
    - If the database is empty, returns empty results
    - If there are connection issues, returns empty results with error info
    """
    return await find_similar_logos(request)


@router.get(
    "/similar",
    response_model=RAGQueryResponse,
    summary="Find similar logos (GET)",
    description="Query for similar logos using query parameters",
)
async def query_similar_logos_get(
    query: str | None = None,
    logo_type: str | None = None,
    theme: str | None = None,
    shape: str | None = None,
    n_results: int = 5,
) -> RAGQueryResponse:
    """
    Find similar logos using GET request with query parameters.

    Simpler interface for quick queries without needing a POST body.
    """
    request = RAGQueryRequest(
        query=query,
        logo_type=logo_type,
        theme=theme,
        shape=shape,
        n_results=n_results,
    )
    return await find_similar_logos(request)
