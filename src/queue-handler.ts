import { env } from 'cloudflare:workers';

import type { IngestMessage } from './app/api/admin/handlers';
import { convertSvgToPng } from './lib/svg-to-png';
import { describeLogo } from './lib/logo-describer';
import { storeLogoEmbedding } from './lib/chromadb-client';

/**
 * Process logo ingestion messages from the queue.
 *
 * For each message:
 * 1. Fetch the SVG from the URL
 * 2. Convert SVG to PNG using resvg-wasm
 * 3. Describe the logo using Claude Vision
 * 4. Store the description in ChromaDB with embeddings
 * 5. Store the PNG in R2 for caching
 */
export async function processLogoIngestion(
  batch: MessageBatch<unknown>
): Promise<void> {
  for (const message of batch.messages) {
    const body = message.body as IngestMessage;
    const { url, id } = body;

    try {
      // 1. Fetch the SVG
      const svgResponse = await fetch(url);
      if (!svgResponse.ok) {
        console.error(`Failed to fetch SVG from ${url}: ${svgResponse.status}`);
        message.ack();
        continue;
      }

      const contentType = svgResponse.headers.get('content-type') || '';
      if (!contentType.includes('svg') && !contentType.includes('xml')) {
        console.error(`URL ${url} is not an SVG (content-type: ${contentType})`);
        message.ack();
        continue;
      }

      const svg = await svgResponse.text();

      // 2. Convert to PNG
      const pngBuffer = await convertSvgToPng(svg, { width: 512 });

      // 3. Describe with Claude Vision
      const description = await describeLogo(pngBuffer);

      // 4. Store in ChromaDB
      await storeLogoEmbedding(id, url, description);

      // 5. Store PNG in R2 for caching
      await env.LOGOS_BUCKET.put(`ingested/${id}.png`, pngBuffer, {
        httpMetadata: {
          contentType: 'image/png',
        },
        customMetadata: {
          sourceUrl: url,
          description: description.description,
          style: description.style,
          mood: description.mood,
        },
      });

      // Also store the original SVG
      await env.LOGOS_BUCKET.put(`ingested/${id}.svg`, svg, {
        httpMetadata: {
          contentType: 'image/svg+xml',
        },
        customMetadata: {
          sourceUrl: url,
        },
      });

      console.log(`Successfully processed logo ${id} from ${url}`);
      message.ack();
    } catch (error) {
      console.error(`Error processing logo ${id} from ${url}:`, error);
      // Retry on failure (up to max_retries configured in queue)
      message.retry();
    }
  }
}
