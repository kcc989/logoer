/**
 * Research Service
 *
 * Orchestrates web research for competitor logos and industry trends.
 */

import type FirecrawlApp from '@mendable/firecrawl-js';
import type {
  ResearchQuery,
  ResearchResult,
  ResearchSession,
  ResearchConfig,
  ScrapedPage,
} from './types';
import { DEFAULT_RESEARCH_CONFIG } from './types';
import {
  createFirecrawlClient,
  RateLimiter,
  scrapeUrl,
  searchAndScrape,
} from './client';

/**
 * Research service for conducting web research
 */
export class ResearchService {
  private client: FirecrawlApp;
  private rateLimiter: RateLimiter;
  private config: ResearchConfig;

  constructor(apiKey: string, config: Partial<ResearchConfig> = {}) {
    this.client = createFirecrawlClient(apiKey);
    this.config = { ...DEFAULT_RESEARCH_CONFIG, ...config };
    this.rateLimiter = new RateLimiter(this.config.rateLimit);
  }

  /**
   * Execute a full research session
   */
  async executeResearch(query: ResearchQuery): Promise<ResearchSession> {
    const session: ResearchSession = {
      id: crypto.randomUUID(),
      query,
      results: [],
      startedAt: new Date().toISOString(),
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
    };

    try {
      // 1. Research competitors
      const competitorResults = await this.researchCompetitors(query);
      session.results.push(...competitorResults);

      // 2. Research industry trends
      const trendResults = await this.researchIndustryTrends(query);
      session.results.push(...trendResults);

      // 3. Research style inspiration
      const styleResults = await this.researchStyleInspiration(query);
      session.results.push(...styleResults);

      session.completedAt = new Date().toISOString();
    } catch (error) {
      console.error('Research session error:', error);
    }

    return session;
  }

  /**
   * Research competitor logos
   */
  async researchCompetitors(query: ResearchQuery): Promise<ResearchResult[]> {
    const results: ResearchResult[] = [];
    const competitors = query.competitors.slice(0, this.config.maxCompetitors);

    for (const competitor of competitors) {
      const searchQuery = `${competitor} logo design brand identity`;
      const pages = await searchAndScrape(
        this.client,
        searchQuery,
        this.rateLimiter,
        { maxResults: this.config.maxResultsPerSearch }
      );

      for (const page of pages) {
        const result = this.extractResearchResult(page, 'competitor', query);
        if (result) {
          results.push(result);
        }
      }
    }

    return results;
  }

  /**
   * Research industry trends
   */
  async researchIndustryTrends(query: ResearchQuery): Promise<ResearchResult[]> {
    const results: ResearchResult[] = [];
    const year = new Date().getFullYear();

    const trendQueries = [
      `${query.industry} logo design trends ${year}`,
      `best ${query.industry} logos ${year}`,
      `${query.industry} branding examples`,
    ].slice(0, this.config.maxTrendSearches);

    for (const searchQuery of trendQueries) {
      const pages = await searchAndScrape(
        this.client,
        searchQuery,
        this.rateLimiter,
        { maxResults: this.config.maxResultsPerSearch }
      );

      for (const page of pages) {
        const result = this.extractResearchResult(page, 'trend', query);
        if (result) {
          results.push(result);
        }
      }
    }

    return results;
  }

  /**
   * Research style inspiration based on keywords
   */
  async researchStyleInspiration(
    query: ResearchQuery
  ): Promise<ResearchResult[]> {
    const results: ResearchResult[] = [];

    if (query.styleKeywords.length === 0) {
      return results;
    }

    const styleQuery = `${query.styleKeywords.join(' ')} logo design examples`;
    const pages = await searchAndScrape(
      this.client,
      styleQuery,
      this.rateLimiter,
      { maxResults: this.config.maxResultsPerSearch }
    );

    for (const page of pages) {
      const result = this.extractResearchResult(page, 'inspiration', query);
      if (result) {
        results.push(result);
      }
    }

    return results;
  }

  /**
   * Extract research result from a scraped page
   */
  private extractResearchResult(
    page: ScrapedPage,
    sourceType: ResearchResult['sourceType'],
    query: ResearchQuery
  ): ResearchResult | null {
    if (!page.markdown && !page.html) {
      return null;
    }

    const content = page.markdown || '';

    // Extract image URLs from markdown
    const imageUrls = this.extractImageUrls(content);

    // Extract design patterns
    const extractedPatterns = this.extractDesignPatterns(content, query);

    // Calculate relevance score
    const relevanceScore = this.calculateRelevanceScore(
      content,
      query,
      imageUrls.length
    );

    // Skip low relevance results
    if (relevanceScore < 30) {
      return null;
    }

    return {
      id: crypto.randomUUID(),
      sourceUrl: page.url,
      sourceType,
      title: page.title || 'Untitled',
      description: this.extractDescription(content),
      imageUrls,
      extractedPatterns,
      relevanceScore,
      scrapedAt: new Date().toISOString(),
    };
  }

  /**
   * Extract image URLs from markdown content
   */
  private extractImageUrls(markdown: string): string[] {
    const urls: string[] = [];

    // Match markdown image syntax: ![alt](url)
    const markdownPattern = /!\[[^\]]*\]\(([^)]+)\)/g;
    let match;
    while ((match = markdownPattern.exec(markdown)) !== null) {
      if (this.isValidImageUrl(match[1])) {
        urls.push(match[1]);
      }
    }

    // Match standalone image URLs
    const urlPattern = /https?:\/\/[^\s<>"{}|\\^`\[\]]+\.(?:png|jpg|jpeg|svg|webp)/gi;
    while ((match = urlPattern.exec(markdown)) !== null) {
      if (this.isValidImageUrl(match[0]) && !urls.includes(match[0])) {
        urls.push(match[0]);
      }
    }

    return urls.slice(0, 10); // Limit to 10 images
  }

  /**
   * Check if a URL is a valid image URL
   */
  private isValidImageUrl(url: string): boolean {
    try {
      const parsed = new URL(url);
      const ext = parsed.pathname.toLowerCase();
      return (
        ext.endsWith('.png') ||
        ext.endsWith('.jpg') ||
        ext.endsWith('.jpeg') ||
        ext.endsWith('.svg') ||
        ext.endsWith('.webp')
      );
    } catch {
      return false;
    }
  }

  /**
   * Extract design patterns from content
   */
  private extractDesignPatterns(
    content: string,
    query: ResearchQuery
  ): string[] {
    const patterns: string[] = [];
    const contentLower = content.toLowerCase();

    // Design style keywords
    const stylePatterns = [
      'minimalist',
      'modern',
      'vintage',
      'retro',
      'geometric',
      'organic',
      'abstract',
      'playful',
      'professional',
      'elegant',
      'bold',
      'clean',
      'flat',
      'gradient',
      'monochrome',
      'colorful',
      'hand-drawn',
      'lettermark',
      'wordmark',
      'emblem',
      'mascot',
      'icon',
      'symbol',
    ];

    for (const pattern of stylePatterns) {
      if (contentLower.includes(pattern)) {
        patterns.push(pattern);
      }
    }

    // Check for query-specific style keywords
    for (const keyword of query.styleKeywords) {
      if (contentLower.includes(keyword.toLowerCase()) && !patterns.includes(keyword)) {
        patterns.push(keyword);
      }
    }

    return patterns.slice(0, 10);
  }

  /**
   * Calculate relevance score for a result
   */
  private calculateRelevanceScore(
    content: string,
    query: ResearchQuery,
    imageCount: number
  ): number {
    let score = 0;
    const contentLower = content.toLowerCase();

    // Brand name match (+20)
    if (contentLower.includes(query.brandName.toLowerCase())) {
      score += 20;
    }

    // Industry match (+15)
    if (contentLower.includes(query.industry.toLowerCase())) {
      score += 15;
    }

    // Logo-related content (+20)
    const logoKeywords = ['logo', 'brand', 'design', 'identity', 'mark'];
    for (const keyword of logoKeywords) {
      if (contentLower.includes(keyword)) {
        score += 4;
      }
    }

    // Style keywords match (+15 max)
    for (const keyword of query.styleKeywords) {
      if (contentLower.includes(keyword.toLowerCase())) {
        score += 5;
      }
    }
    score = Math.min(score, score > 15 ? score : score);

    // Images boost (+20 max)
    score += Math.min(imageCount * 4, 20);

    // Competitor mention (+10)
    for (const competitor of query.competitors) {
      if (contentLower.includes(competitor.toLowerCase())) {
        score += 5;
      }
    }

    return Math.min(score, 100);
  }

  /**
   * Extract a short description from content
   */
  private extractDescription(content: string): string {
    // Remove markdown formatting
    const cleaned = content
      .replace(/!\[[^\]]*\]\([^)]+\)/g, '') // Remove images
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Keep link text
      .replace(/#{1,6}\s/g, '') // Remove headers
      .replace(/[*_~`]/g, '') // Remove formatting
      .replace(/\n+/g, ' ') // Normalize whitespace
      .trim();

    // Return first 200 characters
    return cleaned.slice(0, 200) + (cleaned.length > 200 ? '...' : '');
  }
}

/**
 * Create a research service instance
 */
export function createResearchService(
  apiKey: string,
  config?: Partial<ResearchConfig>
): ResearchService {
  return new ResearchService(apiKey, config);
}

/**
 * Summarize research results for display
 */
export function summarizeResearchResults(results: ResearchResult[]): string {
  if (results.length === 0) {
    return 'No research results found.';
  }

  const byType = {
    competitor: results.filter((r) => r.sourceType === 'competitor'),
    trend: results.filter((r) => r.sourceType === 'trend'),
    inspiration: results.filter((r) => r.sourceType === 'inspiration'),
  };

  const allPatterns = new Set(results.flatMap((r) => r.extractedPatterns));
  const topPatterns = [...allPatterns].slice(0, 5);

  const lines = [
    `Found ${results.length} results:`,
    `- ${byType.competitor.length} competitor analyses`,
    `- ${byType.trend.length} industry trends`,
    `- ${byType.inspiration.length} style inspirations`,
    '',
    `Common design patterns: ${topPatterns.join(', ')}`,
  ];

  return lines.join('\n');
}
