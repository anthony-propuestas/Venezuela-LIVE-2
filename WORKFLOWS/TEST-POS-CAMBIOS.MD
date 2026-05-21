# Workflow: Test Post-Cambios

Después de cada commit, ejecutar este workflow para cubrir con tests lo que cambió,
actualizar lo que haya que actualizar, y eliminar lo obsoleto.

---

## 1. Identificar qué cambió

```bash
git log --oneline -5
git diff HEAD~1 HEAD
```

Anotar: qué archivos cambiaron y qué lógica se modificó.

---

## 2. Escribir los tests

### Reglas
- Un test por comportamiento cambiado, no por línea de código.
- Testear el camino que el bug/fix protege, más un regression check del camino que ya funcionaba.
- Co-ubicar el test con el archivo que prueba: `foo.ts` → `foo.test.ts`.

### Estructura de cada test
1. **Arrange** — setup mínimo (mocks, env, datos de entrada).
2. **Act** — llamar al código cambiado.
3. **Assert** — verificar el resultado exacto que el cambio garantiza.

### Mocking en este proyecto (Hono + Cloudflare Workers)
- Usar `vi.mock('ruta/modulo.js', () => ({ fn: vi.fn() }))` para aislar dependencias de D1/R2/KV.
- Para evitar que `registerGamificationListener()` corra al importar `index.ts`, mockear `./domain/gamification/index.js` antes del import.
- Autenticación en tests: pasar `Authorization: Bearer __dev_bypass__` con env `DEV_BYPASS_ALLOWED: 'true'` — evita llamadas a Google JWKS.
- Pasar el env simulado como tercer argumento de `app.request(url, init, mockEnv)`.

### Referencia: ejemplo aplicado (commit BUGS)

| Cambio | Test |
|--------|------|
| `/api/cron/profile-photos-sanitize` añadido al allowlist del middleware | `app.request('/api/cron/profile-photos-sanitize')` sin token → 200 |
| `email: email \|\| name` → `email: email` en PUT `/api/profile` | `upsertProfile` recibe `email: 'pruebas@local'`, nunca el campo `name` |
| Regression: rutas protegidas siguen requiriendo JWT | `app.request('/api/profile')` sin token → 401 |

---

## 3. Correr los tests

```bash
npm test
```

Todos deben pasar en verde. Si falla alguno, corregir el código — no el test.

---

## 4. Eliminar lo obsoleto

Revisar si el cambio dejó código muerto:
- Variables declaradas y no usadas.
- Funciones que ya no se llaman.
- Tests de comportamiento que se eliminó.

Si hay algo obsoleto, borrarlo en el mismo PR/commit que los tests.

---

## 5. Commit

```bash
git add src/**/*.test.ts
git commit -m "test: cubrir cambios de <nombre-commit>"
```
