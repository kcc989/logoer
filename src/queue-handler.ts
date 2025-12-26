import { env } from 'cloudflare:workers';
import { getContainer, getRandom } from '@cloudflare/containers';

import type { IngestMessage } from './app/api/admin/handlers';

interface ConvertResponse {
  png: string;
  width: number;
  height: number;
}

/**
 * Get a ready LogoAgent container instance for making requests.
 */
async function getLogoAgentContainer() {
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
 * Get a ready SvgConverter container instance (load balanced across 5 instances).
 */
async function getSvgConverterContainer() {
  const container = await getRandom(env.SVG_CONVERTER, 5);
  await container.startAndWaitForPorts({ ports: [8080] });
  return container;
}

/**
 * Process logo ingestion messages from the queue.
 *
 * For each message:
 * 1. Fetch the SVG from the URL
 * 2. Send to the container for processing (sanitization, description, embedding)
 * 3. Store the original SVG in R2
 */
export async function processLogoIngestion(
  batch: MessageBatch<unknown>
): Promise<void> {
  // Get container once for the batch
  const container = await getReadyContainer();

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

      // 2. Send to container for processing
      const response = await container.fetch(
        new Request('http://container/admin/ingest', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Admin-Key': env.ADMIN_API_KEY,
          },
          body: JSON.stringify({
            svg,
            name: id,
            source_url: url,
          }),
        })
      );

      if (!response.ok) {
        const error = await response.text();
        console.error(`Container ingest failed for ${url}: ${error}`);
        message.retry();
        continue;
      }

      // 3. Store original SVG in R2
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
