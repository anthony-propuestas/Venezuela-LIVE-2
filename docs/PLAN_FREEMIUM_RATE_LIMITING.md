# Plan: Modelo Freemium, Rate Limiting y Sistema de Pagos

## Resumen

Sistema de limitación diaria para usuarios gratuitos (50 likes, 20 comentarios, 2 propuestas), verificación manual de pagos mediante tickets, y corrección del reset semanal de votos.

---

## Archivos a Modificar / Crear

| Archivo | Acción |
|---------|--------|
| `wrangler.json` | Añadir binding KV, variables de límites |
| `migrations/0008_add_is_premium_and_payment_tickets.sql` | Nueva migración |
| `src/worker/rateLimit.ts` | Servicio de rate limiting con KV |
| `src/worker/premium.ts` | Helpers isPremium, payment tickets |
| `src/worker/index.ts` | Middleware, endpoints /api/actions/*, /api/premium/* |
| `app.jsx` | Fix canVoteThisWeek, Modal 429, página /premium, integrar llamadas API |
| `api.js` | Funciones checkAndConsumeAction, submitPaymentTicket, etc. |

---

## 1. Lógica de Límites (KV)

### Clave KV
- Formato: `rl:${YYYY-MM-DD}:${userId}:${action}` donde action = `likes` | `comments` | `proposals`
- Fecha en UTC para reset a medianoche global
- Sin TTL: la clave expira naturalmente al cambiar de día (no la usamos al día siguiente)

### Lectura/escritura rápida
- Un solo `KV.get()` antes de la acción
- Un solo `KV.put()` para incrementar (atomicidad: leer, incrementar, escribir — KV no tiene incremento atómico nativo; usamos `KV.get` + `KV.put` en el mismo request, riesgo de race: mitigar con reintentos o aceptar eventual consistencia para rate limits)
- Alternativa: usar `KV.list()` con prefix no aplica. Mejor: `get` + `put` con valor numérico.

### Si KV falla
- Degradación: permitir la acción (fail-open) o rechazar (fail-closed). Para rate limits, fail-closed es más seguro: si no podemos leer, asumir límite excedido y devolver 429. Registrar el error para diagnóstico.

---

## 2. Middleware / Validación

- Antes de procesar like/comment/proposal: llamar a `checkRateLimit(env, userId, action)`.
- Si `isPremium(userId)` → skip.
- Si límite excedido → `return c.json({ error: 'RATE_LIMIT_EXCEEDED', action }, 429)`.
- Si OK → incrementar en KV y continuar.

---

## 3. Reset Semanal de Votos (Fix)

- Problema: `getLastSundayReset` usaba "último domingo" pero la condición para poder votar estaba invertida.
- Solución: La semana de votación va de **lunes 00:00** a **domingo 23:59**. Tras el domingo (corte PDF), el lunes empieza nueva semana.
- `getStartOfCurrentWeek()`: lunes 00:00 de la semana actual (en UTC o local).
- `canVoteThisWeek(lastVoteTime)`: `lastVoteTime < getStartOfCurrentWeek()` → puede votar (el voto es de una semana anterior).

---

## 4. Esquema D1

### Columna en profiles
- `is_premium INTEGER NOT NULL DEFAULT 0` (0=false, 1=true)

### Tabla payment_tickets
- `id` TEXT PK
- `user_id` TEXT
- `reference` TEXT (número comprobante)
- `payment_date` TEXT
- `amount` REAL
- `status` TEXT ('pending'|'approved'|'rejected')
- `created_at` TEXT
- `reviewed_at` TEXT
- `reviewed_by` TEXT

---

## 5. Endpoints API

| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | /api/actions/consume | Body: `{ action: 'like'|'comment'|'proposal' }`. Verifica e incrementa cuota. 200 OK o 429 |
| GET | /api/premium/status | Devuelve `{ isPremium, alias, tickets }` |
| POST | /api/premium/ticket | Body: `{ reference, paymentDate, amount }`. Crea ticket pendiente |
| GET | /api/profile | Incluir `isPremium` en la respuesta |

---

## 6. Frontend

- Al dar like/comment/crear propuesta: llamar `POST /api/actions/consume` primero. Si 429 → mostrar modal Premium.
- Modal: mensaje amigable + botón "Obtener Premium" → navega a /premium.
- Página /premium: alias bancario, formulario (referencia, fecha, monto), lista de tickets del usuario.

---

## Orden de Implementación

1. Migración 0008 (is_premium, payment_tickets)
2. Corregir canVoteThisWeek en app.jsx
3. wrangler.json: añadir KV
4. rateLimit.ts y premium.ts
5. Endpoints en index.ts
6. api.js (cliente)
7. app.jsx: modal 429, página premium, integración de llamadas
