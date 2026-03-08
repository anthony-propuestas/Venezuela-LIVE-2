# Verificación final de la migración (Paso docs/todo.md 390-446)

Ejecutados en orden los comandos de verificación. Resultados:

---

## 1. Sin referencias huérfanas a la raíz

**Comprobación:** Imports `from './'` en `src/` no deben apuntar a archivos que ya no existen en la raíz.

**Resultado:** Los imports con `./` en `src/` son relativos dentro de cada capa (p. ej. `./domain/...`, `./middlewares/...`, `./repositories/...`). No hay referencias a `./api`, `./login`, `./Profile`, etc. desde la raíz; el cliente usa `@client/...`.

---

## 2. Imports con rutas que suben niveles (`../`)

**Comprobación:** `grep "from '\.\.\/"` en `*.jsx` y `*.js` dentro de `src/`. Idealmente 0.

**Resultado:** **0 resultados** en `.jsx` y `.js`. En `.ts` del server hay `../` en middlewares y repositories (p. ej. `../errors`, `../config`), que es esperable dentro de `src/server/` y no afecta al cliente.

---

## 3. Build de producción limpio

**Comprobación:** `npm run build` sin errores ni "Could not resolve".

**Resultado:** Build correcto. Salida: `✓ built in Xs` y `Pages Functions compiladas en dist/functions/`. Sin warnings de resolución.

---

## 4. Worker compila y responde

**Comprobación:** `npm run dev:worker` en segundo plano; `curl http://localhost:8787/api/profile` devuelve JSON (o error de auth), no error de conexión.

**Resultado:** El worker responde. Sin header `Authorization` se obtiene `{"error":"UNAUTHORIZED","message":"No autorizado. Inicia sesión de nuevo."}` (401). Comportamiento correcto.

---

## 5. Frontend levanta sin errores

**Comprobación:** `npm run dev` en segundo plano; `curl http://localhost:5173` debe contener "Venezuela" (count > 0).

**Resultado:** La página en `http://localhost:5173` contiene "Venezuela". Count > 0.

---

## 6. Deploy de staging

**Comprobación:** `npm run deploy` termina sin errores.

**Resultado:** Deploy completado. Preview: `https://d360a563.venezuela-live-2.pages.dev`. Build + upload + deployment correctos.

---

## Resumen

| # | Verificación                         | Estado   |
|---|--------------------------------------|----------|
| 1 | Sin referencias huérfanas a la raíz   | OK       |
| 2 | Imports `../` en .jsx/.js            | OK (0)   |
| 3 | Build de producción                  | OK       |
| 4 | Worker responde                      | OK       |
| 5 | Frontend levanta                     | OK       |
| 6 | Deploy                               | OK       |

La migración (aliases, client/server/shared, eliminación de worker) está verificada y el proyecto compila, responde en local y despliega correctamente.
