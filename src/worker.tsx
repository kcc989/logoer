import { env } from 'cloudflare:workers';
import { Container } from '@cloudflare/containers';
import { realtimeRoute } from 'rwsdk/realtime/worker';
import { layout, prefix, render, route } from 'rwsdk/router';
import { defineApp, type RequestInfo } from 'rwsdk/worker';

import { userRoutes, avatarRoutes } from './app/api/users/routes';
import { logoRoutes, logoAssetsRoutes } from './app/api/logos/routes';
import { aiRoutes, uploadRoutes } from './app/api/ai/routes';
import { adminRoutes } from './app/api/admin/routes';
import { chatHandler } from './app/api/chat/handler';
import { processLogoIngestion } from './queue-handler';
import { AppLayout } from './app/app-layout';
import { getSidebarCollapsed } from './lib/sidebar';
import { getTheme, serializeTheme } from './lib/theme';

import { Document } from '@/app/Document';
import { setCommonHeaders } from '@/app/headers';
import { Home } from '@/app/pages/Home';
import { Login } from '@/app/pages/Login';
import { Settings } from '@/app/pages/Settings';
import { Generator } from '@/app/pages/Generator';
import { Gallery } from '@/app/pages/Gallery';
import { Unauthorized } from '@/app/pages/Unauthorized';
import { AdminLayout } from '@/app/admin/admin-layout';
import { AdminDashboard } from '@/app/pages/admin/Dashboard';
import { AdminHistories } from '@/app/pages/admin/Histories';
import { AdminSearch } from '@/app/pages/admin/Search';
import { AdminLogos } from '@/app/pages/admin/Logos';
import { AdminUpload } from '@/app/pages/admin/Upload';
import type { Session, User } from '@/lib/auth';
import { createAuth } from '@/lib/auth';

export { Database } from '@/db/centralDbDurableObject';
export { RealtimeDurableObject } from 'rwsdk/realtime/durableObject';
export { AgentSession } from '@/lib/agent';

// Logo generation container
export class LogoAgentContainer extends Container<Env> {
  defaultPort = 8000;
  sleepAfter = '5m';
}

// SVG to PNG conversion container
export class SvgConverterContainer extends Container<Env> {
  defaultPort = 8080;
  sleepAfter = '5m';
}

export type AppContext = {
  session: Session | null;
  user: User | null;
  theme: 'light' | 'dark';
  sidebarCollapsed: boolean;
};

let auth: ReturnType<typeof createAuth> | null = null;

const app = defineApp<RequestInfo<Record<string, string>, AppContext>>([
  setCommonHeaders(),
  async ({ ctx, request }) => {
    auth = createAuth(env);
    const session = await auth.api.getSession({
      headers: request.headers,
    });
    ctx.session = session || null;
    ctx.user = session?.user || null;
    ctx.theme = getTheme(request);
    ctx.sidebarCollapsed = getSidebarCollapsed(request);
  },
  route('/api/auth/*', async ({ request }) => {
    if (!auth) {
      auth = createAuth(env);
    }
    return auth.handler(request);
  }),
  route('/theme/set/:theme', ({ params }) => {
    const t = params.theme === 'dark' ? 'dark' : 'light';

    const res = Response.json({ success: true, theme: t });
    res.headers.set('Set-Cookie', serializeTheme(t));
    return res;
  }),
  route('/theme', ({ request }) => {
    const theme = getTheme(request);

    const response = new Response(JSON.stringify({ theme }));
    response.headers.set('Set-Cookie', serializeTheme(theme));
    return response;
  }),
  realtimeRoute(() => env.REALTIME_DURABLE_OBJECT),
  route('/api/chat', {
    post: async ({ request }) => chatHandler({ request }),
  }),
  prefix('/api', [userRoutes, avatarRoutes, logoRoutes, aiRoutes, uploadRoutes, adminRoutes]),
  // Logo assets served outside /api prefix - rwsdk limitation with wildcard + dynamic routes
  logoAssetsRoutes,
  render(Document, [
    route('/', Home),
    route('/login', Login),
    route('/unauthorized', Unauthorized),
    prefix('/settings', [layout(AppLayout, [route('/', Settings)])]),
    prefix('/generator', [layout(AppLayout, [route('/', Generator)])]),
    prefix('/gallery', [layout(AppLayout, [route('/', Gallery)])]),
    prefix('/admin', [
      layout(AdminLayout, [
        route('/', AdminDashboard),
        route('/histories', AdminHistories),
        route('/search', AdminSearch),
        route('/logos', AdminLogos),
        route('/upload', AdminUpload),
      ]),
    ]),
  ]),
]);

export default {
  fetch: app.fetch,
  queue: processLogoIngestion,
} satisfies ExportedHandler<Env>;
