# Workflow: Comparación Código vs Documentación

## Objetivo
Detectar discrepancias entre el código real y los archivos en `docs/` antes de que se acumulen y confundan a futuros colaboradores.

## Cuándo ejecutar
- Antes de cada release
- Al agregar o modificar un endpoint, tabla, o feature
- Al editar cualquier archivo en `docs/`

---

## Checklist de verificación

Para cada ítem: marca ✅ si coincide, ❌ si hay discrepancia, y anota la discrepancia en la tabla al final.

---

### A. API Endpoints — `docs/API.md` vs `src/server/`

| # | Verificar | Estado |
|---|-----------|--------|
| A1 | Cada endpoint documentado existe como ruta en `src/server/` | ✅ |
| A2 | Los métodos HTTP (GET/POST/PUT/DELETE) coinciden | ✅ |
| A3 | Header `Authorization: Bearer <token>` requerido en todas las rutas protegidas | ✅ |
| A4 | Modo dev con `DEV_BYPASS_ALLOWED=true` + `Bearer __dev_bypass__` inyecta usuario `dev-bypass-user` (role: `user`) | ✅ |
| A8 | `GET /api/profile/photo` documentado con respuesta (Content-Type, Cache-Control, 404 si no hay foto) | ✅ |
| A5 | Cron endpoints usan header `X-Cron-Secret` (no `Authorization`) | ✅ |
| A6 | Límites de subida de foto: 2 MB máximo, solo JPG/PNG/WebP | ✅ |
| A7 | Campos de respuesta de cada endpoint coinciden con los ejemplos en docs | ✅ |

**Cómo verificar:** Busca rutas en `src/server/` con `app.get(`, `app.post(`, etc. y compara contra la tabla de endpoints en `docs/API.md`.

---

### B. Base de Datos — `docs/DATABASE.md` vs `migrations/`

| # | Verificar | Estado |
|---|-----------|--------|
| B1 | Número de archivos en `migrations/` coincide con los documentados (docs dice 0001–0010) | ✅ |
| B2 | Tabla `profiles` tiene columnas: `id`, `email`, `display_name`, `username`, `is_premium`, `role`, `ideologies` (JSON en TEXT) | ✅ |
| B3 | Tabla `proposals` existe con las columnas documentadas | ✅ |
| B4 | Tabla `achievements` y `user_achievements` existen | ✅ |
| B5 | Tabla `payment_tickets` existe (migración 0008) | ✅ |
| B6 | Columna `profiles.role` con valores `user\|moderator\|admin` (migración 0010) | ✅ |
| B7 | Restricción UNIQUE en `profiles.email` (migración 0009) | ✅ |
| B8 | Formato de KV key: `rl:<YYYY-MM-DD>:<userId>:<action>` | ✅ |
| B9 | Paths de R2: `profiles/<userId>/photo.<ext>` para fotos de perfil | ✅ |

**Cómo verificar:** Lee los archivos `.sql` en `migrations/` y compara con las tablas descritas en `docs/DATABASE.md`.

---

### C. Arquitectura — `docs/ARCHITECTURE.md` vs `src/server/` + `functions/`

| # | Verificar | Estado |
|---|-----------|--------|
| C1 | El catch-all de Pages está en `functions/[[path]].ts` | ✅ |
| C2 | El middleware de auth extrae `userId` y `email` del token y resuelve `role` desde D1 (no desde el token) | ✅ |
| C3 | El event bus de gamificación opera en memoria (no persiste entre Worker recycles) | ✅ |
| C4 | `emitGamificationEventAsync()` existe y dispara eventos en background | ✅ |
| C5 | El autor de propuestas/acciones siempre se resuelve desde D1, nunca desde el body del request | ✅ |
| C6 | Los bindings en `wrangler.json` son: `DB` (D1), `RATE_LIMIT_KV` (KV), `R2_BUCKET` (R2) | ✅ |
| C7 | Existe un segundo binding de R2 llamado `y` que no se usa en código (candidato a eliminar) | ✅ |

**Cómo verificar:** Lee `wrangler.json`, busca los bindings. Grep `emitGamification` en `src/server/`. Lee el middleware de auth.

---

### D. Seguridad — `docs/SECURITY.md` vs código

| # | Verificar | Estado |
|---|-----------|--------|
| D1 | Por defecto los tokens de sesión están solo en memoria; `VITE_PERSIST_SESSIONS=true` habilita persistencia en `localStorage` (clave `venlive_session_v1`). **Excepción:** JWT admin en `sessionStorage` (flujo separado, 8h) | ✅ |
| D2 | `localStorage` contiene: `venezuelaLiveVotes`, `venezuelaLiveNoteVotes`; opcionalmente `venlive_session_v1` (solo si `VITE_PERSIST_SESSIONS=true`) | ✅ |
| D3 | EXIF removido con `@mary/exif-rm` ANTES de guardar en R2 | ✅ |
| D4 | DOMPurify importado y usado antes de cualquier render de HTML arbitrario | ✅ |
| D5 | Todas las queries a D1 usan prepared statements (`.prepare().bind()`) — ningún string concatenado | ✅ |
| D6 | Premium users tienen `is_premium = 1` y el rate limit middleware los excluye | ✅ |
| D7 | Cron endpoints verifican `X-Cron-Secret` antes de ejecutar | ✅ |
| D8 | `ALLOWLIST_EMAILS` documentado en SECURITY.md: cuando tiene valor, bloquea con 403 emails no listados | ✅ |
| D9 | Las dos rutas cron (`/weekly-reports` y `/profile-photos-sanitize`) están documentadas como excluidas del JWT middleware | ✅ |
| D10 | JWT admin en `sessionStorage` está documentado como excepción intencional a la regla de tokens solo en memoria | ✅ |

**Cómo verificar:** Grep `localStorage.setItem` en `src/client/`. Grep `exif-rm` en `src/server/`. Grep `DOMPurify` en `src/client/`. Busca queries sin `.prepare()`.

---

### E. Configuración — `docs/CONFIGURATION.md` vs `wrangler.json` + `.env.example`

| # | Verificar | Estado |
|---|-----------|--------|
| E1 | Variables `VITE_*` en `.env.example` coinciden con las documentadas | ✅ |
| E2 | Variables de backend (Worker) en `.dev.vars.example` o `wrangler.json` coinciden con docs | ✅ |
| E7 | `ALLOWLIST_EMAILS` aparece en `CONFIGURATION.md` con descripción de comportamiento | ✅ |
| E3 | `DEV_BYPASS_ALLOWED` solo aparece en entorno de desarrollo, nunca hardcodeado en prod | ✅ |
| E4 | `compatibility_date` en `wrangler.json` está documentada en `CONFIGURATION.md` | ✅ |
| E5 | Ambos bindings KV (`RATE_LIMIT_KV` y `RATE_LIMIT`) están en `wrangler.json` — confirmar cuál se usa | ✅ |
| E6 | `pages_build_output_dir` en `wrangler.json` apunta a `./dist` | ✅ |

**Cómo verificar:** Lee `wrangler.json` y `.env.example`, compara contra la tabla de variables en `docs/CONFIGURATION.md`.

---

### F. Testing — `docs/TESTING.md` vs `package.json` + archivos de test

| # | Verificar | Estado |
|---|-----------|--------|
| F1 | Script `npm test` existe en `package.json` y corre Vitest | ✅ |
| F2 | Script `npm run security:test:sanitize` existe en `package.json` | ✅ |
| F3 | Script `npm run db:migrate:local:safe` existe en `package.json` | ✅ |
| F4 | Existe al menos un archivo `.test.` en `src/client/` que cubre `typewriterStep()` | ✅ |
| F5 | El puerto en los ejemplos `curl` de cron coincide con el servidor de dev (`dev:worker` usa 8787, `dev:pages` usa otro puerto) | ✅ |
| F6 | Los pasos del "full manual test flow" reflejan el estado actual de la app (no menciona features eliminadas) | ✅ |

**Cómo verificar:** Lee `package.json`, lista archivos `.test.jsx/.ts` en `src/`, verifica puerto en ejemplos curl vs scripts de dev.

---

## Registro de discrepancias encontradas

Llena esta tabla con cada ❌ del checklist. Si no hay discrepancias, deja la tabla vacía.

| # | Área | Item | Docs dice | Código hace | Acción | Responsable |
|---|------|------|-----------|-------------|--------|-------------|
| 1 | API | A4 | `VITE_GOOGLE_AUTH_PAUSED=true` + cualquier request con `test-user` | `DEV_BYPASS_ALLOWED=true` en `.dev.vars` + `Bearer __dev_bypass__` | Fix docs | — |
| 2 | DB | B8 | `ratelimit:<userId>:<action>:<YYYY-MM-DD>` | `rl:<YYYY-MM-DD>:<userId>:<action>` | Fix docs | — |
| 3 | Config | E2 | `.dev.vars.example` debería existir como plantilla | Archivo no existía en el repo | Fix código | — |
| 4 | Testing | F | `npm test` solo cubre funciones puras del cliente | Existen 3 archivos de test (cliente + servidor) | Fix docs | — |
| 5 | Workflow | B9 | Checklist describe path como `photos/<userId>` | Docs y código usan `profiles/<userId>/photo.<ext>` | Fix workflow | — |
| 6 | Testing | A4 | "el middleware devuelve un usuario hardcoded `test-user`" | Middleware usa `dev-bypass-user` (email: `pruebas@local`) activado por `DEV_BYPASS_ALLOWED`, no `VITE_GOOGLE_AUTH_PAUSED` | Fix docs | — |
| 7 | API | A8 | `GET /api/profile/photo` listado en tabla pero sin sección de respuesta | Retorna imagen binaria + `Content-Type` + `Cache-Control` + 404 si sin foto | Fix docs | — |
| 8 | Security | D8 | `ALLOWLIST_EMAILS` ausente en SECURITY.md | Middleware bloquea con 403 emails no listados cuando var tiene valor | Fix docs | — |
| 9 | Security | D9 | Solo `/api/cron/weekly-reports` mencionada como excluida | Middleware excluye también `/api/cron/profile-photos-sanitize` | Fix docs | — |
| 10 | Config | E7 | `ALLOWLIST_EMAILS` ausente en CONFIGURATION.md | Definida como campo en `Env` type; funcionalmente opcional | Fix docs | — |
| 11 | Security | D10 | D1 dice tokens nunca en `sessionStorage` sin excepciones | JWT admin se guarda en `sessionStorage` (flujo separado, expira 8h) | Fix docs | — |
| 12 | Security | D2 | `localStorage` key documentada como `vl_session` en SECURITY.md y CONFIGURATION.md | Código usa `venlive_session_v1` (`session.js:5`, `session.test.js:4`) | Fix docs | — |
| 13 | Security | D1/D2 | Checklist decía "NUNCA en localStorage" y listaba solo 2 keys | `session.js` persiste a localStorage cuando `VITE_PERSIST_SESSIONS=true` (key `venlive_session_v1`) | Fix workflow | — |
| 14 | Testing | F4 | TESTING.md listaba 3 archivos de test | Existe `src/client/auth/session.test.js` (sesión en memoria y localStorage) | Fix docs | — |

**Tipos de acción:**
- `Fix docs` — el código es correcto, actualizar la documentación
- `Fix código` — la documentación refleja el diseño correcto, corregir el código
- `Accepted-gap` — la diferencia es intencional y se documenta como excepción

---

## Criterio de cierre

El workflow está completo cuando:
1. Todos los ítems del checklist tienen estado ✅ o ❌
2. Cada ❌ tiene una fila en la tabla de discrepancias con acción asignada
3. Todas las acciones `Fix docs` y `Fix código` están resueltas o tienen issue/PR abierto

## Historial de ejecuciones

| Fecha | Ejecutado por | Discrepancias | Resultado |
|-------|---------------|---------------|-----------|
| 2026-05-21 | Claude Code | 6 (A4×2, B8, B9, E2, F) | Resueltas: Fix docs en API.md, DATABASE.md, TESTING.md (×2); Fix código creando `.dev.vars.example`; Fix workflow B9 |
| 2026-05-21 | Claude Code | 5 (A8, D8, D9, D10, E7) | Resueltas: Fix docs en API.md (GET /profile/photo), SECURITY.md (ALLOWLIST_EMAILS, rutas cron excluidas, excepción JWT admin), CONFIGURATION.md (ALLOWLIST_EMAILS) |
| 2026-05-21 | Claude Code | 3 (D2 key name, D1/D2 session persistence, F4 session.test.js) | Resueltas: Fix docs en SECURITY.md + CONFIGURATION.md (key `vl_session`→`venlive_session_v1`), TESTING.md (nuevo test), Fix workflow D1/D2 |
