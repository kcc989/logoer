import { env } from 'cloudflare:workers';
import type { RequestInfo } from 'rwsdk/worker';
import { z } from 'zod';

import { ValidationError, NotFoundError } from '@/lib/errors';

// Schemas
const createHistorySchema = z.object({
  prompt: z.string().min(1),
  config: z.string().optional(), // JSON string
  messages: z.string().optional(), // JSON string
  logoVersionIds: z.array(z.string()).optional(),
});

// Types
export type GenerationHistory = {
  id: string;
  userId: string;
  prompt: string;
  config: string | null;
  messages: string | null;
  logoVersionIds: string | null;
  createdAt: string;
  updatedAt: string;
  // Joined from user table
  userEmail?: string;
  userName?: string;
};

/**
 * List generation histories with pagination.
 */
export async function listHistories({
  request,
  ctx,
}: RequestInfo): Promise<Response> {
  const url = new URL(request.url);
  const limit = parseInt(url.searchParams.get('limit') || '20', 10);
  const offset = parseInt(url.searchParams.get('offset') || '0', 10);
  const userId = url.searchParams.get('user_id');

  const db = ctx.db;

  let query = db
    .selectFrom('generation_history')
    .leftJoin('user', 'generation_history.userId', 'user.id')
    .select([
      'generation_history.id',
      'generation_history.userId',
      'generation_history.prompt',
      'generation_history.config',
      'generation_history.messages',
      'generation_history.logoVersionIds',
      'generation_history.createdAt',
      'generation_history.updatedAt',
      'user.email as userEmail',
      'user.name as userName',
    ])
    .orderBy('generation_history.createdAt', 'desc')
    .limit(limit)
    .offset(offset);

  if (userId) {
    query = query.where('generation_history.userId', '=', userId);
  }

  const histories = await query.execute();

  // Get total count
  let countQuery = db
    .selectFrom('generation_history')
    .select((eb) => eb.fn.count<number>('id').as('count'));

  if (userId) {
    countQuery = countQuery.where('userId', '=', userId);
  }

  const countResult = await countQuery.executeTakeFirst();
  const total = countResult?.count || 0;

  return Response.json({
    histories,
    total,
    limit,
    offset,
  });
}

/**
 * Get a single generation history by ID.
 */
export async function getHistory({
  params,
  ctx,
}: RequestInfo): Promise<Response> {
  const { id } = params;
  const db = ctx.db;

  const history = await db
    .selectFrom('generation_history')
    .leftJoin('user', 'generation_history.userId', 'user.id')
    .select([
      'generation_history.id',
      'generation_history.userId',
      'generation_history.prompt',
      'generation_history.config',
      'generation_history.messages',
      'generation_history.logoVersionIds',
      'generation_history.createdAt',
      'generation_history.updatedAt',
      'user.email as userEmail',
      'user.name as userName',
    ])
    .where('generation_history.id', '=', id)
    .executeTakeFirst();

  if (!history) {
    throw new NotFoundError('Generation history not found');
  }

  return Response.json(history);
}

/**
 * Create a new generation history entry.
 */
export async function createHistory({
  request,
  ctx,
}: RequestInfo): Promise<Response> {
  const body = await request.json();
  const input = createHistorySchema.safeParse(body);

  if (!input.success) {
    throw new ValidationError(input.error.message);
  }

  if (!ctx.user) {
    throw new ValidationError('User not authenticated');
  }

  const db = ctx.db;
  const now = new Date().toISOString();
  const id = crypto.randomUUID();

  await db
    .insertInto('generation_history')
    .values({
      id,
      userId: ctx.user.id,
      prompt: input.data.prompt,
      config: input.data.config || null,
      messages: input.data.messages || null,
      logoVersionIds: input.data.logoVersionIds
        ? JSON.stringify(input.data.logoVersionIds)
        : null,
      createdAt: now,
      updatedAt: now,
    })
    .execute();

  return Response.json({ id, success: true });
}

/**
 * Update a generation history entry.
 */
export async function updateHistory({
  request,
  params,
  ctx,
}: RequestInfo): Promise<Response> {
  const { id } = params;
  const body = await request.json();
  const db = ctx.db;

  // Check if history exists
  const existing = await db
    .selectFrom('generation_history')
    .select(['id'])
    .where('id', '=', id)
    .executeTakeFirst();

  if (!existing) {
    throw new NotFoundError('Generation history not found');
  }

  const updateData: Record<string, unknown> = {
    updatedAt: new Date().toISOString(),
  };

  if (body.prompt) updateData.prompt = body.prompt;
  if (body.config) updateData.config = body.config;
  if (body.messages) updateData.messages = body.messages;
  if (body.logoVersionIds) {
    updateData.logoVersionIds = JSON.stringify(body.logoVersionIds);
  }

  await db
    .updateTable('generation_history')
    .set(updateData)
    .where('id', '=', id)
    .execute();

  return Response.json({ id, success: true });
}

/**
 * Delete a generation history entry.
 */
export async function deleteHistory({
  params,
  ctx,
}: RequestInfo): Promise<Response> {
  const { id } = params;
  const db = ctx.db;

  const result = await db
    .deleteFrom('generation_history')
    .where('id', '=', id)
    .execute();

  if (!result || result.length === 0) {
    throw new NotFoundError('Generation history not found');
  }

  return Response.json({ success: true });
}
