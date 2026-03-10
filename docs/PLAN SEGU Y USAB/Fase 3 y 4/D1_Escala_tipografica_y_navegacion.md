Plan de implementación D1: Escala tipográfica, navegación a una mano y zonas táctiles

## 1. Objetivo del punto D1

**Objetivo general:**  
Conseguir que la interfaz de "Venezuela Live" sea operativa de forma intuitiva para usuarios con baja alfabetización digital y visión reducida, mediante:

- **Escala tipográfica coherente** y altamente legible en pantallas pequeñas.  
- **Ajuste del espaciado global** para uso cómodo con una sola mano.  
- **Reubicación de acciones centrales** (contenido y búsqueda) a una **Bottom App Bar** accesible al pulgar.  
- **Estandarización de zonas táctiles** mínimas de **48 x 48 px** en todos los elementos interactivos.

---

## 2. Auditoría inicial de la interfaz actual

**2.1. Inventario de tipografías**
- Listar todas las fuentes que se usan actualmente (familias, pesos, tamaños).
- Identificar componentes clave donde se renderiza texto:
  - Titulares (feeds, secciones, pantallas principales).
  - Subtítulos, metadatos (fechas, nombres de usuario, contadores).
  - Texto de párrafo (descripciones de publicaciones, comentarios).
  - Elementos de navegación y botones.
- Registrar tamaños actuales en px / rem y su uso en cada componente.

**2.2. Inventario de navegación y acciones principales**
- Localizar:
  - Botón de inicio / feed principal.
  - Acción de crear contenido / publicar.
  - Acción de búsqueda.
  - Navegación entre secciones (notificaciones, perfil, etc.).
- Documentar su **posición actual** (header, sidebar, flotantes) y si son accesibles con una sola mano en móviles (zona inferior vs superior).

**2.3. Inventario de zonas táctiles**
- Identificar todos los elementos interactivos:
  - Botones, íconos, chips, pestañas, elementos de lista clicables.
  - Controles de reproducción (si los hay).
- Medir sus dimensiones táctiles efectivas:
  - Ancho y alto del área clicable.
  - Distancia entre elementos interactivos para evitar toques erróneos.

**Entregable de esta fase:** documento o tabla con:
- Lista de tamaños de fuente actuales.
- Mapa de navegación actual (dónde están las acciones clave).
- Lista de elementos interactivos que **no** cumplen 48 x 48 px.

---

## 3. Definición de la escala tipográfica coherente

**3.1. Selección de familia(s) tipográfica(s)**
- Elegir **1 familia primaria** para texto de lectura (preferiblemente Sans Serif legible en baja resolución).
- Opcionalmente, una **familia secundaria** para títulos si aporta contraste, manteniendo alta legibilidad.
- Verificar:
  - Buen renderizado en Android de gama baja.
  - Soporte para caracteres extendidos en español.

**3.2. Definir la escala modular**
- Establecer un tamaño base de texto, por ejemplo:
  - Body base: **16 px** (o 1 rem).
- Construir una escala modular coherente, por ejemplo:
  - H1: 24–28 px (títulos principales).
  - H2: 20–22 px.
  - H3: 18–20 px.
  - Body grande (resaltado): 16–18 px.
  - Body normal: 14–16 px (evitar menos de 14 px).
  - Metadatos: 12–14 px, solo donde sea inevitable y con alto contraste.

**3.3. Crear tokens de diseño para tipografía**
- Definir tokens (variables) globales, por ejemplo:
  - `font-family-base`
  - `font-size-h1`, `font-size-h2`, `font-size-h3`
  - `font-size-body-lg`, `font-size-body`, `font-size-meta`
  - `line-height-tight`, `line-height-normal`, `line-height-loose`
- Centralizar estos tokens en:
  - Un archivo de tema (p. ej. `theme.ts` / `tokens.ts`) o
  - Un módulo de estilos global (`global.css` / `variables.css`).

**Entregable de esta fase:** tabla de escala tipográfica y archivo de tokens que la codifica.

---

## 4. Aplicación progresiva de la escala tipográfica a los componentes

**4.1. Priorizar pantallas críticas**
- Orden de prioridad:
  1. Pantalla principal de feed / noticias.
  2. Pantalla de detalle de publicación.
  3. Pantalla de creación de contenido.
  4. Pantallas de navegación principales (búsqueda, notificaciones, perfil).

**4.2. Refactorizar componentes para usar tokens**
- Reemplazar tamaños de fuente “sueltos” (hard-coded) por tokens definidos en la fase 3.
- Asegurarse de que:
  - Los títulos en el feed usen siempre el mismo nivel (H2/H3).
  - Los metadatos (fecha, alias) usen `font-size-meta`.
  - El cuerpo del texto use `font-size-body` o `font-size-body-lg` según jerarquía.

**4.3. Ajustar interlineado y espaciados verticales**
- Definir reglas por tipo de contenido:
  - Títulos: line-height 1.2–1.3.
  - Texto de párrafo: line-height 1.4–1.6.
  - Separación entre bloques de contenido: múltiplos de la unidad de espaciado base (p. ej. 4, 8, 12, 16 px).
- Verificar legibilidad en:
  - Móviles de 5"–6" en vertical.
  - Modos de alto contraste del sistema operativo (si aplica).

**Entregable de esta fase:** componentes clave actualizados con la nueva escala tipográfica y spacing coherente.

---

## 5. Diseño y despliegue de la Bottom App Bar

**5.1. Definir arquitectura de navegación**
- Seleccionar **máximo 3–5 acciones principales** para la barra inferior:
  - Inicio / Feed.
  - Búsqueda.
  - Crear contenido / Publicar.
  - Notificaciones (opcional).
  - Perfil (opcional).
- Establecer el **orden de izquierda a derecha** priorizando accesibilidad con el pulgar:
  - Colocar las acciones más usadas y críticas hacia el **centro-derecha** (para diestros) o balancear según estadística de usuarios si se conoce.

**5.2. Diseñar la Bottom App Bar**
- Altura mínima de la barra: 56–64 px.
- Íconos:
  - Tamaño visual 24 px, pero asegurando hit area de 48 x 48 px.
  - Etiquetas de texto opcionales, pero recomendables para usuarios de baja alfabetización digital (usar texto simple y claro).
- Fondo:
  - Contraste suficiente con el contenido del feed y con el modo oscuro.

**5.3. Integración técnica**
- Crear un componente reutilizable, por ejemplo: `BottomNavBar` / `BottomAppBar`.
- Colocarlo en el layout principal de la app móvil:
  - Anclarlo a la parte inferior de la ventana.
  - Asegurar que no se solape con gestos del sistema operativo (Android/iOS).
- Conectar las acciones a la capa de routing existente (enrutador de la SPA).

**Entregable de esta fase:** barra de navegación inferior operativa con las acciones clave y diseño consistente.

---

## 6. Estandarización de zonas táctiles mínimas de 48 x 48 px

**6.1. Definir tokens / utilidades para áreas táctiles**
- Crear una regla global, por ejemplo:
  - `touch-target-min: 48px`.
- Implementar utilidades o clases que garanticen:
  - `min-width: 48px;`
  - `min-height: 48px;`
  - `padding` suficiente alrededor de íconos y textos interactivos.

**6.2. Aplicación a componentes interactivos**
- Botones primarios y secundarios.
- Íconos sueltos que actúan como botones (me gusta, compartir, guardar).
- Elementos de navegación en la Bottom App Bar.
- Pestañas, chips y otros elementos con interacción táctil.

**6.3. Revisión de densidad de interfaz**
- Verificar que al aumentar las áreas táctiles:
  - No se rompa el layout en pantallas pequeñas.
  - Se mantenga una separación mínima entre elementos para evitar toques accidentales.

**Entregable de esta fase:** todos los elementos interactivos críticos cumplen o superan 48 x 48 px de área táctil.

---

## 7. Ajuste de espaciado global para navegación a una sola mano

**7.1. Definir sistema de espaciado**
- Establecer una escala de espaciado base (por ejemplo, múltiplos de 4 px): 4, 8, 12, 16, 20, 24, 32…
- Mapear:
  - Margen entre tarjetas de publicaciones.
  - Padding interno de las tarjetas.
  - Espaciados entre secciones (header, contenido, footer, barra inferior).

**7.2. Optimizar disposición de elementos clave**
- Desplazar la mayor parte de las interacciones primarias hacia el tercio inferior de la pantalla.
- Reducir la necesidad de “estirarse” hacia la parte superior para acciones frecuentes.
- Evitar que acciones destructivas o críticas estén demasiado cerca de bordes donde se activan gestos del sistema operativo.

**Entregable de esta fase:** layout ajustado para uso cómodo con una sola mano en móviles estándar.

---

## 8. Validación con criterios de accesibilidad y pruebas en dispositivos reales

**8.1. Validación visual y tipográfica**
- Revisar:
  - Contraste de texto frente al fondo (especialmente en modo oscuro).
  - Tamaños mínimos de fuente (evitar < 14 px).
  - Jerarquía visual clara entre títulos, subtítulos y cuerpo.

**8.2. Pruebas en dispositivos físicos**
- Probar en:
  - Al menos un Android de gama baja y uno de gama media.
  - Resoluciones diferentes (720p, 1080p).
- Validar:
  - Que todos los botones se pueden alcanzar con el pulgar sin reposicionar la mano en exceso.
  - Que no haya elementos esenciales fuera del área cómoda de interacción.

**8.3. Feedback de usuarios objetivo**
- Si es posible, realizar pruebas con:
  - Personas mayores.
  - Usuarios con bajo alfabetismo digital.
- Registrar:
  - Dónde se confunden.
  - Qué acciones no encuentran fácilmente.
  - Dónde fallan los toques o pulsan elementos equivocados.

**Entregable de esta fase:** informe de pruebas con lista de problemas detectados y propuestas de mejora.

---

## 9. Documentación final en el sistema de diseño

**9.1. Documentar tokens y reglas**
- Registrar en el Design System:
  - Escala tipográfica (tabla de tamaños, pesos y usos).
  - Escala de espaciado.
  - Reglas de áreas táctiles mínimas.

**9.2. Documentar patrones de navegación**
- Incluir:
  - Diseño y comportamiento de la Bottom App Bar.
  - Patrones de navegación recomendados (qué acciones van arriba, cuáles abajo).

**9.3. Mantener la coherencia futura**
- Establecer una política interna:
  - Nuevos componentes deben usar únicamente los tokens del sistema de diseño.
  - Revisiones de UI deben respetar los tamaños mínimos de texto y de áreas táctiles.

---

## 10. Checklist rápido de implementación D1

- [ ] Escala tipográfica definida y centralizada en tokens.  
- [ ] Componentes clave refactorizados para usar la nueva escala.  
- [ ] Sistema de espaciado global definido y aplicado.  
- [ ] Bottom App Bar implementada con acciones prioritarias y accesibles.  
- [ ] Todas las zonas táctiles críticas cumplen 48 x 48 px o más.  
- [ ] Pruebas en dispositivos reales realizadas.  
- [ ] Feedback de usuarios de baja alfabetización digital recogido y aplicado.  
- [ ] Reglas y patrones documentados en el sistema de diseño.

