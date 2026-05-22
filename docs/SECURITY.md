# Security — Venezuela LIVE

## Reportar una vulnerabilidad

Abre un issue privado en el repositorio o contacta directamente al mantenedor. No publiques detalles de vulnerabilidades en issues públicos.

---

## Medidas implementadas

### Autenticación
- **Google OAuth 2.0** con verificación de JWT vía JWKS (no se confía en el token sin verificar).
- La sesión de usuario se guarda **en memoria** del frontend (`src/client/auth/session.js`). Si `VITE_PERSIST_SESSIONS=true`, también se persiste en `localStorage` (clave: `venlive_session_v1`) para sobrevivir recargas de página; los errores de storage (modo privado, blocked) se ignoran silenciosamente.
- Cuando la sesión tiene <5 minutos restantes, se intenta un re-login silencioso via Google One Tap (`useGoogleOneTapLogin`).
- El `userId` y el rol se resuelven desde D1 en cada request; el cliente no puede elevar su propio rol.
- **Excepción:** el JWT del panel admin (`/admin`) se guarda en `sessionStorage` del navegador. Es un flujo separado al OAuth de usuario; el token expira en 8 horas y no contiene datos de sesión de usuario.

### Admin JWT Auth
- Las rutas `/api/admin/*` usan un middleware dedicado (`src/server/middlewares/admin.middleware.ts`), separado del flujo Google OAuth.
- El auth middleware regular omite `/api/admin/*` explícitamente; el admin middleware toma el control.
- Token HS256 firmado con `ADMIN_PASSWORD`, expira en 8 horas.
- Retorna 401 si el token está ausente o es inválido; 503 si `ADMIN_PASSWORD` no está configurado.

### Autorización (RBAC)
- Roles en D1: `user`, `moderator`, `admin` (columna `role` en tabla `profiles`).
- El autor de temas, propuestas y notas se extrae siempre desde el perfil en D1, nunca del body del request (Zero Trust).

### XSS
- **DOMPurify** sanitiza todo HTML antes de renderizarlo (`src/client/utils/sanitize.js`).
- Componente `SafeHtml` encapsula `dangerouslySetInnerHTML` con sanitización obligatoria.
- No se usa `innerHTML` directo en ningún componente.

### Inyección
- Todas las queries a D1 usan **prepared statements** con `.bind()`.
- Los parámetros de ruta y body se validan y truntan antes de usarse.

### Subida de imágenes
- Solo se aceptan `image/jpeg`, `image/png`, `image/webp`.
- Límite de 2 MB por archivo.
- Los metadatos **EXIF se eliminan** con `@mary/exif-rm` antes de guardar en R2 (`src/server/domain/media/sanitizer.ts`).

### Rate Limiting
- Cuotas diarias por usuario en **Cloudflare KV** para `likes`, `comments`, `proposals`.

### Cron / endpoints internos
- El header `X-Cron-Secret` (valor de la variable `CRON_SECRET`) autentica los endpoints de cron.
- El secreto nunca se expone en query params (evita logs y Referrer headers).
- Las rutas `/api/cron/weekly-reports` y `/api/cron/profile-photos-sanitize` están excluidas del middleware JWT de usuario; solo verifican `X-Cron-Secret`.

### Dependencias
- Auditoría estática documentada en `docs/PLAN SEGU Y USAB/Fase 1 Auditoría Heurística y Inyecciones/A1 revision de dependencias estaticas.md`.
- Baseline de audit en `docs/audit-baseline.json`.

### HTTP Headers

Aplicados vía `public/_headers` (Cloudflare Pages los inyecta automáticamente en todas las rutas `/*`). También hay un `<meta>` CSP equivalente en `index.html` como fallback.

| Header | Valor |
|--------|-------|
| `X-Content-Type-Options` | `nosniff` |
| `X-Frame-Options` | `DENY` |
| `X-XSS-Protection` | `0` (desactivado; el navegador usa CSP) |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=(), fullscreen=(self)` |
| `Strict-Transport-Security` | `max-age=3600; includeSubDomains` (rollout conservador) |
| `Content-Security-Policy` | `default-src 'self'; script-src 'self' https://accounts.google.com; style-src 'self' https://fonts.googleapis.com 'unsafe-inline'; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob: https://*.googleusercontent.com https://flagcdn.com; connect-src 'self' https://accounts.google.com https://oauth2.googleapis.com https://www.googleapis.com; frame-src https://accounts.google.com; frame-ancestors 'none'; object-src 'none'; base-uri 'self'; form-action 'self'; upgrade-insecure-requests` |

---

## Historial de fases de seguridad

| Fase | Documento | Descripción |
|------|-----------|-------------|
| A1 | `Fase 1/A1` | Revisión de dependencias estáticas |
| A2 | `Fase 1/A2` | Renderizado no escapado → DOMPurify |
| A3 | `Fase 1/A3` | Integración DOMPurify completa |
| B1 | `Fase 2/B1` | Sesión en memoria (sin localStorage) |
| B2 | `Fase 2/B2` | RBAC: permisos y restricción de fugas de BD |
| B3 | `Fase 2/B3` | Eliminación de EXIF en imágenes |

---

## Variables de entorno sensibles

| Variable | Uso |
|----------|-----|
| `GOOGLE_CLIENT_ID` | Verifica JWTs de Google |
| `CRON_SECRET` | Autentica endpoints de cron |
| `ADMIN_EMAIL` | Email requerido para login en el panel admin |
| `ADMIN_PASSWORD` | Contraseña admin y clave de firma del JWT admin |
| `DEV_BYPASS_ALLOWED` | Solo `"true"` en dev; nunca en producción |

Ver [CONFIGURATION.md](CONFIGURATION.md) para la lista completa.
