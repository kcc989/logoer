"""
ChromaDB client for logo vector storage and retrieval.

Connects to ChromaDB Cloud to store and query logo embeddings.
"""

from typing import Optional

import chromadb
from chromadb.config import Settings

from .types import LogoEmbedding, LogoMetadata, RAGConfig, SimilarLogo


class ChromaLogoClient:
    """Client for storing and retrieving logo embeddings from ChromaDB Cloud."""

    def __init__(self, config: RAGConfig):
        """
        Initialize the ChromaDB client.

        Args:
            config: RAG configuration with ChromaDB credentials
        """
        self.config = config
        self._client: Optional[chromadb.ClientAPI] = None
        self._collection = None

    def _get_client(self) -> chromadb.ClientAPI:
        """Get or create the ChromaDB client."""
        if self._client is None:
            self._client = chromadb.CloudClient(
                tenant=self.config.tenant,
                database=self.config.database,
                api_key=self.config.api_token,
            )
        return self._client

    def _get_collection(self):
        """Get or create the logos collection."""
        if self._collection is None:
            client = self._get_client()
            self._collection = client.get_or_create_collection(
                name=self.config.collection_name,
                metadata={"description": "Logo embeddings for similarity search"},
            )
        return self._collection

    def add_logo(self, logo: LogoEmbedding) -> None:
        """
        Add a single logo embedding to the collection.

        Args:
            logo: Logo embedding with metadata
        """
        collection = self._get_collection()
        collection.add(
            ids=[logo.id],
            embeddings=[logo.embedding],
            metadatas=[logo.metadata.model_dump(exclude_none=True)],
            documents=[logo.document],
        )

    def add_logos(self, logos: list[LogoEmbedding]) -> None:
        """
        Add multiple logo embeddings to the collection in batch.

        Args:
            logos: List of logo embeddings with metadata
        """
        if not logos:
            return

        collection = self._get_collection()
        collection.add(
            ids=[logo.id for logo in logos],
            embeddings=[logo.embedding for logo in logos],
            metadatas=[logo.metadata.model_dump(exclude_none=True) for logo in logos],
            documents=[logo.document for logo in logos],
        )

    def query_similar(
        self,
        query_embedding: list[float],
        n_results: int = 5,
        where: Optional[dict] = None,
    ) -> list[SimilarLogo]:
        """
        Query for similar logos using an embedding vector.

        Args:
            query_embedding: The embedding vector to search with
            n_results: Number of results to return (default 5)
            where: Optional filter conditions

        Returns:
            List of similar logos with scores
        """
        collection = self._get_collection()
        results = collection.query(
            query_embeddings=[query_embedding],
            n_results=n_results,
            where=where,
            include=["metadatas", "distances"],
        )

        similar_logos = []
        if results["ids"] and results["ids"][0]:
            for i, logo_id in enumerate(results["ids"][0]):
                metadata = results["metadatas"][0][i] if results["metadatas"] else {}
                # Convert distance to similarity score (ChromaDB uses L2 distance)
                distance = results["distances"][0][i] if results["distances"] else 0
                score = 1 / (1 + distance)  # Convert distance to similarity

                similar_logos.append(
                    SimilarLogo(
                        id=logo_id,
                        score=score,
                        metadata=LogoMetadata(**metadata),
                        svg_url=metadata.get("svg_url"),
                    )
                )

        return similar_logos

    def query_by_text(
        self,
        query_text: str,
        n_results: int = 5,
        where: Optional[dict] = None,
    ) -> list[SimilarLogo]:
        """
        Query for similar logos using a text description.

        ChromaDB will use its default embedding function for the text.

        Args:
            query_text: Text description to search for
            n_results: Number of results to return
            where: Optional filter conditions

        Returns:
            List of similar logos with scores
        """
        collection = self._get_collection()
        results = collection.query(
            query_texts=[query_text],
            n_results=n_results,
            where=where,
            include=["metadatas", "distances"],
        )

        similar_logos = []
        if results["ids"] and results["ids"][0]:
            for i, logo_id in enumerate(results["ids"][0]):
                metadata = results["metadatas"][0][i] if results["metadatas"] else {}
                distance = results["distances"][0][i] if results["distances"] else 0
                score = 1 / (1 + distance)

                similar_logos.append(
                    SimilarLogo(
                        id=logo_id,
                        score=score,
                        metadata=LogoMetadata(**metadata),
                        svg_url=metadata.get("svg_url"),
                    )
                )

        return similar_logos

    def get_logo(self, logo_id: str) -> Optional[LogoMetadata]:
        """
        Get a specific logo by ID.

        Args:
            logo_id: The logo ID to retrieve

        Returns:
            Logo metadata if found, None otherwise
        """
        collection = self._get_collection()
        results = collection.get(ids=[logo_id], include=["metadatas"])

        if results["ids"] and results["metadatas"]:
            return LogoMetadata(**results["metadatas"][0])
        return None

    def update_logo(self, logo_id: str, metadata: LogoMetadata) -> None:
        """
        Update a logo's metadata.

        Args:
            logo_id: The logo ID to update
            metadata: New metadata values
        """
        collection = self._get_collection()
        collection.update(
            ids=[logo_id],
            metadatas=[metadata.model_dump(exclude_none=True)],
        )

    def delete_logo(self, logo_id: str) -> None:
        """
        Delete a logo from the collection.

        Args:
            logo_id: The logo ID to delete
        """
        collection = self._get_collection()
        collection.delete(ids=[logo_id])

    def delete_logos(self, logo_ids: list[str]) -> None:
        """
        Delete multiple logos from the collection.

        Args:
            logo_ids: List of logo IDs to delete
        """
        if not logo_ids:
            return
        collection = self._get_collection()
        collection.delete(ids=logo_ids)

    def count(self) -> int:
        """
        Get the total number of logos in the collection.

        Returns:
            Number of logos stored
        """
        collection = self._get_collection()
        return collection.count()

    def list_logos(
        self,
        limit: int = 100,
        offset: int = 0,
        where: Optional[dict] = None,
    ) -> list[LogoMetadata]:
        """
        List logos with pagination.

        Args:
            limit: Maximum number of results
            offset: Number of results to skip
            where: Optional filter conditions

        Returns:
            List of logo metadata
        """
        collection = self._get_collection()
        results = collection.get(
            limit=limit,
            offset=offset,
            where=where,
            include=["metadatas"],
        )

        logos = []
        if results["ids"] and results["metadatas"]:
            for metadata in results["metadatas"]:
                logos.append(LogoMetadata(**metadata))

        return logos
