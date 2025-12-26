"""
Audit logging for admin operations.

Logs all admin actions for security and debugging purposes.
"""

import json
import logging
import os
from datetime import datetime
from enum import Enum
from typing import Any, Optional

from pydantic import BaseModel, Field


class AuditAction(str, Enum):
    """Types of auditable admin actions."""

    LOGO_INGESTED = "logo_ingested"
    LOGO_UPDATED = "logo_updated"
    LOGO_DELETED = "logo_deleted"
    BATCH_STARTED = "batch_started"
    BATCH_COMPLETED = "batch_completed"
    SVG_SANITIZED = "svg_sanitized"
    RAG_QUERIED = "rag_queried"


class AuditEntry(BaseModel):
    """An audit log entry."""

    timestamp: str = Field(default_factory=lambda: datetime.utcnow().isoformat())
    action: AuditAction
    resource_id: Optional[str] = None
    resource_type: str = "logo"
    details: dict[str, Any] = Field(default_factory=dict)
    success: bool = True
    error: Optional[str] = None


# Configure audit logger
_audit_logger = logging.getLogger("admin.audit")
_audit_logger.setLevel(logging.INFO)

# Add handler if not already present
if not _audit_logger.handlers:
    handler = logging.StreamHandler()
    handler.setFormatter(
        logging.Formatter("%(asctime)s - AUDIT - %(message)s", datefmt="%Y-%m-%d %H:%M:%S")
    )
    _audit_logger.addHandler(handler)


def log_audit(entry: AuditEntry) -> None:
    """
    Log an audit entry.

    Args:
        entry: The audit entry to log
    """
    log_data = entry.model_dump()
    _audit_logger.info(json.dumps(log_data))


def audit_logo_ingested(logo_id: str, name: Optional[str] = None, success: bool = True, error: Optional[str] = None) -> None:
    """Log a logo ingestion event."""
    log_audit(
        AuditEntry(
            action=AuditAction.LOGO_INGESTED,
            resource_id=logo_id,
            details={"name": name} if name else {},
            success=success,
            error=error,
        )
    )


def audit_logo_updated(logo_id: str, fields: list[str], success: bool = True, error: Optional[str] = None) -> None:
    """Log a logo update event."""
    log_audit(
        AuditEntry(
            action=AuditAction.LOGO_UPDATED,
            resource_id=logo_id,
            details={"updated_fields": fields},
            success=success,
            error=error,
        )
    )


def audit_logo_deleted(logo_id: str, success: bool = True, error: Optional[str] = None) -> None:
    """Log a logo deletion event."""
    log_audit(
        AuditEntry(
            action=AuditAction.LOGO_DELETED,
            resource_id=logo_id,
            success=success,
            error=error,
        )
    )


def audit_batch_started(batch_id: str, count: int) -> None:
    """Log a batch ingestion start event."""
    log_audit(
        AuditEntry(
            action=AuditAction.BATCH_STARTED,
            resource_id=batch_id,
            details={"logo_count": count},
        )
    )


def audit_batch_completed(batch_id: str, completed: int, failed: int) -> None:
    """Log a batch ingestion completion event."""
    log_audit(
        AuditEntry(
            action=AuditAction.BATCH_COMPLETED,
            resource_id=batch_id,
            details={"completed": completed, "failed": failed},
            success=failed == 0,
        )
    )
