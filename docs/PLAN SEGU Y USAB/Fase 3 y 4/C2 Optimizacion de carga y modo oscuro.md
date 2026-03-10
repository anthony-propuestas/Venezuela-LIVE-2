## C2 — Plan de implementación: Optimización de carga cognitiva y conservación de ancho de banda

**Objetivo general:**  
Reducir al mínimo la sensación de lentitud y el consumo innecesario de batería/datos en conexiones degradadas (3G / HSPA+) mediante:

- **Gestión activa de carga:** sustitución total de spinners por *Skeleton Screens* coherentes con el contenido real, más **lógica de actualización optimista** en las interacciones clave.
- **Accesibilidad lumínica:** implementación de **Modo Oscuro absoluto (#000000)** guiado por `prefers-color-scheme`, protegiendo la batería en pantallas OLED y mejorando el confort visual.

Este plan está pensado para ejecutarse entre los **Días 8–15** del plan global.

---

## 1. Supuestos técnicos y alcance

- **Stack actual:**
  - Frontend en **React 19 + Vite 7** con **Tailwind CSS 4** (`src/client/`).
  - Backend Hono + Cloudflare Pages Functions, pero **C2 afecta principalmente al frontend**.
- **Puntos de interacción relevantes:**
  - Páginas controladas desde `App.jsx` (home, general, perfil, nosotros, premium, donations, menú).
  - Servicios HTTP centralizados en `src/client/services/api.service.js`.
  - Uso de `localStorage` solo para estados de UI no sensibles (votos, etc.), que se puede aprovechar para lógica optimista visual.
- **Alcance de C2:**
  - **No** se cambia el modelo de datos ni la API.
  - Se añaden **capas de presentación y gestión de estado de carga** en el cliente.
  - Se añade **modo oscuro absoluto** sin romper el diseño existente.

---

## 2. Gestión activa de carga — Skeleton Screens + estados de carga

### 2.1. Inventario de flujos con espera percibida (Día 8)

1. **Identificar todas las vistas que hoy muestran spinners o “saltos” bruscos de contenido:**
   - Carga inicial de la página `home` (listado principal de contenidos/propuestas).
   - Carga de la sección `general` (si existe feed diferenciado).
   - Carga del `perfil` (datos de usuario + gamificación + foto).
   - Carga de listados adicionales (ej. notas de comunidad, propuestas premium, etc.).
2. En cada flujo, anotar:
   - **Tipo de contenido esperado** (lista de tarjetas, cabecera de perfil, texto largo, etc.).
   - **Tiempo medio de respuesta** estimado en red normal vs. 3G degradado.
   - **Componente React responsable** de ese render (normalmente controlado desde `App.jsx`).
3. Resultado de esta fase:
   - Un pequeño documento interno (puede ser una sección en este mismo archivo) con la tabla:

   | Vista / flujo | Componente principal | Tipo de skeleton requerido |
   |---------------|----------------------|-----------------------------|
   | Home feed     | Bloque `home` en `App.jsx` | Lista de tarjetas de noticia / propuesta |
   | Perfil        | Bloque `perfil` en `App.jsx` | Cabecera de usuario + métricas |
   | ...           | ...                  | ...                         |

### 2.2. Diseño de un lenguaje visual de Skeleton Screens (Día 8)

1. Definir un **patrón visual consistente** para todos los skeletons:
   - Fondo ligeramente más oscuro/clarito que el tema actual, con animación de *shimmer* suave.
   - Bordes redondeados que coincidan con las tarjetas reales.
   - Bloques que imiten:
     - Avatar/foto (círculo o cuadrado).
     - Títulos (barras horizontales).
     - Texto secundario (barras más cortas).
2. Traducir este lenguaje visual a **utilidades Tailwind reutilizables**, por ejemplo:
   - Clases tipo `skeleton-base`, `skeleton-avatar`, `skeleton-line`, `skeleton-card`.
   - O bien componentes pequeños de estilo que apliquen las clases necesarias.
3. Definir los **tokens de color** que se usarán tanto en modo claro como oscuro (ver sección 3) para que el skeleton **no encandile** en pantallas OLED:
   - En modo claro: grises suaves con buen contraste.
   - En modo oscuro: grises muy oscuros sobre fondo `#000000`, sin parpadeos luminosos.

### 2.3. Creación de componentes base de Skeleton (Día 9)

1. Crear una carpeta de componentes de presentación, por ejemplo:
   - `src/client/components/skeletons/`
2. Dentro, implementar componentes **puramente visuales** (sin lógica de datos):
   - `SkeletonBlock` (bloque genérico rectangular).
   - `SkeletonText` (varias líneas horizontales).
   - `SkeletonAvatar` (círculo/cuadrado).
   - `SkeletonCard` (composición de avatar + título + subtítulos).
3. Cada skeleton debe aceptar **props mínimos**:
   - Variantes de tamaño (`size`, `lines`, etc.).
   - Clase extra opcional (`className`) para integrarse en layouts existentes.
4. Añadir pruebas manuales rápidas:
   - Un “playground” o sección oculta de la UI donde se puedan ver todos los skeletons juntos para ajustar el diseño.

### 2.4. Integración de Skeletons en flujos principales (Días 9–10)

Para cada flujo identificado en 2.1:

1. **Reemplazar el spinner** o el estado vacío por el skeleton correspondiente:
   - Mientras los datos estén en estado “cargando” (`isLoading === true`), renderizar el skeleton en lugar de:
     - Spinners genéricos.
     - Mensajes tipo “Cargando…” sobre fondo en blanco.
2. Manejar correctamente los **tres estados**:
   - `loading` → mostrar skeleton.
   - `success` (datos reales) → mostrar contenido real.
   - `error` → mostrar mensaje de error con opción de reintentar, manteniendo un esqueleto mínimo para evitar pantallas vacías.
3. En cada integración:
   - Evitar que el usuario vea parpadeos de “nada” → skeleton debe ocupar el mismo espacio que ocupará el contenido real.
   - Usar un número fijo de skeletons (por ejemplo 3–5 tarjetas) para evitar que en redes lentas la UI parezca vacía.

### 2.5. Manejo de cargas subsecuentes y paginación (Día 10)

1. Para listados que cargan **más contenido al hacer scroll**:
   - Añadir skeletons **al final de la lista** cuando se solicitan más elementos.
2. Asegurarse de que:
   - La primera carga del listado también use skeleton.
   - En recargas “silenciosas” (por ejemplo, refrescos automáticos de datos) se evite borrar todo el contenido y reemplazarlo por skeleton: solo se muestran skeletons para los nuevos elementos o se indica recarga discreta.

---

## 3. Lógica de actualización optimista

El objetivo es que, en interacciones críticas (votar, enviar notas, actualizar perfil), el usuario **vea el resultado al instante**, sin esperar la latencia de red, y que se gestione de forma robusta el posible fallo del backend.

### 3.1. Identificación de acciones candidatas (Día 10)

1. Analizar `src/client/services/api.service.js` y la UI para listar acciones:
   - Voto a propuestas.
   - Voto a notas de la comunidad.
   - Actualización de perfil / descripción.
   - Acciones de gamificación visibles inmediatamente en el perfil.
2. Clasificarlas según:
   - **Impacto en UX** (¿el usuario espera feedback inmediato?).
   - **Riesgo de inconsistencia** (¿es fácil de revertir si falla?).

Priorizar primero las que:

- Son frecuentes.
- Tienen feedback simple (por ejemplo, +1 voto, cambio de icono, activar un “like”).

### 3.2. Patrón general de actualización optimista (Días 10–11)

Definir un patrón reutilizable para las acciones elegidas:

1. **Estado previo:** guardar una copia del estado actual antes de mutarlo.
2. **Actualización inmediata de la UI:**
   - Modificar el estado local (o global, si existiera) para que el usuario vea el cambio al instante:
     - Votos: incrementar contador y marcar como “votado”.
     - Perfil: mostrar la nueva descripción o foto inmediatamente.
3. **Llamada a la API en segundo plano:**
   - Enviar la petición HTTP al backend.
4. **Gestión del resultado:**
   - Si **éxito** → consolidar el estado (opcionalmente refrescar datos desde servidor si es barato en ancho de banda).
   - Si **error** → revertir al estado previo y mostrar un mensaje claro:
     - “No se pudo guardar el cambio, tu conexión está inestable. Reintenta más tarde.”
5. Encapsular este patrón en utilidades:
   - Helpers o hooks (por ejemplo, `useOptimisticAction`) para no duplicar lógica.

### 3.3. Uso prudente del almacenamiento local (Día 11)

1. Aprovechar las claves ya permitidas en `localStorage` (por ejemplo, votos) para:
   - Evitar mostrar skeletons de “estado base” cuando ya conocemos el voto previo del usuario.
2. Mantener la regla de seguridad: **no** almacenar credenciales ni tokens.
3. Limitar la cantidad de datos guardados para no incrementar el uso de ancho de banda indirectamente (sincronizaciones innecesarias).

### 3.4. Telemetría básica de resultados (Día 11)

1. Definir contadores o logs mínimos (aunque sea en consola al principio) para medir:
   - Número de acciones optimistas ejecutadas.
   - Ratio de fallos que requieren rollback.
2. Si se añade telemetría real en el futuro:
   - Enviar solo eventos agregados y anónimos.

---

## 4. Accesibilidad lumínica — Modo Oscuro absoluto

Objetivo: implementar un **modo oscuro real**, con fondo `#000000` en áreas principales para proteger baterías OLED y mejorar el confort en entornos de baja iluminación.

### 4.1. Estrategia de theming con `prefers-color-scheme` (Días 12–13)

1. En el archivo de estilos globales (`src/client/assets/index.css`), definir:
   - Paleta base (modo claro) usando **CSS Custom Properties** (`--color-bg`, `--color-text`, etc.).
2. Añadir un bloque:
   - `@media (prefers-color-scheme: dark) { ... }`
   - Dentro de este bloque, redefinir las variables:
     - `--color-bg: #000000;`
     - `--color-bg-elevated`: tonos muy oscuros, cercanos a negro pero con ligerísimo contraste para tarjetas.
     - `--color-text`: gris claro de alto contraste.
3. Configurar Tailwind para que:
   - Use estas variables en las utilidades principales (`bg-[var(--color-bg)]`, etc.).
   - O, si ya está activada la variante `dark`, asegurarse de que `dark` esté en modo `media` y no solo por clase, para responder a `prefers-color-scheme`.

### 4.2. Definición de paleta y contraste (Días 12–13)

1. Diseñar una paleta mínima:
   - Fondo principal: `#000000`.
   - Texto primario: gris muy claro con ratio de contraste suficiente (mínimo 4.5:1).
   - Texto secundario: gris intermedio, sin caer en baja legibilidad.
   - Bordes divisores muy sutiles para separar tarjetas sin “manchas” luminosas.
2. Ajustar estados de foco y hover:
   - Evitar brillos fuertes.
   - Usar cambios suaves de escala/opacidad antes que cambios agresivos de color.

### 4.3. Revisión componente por componente (Días 13–14)

1. Recorrer las secciones principales de `App.jsx`:
   - `home`, `general`, `perfil`, `donations`, `nosotros`, `premium`, menú.
2. Para cada sección:
   - Reemplazar colores “hardcodeados” por variables (`var(--color-...)`) o clases Tailwind alineadas con el tema.
   - Verificar:
     - Legibilidad del texto.
     - Visibilidad de iconos y botones.
     - Integración de skeletons (secciones 2.x) en fondo negro sin deslumbrar.
3. Priorizar primero las pantallas con mayor uso (home y perfil).

### 4.4. Control manual opcional de modo (Día 14)

1. Añadir, si se considera necesario, un **toggle opcional** en el menú o configuración:
   - Por defecto, el sistema obedece `prefers-color-scheme`.
   - El toggle permitiría forzar “modo claro” u “oscuro” y persistir **solo la preferencia de UI** en `localStorage` (sin datos sensibles).
2. Al activar el toggle:
   - Añadir una clase al `body` o al `root` (`class="theme-dark"` / `class="theme-light"`).
   - Hacer que esta clase tenga prioridad sobre el media query, sin romperlo si el usuario no ha elegido nada.

### 4.5. Validación en dispositivos reales (Día 14–15)

1. Probar en:
   - Móviles Android con pantalla OLED (modo oscuro del sistema activado).
   - Diferentes niveles de brillo de pantalla.
2. Comprobar:
   - Que no hay fondos grises inesperados que mantengan muchos píxeles encendidos.
   - Que los skeletons y modales respetan el fondo `#000000` o tonos muy oscuros.

---

## 5. Plan temporal resumido (Días 8–15)

- **Día 8**
  - Inventario de flujos con carga percibida.
  - Definición del lenguaje visual de Skeleton Screens.
- **Día 9**
  - Implementación de componentes base de skeleton.
  - Playground interno de skeletons.
- **Día 10**
  - Integración de skeletons en flujos principales (home, perfil, etc.).
  - Identificación de acciones candidatas para actualización optimista.
- **Día 11**
  - Implementación del patrón de actualización optimista en las 1–2 acciones de mayor impacto.
  - Ajuste de uso de `localStorage` solo para pistas de UI.
- **Días 12–13**
  - Implementación de variables de tema y media query `prefers-color-scheme`.
  - Definición y ajuste fino de paleta de modo oscuro absoluto.
- **Días 13–14**
  - Revisión componente por componente en `App.jsx`.
  - Asegurar compatibilidad visual de skeletons en modo oscuro.
- **Día 14–15**
  - (Opcional) Añadir toggle de modo manual con persistencia.
  - Pruebas en dispositivos reales + correcciones finales.

---

## 6. Criterios de éxito

Se considerará que C2 está correctamente implementado cuando:

- **No existan spinners genéricos** en las vistas principales; todo estado de carga esté cubierto por Skeleton Screens coherentes.
- Las acciones clave (votos, actualizaciones pequeñas de perfil) se perciban **instantáneas** gracias a actualización optimista, con rollbacks manejados.
- El modo oscuro:
  - Use fondo principal `#000000` en las áreas donde el usuario pasa más tiempo.
  - Respete automáticamente `prefers-color-scheme`.
  - Mantenga la legibilidad y no introduzca parpadeos o zonas de brillo agresivas.
- En conexiones degradadas, los usuarios **perciban fluidez** en las transiciones y no se encuentren con pantallas en blanco ni mensajes de error abruptos.

