## Plan B2 – Mitigar la asignación masiva de permisos y restringir fugas completas de bases de datos

### Objetivo

- **Objetivo principal**: Evitar que cualquier actor (usuario final, backend comprometido parcialmente o servicio mal configurado) pueda leer o escribir de forma masiva sobre la base de datos de la red social.
- **Resultado esperado**:
  - Ninguna ruta lógica de la aplicación permite lecturas “catch-all” (ej. dumps completos de tablas/colecciones) sin filtros estrictos y control de rol.
  - Cada operación de lectura/escritura está acotada por:
    - **Identidad** del usuario (ID único).
    - **Rol** explícito (RBAC).
    - **Contexto** (acción concreta, límites de paginación, filtros).
  - Un atacante que obtenga un token de usuario estándar solo puede acceder a **sus propios datos** y a subconjuntos públicos muy limitados, nunca a un dump completo.

### Alcance y supuestos

- **Alcance**:
  - Capa de persistencia principal (en este proyecto, base de datos D1/SQLite detrás de la API).
  - Capa de API (`/api/*` en Hono) que expone operaciones de lectura/escritura.
  - Mecanismo de autenticación actual (JWT de Google + posible bypass dev) como fuente de identidad para RBAC.
- **Supuestos técnicos concretos para Venezuela LIVE**:
  - El backend está en **Cloudflare Pages Functions** con **Hono**.
  - La base de datos es **D1 (SQLite)**, no Firestore.  
    - Por tanto, las “reglas jerárquicas” al estilo Firestore se implementan vía:
      - **Capa de API + middlewares** (autorización).
      - **Consultas SQL parametrizadas y acotadas** (sin SELECT * sin filtro).
  - El JWT de Google (o el token dev) se termina validando en un middleware de auth y se mapea a un **usuario interno** con posibles campos de rol (`is_admin`, `is_moderator`, etc.).

---

### Implementación actual en Venezuela LIVE

En la implementación actual, el control B2 se refleja en un **modelo de roles básico** y en el diseño de la API y consultas a D1 para evitar lecturas o escrituras globales:

- **Rol de usuario en la base de datos (D1)**:
  - La tabla `profiles` incluye la columna:
    - `role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'moderator', 'admin'))` (migración `0010_add_role_to_profiles.sql`).
  - Esta columna actúa como **fuente de verdad de RBAC** para todo el backend.
- **Tipo compartido `User` enriquecido con `role`**:
  - En `src/shared/types/api.types.ts`:
    - `User` se define como `{ userId: string; email: string; name: string; role: 'user' | 'moderator' | 'admin' }`.
  - Tanto el servidor (`src/server`) como el cliente que consuma este tipo comparten la misma noción de rol.
- **Middleware de autenticación con resolución de rol**:
  - Archivo: `src/server/middlewares/auth.middleware.ts`.
  - Flujo:
    - Verifica el JWT de Google usando JWKS (`jwtVerify`).
    - Extrae `sub` (userId), `email` y `name`.
    - Realiza una consulta a D1:
      - `SELECT role FROM profiles WHERE user_id = ?`.
      - Si la consulta devuelve `'user'`, `'moderator'` o `'admin'`, se usa ese rol; en cualquier otro caso o error, se degrada a `'user'`.
    - Inyecta en el contexto Hono (`c.set('user', user)`) un objeto con `{ userId, email, name, role }`.
    - El usuario de bypass de desarrollo (`__dev_bypass__`) se crea siempre con rol `'user'`.
- **API diseñada para evitar lecturas masivas**:
  - Rutas como `/api/profile`, `/api/profile/photo`, `/api/premium/status`, `/api/premium/ticket`, `/api/actions/consume` y el dominio de gamificación:
    - Siempre trabajan acotadas por el `userId` autenticado.
    - No existen endpoints que devuelvan:
      - Listados completos de usuarios.
      - Listas globales de `payment_tickets` u otras tablas sensibles.
  - El repositorio de perfiles (`src/server/repositories/profile.repository.ts`):
    - `getProfileByUserId`, `getPhotoKeyByUserId`, `getGamificationForUser` y helpers relacionados **siempre filtran por `user_id = ?`**.
  - El módulo `premium.ts`:
    - `getTicketsByUser` se limita a `WHERE user_id = ?`, evitando exponer tickets de otros usuarios.
- **Base para futuros roles `moderator` y `admin`**:
  - Aunque en la versión actual no hay endpoints expuestos específicamente para `moderator`/`admin`, el sistema ya:
    - Resuelve `role` de forma centralizada.
    - Puede evolucionar fácilmente:
      - Añadiendo cheques de rol en rutas administrativas.
      - Creando vistas reducidas para moderación.
- **Efecto resultante**:
  - Un token de usuario comprometido no puede usarse para descargar dumps completos de la base de datos.
  - Las lecturas y escrituras se encuentran fuertemente vinculadas a la identidad (`userId`) y al contexto de la operación, cumpliendo el objetivo de mitigar permisos masivos y fugas por scraping.

---

## Anexo histórico – Fase 1: Inventario y modelo de datos de seguridad

### Paso 1.1 – Inventario de tablas/colecciones y rutas API asociadas

- **Acción**:
  - Listar todas las tablas / colecciones relevantes para seguridad:
    - Perfiles de usuario (identidad, username, flags premium, etc.).
    - Propuestas, comentarios, notas de comunidad, logros, tickets de pago, etc.
  - Para cada tabla:
    - Documentar qué rutas API la modifican (`GET/POST/PUT/DELETE /api/...`).
    - Identificar las consultas “de lista” (listados, rankings, reportes).
- **Salida**:
  - Tabla de mapeo `Recurso -> Rutas API -> Operaciones (R, W, RW) -> Sensibilidad`.

### Paso 1.2 – Clasificación de datos por sensibilidad

- **Categorías**:
  - **Alta sensibilidad**:
    - Información de perfil vinculada a identidad real o identificadores únicos (correo, alias bancario, referencias de pago).
    - Cualquier información que pueda exponer metadatos geopolíticos o hábitos de uso sensibles.
  - **Media sensibilidad**:
    - Propuestas, comentarios, notas de comunidad asociadas a usuario identificado por alias público.
  - **Baja sensibilidad**:
    - Datos puramente agregados o estadísticos (contadores, rankings agregados sin identificar individuos).
- **Acción**:
  - Marcar cada tabla/campo con sensibilidad **Alta/Media/Baja**.
  - Este nivel condicionará qué roles pueden:
    - Listar sin filtro.
    - Leer por ID.
    - Modificar / borrar.

---

## Fase 2 – Diseño de modelo RBAC basado en identidad y rol

### Paso 2.1 – Definir roles y principios de mínimo privilegio

- **Roles sugeridos**:
  - `user`: usuario estándar autenticado.
  - `moderator`: puede realizar acciones de moderación acotadas (ocultar contenido, marcar notas, etc.) pero **no** leer dumps de datos sensibles.
  - `admin`: operaciones administrativas limitadas, sujetas a logs estrictos y sin endpoints expuestos al cliente público.
- **Principios**:
  - El rol **no** se infiere de forma implícita (p. ej. por dominio de correo) en tiempo de petición:
    - Se mapea el correo a un registro interno de usuario donde se guarda el rol explícito.
  - Todo endpoint protegido debe declarar:
    - Rol mínimo requerido.
    - Recursos accesibles bajo ese rol (por ejemplo: solo filas propias o subconjuntos agregados).

### Paso 2.2 – Fuente de verdad de roles y claims

- **Acción**:
  - Crear/usar una tabla `users` o equivalente en D1 que contenga:
    - `id` interno.
    - `email` (único).
    - `role` (`user` | `moderator` | `admin`).
  - El middleware de autenticación:
    - Valida el token de Google / bypass.
    - Recupera el usuario interno por `email` o `sub`.
    - Inyecta en el contexto de la petición:
      - `userId`, `role` y otros flags (ej. `isPremium`).
- **Resultado**:
  - Las decisiones de autorización **no dependen** directamente del JWT externo, sino del estado interno controlado (RBAC).

---

## Fase 3 – Políticas de acceso en la capa de API (bloqueo de lecturas/escrituras globales)

### Paso 3.1 – Prohibir endpoints de lectura masiva para roles estándar

- **Acción**:
  - Revisar todas las rutas `GET /api/...` para detectar:
    - Endpoints que devuelven listas de usuarios, listas de perfiles, dumps de tablas completas o grandes volúmenes sin filtro.
  - Políticas:
    - Para **rol `user`**:
      - Solo puede leer:
        - Su propio perfil.
        - Datos públicos destinados a ser visibles (propuestas, conteos agregados, rankings).
      - No puede llamar endpoints que devuelven:
        - Listas masivas de usuarios.
        - Dumps de tickets de pago, logs o tablas administrativas.
    - Para **rol `moderator`**:
      - Acceso limitado a datos necesarios para moderación, nunca a datos financieros o de identidad completa.
    - Para **rol `admin`**:
      - Endpoints administrativos deben:
        - Estar fuera del frontend público (por ejemplo, panel interno o protegidos con mecanismos adicionales como IP allowlist, 2FA).
        - Tener paginación fuerte y filtros obligatorios (nada de “dump total”).

### Paso 3.2 – Imponer filtros obligatorios por usuario en operaciones sensibles

- **Acción**:
  - Para tablas vinculadas a usuario (perfil, logros, tickets, etc.):
    - Toda consulta de lectura debe incluir condición `WHERE user_id = :userId` para rol `user`.
  - Para escritura:
    - Validar que el `user_id` de la operación coincide con el `userId` del contexto autenticado (evitar “cambiar el owner” arbitrariamente).
- **Resultado**:
  - Aunque un atacante pueda automatizar llamadas a la API con su propio token, solo verá **sus propias filas** o datos públicos agregados.

### Paso 3.3 – Limitar paginación y tamaño de respuesta

- **Acción**:
  - Establecer límites duros de:
    - `limit` máximo (ej. 50–100 registros por página).
    - Tiempos de retención de históricos expuestos al cliente.
  - Rechazar peticiones que:
    - No incluyan parámetros de paginación.
    - Intenten usar `limit` por encima del máximo.
- **Efecto defensivo**:
  - Incluso en endpoints públicos (propuestas, rankings) se vuelve **muy costoso** realizar scraping exhaustivo a gran escala.

---

## Fase 4 – Endurecimiento en la capa de base de datos (consultas acotadas)

### Paso 4.1 – Eliminar cualquier `SELECT *` sin filtro contextual

- **Acción**:
  - Auditar el código del repositorio de datos (D1) en busca de:
    - `SELECT * FROM ...` sin `WHERE` o sin paginación.
  - Sustituir por:
    - Proyecciones explícitas de columnas necesarias.
    - `WHERE` por `id`, `user_id`, filtros de categoría, etc.
    - Cláusulas `LIMIT` obligatorias.

### Paso 4.2 – Separar vistas públicas y privadas

- **Acción**:
  - Para información que se expone públicamente (ej. propuestas, votos agregados):
    - Crear consultas/vistas específicas que:
      - No incluyan campos sensibles (correos, metadatos internos).
      - Apliquen agregaciones en el lado del servidor (sumas, conteos, netScore).
  - Nunca exponer tablas “crudas” directamente al cliente.

---

## Fase 5 – Reglas para operaciones administrativas y de moderación

### Paso 5.1 – Panel administrativo aislado

- **Acción**:
  - Asegurar que cualquier endpoint tipo:
    - “listar todos los usuarios”,
    - “listar todos los tickets de pago”,
    - “exportar reportes completos”
  - Sea accesible **solo** desde:
    - Un panel administrativo separado, con autenticación reforzada (por ejemplo, allowlist de correos específicos y 2FA externo).
    - O herramientas internas (p. ej. scripts ejecutados con credenciales de servicio, no vía frontend público).

### Paso 5.2 – Moderación con vistas reducidas

- **Acción**:
  - Para `moderator`:
    - Exponer solo los campos estrictamente necesarios (texto de propuesta, alias público, timestamps).
    - Ocultar sistemáticamente:
      - Correos.
      - Datos de pago.
      - Cualquier identificador interno que facilite correlación masiva.

---

## Fase 6 – Monitoreo, logging y detección de scraping

### Paso 6.1 – Logging de accesos de alto riesgo

- **Acción**:
  - Registrar en logs (en KV, D1 o sistema de logging externo):
    - Todas las peticiones a endpoints administrativos.
    - Patrones anómalos de uso:
      - Muchas páginas de resultados pedidas secuencialmente por el mismo usuario/IP.
      - Accesos repetidos a recursos que no corresponden al usuario autenticado.

### Paso 6.2 – Integración con rate limiting

- **Acción**:
  - Reutilizar o extender el sistema de **rate limit** existente:
    - Asociar límites estrictos a:
      - Endpoints de lectura intensiva (listados, reportes).
    - Bloquear o degradar (respuestas 429) cuando se detecten patrones de enumeración/scraping.

---

## Fase 7 – Pruebas de seguridad y validación

### Paso 7.1 – Pruebas manuales de acceso por rol

- **Escenarios**:
  - Usuario con rol `user`:
    - Intenta acceder a endpoints administrativos → debe recibir 403.
    - Intenta forzar IDs de otros usuarios (cambiando parámetros) → la API debe devolver 403/404 sin filtrar datos.
  - Usuario con rol `moderator`:
    - Verifica que puede moderar contenido, pero **no** ver listas completas de usuarios ni datos financieros.

### Paso 7.2 – Pruebas automatizadas

- **Acción**:
  - Incorporar tests (unitarios/E2E) que verifiquen:
    - Que para rol `user` ninguna ruta devuelve más datos de los esperados.
    - Que endpoints críticos requieren rol `admin` y fallan para otros roles.
    - Que todas las llamadas a repositorios de datos usan filtros y límites adecuados.

---

## Fase 8 – Gobernanza y revisiones de seguridad continuas

### Paso 8.1 – Política de cambios sobre la base de datos

- **Acción**:
  - Definir una regla interna:
    - Cualquier nueva tabla o endpoint que exponga datos sensibles debe acompañarse de:
      - Análisis de sensibilidad.
      - Diseño de reglas RBAC específicas.
      - Revisión de seguridad.

### Paso 8.2 – Auditoría periódica

- **Acción**:
  - Programar revisiones trimestrales de:
    - Esquema de D1 (nuevas tablas/campos).
    - Rutas API y sus controles de acceso.
  - Reforzar o adaptar el modelo de roles según crezcan las capacidades de la plataforma.

---

## Conclusión

Este plan B2 traslada el espíritu de “reglas jerárquicas en Firestore + RBAC sobre claims de Google” al stack real de Venezuela LIVE (D1 + Hono), implementando controles de acceso en capas: rol explícito, filtros estrictos por usuario y contexto, límites de paginación y separación entre vistas públicas y datos sensibles. Con ello se mitiga de forma contundente la asignación masiva de permisos y se vuelve altamente costoso extraer fugas completas de la base de datos, incluso ante intentos de scraping automatizado o abuso de credenciales comprometidas.

