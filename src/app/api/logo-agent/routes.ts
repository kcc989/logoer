import { prefix, route } from 'rwsdk/router';
import { generateLogo, generateLogoSync, healthCheck } from './handlers';
import { requireAuth } from '@/lib/middleware/auth';

export const logoAgentRoutes = prefix('/logo-agent', [
  // Generate logo with streaming (SSE)
  route('/generate', {
    post: [requireAuth, generateLogo],
  }),

  // Generate logo synchronously
  route('/generate/sync', {
    post: [requireAuth, generateLogoSync],
  }),

  // Health check
  route('/health', healthCheck),
]);
