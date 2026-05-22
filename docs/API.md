# API Reference — Venezuela LIVE

Todos los endpoints están bajo `/api/`. Requieren header `Authorization: Bearer <google_id_token>` salvo los endpoints de cron (usan `X-Cron-Secret`) y los endpoints de admin (usan `Authorization: Bearer <admin_jwt>`).

---

## Auth

El middleware `createAuthMiddleware()` verifica el JWT de Google con JWKS. El `userId` se extrae del token y el rol se resuelve desde D1. En modo dev (`DEV_BYPASS_ALLOWED=true` en `.dev.vars`), el header `Authorization: Bearer __dev_bypass__` omite la verificación de Google.

---

## Endpoints

### Perfil

| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/api/profile` | Retorna perfil del usuario autenticado + gamificación |
| `PUT` | `/api/profile` | Actualiza displayName, username, birthDate, description, ideologies |
| `GET` | `/api/profile/photo` | Descarga foto de perfil desde R2 |
| `POST` | `/api/profile/photo` | Sube foto (multipart/form-data, campo `photo`) |
| `DELETE` | `/api/profile/photo` | Elimina foto de perfil |
| `GET` | `/api/profile/username/check?username=X` | Verifica disponibilidad de username |

**GET /api/profile — respuesta:**
```json
{
  "profile": {
    "displayName": "string",
    "username": "string",
    "birthDate": "YYYY-MM-DD",
    "description": "string",
    "ideologies": ["string"],
    "hasPhoto": true,
    "gamification": {
      "totalXp": 120,
      "achievements": [{ "id": "first_counter_proposal", "name": "Primera contrapropuesta" }]
    }
  }
}
```

**PUT /api/profile — body:**
```json
{
  "displayName": "string (max 500)",
  "username": "string (3–30 chars, a-z0-9_)",
  "birthDate": "YYYY-MM-DD",
  "description": "string (max 2000)",
  "ideologies": ["string"]
}
```

**GET /api/profile/photo:**
- Retorna la imagen del perfil directamente desde R2.
- Header de respuesta: `Content-Type: image/jpeg` (o `image/png` / `image/webp` según el archivo guardado).
- Incluye `Cache-Control: private, max-age=3600`.
- Retorna `404` si el usuario no tiene foto.

**POST /api/profile/photo:**
- `Content-Type: multipart/form-data`
- Campo `photo`: JPG / PNG / WebP, max 2 MB
- El EXIF se elimina antes de guardar en R2

---

### Temas

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| `GET` | `/api/categories` | ninguna | Lista todas las categorías con subcategorías |
| `GET` | `/api/topics` | ninguna | Lista todos los temas con propuestas y notas |
| `POST` | `/api/topics` | Bearer token | Crea un tema con su propuesta inicial |

**GET /api/categories — respuesta:**
```json
{ "categories": [{ "id": 1, "name": "Economía", "slug": "economia", "subcategories": ["Moneda","Inflación","Impuestos"] }] }
```

**GET /api/topics — respuesta:**
```json
{ "threads": [] }
```
Array de objetos con topic, proposals anidadas y notes por propuesta.

**POST /api/topics — body:**
```json
{
  "category": "string (max 100)",
  "topicText": "string (max 300)",
  "proposalTitle": "string (max 200)",
  "proposalDescription": "string (max 2000)",
  "subcategory": "string (opcional)"
}
```

- El autor se resuelve desde el perfil en D1 (nunca del body — Zero Trust).
- Dispara evento de gamificación `CREATE_COUNTER_PROPOSAL` en background.
- Consume cuota de rate limit `proposals`.
- Retorna `400 INVALID_TOPIC_DATA` si faltan campos requeridos.

**Respuesta:**
```json
{ "thread": { "category": "string", "topic": "string", "proposals": [] } }
```

---

### Contrapropuestas

| Método | Ruta | Descripción |
|--------|------|-------------|
| `POST` | `/api/topics/:topicId/proposals` | Crea contrapropuesta en un tema |

**POST /api/topics/:topicId/proposals — body:**
```json
{
  "title": "string (max 200)",
  "description": "string (max 2000)"
}
```

- El autor se resuelve desde el perfil en D1 (nunca del body — Zero Trust).
- Dispara evento de gamificación `CREATE_COUNTER_PROPOSAL` en background.
- Consume cuota de rate limit `proposals`.

**Respuesta:**
```json
{
  "proposal": {
    "id": "uuid",
    "topicId": "string",
    "title": "string",
    "description": "string",
    "author": "string",
    "upvotes": 0,
    "downvotes": 0,
    "netScore": 0,
    "comments": [],
    "notes": []
  }
}
```

---

### Votos

| Método | Ruta | Descripción |
|--------|------|-------------|
| `POST` | `/api/proposals/:proposalId/vote` | Registra voto en una propuesta |

**Body:**
```json
{ "type": "up" | "down" }
```

- Un voto por usuario por propuesta, permanente (no se resetea).
- Consume cuota de rate limit `likes`.

**Respuesta:**
```json
{ "upvotes": 5, "downvotes": 2 }
```

**Errores:**
- `400 INVALID_TYPE` — el campo `type` no es `"up"` ni `"down"`
- `409 ALREADY_VOTED` — el usuario ya votó esta propuesta
- `429` — rate limit de `likes` agotado

---

### Rate Limiting

| Método | Ruta | Descripción |
|--------|------|-------------|
| `POST` | `/api/actions/consume` | Consume una cuota de acción diaria |

**Body:**
```json
{ "action": "likes" }
```

Valores válidos de `action`: `likes`, `comments`, `proposals`.

- Se verifica contra KV. Si el límite se excede, retorna `429`.

**429 response:**
```json
{ "error": "RATE_LIMIT_EXCEEDED", "action": "likes", "reason": "Límite diario alcanzado." }
```

---

### Reportes Semanales

| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/api/reports/weekly/positives` | PDF: consenso positivo |
| `GET` | `/api/reports/weekly/negatives` | PDF: rechazos |
| `GET` | `/api/reports/weekly/volume` | PDF: volumen de actividad |

Retornan el PDF directamente (`application/pdf`). Los archivos se generan on-demand y se cachean en R2.

---

### Cron

| Método | Ruta | Descripción |
|--------|------|-------------|
| `ALL` | `/api/cron/weekly-reports` | Genera reportes semanales |
| `ALL` | `/api/cron/profile-photos-sanitize` | Migra fotos existentes: elimina EXIF |

**Header requerido:** `X-Cron-Secret: <CRON_SECRET>`

**profile-photos-sanitize** acepta `?cursor=<string>` para paginar (25 fotos por lote).

---

### Admin

Requieren `Authorization: Bearer <admin_jwt>` salvo el endpoint de login.

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| `POST` | `/api/admin/login` | ninguna | Valida email+password contra env; retorna JWT de 8h |
| `GET` | `/api/admin/users` | Admin JWT | Lista todos los usuarios (user_id, email, username, role) |
| `DELETE` | `/api/admin/users/:userId/ratelimits` | Admin JWT | Resetea contadores de rate limit diario del usuario |
| `GET` | `/api/admin/topics` | Admin JWT | Lista todos los temas ordenados por fecha desc |
| `DELETE` | `/api/admin/topics/:topicId` | Admin JWT | Elimina tema + sus propuestas + notas en cascada |
| `GET` | `/api/admin/proposals` | Admin JWT | Últimas 200 propuestas |
| `DELETE` | `/api/admin/proposals/:proposalId` | Admin JWT | Elimina propuesta + sus notas en cascada |
| `GET` | `/api/admin/categories` | Admin JWT | Lista todas las categorías |
| `POST` | `/api/admin/categories` | Admin JWT | Crea categoría |
| `PUT` | `/api/admin/categories/:id` | Admin JWT | Actualiza categoría |
| `DELETE` | `/api/admin/categories/:id` | Admin JWT | Elimina categoría |

**POST/PUT /api/admin/categories — body:**
```json
{ "name": "string", "slug": "string (a-z0-9-)", "subcategories": ["string"] }
```
Errores: `400` si falta `name` o `slug`; `409` si el slug ya existe.

**POST /api/admin/login — body:**
```json
{ "email": "string", "password": "string" }
```
**Respuesta:** `{ "token": "<jwt>" }`

---

## Errores estándar

| Código | HTTP | Descripción |
|--------|------|-------------|
| `INVALID_TOPIC_DATA` | 400 | Faltan campos requeridos para crear un tema |
| `VALIDATION_ERROR` | 400 | Datos de entrada inválidos |
| `CONFLICT_ERROR` | 409 | Recurso ya existe (ej. username tomado) |
| `NOT_FOUND` | 404 | Recurso no encontrado |
| `UNAUTHORIZED` | 401 | Token ausente o inválido |
| `RATE_LIMIT_EXCEEDED` | 429 | Cuota diaria agotada |
| `ALREADY_VOTED` | 409 | El usuario ya votó esta propuesta (voto permanente) |
| `DEPENDENCY_ERROR` | 503 | Error de configuración interna |

**Formato de error:**
```json
{
  "error": "VALIDATION_ERROR",
  "message": "Datos inválidos.",
  "fields": [{ "field": "username", "message": "Formato inválido." }]
}
```
