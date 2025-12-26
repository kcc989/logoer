"""
Admin API key authentication for protected endpoints.
"""

import os
from typing import Annotated

from fastapi import Header, HTTPException, status


def get_admin_api_key() -> str:
    """Get the admin API key from environment."""
    key = os.environ.get("ADMIN_API_KEY")
    if not key:
        raise RuntimeError("ADMIN_API_KEY environment variable not set")
    return key


def require_admin_key(x_admin_key: Annotated[str | None, Header()] = None) -> str:
    """
    Dependency that validates the admin API key.

    The key must be provided in the X-Admin-Key header.

    Args:
        x_admin_key: The admin API key from the request header

    Returns:
        The validated API key

    Raises:
        HTTPException: If the key is missing or invalid
    """
    if not x_admin_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing X-Admin-Key header",
        )

    expected_key = get_admin_api_key()
    if x_admin_key != expected_key:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid admin API key",
        )

    return x_admin_key


# Type alias for use in route dependencies
AdminKeyDependency = Annotated[str, require_admin_key]
