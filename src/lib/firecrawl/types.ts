/**
 * Firecrawl Integration Types
 *
 * Types for web research using Firecrawl API.
 */

/**
 * Query parameters for research
 */
export interface ResearchQuery {
  industry: string;
  competitors: string[];
  styleKeywords: string[];
  brandName: string;
}

/**
 * Source type for research results
 */
export type ResearchSourceType = 'competitor' | 'inspiration' | 'trend';

/**
 * Scraped page data from Firecrawl
 */
export interface ScrapedPage {
  url: string;
  title: string;
  description?: string;
  markdown?: string;
  html?: string;
  links?: string[];
  metadata?: Record<string, unknown>;
}

/**
 * Extracted logo information from a page
 */
export interface ExtractedLogoInfo {
  logoUrl?: string;
  brandName: string;
  colorScheme: string[];
  designPatterns: string[];
  industry?: string;
}

/**
 * Research result from web scraping
 */
export interface ResearchResult {
  id: string;
  sourceUrl: string;
  sourceType: ResearchSourceType;
  title: string;
  description: string;
  imageUrls: string[];
  extractedPatterns: string[];
  relevanceScore: number;
  scrapedAt: string;
}

/**
 * Research session tracking
 */
export interface ResearchSession {
  id: string;
  query: ResearchQuery;
  results: ResearchResult[];
  startedAt: string;
  completedAt?: string;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
}

/**
 * Rate limit configuration
 */
export interface RateLimitConfig {
  /** Minimum delay between requests in ms */
  minDelayMs: number;
  /** Maximum delay between requests in ms */
  maxDelayMs: number;
  /** Maximum concurrent requests */
  maxConcurrent: number;
  /** Maximum requests per minute */
  maxPerMinute: number;
}

/**
 * Default rate limit configuration for Firecrawl
 * Conservative settings to avoid hitting API limits
 */
export const DEFAULT_RATE_LIMIT: RateLimitConfig = {
  minDelayMs: 2000,
  maxDelayMs: 3000,
  maxConcurrent: 1,
  maxPerMinute: 20,
};

/**
 * Research configuration
 */
export interface ResearchConfig {
  /** Maximum competitors to research */
  maxCompetitors: number;
  /** Maximum trend searches */
  maxTrendSearches: number;
  /** Maximum results per search */
  maxResultsPerSearch: number;
  /** Rate limiting configuration */
  rateLimit: RateLimitConfig;
}

/**
 * Default research configuration
 */
export const DEFAULT_RESEARCH_CONFIG: ResearchConfig = {
  maxCompetitors: 5,
  maxTrendSearches: 3,
  maxResultsPerSearch: 5,
  rateLimit: DEFAULT_RATE_LIMIT,
};

/**
 * Error types for research operations
 */
export type ResearchErrorType =
  | 'rate_limit'
  | 'scrape_failed'
  | 'parse_error'
  | 'timeout'
  | 'api_error'
  | 'unknown';

/**
 * Research error with details
 */
export interface ResearchError {
  type: ResearchErrorType;
  message: string;
  url?: string;
  retryable: boolean;
}
