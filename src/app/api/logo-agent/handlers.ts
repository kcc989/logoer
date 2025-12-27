import { env } from 'cloudflare:workers';
import type { RequestInfo, RouteHandler } from 'rwsdk/worker';
import type { AppContext } from '@/worker';

// Get the TypeScript logo agent container
async function getLogoAgentContainer() {
  const container = env.LOGO_AGENT_TS as unknown as {
    fetch: (url: string | URL | Request, init?: RequestInit) => Promise<Response>;
  };
  return container;
}

/**
 * Generate a logo using the TypeScript container with Claude Agent SDK
 * Returns SSE stream with generation progress
 */
export const generateLogo: RouteHandler<RequestInfo<Record<string, string>, AppContext>> = async ({
  request,
}) => {
  try {
    const body = await request.json();

    // Get the container
    const container = await getLogoAgentContainer();

    // Forward the request to the container
    const response = await container.fetch('http://localhost:8080/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    // Return the SSE stream
    return new Response(response.body, {
      status: response.status,
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    });
  } catch (error) {
    console.error('Logo generation error:', error);
    return Response.json(
      {
        error: 'Logo generation failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
};

/**
 * Generate a logo synchronously (non-streaming)
 * Returns the final result directly
 */
export const generateLogoSync: RouteHandler<RequestInfo<Record<string, string>, AppContext>> = async ({
  request,
}) => {
  try {
    const body = await request.json();

    // Get the container
    const container = await getLogoAgentContainer();

    // Forward the request to the sync endpoint
    const response = await container.fetch('http://localhost:8080/generate/sync', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const result = await response.json();
    return Response.json(result, { status: response.status });
  } catch (error) {
    console.error('Logo generation error:', error);
    return Response.json(
      {
        error: 'Logo generation failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
};

/**
 * Health check for the logo agent container
 */
export const healthCheck: RouteHandler<RequestInfo<Record<string, string>, AppContext>> = async () => {
  try {
    const container = await getLogoAgentContainer();
    const response = await container.fetch('http://localhost:8080/health');
    const result = await response.json();
    return Response.json(result);
  } catch (error) {
    return Response.json(
      {
        status: 'error',
        message: error instanceof Error ? error.message : 'Container unavailable',
      },
      { status: 503 }
    );
  }
};
