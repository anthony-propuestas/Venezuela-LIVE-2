/// <reference types="@cloudflare/workers-types" />
import type { Context } from 'hono';
import { mapErrorToResponseBody } from '../errors.js';
import { isDevBypassAllowed } from '../config.js';
import type { Env } from '../types.js';
import type { User } from '../types.js';

type AppBindings = { Bindings: Env; Variables: { user: User } };

/** Handler global de errores de Hono: serializa DomainError a JSON y oculta detalle en producción. */
export function createErrorHandler() {
  return (err: unknown, c: Context<AppBindings>) => {
    console.error('Unhandled error in Hono app:', err);
    const includeDetail = isDevBypassAllowed(c.env);
    const { status, body } = mapErrorToResponseBody(err, includeDetail);
    return c.json(body, status);
  };
}
