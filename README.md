## Venezuela LIVE

Proyecto **Cloudflare Pages** (assets + Pages Functions). La API corre en un catch-all de Pages (`/functions`) con Hono; D1, KV y R2 se inyectan vía `context.env`.

### Desarrollo local

**Opción A – Pages (recomendado)**

1. Instala dependencias: `npm install`
2. Secrets: `npx wrangler pages secret put GOOGLE_CLIENT_ID` (mismo Client ID que en el frontend).
3. D1 local: `npm run db:migrate:local:safe` (y el resto de migraciones si aplica).
4. Build y servidor Pages: `npm run build` y luego `npm run dev:pages` (o `wrangler pages dev dist`). Abre la URL que indique Wrangler (por defecto `http://localhost:8787`).

**Opción B – Frontend en Vite con proxy (API en otro proceso)**

1. Instala dependencias: `npm install`
2. D1 local: `npm run db:migrate:local:safe`
3. Terminal 1 – API (Pages local): `npm run build` y luego `npm run dev:worker` (en este proyecto `dev:worker` ejecuta `wrangler pages dev dist`).
4. Terminal 2 – Frontend: `npm run dev` (puerto 5173; en `vite.config.js` el proxy `/api/` puede apuntar al puerto que use `wrangler pages dev`).
5. Abre http://localhost:5173

Si ves en la parte superior de la app el mensaje:

- **\"No se pudo conectar al servidor. ¿Está el worker en marcha? Ejecuta en otra terminal: npm run dev:worker\"**

significa que el backend (worker) no está en marcha o que Vite no puede reenviar las peticiones `/api/...` al puerto 8787. En ese caso:

- Abre **una terminal** y ejecuta `npm run dev:worker`.
- Abre **otra terminal** y ejecuta `npm run dev`.
- Recarga la página de Perfil y comprueba en DevTools que las peticiones a `/api/profile` y `/api/profile/photo` ya responden sin errores.

### Pausar la autenticación con Google (modo pruebas)

Para que cualquiera pueda entrar sin iniciar sesión con Google (útil para pruebas):

- **Frontend:** en `.env.development` (o `.env.local`) define `VITE_GOOGLE_AUTH_PAUSED=true`. En la pantalla de login aparecerá el botón **"Entrar (modo pruebas)"** y no se usará Google.
- **Worker:** `npm run dev:worker` ya usa el entorno `dev`, que tiene `DEV_BYPASS_ALLOWED=true`, así que las rutas `/api/profile` y foto funcionarán con el usuario de pruebas cuando el frontend está en modo pausado.

Para volver a exigir Google: quita o pon en `false` la variable `VITE_GOOGLE_AUTH_PAUSED`. En producción no uses `true` ni expongas el bypass del worker.

### Solución de problemas

| Síntoma | Causa | Solución |
|--------|--------|----------|
| **500 Internal Server Error** en `/api/profile` | La tabla `profiles` no existe en la base D1 local. | Ejecuta `npm run db:migrate:local:safe` y reinicia el worker (`npm run dev:worker`). |
| **SQLITE_READONLY** al migrar | El worker tiene la BD abierta, o la carpeta del proyecto (p. ej. Desktop) impide escritura. | Cierra el worker y ejecuta `npm run db:migrate:local:safe`. El script usa `%LOCALAPPDATA%\venezuela-live-wrangler`. |
| **net::ERR_CONNECTION_REFUSED** en `localhost:5173/api/profile` | El frontend (Vite) o el worker no está en marcha. Las peticiones a `/api` pasan por Vite (5173) y este redirige al worker (8787). | Abre **dos terminales**: en una ejecuta `npm run dev:worker` (puerto 8787) y en la otra `npm run dev` (puerto 5173). Asegúrate de que ambos sigan corriendo. |
| **[vite] server connection lost** | Vite se reinició o se cerró (por ejemplo al guardar archivos o al caerse el proceso). | Vuelve a ejecutar `npm run dev` en la terminal del frontend. Recarga la página. |
| Muchos errores seguidos en consola (cientos) | El servidor cayó pero la app sigue intentando cargar/guardar el perfil. | Arranca de nuevo el worker y Vite (ver puntos anteriores). Recarga la página. |

**Orden recomendado al empezar:** primero `npm run db:migrate:local:safe` (una vez), luego `npm run dev:worker`, luego `npm run dev`, y por último abrir http://localhost:5173.

### Producción

- **Deploy:** `npm run deploy` – compila (Vite + Pages Functions en `dist/`) y despliega con `wrangler pages deploy dist --project-name=venezuela-live-2`. No uses `VITE_GOOGLE_AUTH_PAUSED=true` ni bypass en producción.
- **Secrets en Pages:** en el dashboard del proyecto Pages (o con Wrangler) configura `GOOGLE_CLIENT_ID`. Opcional: `CRON_SECRET` para el endpoint de cron semanal.
- **Cron semanal (reportes):** Pages no tiene `scheduled`. Usa el endpoint `GET/POST /api/cron/weekly-reports` con header `X-Cron-Secret: <CRON_SECRET>` (solo header). Configura un Cron Trigger en Cloudflare que llame a esa URL con el secreto (p. ej. domingos 23:59).
.