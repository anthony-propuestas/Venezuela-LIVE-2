 C1 – Transición Definitiva hacia una PWA Offline‑First  
 (Security‑First, Zero‑Trust y Offline‑First)
 
 ---
 
 ## 1. Objetivo del control C1
 
 - **Objetivo principal**: Convertir la interfaz de "Venezuela Live" en una PWA robusta y verdaderamente offline‑first, que:
   - Siga respondiendo al tacto aun con cortes prolongados de red/energía.
   - Permita leer noticias y perfiles ya consultados sin conexión.
   - Permita redactar denuncias/comentarios y ponerlos en cola localmente para sincronizarlos en segundo plano cuando vuelva la conectividad.
 - **Principios rectores**:
   - **Security‑First**: cada nueva capacidad offline viene acompañada de controles de seguridad explícitos.
   - **Zero‑Trust**: no se confía ni en el cliente ni en la red; todo se valida al entrar y al salir.
   - **Offline‑First**: la app se diseña asumiendo que la red siempre es inestable o inexistente.
 
 ---
 
 ## 2. Supuestos técnicos y alcance
 
 - **Frontend**:
   - SPA construida con React/Next.js o similar (ajustar nombres de carpetas según el proyecto real).
   - Empaquetador moderno (Vite, Webpack o equivalente).
 - **Backend y datos**:
   - Autenticación y datos gestionados con **Firebase Auth** y **Firestore/Storage**.
   - Hosting preferente sobre HTTPS (Cloudflare Pages / Firebase Hosting + Cloudflare delante).
 - **Alcance de este plan**:
   - Implementación de manifest PWA, service worker y caching.
   - Diseño de la cola offline basada en IndexedDB.
   - Estrategia de sincronización segura hacia Firebase.
   - Endurecimiento de seguridad específico para el plano offline/PWA.
 
 ---
 
 ## 3. Estrategia de implementación por fases (para desarrollo y pruebas)
 
 Para reducir riesgo y complejidad, la PWA se implementará **en oleadas pequeñas**, con puntos de prueba claros al final de cada fase:
 
 - **Fase MVP 1 – PWA mínima segura (solo App Shell)**
   - Basada en las secciones **4 y 5** de este documento.
   - Entregable: la app abre y navega su shell básico aun sin conexión, sin cachear datos de usuario.
   - Prueba clave: recargar la app en modo offline desde DevTools y verificar que UI básica responde.
 
 - **Fase MVP 2 – Lectura offline de contenido público**
   - Basada en la sección **6**.
   - Entregable: últimas noticias/perfiles públicos consultados se pueden leer sin conexión.
   - Prueba clave: abrir varias noticias/perfiles online, cortar red y comprobar lectura fluida desde caché.
 
 - **Fase MVP 3 – Escritura offline con cola local**
   - Basada en las secciones **7 y 8**.
   - Entregable: se pueden redactar denuncias/comentarios sin red; quedan en cola y se sincronizan al volver la conectividad.
   - Prueba clave: crear varias denuncias en modo offline, reconectar y comprobar que aparecen en el backend/API.
 
 - **Fase MVP 4 – UX offline avanzada, monitoreo y endurecimiento continuo**
   - Basada en las secciones **9, 10 y 11** (checklist).
   - Entregable: experiencia de usuario transparente (indicadores offline, fallbacks claros) y monitoreo básico en producción.
   - Prueba clave: sesiones reales de uso en condiciones de red degradada + revisión de métricas y logs.
 
 Cada fase debe considerarse **deployable por sí misma**: no se pasa a la siguiente hasta que las pruebas definidas se hayan completado con éxito y documentado.
 
 ---
 
 ## 4. Fase 0 (previa) – Endurecimiento mínimo para poder activar el Service Worker
 
 Antes de registrar el Service Worker en producción:
 
 1. **Asegurar canal HTTPS extremo a extremo**
    - Habilitar HTTPS obligatorio en el dominio principal y subdominios.
    - Configurar redirección 301 de HTTP → HTTPS en Cloudflare / hosting.
 
 2. **Revisión de XSS / inyecciones (dependencia con Fase 1 del plan global)**
    - Confirmar que todos los puntos de entrada de usuario han pasado por sanitización (p.ej. `DOMPurify`).
    - Prohibir `dangerouslySetInnerHTML` y equivalentes salvo excepciones muy justificadas y auditadas.
    - Motivo: un XSS explotable combinado con un service worker permite ataques persistentes y cache poisoning.
 
 3. **Encabezados de seguridad básicos**
    - Definir **CSP estricta** (Content-Security-Policy) que:
      - Limite scripts a orígenes de confianza (dominio propio + Firebase/CDN necesarios).
      - Prohíba `unsafe-inline` donde sea realista.
    - Activar `X-Frame-Options: DENY` o `SAMEORIGIN`.
    - Activar `Referrer-Policy` y `Strict-Transport-Security (HSTS)`.
 
 ---
 
 ## 5. Fase 1 – PWA básica: Manifest + Registro seguro del Service Worker
 
 1. **Crear/validar `manifest.webmanifest`**
    - Definir:
      - `name`, `short_name`, `start_url` (idealmente `/` con `?source=pwa` para métricas).
      - `display: standalone`, `orientation: portrait`, `background_color`, `theme_color`.
      - Íconos en varias resoluciones, alojados en el mismo dominio y declarados en el manifest.
    - Asegurar que el manifest se sirva con `Content-Type: application/manifest+json`.
    - En el HTML principal, enlazar el manifest correctamente.
 
 2. **Registrar el Service Worker con alcance mínimo**
    - Crear archivo dedicado, por ejemplo `src/pwa/registerServiceWorker.ts`, que:
      - Registre el SW sólo en entornos `production`.
      - Limite el `scope` al mínimo necesario (p.ej. `/` o `/app/` según estructura).
    - Implementar lógica de **actualización controlada**:
      - Detectar nuevas versiones del SW y mostrar al usuario un aviso “Nueva versión disponible” para recargar de forma segura.
 
 3. **Política de Zero‑Trust en el registro**
    - Nunca cargar el SW desde dominios de terceros.
    - Mantener el archivo del SW pequeño y modular (idealmente < 1000 líneas) y versionado.
    - Revisar el código del SW igual que el del backend (code review obligatorio).
 
 ---
 
 ## 6. Fase 2 – Arquitectura de caché Offline‑First (Application Shell)
 
 1. **Definir la App Shell**
    - Identificar recursos estáticos que forman el “caparazón”:
      - HTML base / plantilla de la SPA.
      - CSS global, fuentes, íconos, imágenes de layout.
      - Bundles JS críticos para renderizar navegación y vistas principales.
 
 2. **Pre‑cache en evento `install`**
    - En el SW:
      - Crear una caché estática versionada, p.ej. `static-v1`.
      - Durante el evento `install`, `cache.addAll()` con la lista de recursos del App Shell.
    - Estrategia de fetch para el App Shell:
      - **`cache-first` con `stale-while-revalidate`**:
        - Responder de caché inmediatamente.
        - En paralelo, intentar actualización desde red y, si tiene éxito, actualizar la caché silenciosamente.
 
 3. **Limpieza de versiones antiguas en `activate`**
    - En el evento `activate`:
      - Iterar sobre las claves de caché existentes.
      - Eliminar todas salvo la versión actual (`static-vX`, `dynamic-vY`).
 
 4. **Control de seguridad sobre el App Shell**
    - Solo cachear recursos estáticos firmados por el propio despliegue (no HTML dinámico generado por terceros).
    - Verificar que ninguna ruta de administración interna quede expuesta sin autenticación al ser cacheada.
 
 5. **Punto de salida de la Fase MVP 1 (pruebas)**
   - Verificar en navegador de escritorio y móvil:
     - Que la app carga y muestra navegación básica en modo offline completo (DevTools → Offline).
     - Que no se cachea ningún endpoint de API sensible.
     - Que, si se rompe el SW, el fallback sigue siendo una carga segura (posible limpieza de SW y recarga).
 
 ---
 
 ## 7. Fase 3 – Caché de contenido dinámico (noticias, perfiles) con límites de confianza
 
 1. **Clasificar tipos de contenido**
    - **Contenido público no sensible**: noticias públicas, perfiles públicos limitados.
    - **Contenido sensible**: información privada de usuarios, mensajes directos, datos de alto riesgo.
 
 2. **Estrategias de caché por tipo**
    - Para **contenido público**:
      - Estrategia `stale-while-revalidate` o `cache-first` con expiración (p.ej. 24–48 h).
      - Mantener una caché dinámica `content-vX` limitada en tamaño (p.ej. máximo N entradas) con política LRU.
    - Para **contenido sensible**:
      - Evitar cachear en el SW salvo que sea estrictamente necesario y justificado.
      - Preferir almacenamiento **en memoria** o cifrado en IndexedDB con TTL muy corto.
 
 3. **Prevención de cache poisoning**
    - Validar que las respuestas que se cachean:
      - Provienen de dominios esperados (Firebase, dominio propio).
      - Tienen formato esperado (JSON con esquema validado).
    - Si la respuesta no supera validaciones, no se cachea.
 
 4. **Zero‑Trust en la lectura**
    - Tratar toda lectura de caché como entrada no confiable:
      - Validar formatos antes de hidratar componentes (tipado estricto, comprobaciones adicionales).
      - Manejar errores de parseo sin romper la UI (fallbacks seguros).
 
 5. **Punto de salida de la Fase MVP 2 (pruebas)**
   - Seleccionar un subconjunto de vistas (ej. feed general y perfiles públicos) y comprobar que:
     - Tras visitarlas online, se pueden volver a abrir en modo offline sin errores.
     - El tamaño de la caché dinámica se mantiene dentro de límites previstos.
     - No se filtra información privada en los datos cacheados.
 
 ---
 
 ## 8. Fase 4 – IndexedDB y cola offline de denuncias/comentarios
 
 1. **Diseñar el modelo de datos local**
    - Crear una base IndexedDB dedicada, por ejemplo `venezuela_live_offline`.
    - Definir al menos dos `objectStore`:
      - `queuedActions`: cola de operaciones pendientes de sincronizar.
      - `cachedEntities`: snapshot de entidades críticas (noticias, perfiles) cuando sea necesario.
    - Cada `queuedAction` debe incluir:
      - `id` local (UUID).
      - `type` (ej. `create_denuncia`, `create_comentario`).
      - `payload` estrictamente definido y validado.
      - `createdAt`, `retryCount`, `lastError` (opcional).
 
 2. **Validación y minimización de datos**
    - **Security‑First**:
      - Validar el `payload` antes de escribirlo en IndexedDB usando esquemas (Zod, Yup o lógica propia).
      - Guardar **solo** los campos imprescindibles; no almacenar tokens, ni datos de sesión, ni información ultra sensible sin justificación.
    - **Zero‑Trust**:
      - Asumir que un atacante con acceso físico al dispositivo puede abrir IndexedDB → no almacenar secretos.
 
 3. **(Opcional) Cifrado de datos en reposo**
    - Usar WebCrypto para cifrar campos sensibles en IndexedDB con una clave derivada de credenciales del usuario o un secreto efímero.
    - Documentar claramente las limitaciones: el cifrado en cliente eleva el coste del atacante pero no sustituye controles de servidor.
 
 4. **API interna para interactuar con la cola**
    - Implementar un módulo de alto nivel, p.ej. `offlineQueue.ts`, que exponga:
      - `enqueueAction(type, payload)` → valida y guarda.
      - `getPendingActions()` → lista segura de acciones.
      - `markAsSynced(id)` / `markAsFailed(id, error)`.
    - No exponer directamente la API IndexedDB al resto de la app; siempre pasar por este módulo.
 
 5. **Punto de salida de la primera parte de la Fase MVP 3 (pruebas locales)**
   - En entorno de desarrollo:
     - Forzar modo offline y crear múltiples denuncias/comentarios.
     - Verificar que todas las acciones quedan correctamente almacenadas en IndexedDB.
     - Inspeccionar manualmente IndexedDB para confirmar que no hay tokens ni datos ultra sensibles.
 
 ---
 
 ## 9. Fase 5 – Sincronización en segundo plano (Background Sync / reintentos)
 
 1. **Detección de cambios de conectividad**
    - En el cliente:
      - Escuchar `navigator.onLine` y eventos `online`/`offline` para actualizar el estado de UI (banner, icono).
      - Evitar bloqueos: permitir que el usuario interactúe aun cuando `navigator.onLine === false`.
 
 2. **Sincronización con Background Sync (cuando disponible)**
    - En el SW:
      - Registrar una `sync` event tag, por ejemplo `sync-denuncias`.
      - Cada vez que se agregue una acción a la cola, solicitar un registro de sync si hay soporte.
      - En el manejador `sync`, procesar la cola:
        - Leer acciones pendientes de IndexedDB.
        - Para cada acción:
          - Reconstruir la petición hacia Firebase con credenciales actuales.
          - Validar nuevamente el `payload` antes de enviarlo.
          - En caso de éxito, marcar como sincronizada y eliminar de la cola.
          - En caso de error transitorio, incrementar `retryCount` y aplicar backoff exponencial.
 
 3. **Sincronización manual / fallback (cuando no hay Background Sync)**
    - Implementar en la app una rutina que:
      - Se dispare al abrir la app, al cambiar de pestaña clave o al detectarse que se ha vuelto `online`.
      - Llame a la API de la cola para intentar sincronizar.
 
 4. **Zero‑Trust en el servidor**
    - En el backend/Firebase:
      - Validar todas las acciones como si llegaran por primera vez, sin confiar en que el cliente ya las sanitizó.
      - Usar **reglas de Firestore** y **Cloud Functions** para chequear:
        - Autenticación válida en cada petición.
        - Autorización basada en claims (RBAC).
        - Integridad de datos (longitudes, tipos, rangos).
 
 5. **Punto de salida completo de la Fase MVP 3 (pruebas integradas)**
   - En entorno de staging / preproducción:
     - Validar que las acciones encoladas offline se reenvían correctamente al backend tanto con Background Sync como con el fallback manual.
     - Simular errores de red y respuestas de error del servidor para comprobar reintentos y manejo de fallos.
 
 ---
 
 ## 10. Fase 6 – Experiencia de usuario offline y transparencia
 
 1. **Estados claros de red en la UI**
    - Mostrar indicadores discretos:
      - Estado `offline` (ej. banner pequeño o icono).
      - Estado `acciones en cola` (puntos o contador).
    - No bloquear la escritura de denuncias por estar offline; mostrar texto como “Se enviará automáticamente cuando vuelva la conexión”.
 
 2. **Fallas controladas en lugar de pantallas en blanco**
    - Definir pantallas de fallback:
      - Para vistas sin datos cacheados: mensaje “Sin conexión y sin datos previos disponibles”.
      - Para imágenes o recursos que no pudieron cargarse: placeholders neutrales.
 
 3. **Modo de bajo ancho de banda (opcional)**
    - Ofrecer un modo que:
      - Reduzca imágenes pesadas.
      - Desactive auto‑reproducciones de medios.
      - Limite la actualización automática de feeds en segundo plano.
 
 4. **Punto de salida de la Fase MVP 4 (primera iteración UX)**
   - Con usuarios de prueba:
     - Confirmar que entienden cuándo están offline y qué acciones están pendientes.
     - Asegurar que los mensajes no exponen detalles técnicos ni aumentan la ansiedad del usuario en contextos de protesta.
 
 ---
 
 ## 11. Fase 7 – Auditoría, pruebas y monitoreo continuo
 
 1. **Pruebas funcionales offline**
    - Usar las DevTools del navegador:
      - Simular offline total e intermitente.
      - Verificar que:
        - La app carga desde caché.
        - Las noticias/perfiles vistos antes son legibles.
        - Las denuncias/comentarios se guardan en IndexedDB y se sincronizan al volver la red.
 
 2. **Pruebas de seguridad específicas del Service Worker**
    - Revisar:
      - Que el SW no cachee endpoints de administración o recursos ultra sensibles.
      - Que no existan rutas que permitan inyectar scripts en respuestas cacheadas.
      - Que la política CSP sea compatible con la PWA pero siga siendo estricta.
 
 3. **Monitoreo y logging**
    - Registrar métricas (sin violar la privacidad de usuarios vulnerables):
      - Número de sincronizaciones offline completadas.
      - Tasa de errores de sincronización.
      - Tamaños de caché y de IndexedDB para vigilar crecimiento.
 
 4. **Revisión periódica (Zero‑Trust en el tiempo)**
    - Programar revisiones trimestrales del código del SW, reglas de Firestore y lógica de cola offline.
    - Rotar secretos, actualizar dependencias y endurecer políticas de caché según nuevas amenazas identificadas.
 
 ---
 
 ## 12. Checklist resumido para el equipo (C1)
 
 - [ ] HTTPS estricto, CSP, XSS mitigado y headers de seguridad en producción.
 - [ ] `manifest.webmanifest` creado, validado y referenciado correctamente.
 - [ ] Service Worker registrado solo en producción, con alcance mínimo y actualización controlada.
 - [ ] App Shell identificado y pre‑cacheado en `install`, con limpieza de versiones en `activate`.
 - [ ] Estrategias de caché diferenciadas para contenido público vs sensible, con límites de tamaño/tiempo.
 - [ ] IndexedDB diseñada con `queuedActions` y `cachedEntities`, sin almacenar secretos.
 - [ ] Módulo de cola offline (`offlineQueue`) implementado con validación estricta de payloads.
 - [ ] Sincronización en segundo plano implementada (Background Sync y fallback manual).
 - [ ] UI adaptada al modo offline: estados claros, fallbacks, mensajes de transparencia al usuario.
 - [ ] Batería de pruebas offline + auditoría de seguridad del Service Worker ejecutadas y documentadas.
 
