## Plan para prevenir el almacenamiento de identificadores de sesión o JWTs en `localStorage` o `sessionStorage`

### Objetivo

- **Objetivo principal**: Garantizar que ningún identificador de sesión ni JWT (ID token, access token, refresh token u otros equivalentes) se persista en `localStorage` ni en `sessionStorage` del navegador, reduciendo así la superficie de ataque frente a XSS.
- **Resultado esperado**: 
  - El estado de autenticación se mantiene únicamente en memoria (runtime) del cliente y/o en cookies seguras HTTP-only gestionadas por el backend.
  - Cualquier script inyectado en el contexto de la página que intente leer `localStorage` o `sessionStorage` no pueda exfiltrar tokens de autenticación.

### Alcance y supuestos

- **Alcance**:
  - Módulo de autenticación basado en Firebase Auth (cliente web).
  - Hooks de estado y contextos de React (o framework equivalente) que gestionan el usuario autenticado y sus tokens.
  - Capa de consumo de APIs protegidas que actualmente dependan de tokens leídos desde almacenamiento local o de sesión.
- **Supuestos técnicos**:
  - La aplicación es una SPA/PWA en el navegador.
  - Se utiliza Firebase Authentication del lado del cliente.
  - Existe (o se prevé crear) un backend capaz de manejar sesiones con cookies HTTP-only, aunque este plan ya aporta valor incluso si, en una primera etapa, la sesión es solo en memoria.

---

## Fase 1 – Inventario y mapeo de riesgos

### Paso 1.1 – Búsqueda exhaustiva de usos de `localStorage` y `sessionStorage`

- **Acción**:
  - Buscar en todo el repositorio las apariciones de:
    - `localStorage`
    - `sessionStorage`
    - `setItem`, `getItem`, `removeItem`, `clear`
  - Registrar para cada coincidencia:
    - Archivo y componente/módulo.
    - Clave utilizada (`key`).
    - Tipo de dato almacenado (token, user profile, preferencias, cache UI, etc.).
- **Criterio de clasificación**:
  - **Crítico**: cualquier dato que contenga o derive en un token de autenticación (ID token, access token, refresh token, `Authorization` bearer, etc.).
  - **Aceptable**: datos no sensibles, por ejemplo:
    - Preferencias de tema (dark/light).
    - Idioma.
    - Flags de UI que no exponen identidad ni privilegios.

### Paso 1.2 – Diagrama de flujo de autenticación actual

- **Acción**:
  - Documentar el flujo actual desde que un usuario hace login hasta que el frontend llama a recursos protegidos:
    - ¿Dónde se invoca `signInWithPopup` / `signInWithRedirect` / `signInWithEmailAndPassword`?
    - ¿En qué punto se obtiene el token (`user.getIdToken()`, `user.accessToken`, etc.)?
    - ¿Cómo se pasa ese token a la capa de API (fetch/axios/interceptor)?
    - ¿En qué momento se escribe el token en `localStorage`/`sessionStorage`, si ocurre?
  - Crear un diagrama simple (aunque sea en texto) que indique:
    - Eventos: `login → obtener token → almacenar → usar en API → refrescar/expirar`.
    - Lugares donde existe hoy cualquier persistencia de token.
- **Salida**:
  - Documento actualizado con el flujo, que servirá de referencia para el rediseño.

---

## Fase 2 – Definición de la nueva estrategia de sesión

### Paso 2.1 – Política central: tokens solo en memoria o en cookies HTTP-only

- **Principios**:
  - **Prohibido**:
    - Guardar tokens de autenticación en:
      - `localStorage`
      - `sessionStorage`
      - `IndexedDB` (para tokens), salvo que se cifren con una clave que no viva en el cliente (lo cual, en práctica, no se cumple en una SPA pura).
  - **Permitido**:
    - Mantener el usuario y su estado de login en:
      - Memoria del runtime (estado de React, contextos, estados de hooks).
      - Cookies HTTP-only, `Secure`, `SameSite=Strict` o `Lax`, administradas por el backend (fase futura o paralela).

### Paso 2.2 – Estrategia inmediata con Firebase Auth: persistencia en memoria

- **Acción**:
  - Configurar Firebase Auth en el cliente para usar **`inMemoryPersistence`**:
    - Evitar `browserLocalPersistence` (usa `localStorage`).
    - Evitar `browserSessionPersistence` (usa `sessionStorage`).
  - Asegurarse de que **toda** inicialización de Firebase Auth pasa por una única función/módulo central:
    - Algo estilo `getFirebaseAuth()` o `initFirebaseAuth()` que:
      - Cree la instancia de `auth`.
      - Aplique `setPersistence(auth, inMemoryPersistence)` antes de cualquier operación de `signIn`.
- **Impacto**:
  - El usuario se deslogueará al cerrar completamente la pestaña/navegador.
  - A cambio, se elimina el vector de exfiltración de tokens desde almacenamiento persistente.

### Paso 2.3 – Estrategia de mediano plazo: sesión en backend con cookies HTTP-only

- **Objetivo** (si el proyecto lo permite):
  - Mover la persistencia de la sesión al servidor:
    - El frontend recibe un ID token solo en el momento del login.
    - Se envía al backend por HTTPS.
    - El backend valida el token y emite una cookie HTTP-only de sesión.
  - Tras esta etapa, el frontend:
    - **No necesita** almacenar ni reenviar tokens explícitamente.
    - Usa simplemente `fetch`/`axios` con credenciales, dejando que la cookie haga el trabajo.
- **Este plan actual** se centra en la parte cliente y deja esta evolución documentada para una Fase 2b.

---

## Fase 3 – Refactor del módulo de Firebase Auth

### Paso 3.1 – Centralizar inicialización de Firebase Auth

- **Acción**:
  - Crear o revisar un único módulo responsable de:
    - Inicializar la app de Firebase.
    - Crear la instancia `auth`.
    - Configurar la persistencia:
      - `setPersistence(auth, inMemoryPersistence)`.
    - Exponer:
      - La instancia `auth`.
      - Funciones helper: `login`, `logout`, `onAuthStateChanged`, `getCurrentUser`, etc.
- **Objetivo**:
  - Cualquier componente que necesite autenticación importa **solo** desde este módulo central.
  - Se prohíbe inicializar `auth` de forma directa y duplicada en otros lugares.

### Paso 3.2 – Eliminar cualquier escritura manual de tokens

- **Acción**:
  - Buscar en el código:
    - Lecturas directas de `user.accessToken` o `user.getIdToken()` que terminen en `localStorage.setItem(...)`.
  - Refactorizar para que:
    - Los tokens se usen **solo en el momento de hacer la llamada** a la API (en memoria).
    - No se persistan tras la llamada.
- **Patrón recomendado**:
  - Implementar una función, por ejemplo, `getAuthHeaders()`:
    - Obtiene el usuario actual desde Firebase Auth.
    - Pide el token en ese instante (`await user.getIdToken()`).
    - Devuelve `{ Authorization: \`Bearer ${token}\` }` sin guardar nada en almacenamiento local.

---

## Fase 4 – Refactor de hooks de estado y contextos

### Paso 4.1 – Revisar hooks de autenticación (`useAuth`, contextos, etc.)

- **Acción**:
  - Identificar todos los hooks/contextos relacionados con autenticación:
    - `useAuth`, `AuthContext`, `useSession`, etc.
  - Verificar si:
    - Guardan tokens en su estado **y** en `localStorage`/`sessionStorage`.
    - Reconstruyen el estado de autenticación leyendo tokens desde el almacenamiento local.
- **Refactor**:
  - Estado de la sesión:
    - Solo debe reconstruirse mediante:
      - `onAuthStateChanged(auth, callback)` de Firebase.
      - O, en la arquitectura con backend, verificando la cookie de sesión vía API.
  - Quitar cualquier lógica del tipo:
    - `const token = localStorage.getItem('token')`.
    - `if (token) { setUser(decode(token)) }`.

### Paso 4.2 – Estandarizar el contexto de usuario autenticado

- **Acción**:
  - Definir un `AuthProvider` que:
    - Se suscriba a `onAuthStateChanged`.
    - Guarde en estado React:
      - `user` (objeto seguro de Firebase, sin exponer tokens).
      - `isAuthenticated`, `isLoading`, etc.
  - Exponer un hook `useAuth()` que devuelva este contexto.
- **Regla de seguridad**:
  - El contexto **no** debe exponer:
    - El valor crudo del token.
    - Métodos para obtener el token salvo a capas muy controladas (por ejemplo, capa de API interna).

---

## Fase 5 – Eliminación y sustitución de usos de `localStorage`/`sessionStorage`

### Paso 5.1 – Remover almacenamiento de tokens

- **Acción**:
  - Para cada uso clasificado como **crítico** en la Fase 1:
    - Eliminar la llamada a `localStorage.setItem` o `sessionStorage.setItem`.
    - Sustituir el patrón de "leer token desde storage" por:
      - Obtener el token en tiempo real desde Firebase Auth o desde una API de backend.
  - Verificar que, tras estos cambios, ningún flujo de login/refresh falla.

### Paso 5.2 – Mantener solo datos no sensibles en almacenamiento local

- **Acción**:
  - Para usos clasificados como **aceptables**:
    - Mantener o refinar su clave para que no revele información sensible.
    - Documentar explícitamente cuáles claves de `localStorage` están permitidas y para qué.
- **Resultado**:
  - Una lista blanca (`allowlist`) de claves permitidas en `localStorage`.
  - Cualquier nueva clave debe revisarse contra esta política.

---

## Fase 6 – Refuerzo frente a XSS pensando en tokens

*(Esta fase se coordina con los controles de sanitización global definidos en el plan maestro, pero aquí se focaliza en el impacto sobre tokens.)*

### Paso 6.1 – Verificación de inexistencia de tokens en storage tras XSS simulado

- **Acción**:
  - Tras implementar las fases 2–5:
    - Iniciar sesión en la aplicación como usuario de prueba.
    - Abrir la consola del navegador y ejecutar:
      - `localStorage` y `sessionStorage` para inspeccionar todas las claves.
    - Confirmar:
      - No existe ninguna clave que contenga valores tipo JWT (dos puntos `.` separando header/payload/signature).
  - Simular un XSS manualmente:
    - Inyectar en la consola (como si fuera un script malicioso) algo tipo:
      - `console.log(JSON.stringify(localStorage));`
      - `console.log(JSON.stringify(sessionStorage));`
    - Confirmar que no se ve ningún token de autenticación.

### Paso 6.2 – Documentar la política de “tokens fuera del DOM”

- **Acción**:
  - Añadir en la documentación para desarrolladores:
    - Prohibición explícita de:
      - Imprimir tokens en la UI.
      - Guardar tokens en atributos de HTML, datasets, etc.
  - Asegurar que las herramientas de logging no suban tokens a servicios externos (Sentry, logs remotos, etc.).

---

## Fase 7 – Pruebas automatizadas y validación continua

### Paso 7.1 – Pruebas unitarias / de integración

- **Acción**:
  - Añadir tests que:
    - Mockeen el módulo de Firebase Auth con persistencia en memoria.
    - Verifiquen que:
      - Las funciones de login no llaman nunca a `localStorage.setItem` ni `sessionStorage.setItem`.
      - Los hooks de autenticación no leen nunca desde estos almacenamientos.

### Paso 7.2 – Pruebas end-to-end (E2E)

- **Acción**:
  - Crear un flujo E2E:
    - `login → navegar por la app → recargar página → re-login (si se cerró sesión, comportamiento esperado con inMemoryPersistence)`.
    - En puntos clave, ejecutar un step que:
      - Evalúe en el navegador:
        - `Object.keys(localStorage)` y `Object.keys(sessionStorage)`.
      - Asegure que ninguna de las claves contiene algo que se parezca a un JWT o a un token de acceso.

---

## Fase 8 – Despliegue, monitoreo y gobernanza

### Paso 8.1 – Checklist previo a despliegue

- **Checklist mínimo**:
  - [ ] No existen escrituras de tokens en `localStorage`/`sessionStorage`.
  - [ ] Firebase Auth utiliza `inMemoryPersistence` (u otra opción que no persista en storage del navegador).
  - [ ] Hooks y contextos de autenticación no reconstruyen estado desde almacenamiento local.
  - [ ] Las pruebas manuales y automatizadas de XSS simulado confirman que no hay tokens accesibles desde `localStorage`/`sessionStorage`.

### Paso 8.2 – Monitoreo y revisión continua

- **Acción**:
  - Establecer una **regla de revisión de código**:
    - Cualquier PR que incluya `localStorage` o `sessionStorage` debe:
      - Ser revisado por alguien con criterio de seguridad.
      - Justificar el uso y confirmar que no se manejan tokens.
  - Revisar periódicamente:
    - Que la configuración de Firebase Auth no haya sido cambiada a una persistencia que use storage local.
    - Que la arquitectura no haya reintroducido tokens en almacenamiento local por nuevas funcionalidades.

---

## Conclusión

Con este plan, el Control B1 (“Erradicación de Tokens Locales”) se operacionaliza en pasos concretos: se elimina el almacenamiento de tokens en `localStorage` y `sessionStorage`, se centraliza el manejo de autenticación con Firebase sobre persistencia en memoria y se refuerza la capa de pruebas y gobernanza para evitar regresiones. Esto reduce drásticamente el impacto de un ataque XSS persistente que logre evadir la sanitización, alineando la plataforma con una arquitectura más cercana a Zero-Trust en el cliente.

