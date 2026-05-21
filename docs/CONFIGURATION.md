# Configuration — Venezuela LIVE

## Variables de entorno

### Frontend (Vite — `VITE_*`)

Se inyectan en tiempo de build. Quedan hardcodeadas en el bundle JS del cliente. **No las uses para secretos.**

| Variable | Valores | Descripción |
|----------|---------|-------------|
| `VITE_GOOGLE_AUTH_PAUSED` | `true` / `false` | `true` desactiva Google OAuth; cualquiera entra sin autenticarse. Solo para desarrollo. |
| `VITE_SUGGESTIONS_EMAIL` | email | Email para el formulario "Sugerir categoría" (opcional). |

### Backend (Worker/Pages Functions)

Se configuran en `.dev.vars` (local) o en el dashboard de Cloudflare Pages (producción).

| Variable | Requerida | Descripción |
|----------|-----------|-------------|
| `GOOGLE_CLIENT_ID` | Sí | Client ID de la app OAuth en Google Cloud Console. También acepta `VITE_GOOGLE_CLIENT_ID`. |
| `CRON_SECRET` | Sí | Secreto para autenticar requests a `/api/cron/*` via header `X-Cron-Secret`. |
| `ADMIN_EMAIL` | Sí | Email del administrador para login en el panel (`POST /api/admin/login`). |
| `ADMIN_PASSWORD` | Sí | Contraseña de admin y clave de firma del JWT admin (HS256, 8h). |
| `DEV_BYPASS_ALLOWED` | No | `"true"` activa el bypass de auth en dev. Nunca `"true"` en producción. |
| `PREMIUM_ALIAS` | No | Número de cuenta/alias para pagos, visible en la UI. Default: `"0000 0000 0000 0000 0000 0000"`. |
| `ALLOWLIST_EMAILS` | No | Emails autorizados, separados por coma. Si está vacía o ausente, no se aplica filtrado. Si tiene valor, el middleware bloquea con 403 a cualquier email no listado. |

---

## Archivos de configuración

### `.env.example`
Plantilla de variables de entorno para el frontend. Cópialo a `.env.development` para desarrollo local.

### `.dev.vars`
Variables de entorno para el backend local (Wrangler). No se commitea. Estructura:

```
GOOGLE_CLIENT_ID=tu-client-id.apps.googleusercontent.com
CRON_SECRET=un-secreto-largo-y-aleatorio
DEV_BYPASS_ALLOWED=true
```

### `wrangler.json`
Configuración de Cloudflare Pages/Workers. Define:

| Campo | Valor | Descripción |
|-------|-------|-------------|
| `name` | `venezuelalive` | Nombre del proyecto en Wrangler |
| `compatibility_date` | `2025-06-17` | Fecha de compatibilidad de la API Workers |
| `compatibility_flags` | `["nodejs_compat"]` | Habilita APIs de Node.js en el Worker |
| `pages_build_output_dir` | `./dist` | Carpeta de output del build |
| `vars.DEV_BYPASS_ALLOWED` | `"false"` | Valor por defecto (producción) |
| `vars.PREMIUM_ALIAS` | string | Alias de pago por defecto |

**Bindings declarados en `wrangler.json`:**

```json
"d1_databases": [{ "binding": "DB", "database_name": "venezuela-live-db" }],
"kv_namespaces": [
  { "binding": "RATE_LIMIT_KV", "id": "..." }
],
"r2_buckets": [{ "binding": "R2_BUCKET", "bucket_name": "..." }]
```

### `vite.config.js`
- Build target: `dist/`
- Proxy: requests a `/api/*` se redirigen a `http://localhost:8787` en dev.
- Plugin React para JSX.

### `tailwind.config.cjs`
Configura Tailwind CSS 4. El contenido scaneado incluye `src/**/*.{js,jsx,ts,tsx}`.

### `jsconfig.json`
Path aliases para el frontend. Permite importar desde `@shared/` → `src/shared/`.

---

## Configuración de Google OAuth

1. Ve a [Google Cloud Console](https://console.cloud.google.com/).
2. Crea un proyecto y habilita la API de Google Sign-In.
3. En Credenciales, crea un **OAuth 2.0 Client ID** (tipo: Web application).
4. Agrega los orígenes autorizados (ej. `https://tu-app.pages.dev`, `http://localhost:5173`).
5. Copia el Client ID y ponlo en `GOOGLE_CLIENT_ID` (backend) y como variable de build si la UI lo necesita.
