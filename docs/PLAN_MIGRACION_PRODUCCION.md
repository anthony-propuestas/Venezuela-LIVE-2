# Plan de Acción: Migración a Producción

## Resumen

Este documento describe los pasos para preparar y ejecutar la migración del proyecto Venezuela LIVE a producción en Cloudflare (Workers, D1, R2, Pages).

---

## Fase 1: Pre-requisitos (Antes de migrar)

### 1.1 Verificar acceso a Cloudflare

| Paso | Acción | Verificación |
|------|--------|---------------|
| 1 | Iniciar sesión en [Cloudflare Dashboard](https://dash.cloudflare.com) | Cuenta activa |
| 2 | Ejecutar `npx wrangler whoami` | Muestra tu cuenta y zona |
| 3 | Confirmar que el proyecto usa la cuenta correcta | `wrangler.json` → `name: venezuelalive` |

### 1.2 Verificar recursos existentes

| Recurso | Dónde revisar | Estado esperado |
|---------|---------------|-----------------|
| D1 Database | Dash → Workers & Pages → D1 | `venezuela-live-db` (id: `3d94425c-e2e8-4fa5-9b29-d54d85caf56f`) |
| R2 Bucket | Dash → R2 | bucket `019c9888-2bfb-7abf-a321-8db0f593ade0` |
| Pages Project (si aplica) | Dash → Workers & Pages → Pages | `venezuela-live-2` |

### 1.3 Variables de entorno

| Variable | Tipo | Producción |
|----------|------|------------|
| `DEV_BYPASS_ALLOWED` | var | `"false"` (ya definido en wrangler.json) |
| `GOOGLE_CLIENT_ID` | **secret** | Client ID de Google OAuth (producción) |

---

## Fase 2: Configurar secret para producción

### 2.1 GOOGLE_CLIENT_ID

```bash
npx wrangler secret put GOOGLE_CLIENT_ID
```

- Cuando se solicite, pegar el **Client ID de producción** de [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
- Asegurar que la URI de origen autorizado incluya el dominio de producción (ej. `https://venezuela-live.pages.dev` o tu dominio personalizado)
- Asegurar que la URI de redirección de JavaScript esté configurada correctamente

---

## Fase 3: Migraciones D1 en producción (Remote)

**⚠️ Importante:** Las migraciones se aplican en orden. No ejecutes migraciones que ya se aplicaron.

### 3.1 Verificar estado actual de la BD remota

```bash
npx wrangler d1 execute venezuela-live-db --remote --command "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;"
```

Revisa qué tablas existen para saber hasta qué migración aplicar.

### 3.2 Ejecutar migraciones (en orden)

Si la BD está vacía o solo tiene esquemas base:

| # | Archivo | Comando |
|---|---------|---------|
| 1 | `0001_create_profiles.sql` | `npx wrangler d1 execute venezuela-live-db --remote --file=./migrations/0001_create_profiles.sql` |
| 2 | `0002_add_username.sql` | `npx wrangler d1 execute venezuela-live-db --remote --file=./migrations/0002_add_username.sql` |
| 3 | `0003_create_proposals_schema.sql` | `npx wrangler d1 execute venezuela-live-db --remote --file=./migrations/0003_create_proposals_schema.sql` |
| 4 | `0004_seed_proposals.sql` | `npx wrangler d1 execute venezuela-live-db --remote --file=./migrations/0004_seed_proposals.sql` |
| 5 | `0005_create_achievements.sql` | `npx wrangler d1 execute venezuela-live-db --remote --file=./migrations/0005_create_achievements.sql` |
| 6 | `0006_create_user_achievements.sql` | `npx wrangler d1 execute venezuela-live-db --remote --file=./migrations/0006_create_user_achievements.sql` |
| 7 | `0007_add_gamification_to_profiles.sql` | `npx wrangler d1 execute venezuela-live-db --remote --file=./migrations/0007_add_gamification_to_profiles.sql` |

### 3.3 Script para migrar todo (BD nueva)

```bash
npm run db:migrate:remote
```

O manualmente con PowerShell desde la raíz del proyecto:

```powershell
powershell -ExecutionPolicy Bypass -File ./scripts/migrate-d1-remote.ps1
```

### 3.4 Si la BD ya tiene datos (solo nuevas migraciones)

Si `profiles`, `proposals`, etc. ya existen y solo faltan las de gamificación:

```bash
npx wrangler d1 execute venezuela-live-db --remote --file=./migrations/0005_create_achievements.sql
npx wrangler d1 execute venezuela-live-db --remote --file=./migrations/0006_create_user_achievements.sql
npx wrangler d1 execute venezuela-live-db --remote --file=./migrations/0007_add_gamification_to_profiles.sql
```

**Nota:** `0007` añade columnas. Si alguna columna ya existe, puede aparecer un error; en ese caso, ignora o adapta el SQL manualmente.

---

## Fase 4: Build y despliegue

### 4.1 Build de prueba (validación local)

```bash
npm run build
```

Comprobar que no hay errores de TypeScript/Vite.

### 4.2 Opción A: Deploy a Cloudflare Pages (flujo actual)

```bash
npm run deploy
```

Esto ejecuta `vite build` y luego `wrangler pages deploy dist --project-name=venezuela-live-2`.

**Revisar:** Si el Worker (API, D1, R2) vive en el mismo proyecto Pages, este deploy debería ser suficiente. Si el Worker se despliega por separado, ver Opción B.

### 4.3 Opción B: Deploy del Worker por separado

Si el backend está en `wrangler.json` como Worker con `main`, assets, D1 y R2:

```bash
npm run build
npx wrangler deploy
```

- `wrangler deploy` sube el Worker, los assets (`./dist`), y usa la configuración de D1/R2.
- No uses `--env dev` en producción.

---

## Fase 5: Post-despliegue

### 5.1 Verificación funcional

| Prueba | Acción |
|--------|--------|
| Login | Abrir la app, iniciar sesión con Google |
| Perfil | Editar perfil y guardar |
| Foto | Subir foto de perfil |
| Gamificación | Comprobar que `GET /api/profile` devuelve `gamification: { totalXp, achievements }` |
| Reportes | Descargar reporte PDF semanal (si aplica) |

### 5.2 Revisar logs

- Dash → Workers & Pages → [tu worker] → Logs (Real-time o Tail)
- Confirmar que no hay errores 500 ni excepciones no capturadas

### 5.3 Variables de frontend

- **No** definir `VITE_GOOGLE_AUTH_PAUSED=true` en producción
- Si usas variables de build (`VITE_*`), configurarlas en el dashboard de Pages o en el pipeline de CI

---

## Fase 6: Rollback (si algo falla)

### 6.1 Worker

- Dash → Workers & Pages → venezuelalive → Deployments
- Seleccionar un deployment anterior y marcar como "Active"

### 6.2 D1

- Las migraciones D1 **no se revierten automáticamente**
- Si es crítico, tendrías que ejecutar SQL manual para revertir (p. ej. `DROP TABLE` o `ALTER TABLE` para quitar columnas)
- **Mejor práctica:** Probar migraciones en staging antes de producción

### 6.3 R2

- Los objetos subidos no se eliminan con el rollback del Worker
- Si hay corrupción de datos, se requiere limpieza manual

---

## Resumen de comandos (copiar/pegar)

```bash
# 1. Verificar autenticación
npx wrangler whoami

# 2. Configurar secret (producción)
npx wrangler secret put GOOGLE_CLIENT_ID

# 3. Migraciones D1 remotas (solo las que falten)
npx wrangler d1 execute venezuela-live-db --remote --file=./migrations/0005_create_achievements.sql
npx wrangler d1 execute venezuela-live-db --remote --file=./migrations/0006_create_user_achievements.sql
npx wrangler d1 execute venezuela-live-db --remote --file=./migrations/0007_add_gamification_to_profiles.sql

# 4. Deploy
npm run deploy
```

---

## Checklist final

- [ ] `DEV_BYPASS_ALLOWED` = `false`
- [ ] Secret `GOOGLE_CLIENT_ID` configurado (producción)
- [ ] Migraciones D1 remotas aplicadas
- [ ] `npm run build` sin errores
- [ ] Deploy completado
- [ ] Login y perfil funcionando en producción
- [ ] Gamificación visible en perfil (si migraciones 5–7 aplicadas)
- [ ] Sin `VITE_GOOGLE_AUTH_PAUSED=true` en producción
