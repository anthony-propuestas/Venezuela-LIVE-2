# Estructura de archivos y funcionamiento del sistema — Venezuela LIVE

Documentación del sistema actual: cómo están organizados los archivos, cómo fluyen las peticiones y qué convenciones se usan para identificar componentes.

---

## 1. Visión general del proyecto

- **Stack:** aplicación full-stack desplegada en **Cloudflare Pages**.
  - **Frontend:** React 19 + Vite 7, estilos con Tailwind CSS 4.
  - **Backend:** API sobre **Hono**, ejecutada como **Pages Functions** (no como Worker independiente).
- **Persistencia:** D1 (SQLite), KV (rate limit), R2 (fotos de perfil y PDFs de reportes).
- **Autenticación:** Google OAuth (JWT); en desarrollo opcional bypass con token `__dev_bypass__`.

El proyecto se identifica por:
- **Nombre en package.json:** `venezuela-live`.
- **Nombre en wrangler.json:** `venezuelalive` (sin guion;) 
-"VENEZUELA-LIVE-2" es el nombre del proyecto en Cloudflare.
- **Salida de build:** carpeta `dist/` (assets estáticos de Vite + `dist/functions/` con la función catch-all).
- **Configuración Cloudflare:** `wrangler.json` (D1, KV, R2, `pages_build_output_dir: "./dist"`). R2 tiene el binding principal `R2_BUCKET`; en wrangler aparece también un segundo binding `y` (mismo bucket), pero en el código solo se usa `R2_BUCKET`.

---

## 2. Árbol de directorios relevante

```
raíz/
├── index.html                 # Punto de entrada HTML; script type="module" → /src/client/main.jsx
├── package.json
├── vite.config.js             # Alias @client, @server, @shared; proxy /api/ → localhost:8787
├── wrangler.json              # Bindings D1, KV, R2; pages_build_output_dir: ./dist
├── jsconfig.json              # Mismos alias para el IDE (TypeScript/JS)
├── functions/
│   └── [[path]].ts            # Catch-all de Pages Functions: delega en app Hono
├── scripts/
│   ├── build-pages-functions.mjs   # Compila functions → dist/functions/, escribe _routes.json
│   ├── migrate-d1-local.ps1
│   └── migrate-d1-remote.ps1
├── migrations/                # SQL numerados: 0001_..., 0002_..., etc.
├── src/
│   ├── client/                # Frontend React
│   │   ├── main.jsx           # Monta React; ErrorProvider; GoogleOAuthProvider
│   │   ├── App.jsx            # Router lógico por estado (currentPage); toda la UI principal
│   │   ├── assets/
│   │   │   └── index.css      # Estilos globales + Tailwind
│   │   ├── context/
│   │   │   └── ErrorContext.jsx
│   │   ├── pages/
│   │   │   ├── Login/
│   │   │   │   └── Login.page.jsx
│   │   │   └── Profile/
│   │   │       └── Profile.page.jsx
│   │   └── services/
│   │       └── api.service.js # Cliente HTTP: Bearer token, /api/profile, reportes, premium, etc.
│   ├── server/                # Backend Hono (TypeScript)
│   │   ├── index.ts           # App Hono; rutas /api/*; fallback app.all('*') → ASSETS
│   │   ├── types.ts           # Env (D1, R2, KV, ASSETS, secrets)
│   │   ├── config.ts          # Lectura de GOOGLE_CLIENT_ID, CRON_SECRET, PREMIUM_ALIAS, DEV_BYPASS
│   │   ├── errors.ts          # ErrorCode, DomainError y subclases, mapErrorToResponseBody
│   │   ├── premium.ts         # Lógica premium: isUserPremium, createPaymentTicket, getTicketsByUser
│   │   ├── middlewares/
│   │   │   ├── auth.middleware.ts   # JWT (o bypass dev) en /api/* salvo cron
│   │   │   ├── errors.middleware.ts # Mapeo de errores a JSON
│   │   │   └── rateLimit.middleware.ts
│   │   ├── repositories/
│   │   │   ├── profile.repository.ts  # Perfil, foto_key, gamificación (D1)
│   │   │   └── r2.repository.ts       # get/put/delete objetos R2
│   │   └── domain/
│   │       ├── reports/       # Reportes PDF semanales
│   │       │   ├── controllers.ts
│   │       │   ├── service.ts
│   │       │   ├── dataLayer.ts
│   │       │   └── pdfEngine.ts
│   │       └── gamification/
│   │           ├── index.ts   # API pública del módulo
│   │           ├── types.ts
│   │           ├── errors.ts
│   │           ├── eventBus.ts
│   │           ├── service.ts
│   │           ├── listeners.ts
│   │           └── integration.ts
│   └── shared/
│       ├── constants.ts       # USERNAME_MIN, USERNAME_MAX, USERNAME_REGEX
│       └── types/
│           ├── api.types.ts   # User, ProfileUpdateBody
│           └── profile.types.ts
├── dist/                      # Generado: vite build + build-pages-functions
│   ├── index.html
│   ├── assets/
│   ├── _routes.json           # include: ["/*"], exclude: [] → toda la ruta por la Function
│   └── functions/
│       └── [[path]].js        # Bundle de functions/[[path]].ts
└── docs/
    └── Estructura de archivos.md  # Este documento
```

---

## 3. Cómo funciona el flujo de una petición

### 3.1 Entrada al backend (producción / dev Pages)

1. **Cloudflare Pages** recibe la petición.
2. **`_routes.json`** (generado por `build-pages-functions.mjs`) tiene `include: ["/*"]` y `exclude: []`, por lo que **todas** las rutas pasan por la Pages Function.
3. La función es **una sola:** `functions/[[path]].ts` compilada a `dist/functions/[[path]].js`. El nombre `[[path]]` es la convención de Pages para un **catch-all** (cualquier path).
4. Dentro de la función se hace:
   - `import { app } from '../src/server/index.js'`
   - `return await app.fetch(context.request, context.env, context.ctx)`  
   Si `app.fetch` lanza una excepción no capturada, la función catch-all captura el error y devuelve **500** con cuerpo `{ error: 'Error interno del servidor.', detail: <mensaje> }` (función `formatApiError` en `functions/[[path]].ts`). Es decir, hay **dos capas de manejo de errores:** la de Hono (`onError(createErrorHandler())`) para errores en las rutas, y esta captura en la función para fallos fuera del handler de Hono.
5. **Hono** en `src/server/index.ts`:
   - Aplica `createAuthMiddleware()` a `/api/*` (excepto `/api/cron/weekly-reports`).
   - Registra `onError(createErrorHandler())`.
   - Define rutas concretas para `/api/profile`, `/api/profile/photo`, `/api/actions/consume`, `/api/premium/*`, `/api/reports/weekly/*`, `/api/cron/weekly-reports`, etc.
   - **Fallback:** `app.all('*', ...)` hace `c.env.ASSETS.fetch(c.req.raw)` para servir el frontend estático (index.html, JS, CSS).

En resumen: **una sola función catch-all** recibe todo el tráfico y lo resuelve con la app Hono (API bajo `/api/` o assets con ASSETS).

### 3.2 Desarrollo local

- **`npm run dev`:** solo Vite; el frontend se sirve en el puerto por defecto de Vite. **`vite.config.js`** define `server.proxy: { '/api/': { target: 'http://localhost:8787' } }`, así que las peticiones a `/api/` se reenvían a `localhost:8787`. Para que la API responda en ese modo hay que tener el worker sirviendo en el puerto 8787 (por ejemplo ejecutar antes `npm run dev:worker` tras un `npm run build`, o otro proceso que sirva la función en 8787). Si se define `VITE_API_BASE_URL`, el cliente usará esa base en lugar de la ruta relativa (útil para previews).
- **`npm run dev:pages`:** ejecuta `vite build` y luego `wrangler pages dev dist --persist-to=%LOCALAPPDATA%\venezuela-live-wrangler` **sin** `--port`; Wrangler usa su puerto por defecto. Sirve tanto assets como la función desde `dist/` en un solo proceso.
- **`npm run dev:worker`:** igual que dev:pages pero con **`--port 8787`** explícito, para alinear con el proxy de Vite cuando se usa `npm run dev` en otra terminal.

---

## 4. Mecanismos para identificar componentes

### 4.1 Rutas API (backend)

- **Prefijo fijo:** todas las rutas de la API están bajo **`/api/`**.
- **Identificación por path y método:** por ejemplo `GET /api/profile`, `GET /api/profile/username/check`, `PUT /api/profile`, `POST /api/profile/photo`, `DELETE /api/profile/photo`, `GET /api/profile/photo` (devuelve la imagen), `POST /api/actions/consume`, `GET /api/premium/status`, `POST /api/premium/ticket`, `GET /api/reports/weekly/positives`, `GET /api/reports/weekly/negatives`, `GET /api/reports/weekly/volume`, `ALL /api/cron/weekly-reports`.
- **Excepción de autenticación:** la ruta `/api/cron/weekly-reports` no pasa por el middleware de auth; se protege con header `X-Cron-Secret`.
- No hay versionado explícito en la URL (ej. no hay `/api/v1/`).

### 4.2 Frontend: “rutas” y páginas

- **No hay router (React Router, etc.).** La “navegación” se hace con **estado en React:** `currentPage` en `App.jsx`. Valores usados: `'home'`, `'general'`, `'perfil'`, `'donations'`, `'nosotros'`, `'premium'`, `'menu'` (menú lateral).
- **Lista de páginas válidas:** la constante `VALID_PAGES` en `App.jsx` es **exactamente** `['home', 'general', 'perfil', 'donations', 'nosotros', 'premium']` — **no incluye** `'menu'`. Se usa solo para decidir a qué página volver al cerrar el menú (si `previousPageBeforeMenu` no está en `VALID_PAGES`, se vuelve a `'home'`).
- **Componentes de página:** se identifican por carpeta y sufijo:
  - `src/client/pages/Login/Login.page.jsx` → Login (y export de `LoginBypass`, `getStoredAuth`, `clearAuth`, `AUTH_PAUSED`).
  - `src/client/pages/Profile/Profile.page.jsx` → Perfil.
- El resto de vistas (home, general, menú, donations, nosotros, premium, notas de la comunidad, modales) están **dentro de `App.jsx`** como condicionales sobre `currentPage` o estado (ej. `selectedProposalForNotes`, `isModalOpen`, `rateLimitModal`).

### 4.3 Alias de módulos (@client, @server, @shared)

- **Definición:** en `vite.config.js` (resolve.alias) y en `jsconfig.json` (compilerOptions.paths).
- **Uso:** permite importar sin rutas relativas largas:
  - `@client/App`, `@client/pages/Login/Login.page`, `@client/context/ErrorContext`, `@client/services/api.service`, `@client/assets/index.css`
  - `@server/...` se usa sobre todo en el propio backend (p. ej. tipos, config).
  - `@shared/constants`, `@shared/types/api.types`, `@shared/types/profile.types`
- El **servidor** (Hono) importa desde `@shared` (p. ej. `USERNAME_MIN`, `USERNAME_MAX`, `USERNAME_REGEX`, tipos). En el build de `functions/[[path]].ts`, el script de build solo define alias para `@shared`; el resto del server usa rutas relativas o imports desde `../src/server/...`.

### 4.4 Convenciones de nombres de archivos

- **Middlewares:** sufijo **`.middleware.ts`** en `src/server/middlewares/` (auth, errors, rateLimit).
- **Repositorios:** sufijo **`.repository.ts`** en `src/server/repositories/` (acceso a D1 o R2).
- **Páginas cliente:** carpeta por feature y archivo **`Nombre.page.jsx`** (Login.page.jsx, Profile.page.jsx).
- **Dominios:** subcarpetas bajo `src/server/domain/` con nombres de capacidad:
  - **reports:** controladores, servicio, capa de datos, generación PDF.
  - **gamification:** event bus, servicio, listeners, integración, tipos, errores; se exporta todo desde `index.ts`.
- **Migraciones:** en `migrations/` con patrón **`NNNN_descripcion.sql`**. En el código existen exactamente **9 archivos:** `0001_create_profiles.sql`, `0002_add_username.sql`, `0003_create_proposals_schema.sql`, `0004_seed_proposals.sql`, `0005_create_achievements.sql`, `0006_create_user_achievements.sql`, `0007_add_gamification_to_profiles.sql`, `0008_add_is_premium_and_payment_tickets.sql`, `0009_add_unique_email_and_payment_reference.sql`. El número ordena la ejecución; no hay runner automático en el código, se ejecutan con scripts npm o PowerShell (`db:migrate:local:*`, `db:migrate:remote`, `migrate-d1-local.ps1`, `migrate-d1-remote.ps1`).

### 4.5 Identificación de errores

- **Códigos:** tipo **`ErrorCode`** en `src/server/errors.ts` (UNAUTHORIZED, INVALID_USERNAME_FORMAT, USERNAME_TAKEN, PROFILE_PHOTO_NOT_FOUND, RATE_LIMIT_EXCEEDED, etc.).
- **Clases:** jerarquía de **`DomainError`** con subclases (`ValidationError`, `NotFoundError`, `ConflictError`, `UnauthorizedError`, `RateLimitError`, `DependencyError`, `InternalError`), cada una con `code`, `status` y opcionalmente `fieldErrors`.
- **Respuestas:** el middleware de errores usa **`mapErrorToResponseBody`** para devolver JSON con `error` (código), `message`, y opcionalmente `detail` y `fieldErrors`. El `detail` (p. ej. stack) solo se incluye cuando **`isDevBypassAllowed(c.env)`** es verdadero, es decir cuando `env.DEV_BYPASS_ALLOWED === 'true'` (no es “cualquier modo dev”, sino esa variable). El cliente en `api.service.js` lee `data?.error` y `data?.message`; en 401 lanza `Error('SESSION_EXPIRED')`. El cuerpo de error está tipado como `ErrorResponseBody` en `errors.ts` (`error`, `message`, `detail?`, `fieldErrors?`).

### 4.6 Tipos compartidos y contratos

- **Usuario y perfil:** `User` y `ProfileUpdateBody` en `src/shared/types/api.types.ts`; el servidor usa `User` desde ahí y define `Env` en `src/server/types.ts`. En **`src/shared/types/profile.types.ts`** están definidos los tipos de respuesta de perfil: `ProfileResponse` (displayName, username, birthDate, description, ideologies, hasPhoto, isPremium, gamification), `GamificationInfo` (totalXp, achievements) y `AchievementItem` (id, name, description, earnedAt).
- **Constantes de validación:** `USERNAME_MIN`, `USERNAME_MAX`, `USERNAME_REGEX` en `src/shared/constants.ts`, usadas en el servidor para validar username.
- **Gamificación:** tipos propios en `src/server/domain/gamification/types.ts` (eventos, logros, etc.); el dominio se encapsula en `domain/gamification/` y se expone vía `index.ts`.

### 4.7 Autenticación y sesión en el cliente

- **Almacenamiento:** clave **`venezuelaLive_auth`** en `localStorage`; se espera un objeto con al menos `credential` (token JWT de Google).
- **Cliente API:** `api.service.js` lee ese credential y envía **`Authorization: Bearer <token>`** en todas las peticiones a la API. Si no hay credential o la API devuelve 401, se trata como sesión expirada (SESSION_EXPIRED).

---

## 5. Build y despliegue

1. **`npm run build`** ejecuta:
   - `vite build` → genera `dist/` con `index.html` y `assets/` (JS/CSS con hash).
   - `node scripts/build-pages-functions.mjs`:
     - Compila `functions/[[path]].ts` con esbuild a `dist/functions/[[path]].js`.
     - Escribe `dist/_routes.json` con `include: ["/*"]`, `exclude: []`.
2. **`npm run deploy`** hace `npm run build` y luego **`wrangler pages deploy dist --project-name=venezuela-live-2`**.

Los assets estáticos y la función catch-all viven juntos en `dist/`; Pages sirve primero la función y el fallback de Hono sirve los assets vía ASSETS.

---

## 6. Resumen de mecanismos de identificación

| Aspecto | Mecanismo |
|--------|-----------|
| **Rutas API** | Prefijo `/api/` + path y método HTTP en `src/server/index.ts`. |
| **Páginas UI** | Estado `currentPage` en `App.jsx`; constantes `VALID_PAGES`; archivos `*.page.jsx` en `pages/<Nombre>/`. |
| **Módulos** | Alias `@client`, `@server`, `@shared` (Vite + jsconfig). |
| **Capas del servidor** | Nombres de archivo: `.middleware.ts`, `.repository.ts`; dominio en `domain/<nombre>/` con controllers/service/dataLayer según el caso. |
| **Migraciones** | `migrations/NNNN_descripcion.sql`. |
| **Errores** | `ErrorCode` + clases `DomainError` y subclases; respuestas JSON con `error`, `message`, opcional `fieldErrors` y `detail`. |
| **Contratos client/server** | Tipos en `src/shared/types/`; constantes en `src/shared/constants.ts`. |
| **Entrada HTTP** | Una sola Pages Function catch-all `[[path]]` que delega en la app Hono; Hono enruta por path y sirve assets con ASSETS en el fallback. |

---

## 7. Auditoría: correcciones y datos verificados en código

Esta sección refleja lo que **realmente hace el código**, contrastado con la documentación anterior. Se ha actualizado el resto del documento para que coincida; aquí se resume lo añadido o corregido.

| Tema | Verificación en código | Ajuste en el documento |
|------|------------------------|-------------------------|
| **Nombre del proyecto** | `package.json`: `"name": "venezuela-live"`. `wrangler.json`: `"name": "venezuelalive"`. | Se añadió que en wrangler el nombre es `venezuelalive` (sin guion). |
| **R2** | En wrangler hay dos bindings de R2: `R2_BUCKET` y `y` (mismo bucket). En el servidor solo se usa `c.env.R2_BUCKET`. | Se aclara que el binding usado en código es `R2_BUCKET`; el otro existe en config. |
| **Manejo de errores** | `functions/[[path]].ts` tiene un `try/catch` alrededor de `app.fetch`; si falla, responde 500 con `{ error: 'Error interno del servidor.', detail: message }`. | Se documentan las dos capas: Hono `onError` para errores en rutas y la captura en la función para excepciones no manejadas. |
| **Rutas API** | Listado completo en `src/server/index.ts`: incluye `GET /api/profile/username/check`, `DELETE /api/profile/photo`, `GET /api/profile/photo`. | Se añadieron todas las rutas con método y path exactos. |
| **VALID_PAGES** | En `App.jsx` línea 93: `['home', 'general', 'perfil', 'donations', 'nosotros', 'premium']` — sin `'menu'`. | Se especifica la lista exacta y que `'menu'` no está en `VALID_PAGES` (solo se usa como valor de `currentPage` para la pantalla de menú). |
| **Dev local** | `dev:pages` no usa `--port`; `dev:worker` sí usa `--port 8787`. Proxy de Vite apunta a `http://localhost:8787`. | Se distingue dev:pages (puerto por defecto de Wrangler), dev:worker (8787) y que con `npm run dev` hace falta tener el worker en 8787 para que el proxy funcione. |
| **Cuerpo de error y cliente** | `mapErrorToResponseBody` devuelve `{ error, message, detail?, fieldErrors? }`. `includeDetail` se calcula con `isDevBypassAllowed(c.env)` (env `DEV_BYPASS_ALLOWED === 'true'`). Cliente usa `data?.error`, `data?.message` y en 401 lanza `SESSION_EXPIRED`. | Se aclara que `detail` depende de `DEV_BYPASS_ALLOWED`, no de NODE_ENV; se describe el uso en el cliente. |
| **Tipos compartidos perfil** | `profile.types.ts` define `ProfileResponse`, `GamificationInfo`, `AchievementItem`. | Se añade el contenido real de `profile.types.ts`. |
| **Migraciones** | Hay 9 archivos SQL con el patrón NNNN_nombre. | Se listan los 9 nombres y se mencionan los scripts de migración disponibles. |

Este documento describe el estado actual del sistema y de la estructura de archivos para referencia y mantenimiento, con las correcciones aplicadas tras la auditoría contra el código.
