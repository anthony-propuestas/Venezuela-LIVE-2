Plan aliases de paths (paso 7)

Los cambios relizados fueron exitosos

Hecho
7.1 — Copia

Contenido de src/worker/* copiado a src/server/ (index.ts, config, types, errors, rateLimit, premium, gamification/, reports/).
7.2 — Reorganización

Domain: Contenido de gamification/ y reports/ movido a domain/gamification/ y domain/reports/; eliminadas las carpetas antiguas en la raíz de server.
Repositories:
profileRepository.ts → repositories/profile.repository.ts (import de ../errors).
r2Repository.ts → repositories/r2.repository.ts (import de ../errors).
Eliminados los archivos originales en la raíz de server.
index.ts:
Imports de reportes: ./reports/controllers → ./domain/reports/controllers.
Imports de gamification: ./gamification/index.js → ./domain/gamification/index.js.
Imports de perfil/R2: ./profileRepository / ./r2Repository → ./repositories/profile.repository.js y ./repositories/r2.repository.js, añadido clearPhotoKey al import del profile repository.
7.3 — Entrypoint

functions/[[path]].ts: ../src/worker/index.js y ../src/worker/types.js reemplazados por ../src/server/index.js y ../src/server/types.js.
7.4 — wrangler.json

Revisado: no hay rutas ni referencias a src/worker/; solo bindings (D1, KV, R2) y pages_build_output_dir: "./dist".
Verificación

npm run build termina correctamente (Vite + Pages Functions).
Sin errores de linter en los archivos tocados.


1. Análisis documentado
En docs/Paso7-analisis-estado.md quedó:

Qué pedía el Paso 7 (7.1–7.4 y tabla de 7.2).
Qué estaba hecho antes de esta pasada: 7.1, 7.3, 7.4, repositories/, domain/.
Qué faltaba: Auth, rate limit y errors en middlewares/*.middleware.ts.

2. Completado: middlewares
Se añadieron los tres middlewares y se conectaron al app:

Archivo	Contenido
middlewares/auth.middleware.ts	verifyAuth, createAuthMiddleware() (JWT + bypass dev). Sustituye el app.use('/api/*', ...) que estaba en index.ts.
middlewares/errors.middleware.ts	createErrorHandler() (usa mapErrorToResponseBody y isDevBypassAllowed). Sustituye el app.onError(...) que estaba en index.ts.
middlewares/rateLimit.middleware.ts	Mismo contenido que el antiguo rateLimit.ts: checkAndIncrement, RateLimitAction, getLimitForAction.
index.ts: importa y usa createAuthMiddleware(), createErrorHandler() y checkAndIncrement / RateLimitAction desde los middlewares; se eliminó la lógica inline de auth y onError y las constantes/jwks de auth.
rateLimit.ts en la raíz de src/server se eliminó; todo el uso pasa por middlewares/rateLimit.middleware.ts.
3. Estado final del Paso 7
Ítem del plan	Estado
7.1 Copiar worker → server	Hecho
7.2 index.ts como app principal	Hecho
7.2 routes/*.routes.ts	Pendiente (refactor opcional)
7.2 controllers/*.controller.ts	Pendiente (refactor opcional)
7.2 repositories/*.repository.ts	Hecho
7.2 middlewares/*.middleware.ts	Hecho (auth, errors, rateLimit)
7.2 domain/ (gamification, reports)	Hecho
7.3 functions/[[path]].ts	Hecho
7.4 wrangler.json	Hecho