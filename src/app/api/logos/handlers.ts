import { env } from 'cloudflare:workers';
import type { RequestInfo } from 'rwsdk/worker';
import { z } from 'zod';

import { db } from '@/db';
import { UnauthorizedError, ValidationError, NotFoundError } from '@/lib/errors';
import type { LogoConfig } from '@/lib/logo-types';

// Schemas
const createLogoSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  svg: z.string().min(1),
  config: z.object({
    type: z.string(),
    text: z.string(),
    shape: z.string(),
    theme: z.string().optional(),
    width: z.number(),
    height: z.number(),
    colors: z.object({
      primary: z.string(),
      accent: z.string(),
    }),
    typography: z.object({
      fontSize: z.number(),
      letterSpacing: z.number(),
      fontWeight: z.string(),
      fontFamily: z.string(),
    }),
  }),
  feedback: z.string().optional(),
  reasoning: z.string().optional(),
  iterations: z.number().optional(),
});

const updateLogoSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
});

const addVersionSchema = z.object({
  svg: z.string().min(1),
  config: z.object({
    type: z.string(),
    text: z.string(),
    shape: z.string(),
    theme: z.string().optional(),
    width: z.number(),
    height: z.number(),
    colors: z.object({
      primary: z.string(),
      accent: z.string(),
    }),
    typography: z.object({
      fontSize: z.number(),
      letterSpacing: z.number(),
      fontWeight: z.string(),
      fontFamily: z.string(),
    }),
  }),
  feedback: z.string().optional(),
  reasoning: z.string().optional(),
  iterations: z.number().optional(),
});

// Types
export type LogoListItem = {
  id: string;
  name: string;
  description: string | null;
  thumbnailUrl: string | null;
  createdAt: string;
  updatedAt: string;
};

export type LogoDetail = {
  id: string;
  name: string;
  description: string | null;
  currentVersion: VersionDetail | null;
  versions: VersionDetail[];
  createdAt: string;
  updatedAt: string;
};

export type VersionDetail = {
  id: string;
  svg: string;
  pngUrl: string | null;
  config: LogoConfig;
  feedback: string | null;
  reasoning: string | null;
  iterations: number;
  createdAt: string;
};

/**
 * List all logos for the current user
 */
export async function listLogos({ ctx }: RequestInfo): Promise<Response> {
  if (!ctx.user) {
    throw new UnauthorizedError('User is not authenticated');
  }

  const logos = await db
    .selectFrom('logo')
    .leftJoin('logo_version', 'logo.currentVersionId', 'logo_version.id')
    .where('logo.userId', '=', ctx.user.id)
    .select([
      'logo.id',
      'logo.name',
      'logo.description',
      'logo_version.pngUrl as thumbnailUrl',
      'logo.createdAt',
      'logo.updatedAt',
    ])
    .orderBy('logo.updatedAt', 'desc')
    .execute();

  return Response.json(
    logos.map((logo) => ({
      id: logo.id,
      name: logo.name,
      description: logo.description,
      thumbnailUrl: logo.thumbnailUrl,
      createdAt: logo.createdAt,
      updatedAt: logo.updatedAt,
    })) satisfies LogoListItem[]
  );
}

/**
 * Get a single logo with all its versions
 */
export async function getLogo({ ctx, params }: RequestInfo): Promise<Response> {
  if (!ctx.user) {
    throw new UnauthorizedError('User is not authenticated');
  }

  const logoId = params.id;
  if (!logoId) {
    throw new ValidationError('Logo ID is required');
  }

  const logo = await db
    .selectFrom('logo')
    .where('logo.id', '=', logoId)
    .where('logo.userId', '=', ctx.user.id)
    .select([
      'logo.id',
      'logo.name',
      'logo.description',
      'logo.currentVersionId',
      'logo.createdAt',
      'logo.updatedAt',
    ])
    .executeTakeFirst();

  if (!logo) {
    throw new NotFoundError('Logo not found');
  }

  const versions = await db
    .selectFrom('logo_version')
    .where('logo_version.logoId', '=', logoId)
    .select([
      'logo_version.id',
      'logo_version.svg',
      'logo_version.pngUrl',
      'logo_version.config',
      'logo_version.feedback',
      'logo_version.reasoning',
      'logo_version.iterations',
      'logo_version.createdAt',
    ])
    .orderBy('logo_version.createdAt', 'desc')
    .execute();

  const versionDetails: VersionDetail[] = versions.map((v) => ({
    id: v.id,
    svg: v.svg,
    pngUrl: v.pngUrl,
    config: JSON.parse(v.config) as LogoConfig,
    feedback: v.feedback,
    reasoning: v.reasoning,
    iterations: v.iterations ?? 1,
    createdAt: v.createdAt,
  }));

  const currentVersion = versionDetails.find((v) => v.id === logo.currentVersionId) || null;

  return Response.json({
    id: logo.id,
    name: logo.name,
    description: logo.description,
    currentVersion,
    versions: versionDetails,
    createdAt: logo.createdAt,
    updatedAt: logo.updatedAt,
  } satisfies LogoDetail);
}

/**
 * Create a new logo with initial version
 */
export async function createLogo({
  ctx,
  request,
}: RequestInfo): Promise<Response> {
  if (!ctx.user) {
    throw new UnauthorizedError('User is not authenticated');
  }

  const body = await request.json();
  const input = createLogoSchema.parse(body);

  const now = new Date().toISOString();
  const logoId = crypto.randomUUID();
  const versionId = crypto.randomUUID();

  // Create the logo first
  await db
    .insertInto('logo')
    .values({
      id: logoId,
      userId: ctx.user.id,
      name: input.name,
      description: input.description || null,
      currentVersionId: versionId,
      createdAt: now,
      updatedAt: now,
    })
    .execute();

  // Create the initial version
  await db
    .insertInto('logo_version')
    .values({
      id: versionId,
      logoId,
      svg: input.svg,
      pngUrl: null,
      config: JSON.stringify(input.config),
      feedback: input.feedback || null,
      reasoning: input.reasoning || null,
      iterations: input.iterations || 1,
      createdAt: now,
    })
    .execute();

  // Save SVG to R2 for backup and PNG generation
  const svgKey = `logos/${ctx.user.id}/${logoId}/${versionId}.svg`;
  await env.LOGOS_BUCKET.put(svgKey, input.svg, {
    httpMetadata: {
      contentType: 'image/svg+xml',
    },
  });

  return Response.json(
    {
      id: logoId,
      name: input.name,
      description: input.description || null,
      currentVersion: {
        id: versionId,
        svg: input.svg,
        pngUrl: null,
        config: input.config as LogoConfig,
        feedback: input.feedback || null,
        reasoning: input.reasoning || null,
        iterations: input.iterations || 1,
        createdAt: now,
      },
      versions: [
        {
          id: versionId,
          svg: input.svg,
          pngUrl: null,
          config: input.config as LogoConfig,
          feedback: input.feedback || null,
          reasoning: input.reasoning || null,
          iterations: input.iterations || 1,
          createdAt: now,
        },
      ],
      createdAt: now,
      updatedAt: now,
    } satisfies LogoDetail,
    { status: 201 }
  );
}

/**
 * Update logo metadata (name, description)
 */
export async function updateLogo({
  ctx,
  request,
  params,
}: RequestInfo): Promise<Response> {
  if (!ctx.user) {
    throw new UnauthorizedError('User is not authenticated');
  }

  const logoId = params.id;
  if (!logoId) {
    throw new ValidationError('Logo ID is required');
  }

  // Verify ownership
  const logo = await db
    .selectFrom('logo')
    .where('logo.id', '=', logoId)
    .where('logo.userId', '=', ctx.user.id)
    .select(['logo.id'])
    .executeTakeFirst();

  if (!logo) {
    throw new NotFoundError('Logo not found');
  }

  const body = await request.json();
  const input = updateLogoSchema.parse(body);

  const updates: Record<string, string> = {
    updatedAt: new Date().toISOString(),
  };

  if (input.name !== undefined) {
    updates.name = input.name;
  }
  if (input.description !== undefined) {
    updates.description = input.description;
  }

  await db
    .updateTable('logo')
    .set(updates)
    .where('id', '=', logoId)
    .execute();

  return Response.json({ success: true });
}

/**
 * Add a new version to an existing logo
 */
export async function addVersion({
  ctx,
  request,
  params,
}: RequestInfo): Promise<Response> {
  if (!ctx.user) {
    throw new UnauthorizedError('User is not authenticated');
  }

  const logoId = params.id;
  if (!logoId) {
    throw new ValidationError('Logo ID is required');
  }

  // Verify ownership
  const logo = await db
    .selectFrom('logo')
    .where('logo.id', '=', logoId)
    .where('logo.userId', '=', ctx.user.id)
    .select(['logo.id'])
    .executeTakeFirst();

  if (!logo) {
    throw new NotFoundError('Logo not found');
  }

  const body = await request.json();
  const input = addVersionSchema.parse(body);

  const now = new Date().toISOString();
  const versionId = crypto.randomUUID();

  // Create the new version
  await db
    .insertInto('logo_version')
    .values({
      id: versionId,
      logoId,
      svg: input.svg,
      pngUrl: null,
      config: JSON.stringify(input.config),
      feedback: input.feedback || null,
      reasoning: input.reasoning || null,
      iterations: input.iterations || 1,
      createdAt: now,
    })
    .execute();

  // Update logo to point to new version
  await db
    .updateTable('logo')
    .set({
      currentVersionId: versionId,
      updatedAt: now,
    })
    .where('id', '=', logoId)
    .execute();

  // Save SVG to R2
  const svgKey = `logos/${ctx.user.id}/${logoId}/${versionId}.svg`;
  await env.LOGOS_BUCKET.put(svgKey, input.svg, {
    httpMetadata: {
      contentType: 'image/svg+xml',
    },
  });

  return Response.json(
    {
      id: versionId,
      svg: input.svg,
      pngUrl: null,
      config: input.config as LogoConfig,
      feedback: input.feedback || null,
      reasoning: input.reasoning || null,
      iterations: input.iterations || 1,
      createdAt: now,
    } satisfies VersionDetail,
    { status: 201 }
  );
}

/**
 * Delete a logo and all its versions
 */
export async function deleteLogo({
  ctx,
  params,
}: RequestInfo): Promise<Response> {
  if (!ctx.user) {
    throw new UnauthorizedError('User is not authenticated');
  }

  const logoId = params.id;
  if (!logoId) {
    throw new ValidationError('Logo ID is required');
  }

  // Verify ownership
  const logo = await db
    .selectFrom('logo')
    .where('logo.id', '=', logoId)
    .where('logo.userId', '=', ctx.user.id)
    .select(['logo.id'])
    .executeTakeFirst();

  if (!logo) {
    throw new NotFoundError('Logo not found');
  }

  // Get all version IDs for cleanup
  const versions = await db
    .selectFrom('logo_version')
    .where('logo_version.logoId', '=', logoId)
    .select(['logo_version.id'])
    .execute();

  // Delete R2 objects
  const deletePromises = versions.map((v) =>
    env.LOGOS_BUCKET.delete(`logos/${ctx.user!.id}/${logoId}/${v.id}.svg`)
  );
  await Promise.all(deletePromises);

  // Delete from database (cascade will handle versions)
  await db.deleteFrom('logo').where('id', '=', logoId).execute();

  return Response.json({ success: true });
}

/**
 * Serve a logo SVG from R2
 */
export async function serveLogo({ params }: RequestInfo): Promise<Response> {
  const path = params['*'];

  if (!path) {
    return new Response('Not found', { status: 404 });
  }

  const object = await env.LOGOS_BUCKET.get(`logos/${path}`);

  if (!object) {
    return new Response('Not found', { status: 404 });
  }

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('Cache-Control', 'public, max-age=31536000');

  return new Response(object.body, { headers });
}
