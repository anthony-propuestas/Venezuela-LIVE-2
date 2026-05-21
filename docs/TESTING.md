# Testing — Venezuela LIVE

## Modo test sin Google OAuth

Establece `VITE_GOOGLE_AUTH_PAUSED=true` en `.env.development`. Con esto, cualquier usuario puede entrar sin autenticarse con Google: el middleware devuelve un usuario hardcoded `test-user`.

**Nunca uses `DEV_BYPASS_ALLOWED=true` en producción.**

Para activar el bypass también en el backend local:

```
# .dev.vars
DEV_BYPASS_ALLOWED=true
GOOGLE_CLIENT_ID=dummy
CRON_SECRET=dev-secret
```

Luego corre el servidor:

```bash
npm run dev:worker
```

---

## Test de sanitización de seguridad

```bash
npm run security:test:sanitize
```

Ejecuta `scripts/test-sanitize.mjs`, que verifica que DOMPurify elimina correctamente las cargas XSS conocidas. No requiere servidor activo.

---

## Migraciones locales

```bash
npm run db:migrate:local:safe
```

Ejecuta `scripts/migrate-d1-local.ps1`, que aplica todas las migraciones pendientes en la base D1 local de Wrangler (`.wrangler/state/`). Corre esto cada vez que agregues una migración nueva mientras desarrollas.

Para ver qué migraciones están pendientes sin aplicarlas:

```bash
wrangler d1 migrations list venezuela-live-db --local
```

---

## Probar endpoints de cron manualmente

Con el servidor corriendo en `http://localhost:8787`:

```bash
# Generar reportes semanales
curl -X POST http://localhost:8787/api/cron/weekly-reports \
  -H "X-Cron-Secret: dev-secret"

# Sanitizar fotos de perfil existentes (primer lote)
curl -X POST http://localhost:8787/api/cron/profile-photos-sanitize \
  -H "X-Cron-Secret: dev-secret"

# Siguiente lote (con cursor)
curl -X POST "http://localhost:8787/api/cron/profile-photos-sanitize?cursor=<cursor>" \
  -H "X-Cron-Secret: dev-secret"
```

---

## Variables de entorno necesarias para dev/test

| Variable | Valor para dev |
|----------|---------------|
| `VITE_GOOGLE_AUTH_PAUSED` | `true` |
| `DEV_BYPASS_ALLOWED` | `true` |
| `GOOGLE_CLIENT_ID` | cualquier string |
| `CRON_SECRET` | cualquier string (ej. `dev-secret`) |

---

## Flujo de prueba manual completo

1. `npm run db:migrate:local:safe` — aplica migraciones.
2. `npm run dev` — arranca Vite con el proxy a `localhost:8787`.
3. Abre `http://localhost:5173` — entra sin Google (modo test).
4. Edita perfil, sube foto, crea contrapropuesta.
5. Verifica gamificación en `GET /api/profile`.
6. Llama al cron y descarga un reporte PDF de `/api/reports/weekly/positives`.
