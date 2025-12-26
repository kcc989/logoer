import { prefix, route } from 'rwsdk/router';

import { bulkIngest } from './handlers';
import { requireAdminApiKey } from '@/lib/middleware/admin';

export const adminRoutes = prefix('/admin', [
  // Bulk ingest URLs to the queue
  route('/ingest/bulk', {
    post: [requireAdminApiKey, bulkIngest],
  }),
]);
