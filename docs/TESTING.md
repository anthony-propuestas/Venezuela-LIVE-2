# Testing — Venezuela LIVE

## Modo test sin Google OAuth

Para hacer funcionar la app sin Google OAuth se necesitan dos ajustes:

1. **Frontend** — `.env.development`:
   Establece `VITE_GOOGLE_AUTH_PAUSED=true`. El cliente muestra el botón "Entrar (modo pruebas)" en lugar del login de Google y almacena la credencial `__dev_bypass__` en memoria.

2. **Backend** — `.dev.vars`:
   Establece `DEV_BYPASS_ALLOWED=true`. El middleware acepta el header `Authorization: Bearer __dev_bypass__` sin verificar contra Google JWKS y resuelve el usuario como `{ userId: 'dev-bypass-user', email: 'pruebas@local', role: 'user' }`.

```
# .dev.vars
DEV_BYPASS_ALLOWED=true
GOOGLE_CLIENT_ID=dummy
CRON_SECRET=dev-secret
```

**Nunca uses `DEV_BYPASS_ALLOWED=true` en producción.**

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

## Unit tests

```bash
npm test
```

Ejecuta Vitest sobre todo el proyecto (cliente y servidor). La suite de servidor usa mocks; no requiere servidor activo ni base de datos.

Archivos de test:

- `src/client/pages/Login/Login.page.test.jsx` — cubre `typewriterStep(state, topics)`: avanza o retrocede un carácter en el efecto typewriter, cicla entre temas cuando el texto queda vacío.
- `src/server/index.test.ts` — cubre las rutas principales del servidor con mocks de D1, KV y R2.
- `src/server/middlewares/auth.middleware.test.ts` — cubre el middleware de autenticación con JWKS mockeado.

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
