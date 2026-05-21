# Database — Venezuela LIVE

## D1 (SQLite en Cloudflare)

Base de datos relacional. Binding: `DB`. Nombre: `venezuela-live-db`.

### Tablas

#### `profiles`
Datos de usuario. Se crea/actualiza con upsert en cada login y edición de perfil.

```sql
CREATE TABLE profiles (
  user_id      TEXT PRIMARY KEY,   -- sub del JWT de Google
  email        TEXT,
  display_name TEXT,
  birth_date   TEXT,
  description  TEXT,
  ideologies   TEXT,               -- JSON array serializado
  photo_key    TEXT,               -- clave R2 de la foto de perfil
  role         TEXT DEFAULT 'user',-- 'user' | 'moderator' | 'admin'
  is_premium   INTEGER DEFAULT 0,
  created_at   TEXT DEFAULT (datetime('now')),
  updated_at   TEXT DEFAULT (datetime('now'))
);
```

#### `topics`
Temas de debate. Jerarquía: Categoría > Subcategoría > Tema.

```sql
CREATE TABLE topics (
  id           TEXT PRIMARY KEY,
  category     TEXT NOT NULL,
  subcategory  TEXT,
  topic_text   TEXT NOT NULL,
  created_at   TEXT DEFAULT (datetime('now'))
);
```

#### `proposals`
Contrapropuestas asociadas a un tema.

```sql
CREATE TABLE proposals (
  id           TEXT PRIMARY KEY,   -- UUID generado por el servidor
  topic_id     TEXT NOT NULL REFERENCES topics(id),
  title        TEXT NOT NULL,      -- max 200 chars
  description  TEXT NOT NULL,      -- max 2000 chars
  author       TEXT NOT NULL,      -- resolución desde perfil (Zero Trust)
  upvotes      INTEGER DEFAULT 0,
  downvotes    INTEGER DEFAULT 0,
  created_at   TEXT DEFAULT (datetime('now'))
);
```

#### `proposal_notes`
Notas de comunidad sobre propuestas.

```sql
CREATE TABLE proposal_notes (
  id           TEXT PRIMARY KEY,
  proposal_id  TEXT NOT NULL REFERENCES proposals(id),
  text         TEXT NOT NULL,
  upvotes      INTEGER DEFAULT 0,
  downvotes    INTEGER DEFAULT 0,
  net_score    INTEGER DEFAULT 0,
  created_at   TEXT DEFAULT (datetime('now'))
);
```

#### `achievements`
Catálogo estático de logros (se seed en la migración 0005).

```sql
CREATE TABLE achievements (
  id           TEXT PRIMARY KEY,
  event_type   TEXT NOT NULL,      -- 'CREATE_COUNTER_PROPOSAL', 'LIKE_ENTITY', etc.
  name         TEXT NOT NULL,
  description  TEXT NOT NULL,
  xp_reward    INTEGER NOT NULL DEFAULT 0,
  threshold    INTEGER NOT NULL DEFAULT 1,
  icon_key     TEXT,
  sort_order   INTEGER DEFAULT 0,
  created_at   TEXT DEFAULT (datetime('now'))
);
```

#### `user_achievements` (migración 0006)
Logros desbloqueados por usuario.

#### `payment_tickets` (migración 0008)
Tickets de pago enviados por usuarios para activación premium.

---

## Migraciones

Las migraciones están en `migrations/` numeradas `0001`–`0010`. Se aplican en orden.

**Aplicar en local:**
```bash
npm run db:migrate:local:safe
```

**Aplicar en producción:**
```bash
wrangler d1 migrations apply venezuela-live-db --remote
```

**Ver estado:**
```bash
wrangler d1 migrations list venezuela-live-db --local   # local
wrangler d1 migrations list venezuela-live-db --remote  # producción
```

**Crear nueva migración:**
```bash
wrangler d1 migrations create venezuela-live-db <nombre>
```

---

## KV — Rate Limiting

Binding: `RATE_LIMIT_KV` (también `RATE_LIMIT`).

**Estructura de keys:**
```
rl:<YYYY-MM-DD>:<userId>:<action>
```

Ejemplo: `rl:2026-05-21:user123:proposals`

El valor es un contador de entero. Se resetea automáticamente al cambiar la fecha (TTL de 24h+).

---

## R2 — Objetos binarios

Binding: `R2_BUCKET`.

| Path | Contenido |
|------|-----------|
| `profiles/<userId>/photo.jpg` | Foto de perfil (EXIF eliminado) |
| `profiles/<userId>/photo.png` | Foto de perfil PNG |
| `profiles/<userId>/photo.webp` | Foto de perfil WebP |
| `reports/<tipo>/<semana>.pdf` | PDFs de reportes semanales |
