import { env } from 'cloudflare:workers';
import type { RequestInfo } from 'rwsdk/worker';

import { ForbiddenError, UnauthorizedError } from '@/lib/errors';

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

/**
 * Middleware to require admin role via better-auth.
 * Checks if the authenticated user has admin role.
 */
export function requireAdmin({ ctx }: RequestInfo) {
  if (!ctx.user) {
    throw new UnauthorizedError('Authentication required');
  }

  if (ctx.user.role !== 'admin') {
    throw new ForbiddenError('Admin access required');
  }
}
