# Venezuela LIVE

Aplicación web desplegada en **Cloudflare Pages** (assets estáticos + Pages Functions). El backend es una API REST servida por un catch-all de Pages que delega en **Hono**; las bases de datos **D1**, almacenes **KV** y **R2** se inyectan mediante `context.env`.

---

## Índice

- [Stack tecnológico](#stack-tecnológico)
- [Estructura del proyecto](#estructura-del-proyecto)
- [Funcionalidades](#funcionalidades)
- [Seguridad (Fase 1)](#seguridad-fase-1)
- [API](#api)
- [Base de datos y migraciones](#base-de-datos-y-migraciones)
- [Desarrollo local](#desarrollo-local)
- [Modo pruebas (sin Google)](#modo-pruebas-sin-google)
- [Producción](#producción)
- [Solución de problemas](#solución-de-problemas)

---

## Stack tecnológico

| Capa | Tecnología |
|------|------------|
| **Frontend** | React 19, Vite 7, Tailwind CSS 4, Lucide React |
| **Auth** | Google OAuth 2.0 (JWT verificado con JWKS) |
| **Backend** | Hono (API), Pages Functions (catch-all `[[path]]`) |
| **Base de datos** | Cloudflare D1 (SQLite) |
| **Almacenamiento** | R2 (fotos de perfil, PDFs de reportes) |
| **Rate limiting** | Cloudflare KV (cuotas diarias por usuario) |
| **Build** | Vite + script que compila Functions a `dist/functions/` |

---

## Estructura del proyecto

```
├── index.html, main.jsx, app.jsx     # Entrada React y app principal
├── Profile.jsx, login.jsx            # Pantallas de perfil y login
├── api.js                            # Cliente API del frontend (perfil, foto, premium, etc.)
├── ErrorContext.jsx                  # Contexto global de errores y banner
├── index.css                         # Estilos globales (Tailwind)
├── vite.config.js                    # Vite + proxy /api/ → worker
├── tailwind.config.cjs               # Configuración Tailwind
│
├── functions/
│   └── [[path]].ts                   # Catch-all Pages: recibe todas las rutas y delega en Hono
│
├── src/worker/                       # Lógica del backend (Hono)
│   ├── index.ts                      # App Hono: rutas, auth, middleware
│   ├── config.ts                     # Lectura de env (client ID, cron secret, premium alias)
│   ├── types.ts                      # Env, User y tipos compartidos
│   ├── errors.ts                     # Errores de dominio y mapeo a JSON
│   ├── profileRepository.ts          # CRUD perfiles, foto key, gamificación (totalXp, logros)
│   ├── r2Repository.ts               # Subida/lectura/borrado de objetos en R2
│   ├── rateLimit.ts                  # Rate limiting por acción (likes, comments, proposals)
│   ├── premium.ts                    # Estado premium y tickets de pago
│   ├── reports/                      # Reportes PDF semanales
│   │   ├── controllers.ts            # GET reportes + handler del cron
│   │   ├── service.ts                # Job semanal y generación on-demand
│   │   ├── dataLayer.ts              # Consultas D1 para datos de reportes
│   │   └── pdfEngine.ts              # Generación de PDFs
│   └── gamification/                 # Sistema de XP y logros (event-driven)
│       ├── index.ts                  # Exports del módulo
│       ├── types.ts                  # Eventos, payloads, BASE_XP
│       ├── eventBus.ts               # Pub/sub de eventos
│       ├── service.ts                # Procesamiento ACID (D1 batch), asignación XP y logros
│       ├── listeners.ts              # Registro del listener que consume eventos
│       ├── integration.ts            # Emisión de eventos desde la API
│       └── errors.ts                 # GamificationError
│
├── migrations/                       # SQL para D1 (orden 0001…0009)
├── scripts/
│   ├── build-pages-functions.mjs     # Compila functions/ → dist/functions/
│   ├── migrate-d1-local.ps1          # Ejecuta todas las migraciones en D1 local
│   └── migrate-d1-remote.ps1         # Ejecuta migraciones en D1 remoto
├── wrangler.json                     # Configuración Pages (D1, KV, R2, vars)
└── package.json                      # Scripts npm (dev, build, deploy, migraciones)
```

---

## Funcionalidades

- **Perfil de usuario**: nombre para mostrar, nombre de usuario único, fecha de nacimiento, descripción, ideologías. Persistencia en D1.
- **Foto de perfil**: subida/consulta/eliminación en R2; tipos permitidos JPG, PNG, WebP; máximo 2 MB.
- **Nombre de usuario**: validación (longitud, caracteres), comprobación de disponibilidad (`/api/profile/username/check`), unicidad en base de datos.
- **Gamificación**: eventos (contrapropuestas, likes, dislikes, comentarios, notas) generan XP y desbloquean logros; total XP y logros se devuelven en `GET /api/profile`.
- **Freemium y rate limiting**: usuarios no premium tienen límites diarios (likes, comentarios, propuestas); el frontend puede consumir cuota con `POST /api/actions/consume`. Usuarios premium no están limitados.
- **Premium**: estado `isPremium` en perfil; tickets de pago (referencia, fecha, monto) para solicitar activación; alias de pago mostrado en la app (configurable por variable de entorno).
- **Reportes semanales**: tres reportes PDF (consenso, rechazo, conflicto) generados por un job que puede ejecutarse vía cron HTTP; también descarga bajo demanda si no existe en R2.

---

## Seguridad (Fase 1)

La **Fase 1 del Plan de acción global** se centra en reducir superficie de ataque y mitigar riesgos de XSS y vulnerabilidades conocidas en dependencias. En Venezuela LIVE esta fase está **implementada** y documentada en:

- `docs/A1 revision de dependencias estaticas.md`
- `docs/A2 renderizado no escapado.md`
- `docs/A3 plan integracion DOMPurify sanitizacion.md`

### A1 – Revisión de dependencias estáticas (npm)

- Se ejecutó una **auditoría de dependencias** con `npm audit` y `npm outdated`, corrigiendo vulnerabilidades reportadas (incluida una de severidad alta en `hono`) hasta dejar el estado actual con **0 vulnerabilidades critical/high** tras la remediación.
- Se dejó registrada una baseline en la tabla de auditoría de `docs/A1 revision de dependencias estaticas.md` (incluyendo la fecha y el resultado del último `npm audit`).
- En GitHub se configuró **Dependabot para npm**, de forma que las futuras actualizaciones de seguridad y versiones obsoletas generen PRs automáticos y alertas.

Comandos útiles:

- `npm audit` — estado de vulnerabilidades conocidas.
- `npm outdated` — dependencias desactualizadas.

### A2 – Renderizado no escapado (XSS)

- Se realizó una **auditoría de renderizado** buscando patrones de riesgo típicos de XSS: `dangerouslySetInnerHTML`, asignaciones a `.innerHTML`, `document.write`, `insertAdjacentHTML`, `createContextualFragment`, `.html()`, atributos con `javascript:` / `data:text/html`, etc.
- El análisis, ejecutado con `rg` (ripgrep) sobre `src/client`, `src/server`, `functions` e `index.html`, confirmó que:
  - El frontend React solo renderiza datos de usuario mediante **interpolación JSX escapada** (`{variable}`), sin usar HTML crudo.
  - El servidor devuelve JSON y no inyecta HTML en el DOM del cliente.
  - No hay uso de APIs DOM peligrosas ni de `dangerouslySetInnerHTML` en código ejecutable.
- Resultado: **0 hallazgos críticos/altos** de XSS por renderizado no escapado. El detalle está en `docs/A2 renderizado no escapado.md`.

### A3 – Sanitización estricta con DOMPurify

Aunque hoy no se renderiza HTML crudo, se dejó lista una defensa fuerte para cualquier uso futuro de HTML enriquecido:

- Se añadió **DOMPurify** al proyecto:
  - Dependencias: `dompurify` y `@types/dompurify` en `package.json`.
- Se creó un **módulo central de sanitización**:
  - `src/client/utils/sanitize.js` expone `sanitizeHtml(dirty)`, que aplica DOMPurify con configuración estricta (`FORBID_TAGS` incluyendo `script`, `iframe`, `object`, `embed`, `form`, etc.).
- Se creó un **componente React seguro**:
  - `src/client/components/SafeHtml.jsx` renderiza `<Tag dangerouslySetInnerHTML={{ __html: sanitizeHtml(html) }} />`.
  - La política es que **cualquier HTML de usuario/terceros** que se quiera mostrar debe pasar por este componente (o por `sanitizeHtml`).
- Se añadió un **self-test automatizado de sanitización**:
  - Script: `scripts/test-sanitize.mjs` usando `jsdom` + DOMPurify.
  - Verifica que se eliminan `<script>`, enlaces `javascript:...` y atributos como `onerror`.
  - Script npm: `"security:test:sanitize": "node ./scripts/test-sanitize.mjs"`.

Comandos de verificación:

- `npm run security:test:sanitize` — comprueba que DOMPurify bloquea payloads XSS típicos.
- `npm run build` — build de la app con la integración de DOMPurify activa.

Con A1, A2 y A3 implementados, la Fase 1 de hardening descrita en el `Plan de accion global` está completada para este repositorio.

---

## API

Todos los endpoints bajo `/api/*` requieren autenticación con Bearer JWT (Google), excepto el cron semanal que usa un header de secreto.

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/profile` | Obtiene perfil (datos, gamificación, isPremium). |
| PUT | `/api/profile` | Actualiza perfil (displayName, username, birthDate, description, ideologies). |
| GET | `/api/profile/username/check?username=...` | Comprueba disponibilidad del nombre de usuario. |
| GET | `/api/profile/photo` | Devuelve la foto de perfil (stream). |
| POST | `/api/profile/photo` | Sube foto (multipart, campo `photo`). |
| DELETE | `/api/profile/photo` | Elimina la foto de perfil. |
| POST | `/api/actions/consume` | Consume cuota de rate limit (body: `{ "action": "likes" \| "comments" \| "proposals" }`). Devuelve 429 si se supera el límite. |
| GET | `/api/premium/status` | Estado premium, alias de pago y lista de tickets. |
| POST | `/api/premium/ticket` | Crea ticket de pago (reference, paymentDate, amount). |
| GET | `/api/reports/weekly/positives` | Descarga PDF reporte consenso. |
| GET | `/api/reports/weekly/negatives` | Descarga PDF reporte rechazo. |
| GET | `/api/reports/weekly/volume` | Descarga PDF reporte conflicto. |
| GET/POST | `/api/cron/weekly-reports` | Ejecuta el job semanal de reportes. Requiere header `X-Cron-Secret`. |

Las respuestas de error siguen un cuerpo JSON con `error`, `message` y opcionalmente `fieldErrors` o `detail` (solo en desarrollo si está habilitado el bypass).

---

## Base de datos y migraciones

La base D1 se configura en `wrangler.json` (binding `DB`). Las migraciones están en `migrations/` en orden numérico:

- Perfiles (user_id, email, display_name, username, birth_date, description, ideologies, photo_key, total_xp, contadores de gamificación, is_premium).
- Propuestas y esquemas relacionados.
- Logros y `user_achievements`.
- Premium: `payment_tickets` (id, user_id, reference, payment_date, amount, status, created_at) y restricciones de unicidad según corresponda.

Para entorno local se usa un script que aplica todas las migraciones contra la base D1 local (persistida en una carpeta del sistema). En producción se usan los scripts de migración remota.

---

## Desarrollo local

### Opción A – Todo en Pages (recomendado)

1. **Dependencias:** `npm install`
2. **Variables de entorno:** Crea `.dev.vars` en la raíz (o configura los secrets con Wrangler). Necesitas el mismo Client ID de Google que en el frontend para que el JWT sea válido. No subas `.dev.vars` al repositorio.
3. **D1 local:** Ejecuta una vez `npm run db:migrate:local:safe` (aplica todas las migraciones).
4. **Build y servidor:** `npm run build` y luego `npm run dev:pages` (o `wrangler pages dev dist` con la opción de persistencia que uses). Abre la URL que indique Wrangler (por defecto `http://localhost:8787`).

### Opción B – Frontend en Vite con proxy (API en otro proceso)

1. **Dependencias:** `npm install`
2. **D1 local:** `npm run db:migrate:local:safe`
3. **Terminal 1 – API:** `npm run build` y luego `npm run dev:worker` (Pages en el puerto 8787).
4. **Terminal 2 – Frontend:** `npm run dev` (Vite en el puerto 5173; en `vite.config.js` el proxy `/api/` apunta a `http://localhost:8787`).
5. Abre **http://localhost:5173**.

Si en la parte superior de la app aparece el mensaje de que no se pudo conectar al servidor y que ejecutes `npm run dev:worker`, el backend no está en marcha o el proxy no puede alcanzar el puerto 8787. Solución: tener dos terminales abiertas, una con `npm run dev:worker` y otra con `npm run dev`, y recargar la página.

**Orden recomendado al empezar:**  
`npm run db:migrate:local:safe` (una vez) → `npm run dev:worker` → `npm run dev` → abrir http://localhost:5173.

---

## Modo pruebas (sin Google)

Para permitir entrar sin iniciar sesión con Google (útil en desarrollo):

- **Frontend:** En `.env.development` o `.env.local` define `VITE_GOOGLE_AUTH_PAUSED=true`. En la pantalla de login aparecerá el botón **"Entrar (modo pruebas)"** y no se usará Google.
- **Worker:** Con el entorno `dev` y la variable de bypass habilitada, las rutas de perfil y foto aceptan un token especial de pruebas; el usuario de pruebas se usa cuando el frontend está en modo pausado.

Para volver a exigir Google, quita la variable o ponla en `false`. En producción no uses el modo pausado ni expongas el bypass.

---

## Producción

- **Deploy:** `npm run deploy` — compila (Vite + Pages Functions en `dist/`) y despliega con Wrangler al proyecto de Pages configurado. No uses modo pruebas ni bypass en producción.
- **Secrets:** En el dashboard del proyecto Pages (o con Wrangler) configura las variables secretas necesarias para OAuth y, si aplica, para el cron semanal. No guardes claves ni secretos en el código ni en el README.
- **Cron semanal (reportes):** Pages no soporta workers programados. Usa el endpoint `GET` o `POST` `/api/cron/weekly-reports` con el header `X-Cron-Secret` (solo header, no en query). Configura un Cron Trigger en Cloudflare que llame a esa URL con el secreto (por ejemplo, domingos a las 23:59).

---

## Solución de problemas

| Síntoma | Causa | Solución |
|--------|--------|----------|
| **500 en `/api/profile`** | La tabla `profiles` (o columnas esperadas) no existe en D1 local. | Ejecuta `npm run db:migrate:local:safe` y reinicia el worker (`npm run dev:worker`). |
| **SQLITE_READONLY al migrar** | El worker tiene la base abierta o la carpeta del proyecto no permite escritura. | Cierra el worker y ejecuta `npm run db:migrate:local:safe`. El script usa la carpeta de persistencia local de Wrangler. |
| **net::ERR_CONNECTION_REFUSED** en `localhost:5173/api/...` | El frontend (Vite) o el worker no está en marcha; las peticiones `/api` pasan por Vite y se reenvían al puerto 8787. | Abre dos terminales: en una `npm run dev:worker`, en la otra `npm run dev`. Comprueba que ambos sigan en ejecución. |
| **[vite] server connection lost** | Vite se reinició o se cerró. | Vuelve a ejecutar `npm run dev` y recarga la página. |
| Muchos errores seguidos en consola | El servidor dejó de responder pero la app sigue intentando cargar o guardar el perfil. | Reinicia el worker y Vite, recarga la página. |

---

## Scripts npm principales

| Script | Descripción |
|--------|-------------|
| `npm run dev` | Arranca Vite (frontend) en modo desarrollo. |
| `npm run build` | Vite build + compilación de Pages Functions a `dist/`. |
| `npm run dev:pages` | Build + `wrangler pages dev dist` (todo en uno). |
| `npm run dev:worker` | `wrangler pages dev dist` en el puerto 8787 (para usarlo con Vite en otra terminal). |
| `npm run deploy` | Build + despliegue a Cloudflare Pages. |
| `npm run db:migrate:local:safe` | Aplica todas las migraciones a la base D1 local (script PowerShell). |
| `npm run db:migrate:remote` | Aplica migraciones a la base D1 remota (script PowerShell). |
| `npm run check:apis` | Migraciones locales + build (útil para comprobar que todo compila y la BD está al día). |
