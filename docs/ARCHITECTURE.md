# Architecture — Venezuela LIVE

## Visión general

```
Browser
  │
  ├── React SPA (Vite, Tailwind)          src/client/
  │     ├── auth/session.js               sesión en memoria (no localStorage)
  │     ├── utils/sanitize.js             DOMPurify
  │     ├── services/api.service.js       cliente HTTP → /api/*
  │     ├── pages/Admin/Admin.page.jsx    panel admin (login + usuarios/temas/propuestas)
  │     └── pages/, components/, hooks/
  │
  └── HTTP /api/* → Cloudflare Pages
        │
        └── functions/[[path]].ts         catch-all Pages Function
              │
              └── Hono app                src/server/index.ts
                    ├── auth middleware   JWKS verify → D1 role lookup (omite /api/admin/*)
                    ├── admin middleware  JWT HS256 verify (solo /api/admin/*)
                    ├── rateLimit middleware  KV check
                    ├── error middleware
                    │
                    ├── repositories/
                    │     ├── profile.repository.ts   D1 CRUD
                    │     └── r2.repository.ts        R2 put/get/delete
                    │
                    └── domain/
                          ├── gamification/           XP + achievements
                          │     ├── eventBus.ts       pub/sub
                          │     ├── service.ts        D1 batch (ACID)
                          │     └── listeners.ts
                          ├── media/sanitizer.ts      EXIF strip
                          └── reports/                PDF semanal
                                ├── controllers.ts
                                ├── service.ts
                                ├── dataLayer.ts      D1 queries
                                └── pdfEngine.ts
```

---

## Flujo de autenticación

```
1. Usuario hace login con Google → recibe id_token (JWT)
2. Frontend guarda el token en memoria (session.js)
3. Cada request a /api/* envía: Authorization: Bearer <token>
4. auth.middleware.ts:
   a. Extrae token del header
   b. Verifica firma contra JWKS de Google
   c. Extrae userId (sub) y email del payload
   d. Busca rol del usuario en D1 (tabla profiles)
   e. Inyecta { userId, email, role } en c.get('user')
```

---

## Flujo de contrapropuesta

```
POST /api/topics/:topicId/proposals
  1. auth middleware → userId verificado
  2. Validación de topicId (regex + longitud)
  3. Validación de body (title max 200, description max 2000)
  4. Verifica que el topic existe en D1
  5. Obtiene author desde perfil en D1 (Zero Trust)
  6. Rate limit check en KV
  7. INSERT en D1 con prepared statement
  8. emitGamificationEventAsync() en background
  9. Retorna la propuesta creada
```

---

## Flujo de creación de tema

```
POST /api/topics
  1. auth middleware → userId verificado
  2. Validación de body (category max 100, topicText max 300, proposalTitle max 200, proposalDescription max 2000)
  3. Obtiene author desde perfil en D1 (Zero Trust)
  4. Rate limit check en KV
  5. INSERT topic + INSERT proposal en D1 (batch)
  6. emitGamificationEventAsync() en background
  7. Retorna el thread creado
```

---

## Gamificación (event-driven)

```
API route → emitGamificationEventAsync(ctx, event)
               │
               └── eventBus.ts (pub/sub en memoria)
                     │
                     └── listeners.ts → service.ts
                           │
                           └── D1 batch:
                                 - upsert user_xp
                                 - check thresholds en achievements
                                 - insert user_achievements si aplica
```

El bus de eventos opera en memoria del Worker. No persiste entre requests si el Worker se recicla. Los logros ya guardados en D1 son duraderos.

---

## Almacenamiento

| Servicio | Binding | Uso |
|----------|---------|-----|
| D1 (SQLite) | `DB` | Usuarios, propuestas, logros, rate limit state |
| KV | `RATE_LIMIT_KV` | Cuotas diarias por usuario |
| R2 | `R2_BUCKET` | Fotos de perfil, PDFs de reportes |

**Keys de R2:**
- Fotos: `profiles/<userId>/photo.<ext>`
- PDFs: generados por `pdfEngine.ts` en `reports/`

---

## Tipos compartidos

`src/shared/constants.js` — constantes usadas tanto en el cliente como en el servidor (ej. `USERNAME_MIN`, `USERNAME_MAX`, `USERNAME_REGEX`).

`src/server/types.ts` — define `Env` (bindings de Cloudflare) y `User` (payload del JWT resuelto).
