"""
Logo management routes for admin CRUD operations.
"""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field

from .auth import AdminKeyDependency
from .audit import audit_logo_updated, audit_logo_deleted
from ..rag import ChromaLogoClient, LogoMetadata, RAGConfig
from ..rag.query_service import get_rag_config


router = APIRouter(prefix="/admin/logos", tags=["admin-management"])


class LogoUpdateRequest(BaseModel):
    """Request to update logo metadata."""

    name: Optional[str] = Field(default=None, description="New logo name")
    logo_type: Optional[str] = Field(default=None, description="New logo type")
    theme: Optional[str] = Field(default=None, description="New theme")
    shape: Optional[str] = Field(default=None, description="New shape")
    primary_color: Optional[str] = Field(default=None, description="New primary color")
    accent_color: Optional[str] = Field(default=None, description="New accent color")
    text: Optional[str] = Field(default=None, description="New text")


class LogoListResponse(BaseModel):
    """Response for logo list."""

    logos: list[LogoMetadata]
    total: int
    limit: int
    offset: int


class LogoDeleteResponse(BaseModel):
    """Response for logo deletion."""

    success: bool
    deleted_ids: list[str]
    errors: list[str] = Field(default_factory=list)


def get_chroma_client() -> ChromaLogoClient:
    """Get ChromaDB client."""
    config = get_rag_config()
    return ChromaLogoClient(config)


# ==================== List and Search ====================


@router.get(
    "",
    response_model=LogoListResponse,
    summary="List logos",
    description="List logos in the database with pagination",
)
async def list_logos(
    limit: int = Query(default=20, ge=1, le=100, description="Max results per page"),
    offset: int = Query(default=0, ge=0, description="Number of results to skip"),
    logo_type: Optional[str] = Query(default=None, description="Filter by logo type"),
    theme: Optional[str] = Query(default=None, description="Filter by theme"),
    shape: Optional[str] = Query(default=None, description="Filter by shape"),
    _: AdminKeyDependency = Depends(),
) -> LogoListResponse:
    """
    List logos in the RAG database.

    Supports pagination and filtering by type, theme, and shape.
    """
    try:
        client = get_chroma_client()

        # Build filter
        where_filter = None
        conditions = []
        if logo_type:
            conditions.append({"logo_type": {"$eq": logo_type}})
        if theme:
            conditions.append({"theme": {"$eq": theme}})
        if shape:
            conditions.append({"shape": {"$eq": shape}})

        if conditions:
            where_filter = conditions[0] if len(conditions) == 1 else {"$and": conditions}

        logos = client.list_logos(limit=limit, offset=offset, where=where_filter)
        total = client.count()

        return LogoListResponse(
            logos=logos,
            total=total,
            limit=limit,
            offset=offset,
        )

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to list logos: {str(e)}",
        )


@router.get(
    "/{logo_id}",
    response_model=LogoMetadata,
    summary="Get logo",
    description="Get a specific logo by ID",
)
async def get_logo(
    logo_id: str,
    _: AdminKeyDependency = Depends(),
) -> LogoMetadata:
    """
    Get a specific logo by its ID.
    """
    try:
        client = get_chroma_client()
        logo = client.get_logo(logo_id)

        if not logo:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Logo {logo_id} not found",
            )

        return logo

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get logo: {str(e)}",
        )


# ==================== Update ====================


@router.patch(
    "/{logo_id}",
    response_model=LogoMetadata,
    summary="Update logo",
    description="Update logo metadata",
)
async def update_logo(
    logo_id: str,
    request: LogoUpdateRequest,
    _: AdminKeyDependency = Depends(),
) -> LogoMetadata:
    """
    Update a logo's metadata.

    Only provided fields will be updated.
    """
    try:
        client = get_chroma_client()

        # Get existing logo
        existing = client.get_logo(logo_id)
        if not existing:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Logo {logo_id} not found",
            )

        # Build updated metadata
        update_data = request.model_dump(exclude_none=True)
        updated_fields = list(update_data.keys())

        if not updated_fields:
            return existing

        # Merge with existing data
        existing_data = existing.model_dump()
        existing_data.update(update_data)
        updated_metadata = LogoMetadata(**existing_data)

        # Update in ChromaDB
        client.update_logo(logo_id, updated_metadata)

        # Audit log
        audit_logo_updated(logo_id, updated_fields)

        return updated_metadata

    except HTTPException:
        raise
    except Exception as e:
        audit_logo_updated(logo_id, [], success=False, error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update logo: {str(e)}",
        )


# ==================== Delete ====================


@router.delete(
    "/{logo_id}",
    response_model=LogoDeleteResponse,
    summary="Delete logo",
    description="Delete a logo from the database",
)
async def delete_logo(
    logo_id: str,
    _: AdminKeyDependency = Depends(),
) -> LogoDeleteResponse:
    """
    Delete a logo from the RAG database.
    """
    try:
        client = get_chroma_client()

        # Check if logo exists
        existing = client.get_logo(logo_id)
        if not existing:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Logo {logo_id} not found",
            )

        # Delete from ChromaDB
        client.delete_logo(logo_id)

        # Audit log
        audit_logo_deleted(logo_id)

        return LogoDeleteResponse(
            success=True,
            deleted_ids=[logo_id],
        )

    except HTTPException:
        raise
    except Exception as e:
        audit_logo_deleted(logo_id, success=False, error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete logo: {str(e)}",
        )


@router.post(
    "/delete-batch",
    response_model=LogoDeleteResponse,
    summary="Delete multiple logos",
    description="Delete multiple logos in batch",
)
async def delete_logos_batch(
    logo_ids: list[str],
    _: AdminKeyDependency = Depends(),
) -> LogoDeleteResponse:
    """
    Delete multiple logos from the RAG database.

    Returns success even if some deletions fail, with errors listed.
    """
    if not logo_ids:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No logo IDs provided",
        )

    if len(logo_ids) > 100:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Maximum 100 logos per batch deletion",
        )

    deleted_ids = []
    errors = []

    try:
        client = get_chroma_client()

        for logo_id in logo_ids:
            try:
                # Check if exists first
                existing = client.get_logo(logo_id)
                if not existing:
                    errors.append(f"Logo {logo_id} not found")
                    continue

                client.delete_logo(logo_id)
                deleted_ids.append(logo_id)
                audit_logo_deleted(logo_id)

            except Exception as e:
                errors.append(f"Failed to delete {logo_id}: {str(e)}")
                audit_logo_deleted(logo_id, success=False, error=str(e))

        return LogoDeleteResponse(
            success=len(errors) == 0,
            deleted_ids=deleted_ids,
            errors=errors,
        )

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Batch deletion failed: {str(e)}",
        )
