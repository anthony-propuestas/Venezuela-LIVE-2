# Plan de resolución: Error 500 en APIs de perfil

## 1. Análisis del funcionamiento de las APIs

### 1.1 Arquitectura

- **Frontend**: Vite en `http://localhost:5173`. Las peticiones a `/api/*` se hacen contra la misma origen (5173).
- **Proxy**: En `vite.config.js`, la ruta `/api/` se redirige a `http://localhost:8787` (worker).
- **Backend**: Cloudflare Pages Functions (Hono) en el worker. Se sirve con:
  ```bash
  npm run dev:worker   # wrangler pages dev dist --persist-to=...
  ```
  El worker está en `src/worker/index.ts`; el entry de Pages es `functions/[[path]].ts`.

### 1.2 Rutas de perfil afectadas (todas devuelven 500 en tu caso)

| Ruta | Método | Uso | Dependencias |
|------|--------|-----|--------------|
| `/api/profile` | GET | Obtener perfil del usuario | Auth (JWT o bypass), **D1** (`profiles`, opcional `user_achievements`) |
| `/api/profile` | PUT | Guardar perfil | Auth, **D1** |
| `/api/profile/username/check` | GET | Comprobar si un username está libre | Auth, **D1** (`profiles`) |
| `/api/profile/photo` | GET/POST/DELETE | Foto de perfil | Auth, **D1**, **R2** (POST/DELETE) |

### 1.3 Flujo de una petición

1. El navegador llama a `http://localhost:5173/api/profile` (o similar).
2. Vite (5173) hace proxy a `http://localhost:8787/api/profile`.
3. Pages ejecuta `functions/[[path]].ts` → `app.fetch(request, env)` (Hono).
4. Middleware `/api/*`: verifica `Authorization: Bearer <token>`. Si no hay token o no es válido → **401**. Si el token es `__dev_bypass__` y `DEV_BYPASS_ALLOWED === 'true'` → usuario de pruebas. Si es JWT de Google válido → usuario real.
5. Handler (ej. `GET /api/profile`): usa `c.env.DB` (D1) para consultar la tabla `profiles`. Si la tabla no existe o D1 no está bien configurado → **excepción** → **500**.

### 1.4 Causas probables del 500 (documentación y código)

- **Tabla `profiles` (u otras) no existe en D1 local**  
  - El README ya lo indica: *"500 Internal Server Error en /api/profile → La tabla profiles no existe en la base D1 local."*  
  - Documentación Cloudflare: [D1 Local Development](https://developers.cloudflare.com/d1/best-practices/local-development): hay que ejecutar migraciones con `--local` y, si usas `--persist-to`, **usar la misma ruta** en migraciones y en `wrangler pages dev`.

- **Ruta de persistencia distinta entre migraciones y worker**  
  - Si las migraciones usan un `--persist-to` y el worker otro (o ninguno), son **dos bases locales distintas**. El worker podría estar usando una BD vacía sin tablas.  
  - En este proyecto ambos usan `%LOCALAPPDATA%\venezuela-live-wrangler` (script `migrate-d1-local.ps1` y `package.json` → `dev:worker`). Si en tu máquina se usara otra ruta en algún comando, aparecería el problema.

- **Worker no construido o desactualizado**  
  - `dev:worker` ejecuta `wrangler pages dev dist`. Si no se ha ejecutado `npm run build` antes, `dist/` puede no tener las Functions actuales o el worker puede fallar al cargar.

- **Worker no en marcha o puerto equivocado**  
  - Si el worker no está corriendo en 8787, el proxy de Vite seguirá enviando las peticiones a 8787 y podrías ver errores de conexión o, si hay otro servicio, respuestas inesperadas. Los 500 que ves indican que la petición sí llega al worker y falla dentro del handler (p. ej. en D1).

---

## 2. Documentación de referencia

- [Cloudflare D1 – Local development](https://developers.cloudflare.com/d1/best-practices/local-development): persistencia con `--persist-to`, misma ruta en todos los comandos.
- [Cloudflare D1 – Wrangler commands](https://developers.cloudflare.com/d1/wrangler-commands): `wrangler d1 execute ... --local`.
- [Cloudflare Pages – Local development](https://developers.cloudflare.com/pages/functions/local-development/): desarrollo local con Pages Functions.
- README del proyecto: sección "Solución de problemas" y orden recomendado (migrar → worker → frontend).

---

## 3. Plan de resolución (pasos concretos)

### Paso 1: Cerrar el worker

- Cierra la terminal donde corre `npm run dev:worker`.
- Objetivo: que el puerto 8787 esté libre y que D1 no tenga la BD bloqueada al ejecutar migraciones (evitar SQLITE_READONLY u otros bloqueos).

### Paso 2: Ejecutar migraciones D1 locales (misma persistencia que el worker)

En la raíz del proyecto:

```powershell
npm run db:migrate:local:safe
```

- El script comprueba que 8787 no esté en uso, luego ejecuta todas las migraciones con:
  `--persist-to=%LOCALAPPDATA%\venezuela-live-wrangler`
- Así la base local donde se crean las tablas (`profiles`, etc.) es la **misma** que usará `dev:worker`.

Si falla por política de ejecución de scripts:

```powershell
powershell -ExecutionPolicy Bypass -File ./scripts/migrate-d1-local.ps1
```

### Paso 3: Build del proyecto

```powershell
npm run build
```

- Genera `dist/` con el frontend y las Pages Functions (worker Hono).  
- Sin este paso, `dev:worker` puede estar sirviendo una versión vieja o incompleta.

### Paso 4: Arrancar el worker con la misma persistencia (y opcionalmente entorno `dev`)

Terminal 1:

```powershell
npm run dev:worker
```

- Ejecuta: `wrangler pages dev dist --persist-to=%LOCALAPPDATA%\venezuela-live-wrangler`
- Si en `package.json` se añade `--env dev` (ver sección 5), se cargará `DEV_BYPASS_ALLOWED=true` y podrás usar "Entrar (modo pruebas)" sin Google.

Comprueba que en la salida aparezca algo como “Ready on http://127.0.0.1:8787/” (o el puerto que indique).

### Paso 5: Arrancar el frontend

Terminal 2:

```powershell
npm run dev
```

- Frontend en 5173; las llamadas a `/api/*` se envían al worker en 8787.

### Paso 6: Probar en el navegador

1. Abre `http://localhost:5173`.
2. Si tienes `VITE_GOOGLE_AUTH_PAUSED=true` en `.env.development`, usa **"Entrar (modo pruebas)"**.
3. Entra en la página de Perfil y revisa la pestaña Red (DevTools): las peticiones a `/api/profile` y `/api/profile/username/check` deberían responder **200** (o 4xx por validación), no 500.

### Paso 7: Si sigue habiendo 500

- En la terminal del **worker** (donde corre `npm run dev:worker`) suele aparecer el `console.error` del catch (por ejemplo `GET /api/profile: <mensaje>`). Ese mensaje indica la excepción real (tabla no existe, columna faltante, etc.).
- Con `DEV_BYPASS_ALLOWED=true`, la API devuelve en el cuerpo del 500 un campo `detail` con el mensaje de error; en DevTools → pestaña Red → selecciona la petición fallida → pestaña "Response" o "Preview" y revisa el JSON (`error`, `detail`).

Con eso puedes afinar (por ejemplo, falta una migración o una columna).

---

## 4. Resumen: qué hacer fuera del código

1. **Ejecutar migraciones locales** (con el worker parado):  
   `npm run db:migrate:local:safe`

2. **Build** antes de usar el worker:  
   `npm run build`

3. **Orden al iniciar cada sesión de desarrollo**  
   - Terminal 1: `npm run dev:worker` (esperar a que diga “Ready”).  
   - Terminal 2: `npm run dev`.  
   - Navegador: `http://localhost:5173`.

4. **Modo pruebas (opcional)**  
   - `.env.development`: `VITE_GOOGLE_AUTH_PAUSED=true`.  
   - Worker con `DEV_BYPASS_ALLOWED=true` (por defecto en `env.dev` si usas `--env dev` en `dev:worker`).  
   Así no necesitas configurar Google OAuth para probar las APIs de perfil.

5. **Si cambias de equipo o borras datos de Wrangler**  
   - Vuelve a ejecutar `npm run db:migrate:local:safe` (con el worker cerrado) y luego `npm run dev:worker` y `npm run dev`.

No hace falta instalar nada extra; solo asegurarse de que Node, npm y Wrangler estén bien (por ejemplo `npx wrangler --version`).

---

## 5. Puerto y variables en local

- **Puerto fijo:** El script `dev:worker` usa `--port 8787` para que coincida con el proxy de Vite (`vite.config.js` → `target: 'http://localhost:8787'`). Así no hay que cambiar el proxy si Wrangler elige otro puerto.
- **Bypass de auth (modo pruebas):** `wrangler pages dev` **no** admite `--env` en desarrollo local. Para tener `DEV_BYPASS_ALLOWED=true` en local, crea en la raíz del proyecto un archivo `.dev.vars` (no se sube a git) con:
  ```
  DEV_BYPASS_ALLOWED=true
  ```
  Wrangler carga `.dev.vars` en local y las variables estarán en `context.env`.

---

## 6. Checklist rápido

- [ ] Worker cerrado (puerto 8787 libre).
- [ ] `npm run db:migrate:local:safe` ejecutado sin errores.
- [ ] `npm run build` ejecutado.
- [ ] Terminal 1: `npm run dev:worker` en marcha (Ready en 8787).
- [ ] Terminal 2: `npm run dev` en marcha (5173).
- [ ] Navegador: abrir 5173, iniciar sesión (o modo pruebas) y abrir Perfil.
- [ ] DevTools → Red: peticiones `/api/profile` y `/api/profile/username/check` con 200 (o 4xx), no 500.

Si tras esto algún endpoint sigue en 500, el mensaje en la terminal del worker o el campo `detail` en la respuesta JSON indicarán el siguiente paso (por ejemplo, una migración adicional o un fallo de R2/KV en ese endpoint concreto).
