# Security — Venezuela LIVE

## Reportar una vulnerabilidad

Abre un issue privado en el repositorio o contacta directamente al mantenedor. No publiques detalles de vulnerabilidades en issues públicos.

---

## Medidas implementadas

### Autenticación
- **Google OAuth 2.0** con verificación de JWT vía JWKS (no se confía en el token sin verificar).
- La sesión se guarda **en memoria** del frontend (`src/client/auth/session.js`), nunca en `localStorage` ni `sessionStorage`.
- El `userId` y el rol se resuelven desde D1 en cada request; el cliente no puede elevar su propio rol.

### Autorización (RBAC)
- Roles en D1: `user`, `moderator`, `admin` (columna `role` en tabla `profiles`).
- El autor de propuestas y notas se extrae siempre desde el perfil en D1, nunca del body del request (Zero Trust).

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
- Usuarios premium (`isPremium = 1` en D1) no están sujetos a límites.

### Cron / endpoints internos
- El header `X-Cron-Secret` (valor de la variable `CRON_SECRET`) autentica los endpoints de cron.
- El secreto nunca se expone en query params (evita logs y Referrer headers).

### Dependencias
- Auditoría estática documentada en `docs/PLAN SEGU Y USAB/Fase 1 Auditoría Heurística y Inyecciones/A1 revision de dependencias estaticas.md`.
- Baseline de audit en `docs/audit-baseline.json`.

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
| `DEV_BYPASS_ALLOWED` | Solo `"true"` en dev; nunca en producción |

Ver [CONFIGURATION.md](CONFIGURATION.md) para la lista completa.
