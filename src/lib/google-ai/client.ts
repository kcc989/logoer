/**
 * Google AI Client
 *
 * Wrapper around the Google GenAI SDK for image generation.
 */

import { GoogleGenAI } from '@google/genai';

let clientInstance: GoogleGenAI | null = null;

/**
 * Create or return cached Google GenAI client
 */
export function createGoogleAIClient(apiKey: string): GoogleGenAI {
  if (!clientInstance) {
    clientInstance = new GoogleGenAI({ apiKey });
  }
  return clientInstance;
}

/**
 * Get the Google AI client (requires prior initialization)
 */
export function getGoogleAIClient(): GoogleGenAI {
  if (!clientInstance) {
    throw new Error('Google AI client not initialized. Call createGoogleAIClient first.');
  }
  return clientInstance;
}

/**
 * Clear the cached client (useful for testing)
 */
export function clearGoogleAIClient(): void {
  clientInstance = null;
}
