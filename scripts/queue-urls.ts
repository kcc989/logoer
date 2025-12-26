#!/usr/bin/env npx tsx

/**
 * CLI script to queue SVG URLs for ingestion.
 *
 * Usage:
 *   npx tsx scripts/queue-urls.ts [options]
 *
 * Options:
 *   --file, -f     Path to file containing URLs (one per line, default: svgs.txt)
 *   --api-key, -k  Admin API key (or set ADMIN_API_KEY env var)
 *   --base-url, -u Base URL of the API (default: http://localhost:5173)
 *   --batch-size   Number of URLs per API request (default: 100)
 *   --dry-run      Print URLs that would be queued without sending
 *
 * Examples:
 *   npx tsx scripts/queue-urls.ts
 *   npx tsx scripts/queue-urls.ts --file my-urls.txt --base-url https://logoer.com
 *   ADMIN_API_KEY=secret npx tsx scripts/queue-urls.ts --dry-run
 */

import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

interface Options {
  file: string;
  apiKey: string;
  baseUrl: string;
  batchSize: number;
  dryRun: boolean;
}

function parseArgs(): Options {
  const args = process.argv.slice(2);
  const options: Options = {
    file: 'svgs.txt',
    apiKey: process.env.ADMIN_API_KEY || '',
    baseUrl: process.env.BASE_URL || 'http://localhost:5173',
    batchSize: 100,
    dryRun: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const next = args[i + 1];

    switch (arg) {
      case '--file':
      case '-f':
        options.file = next;
        i++;
        break;
      case '--api-key':
      case '-k':
        options.apiKey = next;
        i++;
        break;
      case '--base-url':
      case '-u':
        options.baseUrl = next;
        i++;
        break;
      case '--batch-size':
        options.batchSize = parseInt(next, 10);
        i++;
        break;
      case '--dry-run':
        options.dryRun = true;
        break;
      case '--help':
      case '-h':
        console.log(`
Usage: npx tsx scripts/queue-urls.ts [options]

Options:
  --file, -f     Path to file containing URLs (default: svgs.txt)
  --api-key, -k  Admin API key (or set ADMIN_API_KEY env var)
  --base-url, -u Base URL of the API (default: http://localhost:5173)
  --batch-size   Number of URLs per API request (default: 100)
  --dry-run      Print URLs that would be queued without sending
  --help, -h     Show this help message
        `);
        process.exit(0);
    }
  }

  return options;
}

async function queueBatch(
  urls: string[],
  options: Options
): Promise<{ success: boolean; queued: number; error?: string }> {
  const response = await fetch(`${options.baseUrl}/api/admin/ingest/bulk`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${options.apiKey}`,
    },
    body: JSON.stringify({ urls }),
  });

  if (!response.ok) {
    const text = await response.text();
    return { success: false, queued: 0, error: `${response.status}: ${text}` };
  }

  const result = (await response.json()) as { queued: number };
  return { success: true, queued: result.queued };
}

async function main() {
  const options = parseArgs();

  // Validate API key
  if (!options.apiKey && !options.dryRun) {
    console.error(
      'Error: API key required. Set ADMIN_API_KEY env var or use --api-key'
    );
    process.exit(1);
  }

  // Read URLs from file
  const filePath = resolve(process.cwd(), options.file);
  if (!existsSync(filePath)) {
    console.error(`Error: File not found: ${filePath}`);
    process.exit(1);
  }

  const content = readFileSync(filePath, 'utf-8');
  const urls = content
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#') && line.startsWith('http'));

  if (urls.length === 0) {
    console.error('Error: No valid URLs found in file');
    process.exit(1);
  }

  console.log(`Found ${urls.length} URLs in ${options.file}`);

  if (options.dryRun) {
    console.log('\n[DRY RUN] Would queue the following URLs:');
    urls.forEach((url, i) => console.log(`  ${i + 1}. ${url}`));
    console.log(`\nTotal: ${urls.length} URLs`);
    return;
  }

  // Process in batches
  let totalQueued = 0;
  let batchNum = 0;
  const totalBatches = Math.ceil(urls.length / options.batchSize);

  console.log(
    `\nQueuing to ${options.baseUrl} in batches of ${options.batchSize}...\n`
  );

  for (let i = 0; i < urls.length; i += options.batchSize) {
    batchNum++;
    const batch = urls.slice(i, i + options.batchSize);

    process.stdout.write(
      `Batch ${batchNum}/${totalBatches} (${batch.length} URLs)... `
    );

    const result = await queueBatch(batch, options);

    if (result.success) {
      console.log(`✓ Queued ${result.queued}`);
      totalQueued += result.queued;
    } else {
      console.log(`✗ Failed: ${result.error}`);
    }

    // Small delay between batches to avoid overwhelming the API
    if (i + options.batchSize < urls.length) {
      await new Promise((r) => setTimeout(r, 100));
    }
  }

  console.log(`\n✓ Complete! Queued ${totalQueued}/${urls.length} URLs`);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
