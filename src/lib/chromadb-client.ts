import { env } from 'cloudflare:workers';
import { ChromaClient } from 'chromadb';

import type { LogoDescription } from './logo-describer';

const COLLECTION_NAME = 'logos';

let clientInstance: ChromaClient | null = null;

/**
 * Get or create the ChromaDB client instance.
 */
function getClient(): ChromaClient {
  if (!clientInstance) {
    clientInstance = new ChromaClient({
      path: 'https://api.trychroma.com',
      auth: {
        provider: 'token',
        credentials: env.CHROMA_API_TOKEN,
      },
      tenant: env.CHROMA_TENANT,
      database: env.CHROMA_DATABASE,
    });
  }
  return clientInstance;
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
 * Generate embeddings using Workers AI.
 */
async function generateEmbedding(text: string): Promise<number[]> {
  const result = await env.AI.run('@cf/baai/bge-base-en-v1.5', {
    text: [text],
  });

  // Workers AI returns { shape: number[], data: number[][] }
  const output = result as { shape: number[]; data: number[][] };

  if (!output.data?.[0]) {
    throw new Error('Failed to generate embedding');
  }

  return output.data[0];
}

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
  const client = getClient();
  const collection = await client.getOrCreateCollection({
    name: COLLECTION_NAME,
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

  const embedding = await generateEmbedding(textForEmbedding);

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
    embeddings: [embedding],
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
  const client = getClient();
  const collection = await client.getOrCreateCollection({
    name: COLLECTION_NAME,
  });

  const queryEmbedding = await generateEmbedding(query);

  const results = await collection.query({
    queryEmbeddings: [queryEmbedding],
    nResults: limit,
  });

  if (!results.ids[0]) {
    return [];
  }

  return results.ids[0].map((id, index) => ({
    id,
    metadata: results.metadatas?.[0]?.[index] as LogoEmbeddingMetadata,
    document: results.documents?.[0]?.[index] || '',
    distance: results.distances?.[0]?.[index] || 0,
  }));
}
