"""
Logo ingestion service for processing and storing logos in ChromaDB.
"""

import asyncio
import os
import uuid
from datetime import datetime
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field

from ..rag import (
    ChromaLogoClient,
    LogoEmbedding,
    LogoMetadata,
    RAGConfig,
    describe_logo_sync,
    svg_to_base64_png,
)
from .sanitizer import sanitize_svg, SVGSanitizationError
from .audit import audit_logo_ingested, audit_batch_started, audit_batch_completed


class IngestionStatus(str, Enum):
    """Status of a logo ingestion job."""

    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


class IngestionJob(BaseModel):
    """A single logo ingestion job."""

    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    status: IngestionStatus = IngestionStatus.PENDING
    logo_id: Optional[str] = None
    error: Optional[str] = None
    created_at: str = Field(default_factory=lambda: datetime.utcnow().isoformat())
    completed_at: Optional[str] = None


class BatchIngestionJob(BaseModel):
    """A batch logo ingestion job."""

    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    status: IngestionStatus = IngestionStatus.PENDING
    total: int = 0
    completed: int = 0
    failed: int = 0
    jobs: list[IngestionJob] = Field(default_factory=list)
    created_at: str = Field(default_factory=lambda: datetime.utcnow().isoformat())
    completed_at: Optional[str] = None


class LogoIngestionRequest(BaseModel):
    """Request to ingest a single logo."""

    svg: str = Field(description="SVG content")
    name: Optional[str] = Field(default=None, description="Logo name")
    logo_type: str = Field(default="abstract", description="Logo type")
    theme: Optional[str] = Field(default=None, description="Logo theme")
    shape: Optional[str] = Field(default=None, description="Logo shape")
    primary_color: Optional[str] = Field(default=None, description="Primary color")
    accent_color: Optional[str] = Field(default=None, description="Accent color")
    text: Optional[str] = Field(default=None, description="Text in logo")
    svg_url: Optional[str] = Field(default=None, description="URL where SVG is stored")


class LogoIngestionResponse(BaseModel):
    """Response from logo ingestion."""

    success: bool
    logo_id: Optional[str] = None
    description: Optional[str] = None
    error: Optional[str] = None


# In-memory storage for batch jobs (in production, use Redis or similar)
_batch_jobs: dict[str, BatchIngestionJob] = {}


def get_rag_config() -> RAGConfig:
    """Get RAG configuration from environment."""
    return RAGConfig(
        api_token=os.environ.get("CHROMA_API_TOKEN", ""),
        tenant=os.environ.get("CHROMA_TENANT", ""),
        database=os.environ.get("CHROMA_DATABASE", ""),
        collection_name=os.environ.get("CHROMA_COLLECTION", "logos"),
    )


def get_anthropic_api_key() -> str:
    """Get Anthropic API key from environment."""
    return os.environ.get("ANTHROPIC_API_KEY", "")


async def ingest_single_logo(request: LogoIngestionRequest) -> LogoIngestionResponse:
    """
    Ingest a single logo into ChromaDB.

    Process:
    1. Sanitize the SVG
    2. Generate description using Claude Vision
    3. Store in ChromaDB with embedding

    Args:
        request: Logo ingestion request

    Returns:
        Ingestion response with logo ID or error
    """
    try:
        # 1. Sanitize the SVG
        try:
            sanitized_svg = sanitize_svg(request.svg)
        except SVGSanitizationError as e:
            return LogoIngestionResponse(success=False, error=f"SVG sanitization failed: {e}")

        # 2. Generate description using Claude Vision
        api_key = get_anthropic_api_key()
        if not api_key:
            return LogoIngestionResponse(success=False, error="Anthropic API key not configured")

        description = describe_logo_sync(sanitized_svg, api_key)

        # 3. Create logo metadata
        logo_id = str(uuid.uuid4())
        metadata = LogoMetadata(
            logo_id=logo_id,
            name=request.name,
            description=description,
            logo_type=request.logo_type,
            theme=request.theme,
            shape=request.shape,
            primary_color=request.primary_color,
            accent_color=request.accent_color,
            text=request.text,
            svg_url=request.svg_url,
            created_at=datetime.utcnow().isoformat(),
        )

        # 4. Store in ChromaDB
        # Note: ChromaDB will generate embeddings using its default embedding function
        config = get_rag_config()
        client = ChromaLogoClient(config)

        # For ChromaDB, we use the text query interface which auto-embeds
        # We create a LogoEmbedding with empty embedding (ChromaDB will generate)
        logo_embedding = LogoEmbedding(
            id=logo_id,
            embedding=[],  # Will be ignored when using add with documents
            metadata=metadata,
            document=description,
        )

        # Use add_logo which passes the document for embedding
        collection = client._get_collection()
        collection.add(
            ids=[logo_id],
            documents=[description],
            metadatas=[metadata.model_dump(exclude_none=True)],
        )

        # Audit log
        audit_logo_ingested(logo_id, name=request.name)

        return LogoIngestionResponse(
            success=True,
            logo_id=logo_id,
            description=description,
        )

    except Exception as e:
        audit_logo_ingested("", name=request.name, success=False, error=str(e))
        return LogoIngestionResponse(success=False, error=str(e))


async def create_batch_job(requests: list[LogoIngestionRequest]) -> BatchIngestionJob:
    """
    Create a batch ingestion job.

    Args:
        requests: List of logo ingestion requests

    Returns:
        Batch job with ID for status polling
    """
    batch = BatchIngestionJob(
        total=len(requests),
        jobs=[IngestionJob() for _ in requests],
    )
    _batch_jobs[batch.id] = batch

    # Audit log
    audit_batch_started(batch.id, len(requests))

    # Start background processing
    asyncio.create_task(_process_batch(batch.id, requests))

    return batch


async def _process_batch(batch_id: str, requests: list[LogoIngestionRequest]) -> None:
    """
    Process a batch of logo ingestion requests.

    Args:
        batch_id: The batch job ID
        requests: List of requests to process
    """
    batch = _batch_jobs.get(batch_id)
    if not batch:
        return

    batch.status = IngestionStatus.PROCESSING

    for i, request in enumerate(requests):
        job = batch.jobs[i]
        job.status = IngestionStatus.PROCESSING

        try:
            result = await ingest_single_logo(request)

            if result.success:
                job.status = IngestionStatus.COMPLETED
                job.logo_id = result.logo_id
                batch.completed += 1
            else:
                job.status = IngestionStatus.FAILED
                job.error = result.error
                batch.failed += 1

        except Exception as e:
            job.status = IngestionStatus.FAILED
            job.error = str(e)
            batch.failed += 1

        job.completed_at = datetime.utcnow().isoformat()

    batch.status = IngestionStatus.COMPLETED
    batch.completed_at = datetime.utcnow().isoformat()

    # Audit log
    audit_batch_completed(batch.id, batch.completed, batch.failed)


def get_batch_status(batch_id: str) -> Optional[BatchIngestionJob]:
    """
    Get the status of a batch job.

    Args:
        batch_id: The batch job ID

    Returns:
        Batch job status or None if not found
    """
    return _batch_jobs.get(batch_id)


def list_batch_jobs(limit: int = 20) -> list[BatchIngestionJob]:
    """
    List recent batch jobs.

    Args:
        limit: Maximum number of jobs to return

    Returns:
        List of batch jobs
    """
    jobs = list(_batch_jobs.values())
    jobs.sort(key=lambda j: j.created_at, reverse=True)
    return jobs[:limit]
