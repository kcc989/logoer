/**
 * Firecrawl Client
 *
 * Wrapper around the Firecrawl SDK for web scraping.
 */

import FirecrawlApp from '@mendable/firecrawl-js';
import { z } from 'zod';
import type { ScrapedPage, RateLimitConfig } from './types';

/**
 * Zod schemas for Firecrawl responses
 */
const ScrapeMetadataSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
}).passthrough();

const ScrapeResponseSchema = z.object({
  markdown: z.string().optional(),
  html: z.string().optional(),
  links: z.array(z.string()).optional(),
  metadata: ScrapeMetadataSchema.optional(),
}).passthrough();

const MapLinkSchema = z.union([
  z.string(),
  z.object({ url: z.string() }).passthrough(),
]);

const MapResponseSchema = z.object({
  links: z.array(MapLinkSchema).optional(),
}).passthrough();

/**
 * Create a Firecrawl client instance
 */
export function createFirecrawlClient(apiKey: string): FirecrawlApp {
  return new FirecrawlApp({ apiKey });
}

/**
 * Rate limiter for API requests
 */
export class RateLimiter {
  private lastRequestTime = 0;
  private requestCount = 0;
  private windowStart = Date.now();

  constructor(private config: RateLimitConfig) {}

  /**
   * Wait until it's safe to make another request
   */
  async waitForSlot(): Promise<void> {
    const now = Date.now();

    // Reset window if a minute has passed
    if (now - this.windowStart >= 60000) {
      this.requestCount = 0;
      this.windowStart = now;
    }

    // Check rate limit per minute
    if (this.requestCount >= this.config.maxPerMinute) {
      const waitTime = 60000 - (now - this.windowStart);
      if (waitTime > 0) {
        await sleep(waitTime);
        this.requestCount = 0;
        this.windowStart = Date.now();
      }
    }

    // Ensure minimum delay between requests
    const timeSinceLastRequest = now - this.lastRequestTime;
    const delay = this.config.minDelayMs +
      Math.random() * (this.config.maxDelayMs - this.config.minDelayMs);

    if (timeSinceLastRequest < delay) {
      await sleep(delay - timeSinceLastRequest);
    }

    this.lastRequestTime = Date.now();
    this.requestCount++;
  }
}

/**
 * Sleep for a given number of milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Scrape a single URL with rate limiting
 */
export async function scrapeUrl(
  client: FirecrawlApp,
  url: string,
  rateLimiter: RateLimiter,
  options: {
    formats?: ('markdown' | 'html')[];
    waitFor?: number;
    timeout?: number;
  } = {}
): Promise<ScrapedPage | null> {
  await rateLimiter.waitForSlot();

  try {
    const result = await client.scrape(url, {
      formats: options.formats ?? ['markdown'],
      waitFor: options.waitFor ?? 2000,
      timeout: options.timeout ?? 30000,
    });

    const parsed = ScrapeResponseSchema.safeParse(result);
    if (!parsed.success) {
      console.error(`Scrape parse failed for ${url}:`, parsed.error);
      return null;
    }

    const data = parsed.data;

    // Check for content (indicates success)
    if (!data.markdown && !data.html) {
      console.error(`Scrape failed for ${url}: no content returned`);
      return null;
    }

    return {
      url,
      title: data.metadata?.title ?? '',
      description: data.metadata?.description ?? '',
      markdown: data.markdown,
      html: data.html,
      links: data.links ?? [],
      metadata: data.metadata,
    };
  } catch (error) {
    console.error(`Error scraping ${url}:`, error);
    return null;
  }
}

/**
 * Map a website to discover pages
 */
export async function mapWebsite(
  client: FirecrawlApp,
  url: string,
  rateLimiter: RateLimiter,
  options: {
    limit?: number;
  } = {}
): Promise<string[]> {
  await rateLimiter.waitForSlot();

  try {
    const result = await client.map(url, {
      limit: options.limit ?? 10,
    });

    const parsed = MapResponseSchema.safeParse(result);
    if (!parsed.success) {
      console.error(`Map parse failed for ${url}:`, parsed.error);
      return [];
    }

    const data = parsed.data;

    if (!data.links) {
      return [];
    }

    return data.links.map((link) => {
      if (typeof link === 'string') return link;
      return link.url;
    }).filter(Boolean);
  } catch (error) {
    console.error(`Error mapping ${url}:`, error);
    return [];
  }
}

/**
 * Search and scrape results for a query
 * Note: This uses scraping approach since Firecrawl doesn't have native search
 */
export async function searchAndScrape(
  client: FirecrawlApp,
  query: string,
  rateLimiter: RateLimiter,
  options: {
    maxResults?: number;
  } = {}
): Promise<ScrapedPage[]> {
  const maxResults = options.maxResults ?? 5;
  const results: ScrapedPage[] = [];

  // Construct a search URL (DuckDuckGo HTML version works well)
  const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;

  const searchPage = await scrapeUrl(client, searchUrl, rateLimiter, {
    formats: ['markdown'],
    waitFor: 3000,
  });

  if (!searchPage || !searchPage.markdown) {
    return results;
  }

  // Extract URLs from the search results markdown
  const urlPattern = /\[([^\]]+)\]\((https?:\/\/[^\s\)]+)\)/g;
  const matches = [...searchPage.markdown.matchAll(urlPattern)];

  // Filter out DuckDuckGo internal links
  const externalUrls = matches
    .map((m) => ({ title: m[1], url: m[2] }))
    .filter((item) => !item.url.includes('duckduckgo.com'))
    .slice(0, maxResults);

  // Scrape each result
  for (const { url, title } of externalUrls) {
    const page = await scrapeUrl(client, url, rateLimiter, {
      formats: ['markdown'],
    });

    if (page) {
      page.title = page.title || title;
      results.push(page);
    }
  }

  return results;
}
