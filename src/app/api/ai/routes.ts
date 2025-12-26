import { prefix, route } from 'rwsdk/router';

import { analyzeImage, serveUpload } from './handlers';

import { requireAuth } from '@/lib/middleware/auth';

export const aiRoutes = prefix('/ai', [
  // Analyze uploaded image
  route('/analyze', {
    post: [requireAuth, analyzeImage],
  }),
]);

// Upload serving route (for R2 assets)
export const uploadRoutes = prefix('/uploads', [
  route('/*', serveUpload),
]);
