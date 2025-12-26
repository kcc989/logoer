"""
RAG (Retrieval-Augmented Generation) module for logo similarity search.

This module provides:
- SVG to PNG conversion for vision model analysis
- Claude Vision logo description generation
- ChromaDB client for vector storage and retrieval
- Query generation from LogoConfig
- Query service for finding similar logos
- API routes for RAG endpoints
"""

from .types import LogoEmbedding, LogoMetadata, RAGConfig, SimilarLogo
from .svg_to_png import svg_to_png, svg_to_base64_png
from .chroma_client import ChromaLogoClient
from .logo_describer import describe_logo, describe_logo_sync
from .query_generator import config_to_query
from .query_service import (
    RAGQueryRequest,
    RAGQueryResponse,
    find_similar_logos,
    format_similar_logos_for_context,
)
from .routes import router as rag_router

__all__ = [
    # Types
    "LogoEmbedding",
    "LogoMetadata",
    "RAGConfig",
    "SimilarLogo",
    "RAGQueryRequest",
    "RAGQueryResponse",
    # Functions
    "svg_to_png",
    "svg_to_base64_png",
    "describe_logo",
    "describe_logo_sync",
    "config_to_query",
    "find_similar_logos",
    "format_similar_logos_for_context",
    # Client
    "ChromaLogoClient",
    # Router
    "rag_router",
]
