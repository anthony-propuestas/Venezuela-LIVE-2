## Plan B3 – Remover y destruir instantáneamente todo rastro de metadatos EXIF

### Objetivo

- **Objetivo principal**: Garantizar que **toda imagen** que se almacena y sirve a través de la plataforma (especialmente fotos de perfil y futuras imágenes de contenido) esté **libre de metadatos EXIF y otros metadatos embebidos** que puedan filtrar:
  - Coordenadas geográficas (GPS).
  - Fechas y horas exactas de captura.
  - Identificadores de dispositivo (modelo de teléfono, número de serie, etc.).
- **Resultado esperado**:
  - Ningún archivo de imagen accesible desde la red social contiene metadatos EXIF recuperables.
  - Incluso si un atacante descarga la imagen original desde la plataforma y la inspecciona con herramientas forenses, **no obtiene información sensible de EXIF**.

### Alcance y supuestos

- **Alcance**:
  - Flujo de subida y almacenamiento de imágenes de la plataforma:
    - Endpoints de API que aceptan imágenes (actualmente, fotos de perfil: `/api/profile/photo`).
    - Almacenamiento en **R2** (binding `R2_BUCKET`) de Cloudflare, donde se guardan fotos de perfil y PDFs de reportes.
  - Flujo de lectura/serving de imágenes desde la API.
- **Supuestos técnicos concretos para Venezuela LIVE**:
  - El backend es una aplicación **Hono** desplegada en **Cloudflare Pages Functions**.
  - Los binarios nativos como ImageMagick/sharp **no son utilizables directamente** en el entorno de Workers; hay que usar:
    - Librerías **compatibles con Workers** (JS/WASM) para saneamiento/recodificación de imágenes.
  - Todas las imágenes de usuario se terminan almacenando en **R2** y se sirven a través de la API (no hay acceso público directo sin pasar por el backend).
- **Traducción del plan original (Cloud Functions + Storage) al stack actual**:
  - Donde el plan habla de “disparadores `onFinalize` sobre Storage”, en nuestro stack se implementa el control así:
    - **Saneamiento en línea en la API de subida** (antes de escribir en R2).
    - **Job de migración** para imágenes ya existentes en R2.

---

### Implementación actual en Venezuela LIVE

En Venezuela LIVE el control B3 está implementado combinando saneamiento **inline** en la subida de fotos de perfil y un job de migración sobre R2:

- **Módulo de saneamiento de imágenes (`mediaSanitizer`)**:
  - Archivo: `src/server/domain/media/sanitizer.ts`.
  - Exporta `sanitizeImage(input: Uint8Array, mimeType: string)` que:
    - Valida que el tipo MIME esté en la lista soportada (`image/jpeg`, `image/jpg`, `image/png`, `image/webp`).
    - Usa `@mary/exif-rm` (`removeExif`) para eliminar metadatos EXIF y relacionados del binario.
    - Devuelve `{ buffer: cleaned, mimeType }` con el mismo tipo MIME o lanza un `InternalError` si algo falla.
- **Saneamiento inline en `POST /api/profile/photo`**:
  - En `src/server/index.ts`, el endpoint de subida de foto de perfil:
    - Valida tamaño máximo (2 MB) y tipos permitidos (JPG, PNG, WebP).
    - Deriva la ruta de almacenamiento en R2: `profiles/${userId}/photo.<ext>`.
    - Convierte el `File` recibido a `Uint8Array` (`originalBytes`).
    - Llama a `sanitizeImage(originalBytes, mt)` para obtener un buffer libre de EXIF.
    - Solo este buffer saneado (`cleanBuffer`) se persiste en R2, junto con el `contentType` correcto.
- **Job de migración de fotos históricas en R2**:
  - Ruta interna: `ALL /api/cron/profile-photos-sanitize`.
  - Comportamiento:
    - Lista objetos en R2 con el prefijo `profiles/` (fotos de perfil), procesando lotes de hasta 25 elementos usando `cursor` para paginación.
    - Para cada objeto:
      - Descarga el cuerpo, lo convierte en `Uint8Array`.
      - Llama a `sanitizeImage` con el `contentType` almacenado.
      - Vuelve a escribir la clave en R2 con el buffer saneado y los metadatos HTTP actualizados.
    - Devuelve un JSON con:
      - `processed` (número de objetos saneados en ese lote),
      - `truncated` (si hay más objetos por procesar),
      - `cursor` (para continuar en la siguiente invocación).
  - Seguridad:
    - Protegido por el mismo header `X-Cron-Secret` que el cron de reportes; en producción solo debe ser invocado por un job controlado.
- **Servir la foto de perfil**:
  - La ruta `GET /api/profile/photo`:
    - Obtiene la clave asociada al usuario desde D1 (`getPhotoKeyByUserId`).
    - Lee el objeto en R2 y lo devuelve tal cual, con headers de cache y `Content-Type`.
    - Dado que todas las escrituras nuevas y las migradas pasan por `sanitizeImage`, las fotos que salen por esta ruta están libres de EXIF.
- **Efecto resultante**:
  - Las fotos de perfil nuevas nunca se almacenan con EXIF gracias al saneamiento inline.
  - Un job de migración puede limpiar las fotos ya existentes en R2 por lotes, hasta cubrir todo el histórico.
  - Los usuarios pueden subir imágenes sin preocuparse por filtraciones accidentales de ubicación, fecha precisa o modelo de dispositivo a través de metadatos.

---

## Anexo histórico – Fase 1: Mapeo del flujo de imágenes y puntos de control

### Paso 1.1 – Inventario de puntos donde se suben y sirven imágenes

- **Acción**:
  - Revisar `src/server/index.ts` y rutas relacionadas para identificar:
    - Endpoints de subida de imágenes de usuario (hoy: `POST /api/profile/photo`).
    - Endpoints de lectura de imágenes (ej.: `GET /api/profile/photo`).
  - Verificar en `src/server/repositories/r2.repository.ts`:
    - Qué claves y rutas de R2 se usan (`put`, `get`, `delete`) para fotos de perfil y otros binarios.
- **Salida**:
  - Tabla `Endpoint → Tipo (subida/lectura) → Recurso R2 → Tipo de archivo (imagen/PDF/otro)`.

### Paso 1.2 – Delimitar qué tipos de archivos requieren saneamiento EXIF

- **Acción**:
  - Definir qué tipos MIME serán sometidos a saneamiento:
    - `image/jpeg`, `image/jpg`, `image/png`, opcionalmente `image/webp` y otros formatos que puedan contener metadatos.
  - Excluir de saneamiento:
    - PDFs de reportes u otros documentos donde la eliminación de metadatos siga políticas específicas distintas (se documentan aparte).
- **Resultado**:
  - Lista concreta de tipos MIME que **deben pasar por el pipeline de saneamiento EXIF** antes de persistir en R2.

---

## Fase 2 – Diseño de la arquitectura de saneamiento de metadatos

### Paso 2.1 – Patrón principal: saneamiento “inline” en la API de subida

- **Idea central**:
  - Toda subida de imagen pasa por un **pipeline `sanitizeImage(buffer)`** en el backend antes de llamar a R2:
    - La API recibe el archivo (multipart/form-data o binario).
    - Se lee el contenido como `ArrayBuffer`/`Uint8Array`.
    - Se invoca una librería JS/WASM compatible con Workers para:
      - Re-decodificar la imagen.
      - Re-encodearla **sin incluir metadatos**.
    - Solo la versión saneada se envía a `R2_BUCKET.put(...)`.

### Paso 2.2 – Plan complementario: migración de imágenes ya almacenadas

- **Motivación**:
  - Es probable que existan ya fotos de perfil en R2 con EXIF sin filtrar.
- **Acción**:
  - Diseñar un **script/Worker de migración** que:
    - Itere sobre todos los objetos R2 que sean imágenes.
    - Descargue el binario.
    - Lo pase por el mismo pipeline `sanitizeImage`.
    - Sobrescriba el objeto existente con la versión limpia.
  - Este proceso se ejecuta una vez (o periódicamente al inicio) en un entorno controlado.

---

## Fase 3 – Selección de librería y estrategia de saneamiento compatible con Cloudflare Workers

### Paso 3.1 – Requisitos para la librería de saneamiento

- **Requisitos técnicos**:
  - Funciona en entorno **Cloudflare Workers**:
    - Sin dependencias a binarios nativos (nada de `.node`, nada que requiera sistema de archivos).
    - Distribuida como JS puro o WASM.
  - API basada en `ArrayBuffer`/`Uint8Array` o `Blob`.
  - Permite:
    - Eliminar secciones EXIF/XMP/IPTC.
    - O recodificar la imagen desde un “canvas”/buffer limpio.
- **Política de seguridad**:
  - Ante cualquier error en el proceso de saneamiento:
    - **Se rechaza la subida** con error claro al cliente.
    - Nunca se almacena una imagen sin procesar.

### Paso 3.2 – Estrategias posibles

- **Estrategia A – Recodificación total**:
  - Decodificar la imagen en un buffer de píxeles y volver a codificarla:
    - Ventaja: garantiza la eliminación de todo metadato (se genera un archivo nuevo a partir de píxeles).
    - Inconveniente: mayor coste de CPU y posible pérdida mínima de calidad (controlable con parámetros).
- **Estrategia B – Stripping de segmentos EXIF sin recodificar**:
  - Leer el archivo binario y eliminar los segmentos EXIF/JFIF/XMP.
  - Recomendado solo si la librería usada es madura y probada.
- **Decisión**:
  - Priorizar **seguridad y certeza sobre rendimiento**:
    - Preferible recodificar por completo a garantizar 0 metadatos, especialmente para JPEG de fotos de perfil.

---

## Fase 4 – Implementación en la API de subida de fotos

### Paso 4.1 – Introducir una capa `mediaSanitizer` en el backend

- **Acción**:
  - Crear un módulo en `src/server/domain/media/` (o similar) con, al menos:
    - `sanitizeImage(buffer: Uint8Array, mimeType: string): Promise<{ buffer: Uint8Array; mimeType: string }>`
  - Responsabilidades:
    - Validar tipo MIME (solo imágenes permitidas).
    - Aplicar el pipeline de saneamiento seleccionado.
    - Devolver el buffer saneado listo para almacenar en R2.

### Paso 4.2 – Integración en el endpoint `POST /api/profile/photo`

- **Acción**:
  - En el controlador de `/api/profile/photo`:
    - Extraer el archivo del body (según implementación actual).
    - Rechazar archivos que no sean imágenes soportadas (control de tipo y tamaño).
    - Invocar `sanitizeImage` antes de llamar a R2:
      - `const { buffer: cleanBuffer, mimeType: finalMime } = await sanitizeImage(originalBuffer, originalMime);`
    - Guardar **solo** `cleanBuffer` en R2 a través del repositorio (`r2.repository.ts`).
  - **Regla estricta**:
    - No debe existir ningún camino de código que llame a `R2_BUCKET.put` con el buffer original sin pasar por `sanitizeImage`.

### Paso 4.3 – Compatibilidad con lectura y serving de imágenes

- **Acción**:
  - Verificar que `GET /api/profile/photo` simplemente:
    - Lee desde R2 la versión ya saneada.
    - Devuelve los headers MIME correctos.
  - No se requieren cambios de lógica de lectura, salvo:
    - Asegurar que no se agregan encabezados o información que pueda reintroducir metadatos sensibles (esto normalmente no ocurre, pero se documenta).

---

## Fase 5 – Migración de imágenes existentes en R2

### Paso 5.1 – Diseño del job de migración

- **Acción**:
  - Implementar un script o Worker dedicado (por ejemplo, bajo `scripts/` o una función temporal) que:
    - Liste objetos en R2 asociados a fotos de perfil (por prefijo de clave).
    - Para cada objeto:
      - Descargue el contenido binario.
      - Pase el binario por `sanitizeImage`.
      - Sobre-escriba el objeto en R2 con la versión limpia.
  - Incluir mecanismos de:
    - Reintentos en caso de fallo.
    - Registro de progreso (cuántas fotos procesadas, fallidas, pendientes).

### Paso 5.2 – Estrategia de ejecución segura

- **Acción**:
  - Ejecutar el job en un entorno controlado:
    - Por lotes (ej. N objetos por ejecución) para evitar límites de tiempo de Workers.
    - Con protección adicional (clave secreta o trigger manual) para que no sea invocable por el público.
  - Mantener logs suficientes para auditar:
    - Que todas las imágenes objetivo fueron procesadas al menos una vez.

---

## Fase 6 – Endurecimiento adicional y controles defensivos

### Paso 6.1 – Validaciones de entrada y límites de tamaño

- **Acción**:
  - Establecer límites máximos de tamaño de imagen (ej. 5MB o lo que se considere razonable) en la API de subida.
  - Rechazar:
    - Archivos que excedan el límite.
    - Archivos con tipo MIME no permitido.
  - Esto reduce superficie de ataque y coste de CPU durante el saneamiento.

### Paso 6.2 – Política de logs y privacidad

- **Acción**:
  - Asegurar que:
    - No se registran en logs fragmentos de binarios de imagen.
    - Cualquier log relacionado con el proceso de saneamiento se limita a:
      - Identificador interno del usuario.
      - Clave del objeto en R2.
      - Estado (éxito/fallo).
  - Cualquier error en librerías de imagen se registra solo a nivel de mensaje, sin incluir datos sensibles.

### Paso 6.3 – Revisión de permisos de R2

- **Acción**:
  - Revisar el binding `R2_BUCKET` en `wrangler.json`:
    - Confirmar que solo el Worker de la aplicación tiene permisos de lectura/escritura.
    - Evitar accesos públicos directos al bucket que permitan leer versiones previas a saneamiento (si existieran).

---

## Fase 7 – Pruebas de seguridad específicas de metadatos EXIF

### Paso 7.1 – Pruebas manuales con imágenes de laboratorio

- **Acción**:
  - Preparar un conjunto de imágenes de prueba con EXIF claramente visible:
    - Fotos con datos GPS, modelo de dispositivo, fecha/hora.
  - Flujo de prueba:
    - Subir cada imagen a través de `/api/profile/photo`.
    - Descargar la imagen resultante desde la API.
    - Inspeccionarla con herramientas forenses/EXIF (en entorno local) para verificar:
      - Que todos los campos EXIF se han eliminado o vaciado.
  - Documentar los resultados de cada prueba.

### Paso 7.2 – Pruebas automatizadas

- **Acción**:
  - Añadir tests (unitarios/integración) para `sanitizeImage`:
    - Dado un buffer que contiene EXIF conocido, la salida **no** debe contener esos campos.
    - En caso de error interno, la función debe lanzar/propagar excepción clara (para que la API pueda responder 400/500 sin almacenar la imagen).
  - Opcionalmente, añadir tests E2E que:
    - Simulen el flujo completo de subida y lectura y validen la ausencia de EXIF.

---

## Fase 8 – Gobernanza y reglas futuras para nuevos tipos de contenido

### Paso 8.1 – Política para nuevas rutas de subida de medios

- **Acción**:
  - Definir una regla interna:
    - Cualquier nueva funcionalidad que permita subir imágenes (por ejemplo, fotos en posts, banners, etc.) **debe**:
      - Reutilizar el módulo `mediaSanitizer`.
      - Ser revisada explícitamente en cuanto a saneamiento de EXIF antes de entrar en producción.

### Paso 8.2 – Auditoría periódica de imágenes servidas

- **Acción**:
  - Programar revisiones periódicas (ej. trimestrales) en las que:
    - Se tomen muestras aleatorias de imágenes servidas por la plataforma.
    - Se descarguen y analicen con herramientas EXIF para verificar que continúan libres de metadatos.
  - Cualquier hallazgo de imagen con EXIF residuo debe disparar:
    - Revisión del pipeline de saneamiento.
    - Reevaluación de la cobertura del job de migración y de las nuevas rutas de subida.

---

## Conclusión

Este plan B3 adapta el control de “Funciones de Saneamiento de Metadatos” descrito en el plan global al stack real de Venezuela LIVE (Cloudflare Pages + Hono + R2). Al aplicar saneamiento **inline** en la API de subida, complementar con un job de migración sobre R2 y reforzar validaciones, logs y pruebas específicas, se logra que cualquier imagen que circule por la red social esté desprovista de metadatos EXIF potencialmente peligrosos, protegiendo la ubicación, el contexto temporal y la huella de dispositivos de los usuarios frente a actores hostiles.

