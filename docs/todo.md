# Todo

# Plan de Migración — Venezuela LIVE 2
> De estructura plana/desordenada → arquitectura `client/server/shared` por capas

---

## Principio rector

**Mover archivos sin romper nada** requiere dos cosas en paralelo:
1. Instalar aliases de paths **antes** de mover cualquier archivo
2. Mover en orden topológico: primero las **hojas** (sin dependencias internas), después los **nodos** (los que importan a otros)

---

## Paso 0 — Instalar el sistema de Alias de Paths (PRIMERO, ANTES DE MOVER NADA)

Este es el paso más importante. Actualmente los archivos se comunican por **ubicación relativa** (`../../components/Button`). El objetivo es que se comuniquen por **contrato semántico** (`@client/components/Button`). Así, mover un archivo no rompe los imports del resto.

### 0.1 — Configurar `vite.config.js`

```js
import path from 'path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@client': path.resolve(__dirname, 'src/client'),
      '@server': path.resolve(__dirname, 'src/server'),
      '@shared': path.resolve(__dirname, 'src/shared'),
    },
  },
})
```

### 0.2 — Crear `jsconfig.json` en la raíz (para que el IDE reconozca los aliases)

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@client/*": ["src/client/*"],
      "@server/*": ["src/server/*"],
      "@shared/*": ["src/shared/*"]
    }
  }
}
```

> **Por qué dos archivos?** Vite usa `vite.config.js` para resolver en build/dev. El IDE (VSCode) usa `jsconfig.json` para intellisense. Si solo tocas uno, el otro queda ciego.
> Fuente: [DEV Community — Path Aliases Vite + React](https://dev.to/jumbo02/how-to-setup-path-alias-vite-react-5426)

### ✅ Test del Paso 0

```bash
npm run build
# Debe compilar sin errores. No hemos movido nada todavía.
```

---

## Paso 1 — Crear la estructura de carpetas vacías

Crear los directorios objetivo antes de mover archivos. Esto es reversible y no rompe nada.

```bash
mkdir -p src/client/pages/Login
mkdir -p src/client/pages/Profile
mkdir -p src/client/components/ui
mkdir -p src/client/components/layout
mkdir -p src/client/services
mkdir -p src/client/hooks
mkdir -p src/client/context
mkdir -p src/client/assets/images
mkdir -p src/server/routes
mkdir -p src/server/controllers
mkdir -p src/server/repositories
mkdir -p src/server/middlewares
mkdir -p src/server/domain/gamification
mkdir -p src/server/domain/reports
mkdir -p src/shared/types
```

### ✅ Test del Paso 1

```bash
npm run build
# Debe seguir compilando igual que antes. Solo creamos carpetas.
```

---

## Paso 2 — Archivos HOJA (sin imports internos del proyecto)

Estos archivos no importan nada del propio proyecto. Son los más seguros para mover primero.

### Mapa de movimientos

| Archivo actual | Destino | Imports internos |
|---|---|---|
| `index.css` | `src/client/assets/index.css` | ❌ Ninguno |

### 2.1 — Mover `index.css`

```bash
mv index.css src/client/assets/index.css
```

Actualizar la referencia en `main.jsx` (único lugar que lo importa):

```js
// Antes
import './index.css'

// Después
import '@client/assets/index.css'
```

### ✅ Test del Paso 2

```bash
npm run dev
# Abrir http://localhost:5173 — los estilos deben seguir aplicándose.
npm run build
# Build sin errores.
```

---

## Paso 3 — Mover `ErrorContext.jsx` → Context

`ErrorContext.jsx` solo exporta un Context de React. No importa otros archivos del proyecto.

```bash
mv ErrorContext.jsx src/client/context/ErrorContext.jsx
```

Actualizar todos los archivos que lo importan. Buscar referencias:

```bash
grep -r "ErrorContext" --include="*.jsx" --include="*.js" .
```

Cambiar cada import encontrado:

```js
// Antes (ejemplo desde app.jsx en la raíz)
import { ErrorProvider } from './ErrorContext'

// Después
import { ErrorProvider } from '@client/context/ErrorContext'
```

### ✅ Test del Paso 3

```bash
npm run dev
# La app debe cargar sin errores en consola.
# Provocar un error en la UI para confirmar que ErrorContext sigue funcionando.
```

---

## Paso 4 — Mover `api.js` → Services

`api.js` actualmente centraliza todos los `fetch()` al backend. Se convierte en la capa `services/`.

### 4.1 — Renombrar y mover sin dividir primero

```bash
cp api.js src/client/services/api.service.js
```

> Copiar (no mover) primero. Así el original sigue funcionando mientras actualizas los imports.

### 4.2 — Actualizar imports

```bash
grep -r "from.*api" --include="*.jsx" --include="*.js" .
```

Cambiar cada referencia:

```js
// Antes
import { getProfile, updateProfile } from './api'

// Después
import { getProfile, updateProfile } from '@client/services/api.service'
```

### 4.3 — Eliminar el original cuando todos los imports estén actualizados

```bash
rm api.js
```

### ✅ Test del Paso 4

```bash
npm run dev
# Iniciar sesión con VITE_GOOGLE_AUTH_PAUSED=true
# Navegar al perfil — las llamadas /api/profile deben funcionar (revisar Network en DevTools)
npm run build
```

---

## Paso 5 — Mover páginas: `login.jsx` y `Profile.jsx`

### 5.1 — Mover `login.jsx`

```bash
mv login.jsx src/client/pages/Login/Login.page.jsx
```

### 5.2 — Mover `Profile.jsx`

```bash
mv Profile.jsx src/client/pages/Profile/Profile.page.jsx
```

### 5.3 — Actualizar `app.jsx` (router raíz)

```bash
grep -r "login\|Profile" app.jsx
```

```js
// Antes
import Login from './login'
import Profile from './Profile'

// Después
import Login from '@client/pages/Login/Login.page'
import Profile from '@client/pages/Profile/Profile.page'
```

### ✅ Test del Paso 5

```bash
npm run dev
# - Ruta / debe mostrar Login
# - Ruta /profile debe mostrar el perfil con datos reales
# - Revisar que no haya 404 ni errores de import en consola
```

---

## Paso 6 — Mover `app.jsx` y `main.jsx` → `src/client/`

Estos son los últimos archivos del cliente en la raíz.

```bash
mv app.jsx src/client/App.jsx
mv main.jsx src/client/main.jsx
```

### 6.1 — Actualizar `index.html`

`index.html` referencia `main.jsx` directamente:

```html
<!-- Antes -->
<script type="module" src="/main.jsx"></script>

<!-- Después -->
<script type="module" src="/src/client/main.jsx"></script>
```

### 6.2 — Actualizar `src/client/main.jsx`

```js
// Antes
import App from './app'

// Después
import App from '@client/App'
```

### ✅ Test del Paso 6

```bash
npm run build
# Build completo sin errores
npm run dev
# La app entera debe funcionar — login, perfil, errores
```

---

## Paso 7 — Migrar `src/worker/` → `src/server/`

El backend actualmente vive en `src/worker/`. La migración es un rename semántico + reorganización interna.

### 7.1 — Copiar el contenido (no mover aún)

```bash
cp -r src/worker/* src/server/
```

### 7.2 — Reorganizar internamente en `src/server/`

Distribuir los archivos según la arquitectura de 3 capas:

| Archivo origen (src/worker/) | Destino (src/server/) | Capa |
|---|---|---|
| `index.ts` | `src/server/index.ts` | App Hono principal |
| Lógica de rutas mezclada | `routes/*.routes.ts` | Solo definición HTTP |
| Lógica de negocio | `controllers/*.controller.ts` | Orquestación |
| Queries D1/R2/KV | `repositories/*.repository.ts` | Acceso a datos |
| Auth, rate limit, errors | `middlewares/*.middleware.ts` | Cross-cutting |
| Módulos gamification/reports | `domain/` | Dominio cerrado |

### 7.3 — Actualizar `functions/[[path]].ts`

```ts
// Antes
import app from '../src/worker/index'

// Después
import app from '../src/server/index'
```

### 7.4 — Verificar que `wrangler.json` apunte correctamente

```bash
cat wrangler.json
# Confirmar que no hay rutas hardcodeadas a src/worker/
```

### ✅ Test del Paso 7

```bash
npm run build
npm run dev:pages
# Probar todos los endpoints:
curl http://localhost:8787/api/profile
curl http://localhost:8787/api/cron/weekly-reports -H "X-Cron-Secret: <tu-secret>"
```

---

## Paso 8 — Eliminar archivos originales ya migrados

Una vez que todos los tests del Paso 7 pasen:

```bash
rm -rf src/worker/
```

Y confirmar que `dist-worker/` (compilado) se regenera correctamente con `npm run build`.

### ✅ Test del Paso 8

```bash
npm run build
# Sin errores. Sin referencias a src/worker/ en ningún import.
grep -r "src/worker" --include="*.ts" --include="*.js" .
# Debe devolver vacío
```

---

## Paso 9 — Crear `src/shared/types/`

Con toda la app funcionando, extraer los tipos compartidos que ya existen en el código:

```bash
touch src/shared/types/profile.types.ts
touch src/shared/types/api.types.ts
touch src/shared/constants.ts
```

Mover las interfaces/types que aparecen tanto en client como en server hacia `@shared/types/`.

### ✅ Test del Paso 9

```bash
npm run build
# TypeScript (server) no debe tener errores de tipos
```

---

## ⚙️ Comandos de Verificación Final

Ejecutar estos comandos **en orden** para confirmar que la migración está completa y sana:

### 1. Sin referencias huérfanas a la raíz

```bash
# No debe haber imports de archivos que ya no existen en la raíz
grep -r "from '\.\/" --include="*.jsx" --include="*.js" --include="*.ts" src/
# Solo deben aparecer imports relativos dentro de la misma carpeta (ej: ./Login.hooks.js)
# NO deben aparecer rutas que suban directorios (../ o ../../)
```

### 2. Sin imports con rutas relativas que suban niveles

```bash
grep -rn "from '\.\.\/" --include="*.jsx" --include="*.js" src/
# Idealmente: 0 resultados
# Si hay resultados: son candidatos para convertir a @client/ o @shared/
```

### 3. Build de producción limpio

```bash
npm run build
# Debe terminar con:
# ✓ built in Xs
# Sin warnings de "Could not resolve"
```

### 4. Validar que el Worker compila y responde

```bash
npm run dev:worker &
sleep 3
curl -s http://localhost:8787/api/profile | head -c 200
# Debe devolver JSON (o error de auth), NO un error de conexión
```

### 5. Validar que el frontend levanta sin errores

```bash
npm run dev &
sleep 3
curl -s http://localhost:5173 | grep -c "Venezuela"
# Debe devolver > 0
```

### 6. Deploy de staging (test final de integración)

```bash
npm run deploy
# El comando completo debe terminar sin errores
# Verificar en Cloudflare Pages dashboard que el deploy fue exitoso
```

---

## Resumen visual del orden de migración

```
Paso 0  → Aliases (@client, @server, @shared)     [FUNDACIÓN]
Paso 1  → Crear carpetas vacías                    [SCAFFOLDING]
Paso 2  → index.css (hoja sin deps)                [HOJA]
Paso 3  → ErrorContext.jsx (hoja, solo React)      [HOJA]
Paso 4  → api.js → services/                       [HOJA]
Paso 5  → login.jsx + Profile.jsx → pages/         [NODO]
Paso 6  → app.jsx + main.jsx → src/client/         [NODO RAÍZ]
Paso 7  → src/worker/ → src/server/ (3 capas)      [BACKEND]
Paso 8  → Limpieza de originales                   [LIMPIEZA]
Paso 9  → src/shared/types/ (extracción)           [REFACTOR]
```

> **Regla de oro:** Si en cualquier paso `npm run build` falla, NO continúes al siguiente. Resolver primero.
