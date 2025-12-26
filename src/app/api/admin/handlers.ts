import { env } from 'cloudflare:workers';
import type { RequestInfo } from 'rwsdk/worker';
import { z } from 'zod';

import { ValidationError } from '@/lib/errors';

// Schemas
const bulkIngestSchema = z.object({
  urls: z.array(z.string().url()).min(1).max(1000),
});

export type IngestMessage = {
  url: string;
  id: string;
  queuedAt: string;
};

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
