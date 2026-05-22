# Mecanismos de seguridad

Resumen de los controles de seguridad actuales en Venezuela LIVE, alineados con la filosofía **Zero Trust** y **Security First** del [Plan de acción global](PLAN%20SEGU%20Y%20USAB/Plan%20de%20accion%20global.md).

---

## 1. Autenticación (Google OAuth 2.0)

- **Proveedor:** Google OAuth 2.0; el frontend obtiene un JWT que se envía en cada petición a la API.
- **Verificación en backend:** El middleware de autenticación (`src/server/middlewares/auth.middleware.ts`) valida el token con **JWKS** de Google (`https://www.googleapis.com/oauth2/v3/certs`), comprobando firma y `audience` (Client ID). Solo se acepta si `email_verified === true`.
- **Cobertura:** Todas las rutas bajo `/api/*` exigen JWT válido, excepto las rutas de cron que se protegen con secreto (véase más abajo).
- **Bypass en desarrollo:** En entorno `dev` con variable habilitada se acepta un token de pruebas; en producción no se usa.

---

## 2. Identidad y autor (Zero Trust: nunca confiar en el cliente)

- **Contrapropuestas:** El autor de una contrapropuesta **nunca** se toma del body de la petición. El backend obtiene la identidad del usuario autenticado (`c.get('user')`) y del perfil en D1 (`displayName`, `username` o nombre del JWT), con fallback seguro a `"Usuario"`.

---

## 3. Límites de caracteres (contrapropuestas)

| Campo        | Límite máximo | Validación                          |
|-------------|----------------|-------------------------------------|
| **Título**  | 200 caracteres | Frontend y backend (trim + longitud) |
| **Descripción** | 2000 caracteres | Frontend y backend (trim + longitud) |

- Los valores se recortan con `.slice()` al persistir para evitar exceder límites incluso si la validación falla.
- Objetivo: mitigar DoS por cadenas gigantes y mantener consistencia entre cliente y servidor.

---

## 4. Validación de entradas y formato

- **Contrapropuestas:** En backend se exige `title` y `description` no vacíos tras trim; se rechaza con 400 si faltan o superan los límites.
- **topicId:** Formato validado con expresión regular segura (`^[a-zA-Z0-9_-]+$`) y longitud máxima 64. Se comprueba que el tema exista en D1 antes de insertar la propuesta (404 si no existe).
- **IDs:** Generación de IDs de propuesta con `crypto.randomUUID()` (no secuencial ni predecible).
- **Consultas:** Uso de consultas preparadas (`.bind()`) en D1 para evitar inyección SQL.

---

## 5. Sesión en memoria (sin tokens en almacenamiento local)

- **B1 – Erradicación de tokens locales:** No se guardan JWTs ni credenciales en `localStorage`, `sessionStorage` ni IndexedDB.
- **Módulo:** `src/client/auth/session.js` mantiene la sesión solo en memoria (`setSession`, `getSession`, `getCredential`, `clearSession`). Al recargar o cerrar la pestaña, la sesión se pierde y el usuario debe autenticarse de nuevo.
- **Efecto:** Un XSS que lea almacenamiento local no obtiene tokens reutilizables.

---

## 6. Control de acceso basado en roles (RBAC)

- **Fuente de verdad:** El rol (`user`, `moderator`, `admin`) se almacena en D1 (`profiles.role`) y se lee en el middleware de auth tras verificar el JWT. No se confía en claims arbitrarios del cliente.
- **Uso:** El contexto de cada petición incluye `user.role`. Las rutas sensibles están acotadas por `userId`; no hay endpoints que devuelvan volcados masivos. La base está preparada para restringir acciones por rol en el futuro.

---

## 7. Rate limiting (Freemium)

- **Almacén:** Cloudflare KV; clave por usuario, fecha (UTC) y acción.
- **Límites diarios (usuarios no premium):**

| Acción        | Límite/día |
|---------------|------------|
| Likes        | 50         |
| Comentarios  | 20         |
| Contrapropuestas | 2      |

- **Orden en contrapropuestas:** El rate limit se consume **solo después** de validar body, tema y autor, para no gastar cuota con peticiones inválidas.

---

## 8. Sanitización XSS (DOMPurify) y renderizado seguro

- **DOMPurify:** Integrado en `src/client/utils/sanitize.js` con configuración estricta (`FORBID_TAGS`, etc.). Cualquier HTML de usuario/terceros que se renderice debe pasar por `sanitizeHtml()` o por el componente `<SafeHtml>`.
- **Renderizado:** El contenido de usuario (propuestas, comentarios, perfil) se muestra por defecto con interpolación JSX (`{variable}`), que escapa el texto. No se usa `dangerouslySetInnerHTML` salvo a través de `SafeHtml` con contenido ya sanitizado.
- **Verificación:** Script `npm run security:test:sanitize` comprueba que payloads XSS típicos se bloquean.

---

## 9. Saneamiento de metadatos EXIF (fotos de perfil)

- **B3 – Metadatos:** Las imágenes de perfil se sanean en backend antes de guardarse en R2 (`src/server/domain/media/sanitizer.ts`). Se usa `@mary/exif-rm` para eliminar EXIF y metadatos relacionados.
- **Tipos permitidos:** Solo `image/jpeg`, `image/png`, `image/webp`. Tamaño máximo 2 MB.
- **Cron de migración:** La ruta `/api/cron/profile-photos-sanitize` reescribe las fotos ya almacenadas en R2 para eliminar EXIF (protegida con `X-Cron-Secret`).

---

## 10. Endpoints de cron (secretos)

- Las rutas de mantenimiento (`/api/cron/weekly-reports`, `/api/cron/profile-photos-sanitize`) no dependen del JWT de usuario; se protegen con el header **`X-Cron-Secret`** (secreto configurado en entorno). El secreto no se envía en query para evitar fugas en logs o Referrer.

---

## 11. Mensajes de error y logs

- **Cliente:** Se devuelven mensajes genéricos en errores de validación (por ejemplo, "Datos inválidos", "El nombre o la descripción exceden el límite permitido"). No se exponen detalles de esquema ni de consultas.
- **Servidor:** Se evita loguear datos sensibles (título, descripción, autor completos); solo IDs y códigos de error cuando sea necesario para depuración.

---

## 12. Resumen por principio

| Principio        | Mecanismo principal |
|------------------|----------------------|
| **Zero Trust**   | Autor desde perfil/JWT, nunca desde body; validación de formato y existencia de `topicId`; consultas preparadas. |
| **Security First** | Límites de longitud, rate limit tras validación, DOMPurify para HTML, EXIF eliminado, sesión en memoria, RBAC en D1. |
| **Mínimo privilegio** | Allowlist opcional; rutas acotadas por `userId`; cron con secreto separado. |

Para más detalle por fase (A1, A2, A3, B1, B2, B3), ver la documentación en `docs/PLAN SEGU Y USAB/` y el `README.md` del proyecto.
