# Deployment — Venezuela LIVE

El proyecto se despliega en **Cloudflare Pages** con Pages Functions (no Workers standalone).

---

## Requisitos previos

- Node.js 18+
- Wrangler CLI: `npm install -g wrangler`
- Cuenta Cloudflare con el proyecto `venezuela-live-2` creado en Pages
- Bindings configurados en el dashboard de Cloudflare Pages (D1, KV, R2)

---

## Build

```bash
npm run build
```

Ejecuta dos pasos:
1. **Vite** — compila el frontend React a `dist/`.
2. **`scripts/build-pages-functions.mjs`** — compila `functions/[[path]].ts` (que importa el servidor Hono) a `dist/functions/`.

El resultado en `dist/` es lo que se despliega. El archivo `public/_headers` se incluye en `dist/` y Cloudflare Pages lo aplica automáticamente a todas las rutas (security headers HTTP).

---

## Deploy a Cloudflare Pages

```bash
npm run deploy
```

Equivale a `npm run build && wrangler pages deploy dist --project-name=venezuela-live-2`.

Wrangler sube los assets y las Functions. El tráfico entra por Pages, pasa al catch-all `[[path]].ts` y llega a Hono.

---

## Migraciones D1 en producción

Aplica cada migración nueva **antes** de hacer deploy del código que la requiere:

```bash
wrangler d1 migrations apply venezuela-live-db --remote
```

Para ver el estado:

```bash
wrangler d1 migrations list venezuela-live-db --remote
```

---

## Variables de entorno en producción

Configúralas en **Cloudflare Pages > Settings > Environment Variables** (o con Wrangler secrets):

| Variable | Descripción |
|----------|-------------|
| `GOOGLE_CLIENT_ID` | Client ID de la app OAuth en Google Cloud Console |
| `CRON_SECRET` | Secret para autenticar requests a `/api/cron/*` |
| `DEV_BYPASS_ALLOWED` | Debe ser `"false"` en producción |

Las vars `VITE_*` se inyectan en tiempo de build y quedan hardcodeadas en el JS del cliente. No las uses para datos sensibles.

---

## Bindings necesarios en Cloudflare Pages

Configúralos en el dashboard bajo **Settings > Functions > Bindings**:

| Tipo | Binding name | Recurso |
|------|-------------|---------|
| D1 | `DB` | `venezuela-live-db` |
| KV | `RATE_LIMIT_KV` | namespace de rate limiting |
| R2 | `R2_BUCKET` | bucket de fotos y PDFs |

---

## Cron job semanal

Cloudflare Pages no tiene Scheduled Workers nativos. El cron se invoca externamente (ej. con un Worker Cron Trigger separado, o un servicio externo) llamando a:

```
POST https://tu-dominio.pages.dev/api/cron/weekly-reports
X-Cron-Secret: <CRON_SECRET>
```

---

## Dev local con Wrangler (simulando Pages)

```bash
npm run dev:pages   # build + wrangler pages dev (puerto 8788 por defecto)
npm run dev:worker  # build + wrangler pages dev en puerto 8787
```

Esto simula los bindings D1/KV/R2 localmente con `.wrangler/state/`.
