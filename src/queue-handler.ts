import { env } from 'cloudflare:workers';
import { getContainer } from '@cloudflare/containers';

import type { IngestMessage } from './app/api/admin/handlers';
import { describeLogo } from './lib/logo-describer';
import { storeLogoEmbedding } from './lib/chromadb-client';

interface ConvertResponse {
  png: string;
  width: number;
  height: number;
}

/**
 * Get a ready SvgConverter container instance.
 * Used for heavy SVG to PNG conversion via resvg.
 */
async function getSvgConverterContainer() {
  const container = getContainer(env.SVG_CONVERTER);
  await container.startAndWaitForPorts({ ports: [8080] });
  return container;
}

/**
 * Process logo ingestion messages from the queue.
 *
 * For each message:
 * 1. Fetch the SVG from the URL
 * 2. Convert SVG to PNG using SvgConverterContainer
 * 3. Describe the logo using Claude Vision (direct Anthropic API)
 * 4. Store description in ChromaDB Cloud (direct REST API, no container)
 * 5. Store both SVG and PNG in R2
 */
export async function processLogoIngestion(
  batch: MessageBatch<unknown>
): Promise<void> {
  for (const message of batch.messages) {
    const body = message.body as IngestMessage;
    const { url, id } = body;

    try {
      // 1. Fetch the SVG
      const svgResponse = await fetch(url, {
        headers: {
          'User-Agent': 'LogoerBot/1.0 (https://logoer.dev)',
          Accept: 'image/svg+xml, application/xml, text/xml, */*',
        },
      });
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

      // 2. Convert SVG to PNG using SvgConverterContainer
      const svgConverter = await getSvgConverterContainer();
      const convertResponse = await svgConverter.fetch(
        new Request('http://container/convert', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ svg, width: 512 }),
        })
      );

      if (!convertResponse.ok) {
        const error = await convertResponse.text();
        console.error(`SVG conversion failed for ${url}: ${error}`);
        message.retry();
        continue;
      }

      const { png, width, height } =
        (await convertResponse.json()) as ConvertResponse;

      // Decode base64 PNG to buffer
      const pngBuffer = Uint8Array.from(atob(png), (c) => c.charCodeAt(0));

      // 3. Describe the logo using Claude Vision (direct Anthropic API)
      const description = await describeLogo(pngBuffer);

      // 4. Store in ChromaDB Cloud (direct REST API, no container needed)
      await storeLogoEmbedding(id, url, description);

      // 5. Store SVG and PNG in R2
      await Promise.all([
        env.LOGOS_BUCKET.put(`ingested/${id}.svg`, svg, {
          httpMetadata: { contentType: 'image/svg+xml' },
          customMetadata: { sourceUrl: url },
        }),
        env.LOGOS_BUCKET.put(`ingested/${id}.png`, pngBuffer, {
          httpMetadata: { contentType: 'image/png' },
          customMetadata: {
            sourceUrl: url,
            width: String(width),
            height: String(height),
            description: description.description,
            style: description.style,
            mood: description.mood,
          },
        }),
      ]);

      console.log(`Successfully processed logo ${id} from ${url}`);
      message.ack();
    } catch (error) {
      console.error(`Error processing logo ${id} from ${url}:`, error);
      message.retry();
    }
  }
}
