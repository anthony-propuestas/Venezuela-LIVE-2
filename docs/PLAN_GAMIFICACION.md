# Plan de Diseño: Sistema de Gamificación (Logros y XP)

## 1. Resumen Ejecutivo

Sistema de gamificación orientado a eventos para la red social Venezuela Live, con alta cohesión y bajo acoplamiento. Los controladores existentes **no se saturan** porque la lógica de logros se ejecuta **reactivamente** mediante un Event Bus (Pub-Sub), nunca inyectada directamente en los endpoints.

---

## 2. Patrón de Diseño: Observer / Pub-Sub (Event-Driven)

### 2.1 Justificación

| Alternativa | Problema |
|-------------|----------|
| **Inyección directa en controladores** | Acoplamiento alto, controladores inflados, difícil de testear, viola SRP. |
| **Middleware en cadena** | El orden importa, la gamificación podría bloquear la respuesta si falla. |
| **Pub-Sub / Event Emitter** ✅ | Controladores solo emiten eventos; la gamificación escucha de forma asíncrona. Bajo acoplamiento, fácil de extender y testear. |

### 2.2 Flujo Propuesto

```
[Usuario da Like] → [Endpoint POST /api/likes] → [Lógica de negocio principal]
                            ↓
                    Emit evento: LIKE_ENTITY
                            ↓
                    [Event Bus] → [GamificationListener]
                            ↓
                    Procesar XP + logros (try-catch, no bloquea)
```

- **Éxito**: El like se guarda y responde 200. La gamificación se ejecuta en paralelo.
- **Fallo en gamificación**: Se registra el error, se hace rollback en D1 si aplica. **El like NO falla.**

---

## 3. Eventos (Core Actions)

| Evento | Payload | XP sugerido | Ejemplo de logro |
|--------|---------|-------------|------------------|
| `CREATE_COUNTER_PROPOSAL` | `{ userId, topicId, proposalId }` | +10 | "Primera contrapropuesta" (1), "Debatiente activo" (10) |
| `LIKE_ENTITY` | `{ userId, entityType, entityId }` | +2 | "Apoyo comunitario" (5 likes) |
| `DISLIKE_ENTITY` | `{ userId, entityType, entityId }` | +1 | "Participación crítica" (5 dislikes) |
| `CREATE_COMMENT` | `{ userId, proposalId, commentId }` | +5 | "Comentarista" (3 comentarios) |
| `CREATE_COMMUNITY_NOTE` | `{ userId, proposalId, noteId }` | +15 | "Notero experto" (1 nota), "Colaborador" (5 notas) |

---

## 4. Modelado de Datos

### 4.1 Tabla `achievements` (catálogo estático)

| Columna | Tipo | Descripción |
|---------|------|-------------|
| `id` | TEXT PK | Identificador único (ej. `first_counter_proposal`) |
| `event_type` | TEXT | Tipo de evento que lo desbloquea |
| `name` | TEXT | Nombre visible |
| `description` | TEXT | Descripción |
| `xp_reward` | INTEGER | XP otorgado al desbloquear |
| `threshold` | INTEGER | Umbral (ej. 1 = primera vez, 10 = diez veces) |
| `icon_key` | TEXT | Clave de icono (opcional) |
| `sort_order` | INTEGER | Orden de visualización |

### 4.2 Tabla `user_achievements` (relacional, hitos)

| Columna | Tipo | Descripción |
|---------|------|-------------|
| `id` | TEXT PK | UUID |
| `user_id` | TEXT | FK a profiles |
| `achievement_id` | TEXT | FK a achievements |
| `earned_at` | TEXT | datetime('now') |
| `xp_earned` | INTEGER | XP otorgado en ese momento |

### 4.3 Refactorización de `profiles` (métricas transaccionales)

| Columna nueva | Tipo | Descripción |
|---------------|------|-------------|
| `total_xp` | INTEGER | XP acumulado del usuario |
| `counter_proposals_count` | INTEGER | Contador de contrapropuestas |
| `likes_count` | INTEGER | Contador de likes dados |
| `dislikes_count` | INTEGER | Contador de dislikes dados |
| `comments_count` | INTEGER | Contador de comentarios |
| `community_notes_count` | INTEGER | Contador de notas de comunidad |

---

## 5. Manejo de Errores y Transacciones

### 5.1 Propiedades ACID

- Usar **D1 `batch()`** para agrupar en una sola transacción:
  1. `UPDATE profiles SET total_xp = ..., counter_proposals_count = ... WHERE user_id = ?`
  2. `INSERT INTO user_achievements (...)`
- Si cualquier statement falla, D1 hace rollback automático.

### 5.2 Clase `GamificationError`

```typescript
export class GamificationError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = 'GamificationError';
  }
}
```

### 5.3 Degradación elegante

1. El endpoint principal (ej. dar like) **nunca** depende del resultado de la gamificación.
2. La emisión del evento se hace con `ctx.waitUntil()` o equivalente para ejecutar en segundo plano.
3. Si el listener lanza, se captura con try-catch, se registra el error y se retorna sin afectar la respuesta HTTP.

---

## 6. Plan de Implementación Paso a Paso

### Paso 1: Migraciones D1

1. `0005_create_achievements.sql`: crear tabla `achievements` + seed de logros base.
2. `0006_create_user_achievements.sql`: crear tabla `user_achievements`.
3. `0007_add_gamification_to_profiles.sql`: añadir columnas de XP y contadores a `profiles`.

### Paso 2: Capa de errores y tipos

1. `src/worker/gamification/errors.ts`: clase `GamificationError`.
2. `src/worker/gamification/types.ts`: tipos `GamificationEvent`, `Achievement`, etc.

### Paso 3: Event Bus (Pub-Sub)

1. `src/worker/gamification/eventBus.ts`: Event Emitter simple con `emit()` y `on()`.
2. Eventos tipados por `eventType` y `payload`.

### Paso 4: Servicio de gamificación

1. `src/worker/gamification/service.ts`:
   - `processEvent(db, event)`: evalúa condiciones, asigna XP, inserta logros.
   - Usa `db.batch()` para transacciones.
   - try-catch con rollback implícito (D1 batch).

### Paso 5: Listeners

1. `src/worker/gamification/listeners.ts`: suscribir al Event Bus y llamar a `processEvent`.
2. Registrar listeners al arrancar el worker.

### Paso 6: Integración en endpoints (cuando existan)

1. En cada endpoint relevante (ej. `POST /api/likes`), tras la operación exitosa:
   ```ts
   import { emitGamificationEventAsync } from './gamification/index.js';
   emitGamificationEventAsync(c, {
     type: 'LIKE_ENTITY',
     payload: { userId: c.get('user').userId, entityType: 'proposal', entityId },
   });
   ```
2. `emitGamificationEventAsync` usa `waitUntil` internamente para no bloquear la respuesta.

### Paso 7: Tests y validación

1. Probar que un like exitoso no falla si la gamificación falla.
2. Probar que XP y logros se persisten correctamente en transacciones.

---

## 7. Estructura de Archivos Propuesta

```
src/worker/
├── gamification/
│   ├── errors.ts        # GamificationError
│   ├── types.ts         # Eventos, Achievement, etc.
│   ├── eventBus.ts      # Pub-Sub
│   ├── service.ts       # Lógica de XP y logros
│   ├── listeners.ts     # Suscripción a eventos
│   └── index.ts         # Export público
├── index.ts             # Registrar listeners, rutas
└── reports/
    └── ...
migrations/
├── 0005_create_achievements.sql
├── 0006_create_user_achievements.sql
└── 0007_add_gamification_to_profiles.sql
```

---

## 8. Consideraciones Cloudflare Workers

- **Sin proceso background**: Usar `ctx.waitUntil()` para gamificación asíncrona.
- **D1 batch**: Máximo ~1000 statements por batch; nuestro uso será mínimo.
- **Cron**: Opcionalmente, un job semanal para sincronizar contadores desde tablas origen (proposals, etc.) si hay desajustes.

---

## 9. Orden de ejecución recomendado

1. Migraciones (esquema).
2. Errores y tipos.
3. Event Bus.
4. Servicio con transacciones.
5. Listeners.
6. Integración en endpoints (stubs o reales según estado del proyecto).
