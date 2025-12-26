"""
Admin API module for logo ingestion and management.

Provides endpoints for:
- Single logo ingestion with embedding generation
- Batch logo ingestion with queue processing
- Status polling for batch operations
- Logo management (list, update, delete)
- Audit logging for all admin operations
"""

from .auth import require_admin_key, AdminKeyDependency
from .sanitizer import sanitize_svg, SVGSanitizationError
from .routes import router as admin_router
from .management import router as management_router
from .audit import (
    AuditAction,
    AuditEntry,
    log_audit,
    audit_logo_ingested,
    audit_logo_updated,
    audit_logo_deleted,
    audit_batch_started,
    audit_batch_completed,
)

__all__ = [
    # Auth
    "require_admin_key",
    "AdminKeyDependency",
    # Sanitizer
    "sanitize_svg",
    "SVGSanitizationError",
    # Routers
    "admin_router",
    "management_router",
    # Audit
    "AuditAction",
    "AuditEntry",
    "log_audit",
    "audit_logo_ingested",
    "audit_logo_updated",
    "audit_logo_deleted",
    "audit_batch_started",
    "audit_batch_completed",
]
