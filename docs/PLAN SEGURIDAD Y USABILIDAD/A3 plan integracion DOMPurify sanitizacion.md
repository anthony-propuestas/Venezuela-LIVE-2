# A3: Integración de biblioteca de sanitización (DOMPurify)

**Estado:** Implementado — Fase 1 A3 del [Plan de acción global](Plan%20de%20accion%20global.md), con DOMPurify integrado en el cliente React.

**Objetivo:** Instalar e instanciar en toda la aplicación una biblioteca de sanitización estricta (DOMPurify) para garantizar que cualquier HTML introducido en el futuro —o cualquier punto que renderice marcado— quede libre de etiquetas `<script>`, esquemas `javascript:`, controladores de eventos y contenido ofuscado antes de que el árbol DOM lo interprete.

**Contexto:** Tras A2 ([A2 renderizado no escapado](A2%20renderizado%20no%20escapado.md)) no existe actualmente renderizado HTML crudo de usuario; este plan deja la defensa lista para el día que se requiera (rich text, markdown a HTML, etc.) y establece el estándar de uso.

---

## 1. Resumen ejecutivo

| Ítem | Descripción |
|------|-------------|
| **Control** | Sanitización estricta de HTML antes de inyección en el DOM |
| **Biblioteca** | DOMPurify (referencia OWASP, ampliamente auditada) |
| **Alcance** | Cliente React (navegador); cualquier uso futuro de `dangerouslySetInnerHTML` o equivalente |
| **Efecto defensivo** | Mitiga XSS por HTML generado por usuarios o de terceros (rich text, feeds, etc.) |

---

## 2. Implementación de la sanitización

### 2.1 Dependencias instaladas (DOMPurify)

Desde la raíz del proyecto:

```bash
npm install dompurify
npm install -D @types/dompurify
```

- **dompurify:** sanitización en el navegador (usa el DOM nativo; en entornos sin DOM existe `isomorphic-dompurify` si más adelante se sanitiza en Node).
- **@types/dompurify:** tipos TypeScript para mejor integración si se migra código a TS.

**Verificación:** `package.json` debe listar `"dompurify"` en `dependencies` y `"@types/dompurify"` en `devDependencies`.

---

### 2.2 Módulo de sanitización centralizado

Objetivo: un único punto de configuración y uso para toda la app.

1. Crear el archivo de utilidad, por ejemplo:
   - `src/client/utils/sanitize.js` (o `sanitize.ts` si se usa TypeScript).

2. Contenido mínimo recomendado:

   - Importar DOMPurify.
   - Exportar una función (p. ej. `sanitizeHtml(dirty)`):
     - Recibe un string con posible HTML.
     - Devuelve el string sanitizado mediante `DOMPurify.sanitize(dirty, config)`.
   - Definir una **configuración estricta** en ese módulo:
     - Sin etiquetas `<script>`, `<iframe>`, `<object>`, `<embed>`, `<form>`.
     - Sin esquemas `javascript:`, `vbscript:`, `data:` en atributos (p. ej. `href`, `src`).
     - Sin controladores de eventos (`onclick`, `onerror`, etc.); DOMPurify por defecto los elimina, pero conviene documentarlo o reforzar con `ADD_ATTR`/`FORBID_TAGS` si se personaliza.
   - Opcional: exportar una configuración “relajada” (solo para casos documentados y justificados, p. ej. iframes de confianza en whitelist).

3. No instanciar DOMPurify en cada componente; usar siempre este módulo para mantener una sola política de sanitización.

---

### 2.3 Componente React “SafeHtml”

Para homogeneizar el uso y evitar olvidos:

1. Crear un componente (p. ej. `src/client/components/SafeHtml.jsx`):
   - Props: `html` (string), opcionalmente `className` o `tag` (por defecto `div`).
   - En el render: usar `dangerouslySetInnerHTML={{ __html: sanitizeHtml(html) }}` donde `sanitizeHtml` es la función del Paso 2.
   - Así, en toda la aplicación solo este componente (y el módulo `sanitize`) tocan HTML crudo; el resto de la app usa `<SafeHtml html={...} />`.

2. Documentar en el componente que **nunca** se debe pasar a `SafeHtml` contenido no sanitizado por la utilidad (doble defensa: el componente siempre sanitiza).

---

### 2.4 Política de uso y puntos de aplicación

- **Hoy:** No hay sitios que requieran cambio inmediato (A2 no encontró `dangerouslySetInnerHTML`).
- **Futuro:** Cualquier feature que renderice HTML de usuario o de terceros (rich text, markdown convertido a HTML, fragmentos de noticias externas, etc.) debe:
  1. Pasar el HTML **siempre** por la función de sanitización del Paso 2 (o por el componente del Paso 3).
  2. Nunca asignar a `__html` / `dangerouslySetInnerHTML` contenido que no haya pasado por DOMPurify en este módulo.
- **Revisión de código:** En PRs, comprobar que no exista `dangerouslySetInnerHTML` fuera del componente `SafeHtml` (o del único punto autorizado que use `sanitizeHtml`).

---

### 2.5 Configuración recomendada de DOMPurify

En el módulo `sanitize` (Paso 2), usar opciones estrictas, por ejemplo:

- **FORBID_TAGS:** incluir al menos `['script', 'iframe', 'object', 'embed', 'form']` si se desea ser explícito (DOMPurify ya restringe muchos por defecto).
- **FORBID_ATTR:** incluir `['onerror', 'onload', 'onclick', ...]` si se quiere una lista explícita de eventos (DOMPurify los elimina por defecto).
- **ALLOWED_ATTR / ALLOWED_TAGS:** si se usa lista blanca, definir solo las etiquetas y atributos necesarios (p. ej. para bold, italic, enlaces seguros), y no permitir `href` con esquema distinto de `http`/`https` (evitar `javascript:`).
- **ADD_ATTR:** no añadir atributos que permitan ejecución de código (evitar `target` con valores raros si no es necesario; en general no añadir handlers).

Documentar en comentarios del módulo la decisión: “solo contenido de presentación; sin scripts ni eventos”.

---

### 2.6 Pruebas y revisión

- Añadir al menos una prueba (manual o automatizada) que verifique que:
  - Un string con `<script>alert(1)</script>` sanitizado no ejecuta script y no contiene la etiqueta en el resultado.
  - Un string con `<a href="javascript:alert(1)">x</a>` sanitizado no conserva `javascript:` en `href` (o el enlace queda inofensivo).
- Opcional: prueba unitaria que llame a `sanitizeHtml(...)` y compruebe que el resultado no incluye `script`, `javascript:`, ni `onerror`/`onload`, etc.

---

### 2.7 Documentación y checklist de cierre A3

- Actualizar este documento con el estado “Implementado” y la ruta real del módulo (p. ej. `src/client/utils/sanitize.js`).
- En el [Plan de acción global](Plan%20de%20accion%20global.md), marcar A3 como completado cuando se cumplan todos los pasos.
- Dejar referenciado en A2 que, para cualquier HTML futuro, se debe usar el flujo A3 (sanitize → luego render).

---

## 3. Comandos para comprobar que la implementación fue exitosa

Ejecutar desde la **raíz del repositorio** (reemplazar `npm` por `pnpm`/`yarn` si aplica).

### 3.1 Verificar que DOMPurify está instalado

```bash
npm list dompurify
npm list @types/dompurify
```

- **Esperado:** Se listan `dompurify` (en dependencies) y `@types/dompurify` (en devDependencies) sin errores de dependencias no resueltas.

### 3.2 Verificar que existe el módulo de sanitización

```bash
dir src\client\utils\sanitize.js
```

(o `ls src/client/utils/sanitize.js` en entornos Unix).  
- **Esperado:** El archivo existe. Si se usó otro path, comprobar que ese path existe.

### 3.3 Verificar que no hay uso de `__html` sin sanitización

Tras la implementación, **todo** uso de `dangerouslySetInnerHTML` debe estar en el componente que llama a DOMPurify (p. ej. `SafeHtml`) o en un único punto documentado que use la utilidad:

```bash
rg "dangerouslySetInnerHTML" src/
rg "__html\s*:" src/
```

- **Esperado:** Las únicas coincidencias deben ser:
  - El componente `SafeHtml` (o el contenedor que use `sanitizeHtml`), donde `__html` recibe el **resultado** de `sanitizeHtml(...)`.
  - Ningún otro archivo debe asignar a `__html` un valor que no pase por la función de sanitización.

### 3.4 Verificar que la sanitización se importa donde corresponde

```bash
rg "sanitizeHtml|DOMPurify|sanitize" src/client/
```

- **Esperado:** Aparece el módulo `sanitize.js` (o equivalente) y el componente que renderiza HTML seguro; no debe haber importación directa de DOMPurify en múltiples sitios sin pasar por el módulo central (opcional pero recomendado: un solo punto de uso de DOMPurify).

### 3.5 Build de la aplicación

```bash
npm run build
```

- **Esperado:** La compilación termina sin errores. Si DOMPurify o el módulo de sanitización no se importan correctamente, el build puede fallar o generar warnings.

### 3.6 Prueba manual rápida en dev

1. Ejecutar `npm run dev`.
2. Si existe ya una pantalla que use el componente seguro con HTML (p. ej. un preview de rich text), introducir en un campo de prueba:
   - `<script>alert('XSS')</script>`
   - `<img src=x onerror=alert('XSS')>`
   - `<a href="javascript:alert('XSS')">click</a>`
3. **Esperado:** No se ejecuta ningún alert; el contenido mostrado no debe incluir scripts ejecutables ni enlaces `javascript:`.

---

## 4. Resumen de criterios de éxito

| Criterio | Comando / Acción |
|----------|-------------------|
| DOMPurify instalado | `npm list dompurify` |
| Tipos instalados (opcional) | `npm list @types/dompurify` |
| Módulo central de sanitización existe | Comprobar `src/client/utils/sanitize.js` (o path definido) |
| No hay `__html` sin sanitizar | `rg "__html\s*:" src/` → solo en componente seguro |
| Build correcto | `npm run build` |
| Sanitización efectiva | Prueba manual con `<script>`, `onerror`, `javascript:` |

Cuando todos los criterios se cumplan y la política de uso esté documentada, **A3 puede darse por implementado** y quedará lista la defensa para cualquier HTML que se incorpore en el futuro.
