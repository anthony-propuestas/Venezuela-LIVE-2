# Paso 7 — Análisis: lo previsto vs lo realizado

## Lo que se debía hacer (según docs/todo.md 296-345)

| Ítem | Descripción | Estado |
|------|-------------|--------|
| **7.1** | Copiar `src/worker/*` a `src/server/` (sin mover aún). | **Hecho** |
| **7.2** | Reorganizar en `src/server/` según arquitectura de 3 capas: | |
| → | `index.ts` → permanece como App Hono principal | **Hecho** |
| → | Lógica de rutas mezclada → `routes/*.routes.ts` (solo definición HTTP) | **Pendiente** |
| → | Lógica de negocio → `controllers/*.controller.ts` (orquestación) | **Pendiente** |
| → | Queries D1/R2/KV → `repositories/*.repository.ts` | **Hecho** (profile.repository.ts, r2.repository.ts) |
| → | Auth, rate limit, errors → `middlewares/*.middleware.ts` | **Hecho** (auth.middleware.ts, errors.middleware.ts, rateLimit.middleware.ts) |
| → | Módulos gamification/reports → `domain/` | **Hecho** (domain/gamification, domain/reports) |
| **7.3** | Actualizar `functions/[[path]].ts`: import desde `../src/server/index` | **Hecho** |
| **7.4** | Verificar `wrangler.json` (sin rutas a src/worker/) | **Hecho** |

## Resumen

- **Completado:** 7.1, 7.3, 7.4, y la parte de 7.2 correspondiente a **repositories** y **domain**.
- **Completado en esta verificación:** extracción de **auth, rate limit y errors** a `middlewares/`: `auth.middleware.ts` (verifyAuth + createAuthMiddleware), `errors.middleware.ts` (createErrorHandler), `rateLimit.middleware.ts` (checkAndIncrement, RateLimitAction). Se eliminó `rateLimit.ts` de la raíz de server.
- **Opcional / refactor mayor:** separar rutas en `routes/*.routes.ts` y lógica en `controllers/*.controller.ts` (implica partir `index.ts` en varios archivos; se puede hacer en un paso posterior).
