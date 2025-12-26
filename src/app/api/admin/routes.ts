import { prefix, route } from 'rwsdk/router';

import {
  bulkIngest,
  searchLogos,
  listLogos,
  getLogo,
  updateLogo,
  deleteLogo,
  uploadFile,
  uploadFromUrl,
  uploadBatch,
} from './handlers';
import {
  listHistories,
  getHistory,
  createHistory,
  updateHistory,
  deleteHistory,
} from './history-handlers';
import { requireAdmin, requireAdminApiKey } from '@/lib/middleware/admin';

export const adminRoutes = prefix('/admin', [
  // Bulk ingest URLs to the queue (API key auth for external access)
  route('/ingest/bulk', {
    post: [requireAdminApiKey, bulkIngest],
  }),

  // Vector search (session auth for admin UI)
  route('/search', {
    post: [requireAdmin, searchLogos],
  }),

  // Logo management (session auth for admin UI)
  route('/logos', {
    get: [requireAdmin, listLogos],
  }),
  route('/logos/:id', {
    get: [requireAdmin, getLogo],
    patch: [requireAdmin, updateLogo],
    delete: [requireAdmin, deleteLogo],
  }),

  // Upload endpoints (session auth for admin UI)
  route('/upload/file', {
    post: [requireAdmin, uploadFile],
  }),
  route('/upload/url', {
    post: [requireAdmin, uploadFromUrl],
  }),
  route('/upload/batch', {
    post: [requireAdmin, uploadBatch],
  }),

  // Generation history (session auth for admin UI)
  route('/histories', {
    get: [requireAdmin, listHistories],
    post: [requireAdmin, createHistory],
  }),
  route('/histories/:id', {
    get: [requireAdmin, getHistory],
    patch: [requireAdmin, updateHistory],
    delete: [requireAdmin, deleteHistory],
  }),
]);
