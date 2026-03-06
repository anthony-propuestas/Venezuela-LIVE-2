/// <reference types="@cloudflare/workers-types" />
/**
 * Catch-all de Pages Functions: delega en la app Hono.
 * EventContext nativo de Pages; env (D1, KV, R2, ASSETS) viene en context.env.
 */
import { app } from '../src/worker/index.js';
import type { Env } from '../src/worker/types.js';

/** Contexto nativo de Pages Functions (request, env, params, next, waitUntil, etc.). */
interface PagesEventContext {
  request: Request;
  env: Env;
  ctx: ExecutionContext;
  params: Record<string, string | string[]>;
  functionPath: string;
  next: (input?: Request | string, init?: RequestInit) => Promise<Response>;
  waitUntil: (promise: Promise<unknown>) => void;
  passThroughOnException: () => void;
}

function formatApiError(err: unknown): Response {
  const message = err instanceof Error ? err.message : 'Error interno del servidor';
  return new Response(
    JSON.stringify({
      error: 'Error interno del servidor.',
      detail: message,
    }),
    { status: 500, headers: { 'Content-Type': 'application/json' } }
  );
}

export async function onRequest(context: PagesEventContext): Promise<Response> {
  try {
    return await app.fetch(context.request, context.env, context.ctx);
  } catch (err) {
    console.error('[Pages Function]', err);
    return formatApiError(err);
  }
}
