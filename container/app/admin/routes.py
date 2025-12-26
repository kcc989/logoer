"""
Admin API routes for logo ingestion and management.
"""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from .auth import AdminKeyDependency
from .ingestion import (
    BatchIngestionJob,
    LogoIngestionRequest,
    LogoIngestionResponse,
    create_batch_job,
    get_batch_status,
    ingest_single_logo,
    list_batch_jobs,
)
from .sanitizer import sanitize_svg, SVGSanitizationError, validate_svg_structure


router = APIRouter(prefix="/admin", tags=["admin"])


class BatchIngestionRequest(BaseModel):
    """Request to ingest multiple logos."""

    logos: list[LogoIngestionRequest] = Field(description="List of logos to ingest")


class BatchIngestionResponse(BaseModel):
    """Response from batch ingestion creation."""

    batch_id: str = Field(description="Batch job ID for status polling")
    total: int = Field(description="Total number of logos in batch")
    status: str = Field(description="Current status")


class SanitizeRequest(BaseModel):
    """Request to sanitize an SVG."""

    svg: str = Field(description="SVG content to sanitize")


class SanitizeResponse(BaseModel):
    """Response from SVG sanitization."""

    success: bool
    sanitized_svg: Optional[str] = None
    error: Optional[str] = None
    validation: Optional[dict] = None


# ==================== Single Logo Ingestion ====================


@router.post(
    "/ingest",
    response_model=LogoIngestionResponse,
    summary="Ingest a single logo",
    description="Upload and process a single SVG logo for RAG storage",
)
async def ingest_logo(
    request: LogoIngestionRequest,
    _: AdminKeyDependency = Depends(),
) -> LogoIngestionResponse:
    """
    Ingest a single logo into the RAG database.

    The logo will be:
    1. Sanitized for security
    2. Described using Claude Vision
    3. Embedded and stored in ChromaDB
    """
    return await ingest_single_logo(request)


# ==================== Batch Ingestion ====================


@router.post(
    "/ingest/batch",
    response_model=BatchIngestionResponse,
    summary="Create batch ingestion job",
    description="Submit multiple logos for batch processing",
)
async def create_batch_ingestion(
    request: BatchIngestionRequest,
    _: AdminKeyDependency = Depends(),
) -> BatchIngestionResponse:
    """
    Create a batch ingestion job for multiple logos.

    Returns a batch ID that can be used to poll for status.
    Processing happens asynchronously in the background.
    """
    if not request.logos:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No logos provided",
        )

    if len(request.logos) > 100:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Maximum 100 logos per batch",
        )

    batch = await create_batch_job(request.logos)

    return BatchIngestionResponse(
        batch_id=batch.id,
        total=batch.total,
        status=batch.status.value,
    )


@router.get(
    "/ingest/batch/{batch_id}",
    response_model=BatchIngestionJob,
    summary="Get batch status",
    description="Poll for batch ingestion job status",
)
async def get_batch_ingestion_status(
    batch_id: str,
    _: AdminKeyDependency = Depends(),
) -> BatchIngestionJob:
    """
    Get the current status of a batch ingestion job.

    Returns detailed status including per-logo results.
    """
    batch = get_batch_status(batch_id)
    if not batch:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Batch job {batch_id} not found",
        )

    return batch


@router.get(
    "/ingest/batch",
    response_model=list[BatchIngestionJob],
    summary="List batch jobs",
    description="List recent batch ingestion jobs",
)
async def list_batch_ingestion_jobs(
    limit: int = 20,
    _: AdminKeyDependency = Depends(),
) -> list[BatchIngestionJob]:
    """
    List recent batch ingestion jobs.

    Returns jobs sorted by creation time (newest first).
    """
    return list_batch_jobs(limit=min(limit, 100))


# ==================== SVG Utilities ====================


@router.post(
    "/sanitize",
    response_model=SanitizeResponse,
    summary="Sanitize SVG",
    description="Sanitize an SVG to remove potentially dangerous content",
)
async def sanitize_svg_endpoint(
    request: SanitizeRequest,
    _: AdminKeyDependency = Depends(),
) -> SanitizeResponse:
    """
    Sanitize an SVG file.

    Removes potentially dangerous elements and attributes
    while preserving the visual appearance.
    """
    try:
        sanitized = sanitize_svg(request.svg)
        validation = validate_svg_structure(sanitized)

        return SanitizeResponse(
            success=True,
            sanitized_svg=sanitized,
            validation=validation,
        )

    except SVGSanitizationError as e:
        return SanitizeResponse(
            success=False,
            error=str(e),
        )


@router.post(
    "/validate",
    summary="Validate SVG",
    description="Validate SVG structure without sanitization",
)
async def validate_svg_endpoint(
    request: SanitizeRequest,
    _: AdminKeyDependency = Depends(),
) -> dict:
    """
    Validate an SVG file structure.

    Returns validation results including whether the SVG is well-formed
    and basic metadata about its structure.
    """
    return validate_svg_structure(request.svg)
