import { env } from 'cloudflare:workers';
import { getContainer } from '@cloudflare/containers';
import type { RequestInfo } from 'rwsdk/worker';
import { z } from 'zod';

import { ValidationError } from '@/lib/errors';
import { searchLogos as searchChromaDB } from '@/lib/chromadb-client';

// Schemas
const bulkIngestSchema = z.object({
  urls: z.array(z.string().url()).min(1).max(1000),
});

const searchSchema = z.object({
  query: z.string().min(1),
  limit: z.number().min(1).max(100).optional().default(20),
});

const uploadUrlSchema = z.object({
  url: z.string().url(),
});

const batchUploadSchema = z.object({
  urls: z.array(z.string().url()).min(1).max(100),
});

export type IngestMessage = {
  url: string;
  id: string;
  queuedAt: string;
};

/**
 * Get a ready container instance for making requests.
 */
async function getReadyContainer() {
  const container = getContainer(env.LOGO_AGENT);
  await container.startAndWaitForPorts({
    startOptions: {
      envVars: {
        ANTHROPIC_API_KEY: env.ANTHROPIC_API_KEY,
      },
    },
  });
  return container;
}

/**
 * Bulk ingest URLs by queuing them to the logo ingestion queue.
 * Accepts an array of URLs and queues them in batches of 100.
 */
export async function bulkIngest({
  request,
}: RequestInfo): Promise<Response> {
  const body = await request.json();
  const input = bulkIngestSchema.safeParse(body);

  if (!input.success) {
    throw new ValidationError(input.error.message);
  }

  const { urls } = input.data;
  const now = new Date().toISOString();
  const batchSize = 100;
  let queued = 0;

  // Process URLs in batches of 100
  for (let i = 0; i < urls.length; i += batchSize) {
    const batch = urls.slice(i, i + batchSize);
    const messages: { body: IngestMessage }[] = batch.map((url) => ({
      body: {
        url,
        id: crypto.randomUUID(),
        queuedAt: now,
      },
    }));

    await env.LOGO_INGESTION_QUEUE.sendBatch(messages);
    queued += batch.length;
  }

  return Response.json({
    success: true,
    queued,
    message: `Queued ${queued} URLs for ingestion`,
  });
}

/**
 * Search the vector index for similar logos.
 * Uses direct ChromaDB Cloud REST API (no container needed).
 */
export async function searchLogos({
  request,
}: RequestInfo): Promise<Response> {
  const body = await request.json();
  const input = searchSchema.safeParse(body);

  if (!input.success) {
    throw new ValidationError(input.error.message);
  }

  // Direct ChromaDB search (no container needed)
  const results = await searchChromaDB(input.data.query, input.data.limit);

  // Transform results to match expected format
  return Response.json({
    results: results.map((r) => ({
      id: r.id,
      name: r.id,
      svg_url: `https://logos.logoer.dev/ingested/${r.id}.svg`,
      similarity: 1 - r.distance, // Convert distance to similarity
      ...r.metadata,
    })),
  });
}

/**
 * List logos from the vector index.
 */
export async function listLogos({
  request,
}: RequestInfo): Promise<Response> {
  const url = new URL(request.url);
  const limit = url.searchParams.get('limit') || '20';
  const offset = url.searchParams.get('offset') || '0';
  const logoType = url.searchParams.get('logo_type');
  const theme = url.searchParams.get('theme');

  const params = new URLSearchParams({ limit, offset });
  if (logoType) params.set('logo_type', logoType);
  if (theme) params.set('theme', theme);

  const container = await getReadyContainer();
  const response = await container.fetch(
    new Request(`http://container/admin/logos?${params}`, {
      headers: {
        'X-Admin-Key': env.ADMIN_API_KEY,
      },
    })
  );

  const data = await response.json();
  return Response.json(data);
}

/**
 * Get a single logo by ID.
 */
export async function getLogo({
  params,
}: RequestInfo): Promise<Response> {
  const container = await getReadyContainer();
  const response = await container.fetch(
    new Request(`http://container/admin/logos/${params.id}`, {
      headers: {
        'X-Admin-Key': env.ADMIN_API_KEY,
      },
    })
  );

  const data = await response.json();
  return Response.json(data, { status: response.status });
}

/**
 * Update logo metadata.
 */
export async function updateLogo({
  request,
  params,
}: RequestInfo): Promise<Response> {
  const body = await request.json();

  const container = await getReadyContainer();
  const response = await container.fetch(
    new Request(`http://container/admin/logos/${params.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'X-Admin-Key': env.ADMIN_API_KEY,
      },
      body: JSON.stringify(body),
    })
  );

  const data = await response.json();
  return Response.json(data, { status: response.status });
}

/**
 * Delete a logo.
 */
export async function deleteLogo({
  params,
}: RequestInfo): Promise<Response> {
  const container = await getReadyContainer();
  const response = await container.fetch(
    new Request(`http://container/admin/logos/${params.id}`, {
      method: 'DELETE',
      headers: {
        'X-Admin-Key': env.ADMIN_API_KEY,
      },
    })
  );

  const data = await response.json();
  return Response.json(data, { status: response.status });
}

/**
 * Upload a single SVG file.
 */
export async function uploadFile({
  request,
}: RequestInfo): Promise<Response> {
  const formData = await request.formData();
  const file = formData.get('file');

  if (!file || !(file instanceof File)) {
    throw new ValidationError('No file provided');
  }

  const svgContent = await file.text();

  const container = await getReadyContainer();
  const response = await container.fetch(
    new Request('http://container/admin/ingest', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Admin-Key': env.ADMIN_API_KEY,
      },
      body: JSON.stringify({
        svg: svgContent,
        name: file.name.replace('.svg', ''),
      }),
    })
  );

  const data = await response.json();
  return Response.json(data, { status: response.status });
}

/**
 * Upload SVG from a URL.
 */
export async function uploadFromUrl({
  request,
}: RequestInfo): Promise<Response> {
  const body = await request.json();
  const input = uploadUrlSchema.safeParse(body);

  if (!input.success) {
    throw new ValidationError(input.error.message);
  }

  // Fetch the SVG from the URL
  const svgResponse = await fetch(input.data.url);
  if (!svgResponse.ok) {
    return Response.json(
      { error: `Failed to fetch SVG: ${svgResponse.status}` },
      { status: 400 }
    );
  }

  const svgContent = await svgResponse.text();
  const urlPath = new URL(input.data.url).pathname;
  const name = urlPath.split('/').pop()?.replace('.svg', '') || 'uploaded';

  const container = await getReadyContainer();
  const response = await container.fetch(
    new Request('http://container/admin/ingest', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Admin-Key': env.ADMIN_API_KEY,
      },
      body: JSON.stringify({
        svg: svgContent,
        name,
        source_url: input.data.url,
      }),
    })
  );

  const data = await response.json();
  return Response.json(data, { status: response.status });
}

/**
 * Upload multiple SVGs from URLs.
 */
export async function uploadBatch({
  request,
}: RequestInfo): Promise<Response> {
  const body = await request.json();
  const input = batchUploadSchema.safeParse(body);

  if (!input.success) {
    throw new ValidationError(input.error.message);
  }

  // Queue all URLs for ingestion
  const now = new Date().toISOString();
  const messages: { body: IngestMessage }[] = input.data.urls.map((url) => ({
    body: {
      url,
      id: crypto.randomUUID(),
      queuedAt: now,
    },
  }));

  await env.LOGO_INGESTION_QUEUE.sendBatch(messages);

  return Response.json({
    success: true,
    queued: input.data.urls.length,
    message: `Queued ${input.data.urls.length} URLs for ingestion`,
  });
}
