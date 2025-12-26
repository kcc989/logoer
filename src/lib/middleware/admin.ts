import { env } from 'cloudflare:workers';
import type { RequestInfo } from 'rwsdk/worker';

import { UnauthorizedError } from '@/lib/errors';

/**
 * Middleware to require admin API key authentication.
 * Checks the Authorization header for Bearer token matching ADMIN_API_KEY.
 */
export function requireAdminApiKey({ request }: RequestInfo) {
  const authHeader = request.headers.get('Authorization');

  if (!authHeader?.startsWith('Bearer ')) {
    throw new UnauthorizedError('Missing or invalid Authorization header');
  }

  const token = authHeader.slice(7);

  if (token !== env.ADMIN_API_KEY) {
    throw new UnauthorizedError('Invalid API key');
  }
}
