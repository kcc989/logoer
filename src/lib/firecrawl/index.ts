/**
 * Firecrawl Module
 *
 * Web research integration using Firecrawl API.
 */

// Types
export type {
  ResearchQuery,
  ResearchSourceType,
  ScrapedPage,
  ExtractedLogoInfo,
  ResearchResult,
  ResearchSession,
  RateLimitConfig,
  ResearchConfig,
  ResearchErrorType,
  ResearchError,
} from './types';

export { DEFAULT_RATE_LIMIT, DEFAULT_RESEARCH_CONFIG } from './types';

// Client
export {
  createFirecrawlClient,
  RateLimiter,
  sleep,
  scrapeUrl,
  mapWebsite,
  searchAndScrape,
} from './client';

// Research Service
export {
  ResearchService,
  createResearchService,
  summarizeResearchResults,
} from './research-service';
