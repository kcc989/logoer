import { prefix, route } from 'rwsdk/router';

import {
  listLogos,
  getLogo,
  createLogo,
  updateLogo,
  addVersion,
  deleteLogo,
  serveLogo,
} from './handlers';

import { requireAuth } from '@/lib/middleware/auth';

export const logoRoutes = prefix('/logos', [
  // List all logos for current user
  route('/', {
    get: [requireAuth, listLogos],
    post: [requireAuth, createLogo],
  }),
  // Single logo operations
  route('/:id', {
    get: [requireAuth, getLogo],
    put: [requireAuth, updateLogo],
    delete: [requireAuth, deleteLogo],
  }),
  // Add new version to logo
  route('/:id/versions', {
    post: [requireAuth, addVersion],
  }),
]);

// Logo serving route (for R2 assets)
export const logoAssetsRoutes = prefix('/logos/assets', [
  route('/*', serveLogo),
]);
