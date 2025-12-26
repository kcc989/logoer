import { CloudflareWorkerAIEmbeddingFunction } from '@chroma-core/cloudflare-worker-ai';
import { CloudClient } from 'chromadb';
import { env } from 'cloudflare:workers';

import type { LogoDescription } from './logo-describer';

const COLLECTION_NAME = 'logos';
const EMBEDDING_MODEL = '@cf/baai/bge-base-en-v1.5';

/**
 * Create ChromaDB Cloud client.
 */
function createChromaClient(): CloudClient {
  return new CloudClient({
    tenant: env.CHROMA_TENANT,
    database: env.CHROMA_DATABASE,
    apiKey: env.CHROMA_API_TOKEN,
  });
}

/**
 * Create embedding function using Cloudflare Workers AI.
 */
function createEmbeddingFunction(): CloudflareWorkerAIEmbeddingFunction {
  return new CloudflareWorkerAIEmbeddingFunction({
    apiKey: env.CLOUDFLARE_API_TOKEN,
    accountId: env.CLOUDFLARE_ACCOUNT_ID,
    modelName: EMBEDDING_MODEL,
  });
}

export type LogoEmbeddingMetadata = {
  sourceUrl: string;
  description: string;
  style: string;
  colors: string;
  elements: string;
  mood: string;
  industry: string;
  ingestedAt: string;
};

/**
 * Store a logo description in ChromaDB with embeddings.
 *
 * @param id - Unique identifier for the logo
 * @param sourceUrl - Original URL where the logo was fetched from
 * @param description - Structured logo description from Claude Vision
 */
export async function storeLogoEmbedding(
  id: string,
  sourceUrl: string,
  description: LogoDescription
): Promise<void> {
  const client = createChromaClient();
  const embeddingFunction = createEmbeddingFunction();

  const collection = await client.getOrCreateCollection({
    name: COLLECTION_NAME,
    embeddingFunction,
  });

  // Create a rich text representation for embedding
  const textForEmbedding = [
    description.description,
    `Style: ${description.style}`,
    `Colors: ${description.colors.join(', ')}`,
    `Elements: ${description.elements.join(', ')}`,
    `Mood: ${description.mood}`,
    description.industry ? `Industry: ${description.industry}` : '',
  ]
    .filter(Boolean)
    .join('. ');

  const metadata: LogoEmbeddingMetadata = {
    sourceUrl,
    description: description.description,
    style: description.style,
    colors: description.colors.join(', '),
    elements: description.elements.join(', '),
    mood: description.mood,
    industry: description.industry || 'unknown',
    ingestedAt: new Date().toISOString(),
  };

  await collection.add({
    ids: [id],
    metadatas: [metadata],
    documents: [textForEmbedding],
  });
}

/**
 * Search for similar logos by text query.
 *
 * @param query - Natural language search query
 * @param limit - Maximum number of results to return
 * @returns Array of matching logos with metadata and similarity scores
 */
export async function searchLogos(
  query: string,
  limit = 10
): Promise<
  Array<{
    id: string;
    metadata: LogoEmbeddingMetadata;
    document: string;
    distance: number;
  }>
> {
  const client = createChromaClient();
  const embeddingFunction = createEmbeddingFunction();

  const collection = await client.getOrCreateCollection({
    name: COLLECTION_NAME,
    embeddingFunction,
  });

  const results = await collection.query({
    queryTexts: [query],
    nResults: limit,
  });

  if (!results.ids[0] || results.ids[0].length === 0) {
    return [];
  }

  return results.ids[0].map((id, index) => ({
    id,
    metadata: results.metadatas?.[0]?.[index] as LogoEmbeddingMetadata,
    document: results.documents?.[0]?.[index] || '',
    distance: results.distances?.[0]?.[index] || 0,
  }));
}
