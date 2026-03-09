# A2: Identificar y aislar renderizado no escapado (XSS)

**Estado: COMPLETADO** — Lista de tareas: [A2 todos.md](A2%20todos.md).

Documento de auditoría de seguridad — Fase 1 A2 del [Plan de acción global](Plan%20de%20accion%20global.md).

---

## 1. Resumen ejecutivo

| Métrica | Valor |
|--------|--------|
| **Hallazgos críticos** | 0 |
| **Hallazgos altos** | 0 |
| **Hallazgos medios/bajos** | 0 |
| **Estado** | Sin vectores de XSS por renderizado no escapado en código |

Se recorrió el repositorio completo mediante búsquedas con expresiones regulares (RegEx) sobre los patrones de riesgo definidos. **No se identificó** uso de `dangerouslySetInnerHTML`, `innerHTML`, `document.write`, `insertAdjacentHTML`, `createContextualFragment`, `v-html`, ni de atributos dinámicos peligrosos (`href` con `javascript:`, etc.) en el código fuente de la aplicación. El contenido generado por usuarios (propuestas, comentarios, notas, perfil) se renderiza mediante el modelo de React (JSX con interpolación `{variable}`), que escapa por defecto el texto y no interpreta HTML. **A2 se considera cumplido**; se recomienda mantener esta práctica y, en caso de necesitar HTML en el futuro, aplicar la Fase 1 A3 (DOMPurify) antes de cualquier renderizado raw.

---

## 2. Metodología

### 2.1 Patrones RegEx y ámbitos

**Patrones React / JSX (prioridad alta):**

| Patrón | RegEx utilizada | Riesgo |
|--------|------------------|--------|
| `dangerouslySetInnerHTML` | `dangerouslySetInnerHTML` | Crítico |
| Uso de `__html` en objeto | `__html\s*:` | Crítico |
| `suppressContentEditableWarning` | `suppressContentEditableWarning` | Contexto de posible inyección |

**Patrones DOM / JavaScript:**

| Patrón | RegEx utilizada | Riesgo |
|--------|------------------|--------|
| Asignación a `innerHTML` | `\.innerHTML\s*=` | Crítico |
| `document.write` | `document\.write\s*\(` | Crítico |
| `insertAdjacentHTML` | `insertAdjacentHTML\s*\(` | Alto |
| `document.writeln` | `document\.writeln\s*\(` | Alto |
| `createContextualFragment` | `createContextualFragment\s*\(` | Medio-Alto |
| jQuery `.html()` | `\.html\s*\(` | Alto (si existiera jQuery) |

**Patrones de atributos dinámicos:**

| Descripción | Búsqueda | Riesgo |
|-------------|----------|--------|
| `href` con `javascript:` o `data:` | `javascript:` / `data:\s*text/html` | Alto |
| Handlers inline con user input | Revisión manual de `on*=` y origen del dato | Alto |
| `style` con contenido dinámico de usuario | Revisión manual | Medio |

**Ámbitos de búsqueda:**

- **Incluido:** `src/client/**/*.{jsx,js}`, `src/server/**/*.ts`, `functions/**/*.ts`, `index.html`.
- **Excluido:** `node_modules`, `dist`, `*.min.js`, y archivos de documentación que solo citan los patrones (p. ej. `docs/Plan de accion global.md`).

**Herramienta:** ripgrep (`rg`) y búsqueda en IDE sobre el árbol del repositorio.

---

## 3. Inventario de hallazgos

No se encontraron coincidencias para ninguno de los patrones anteriores en el código de la aplicación.

| Archivo | Línea | Patrón | Origen del dato | Clasificación | Recomendación |
|---------|-------|--------|-----------------|---------------|---------------|
| — | — | — | — | — | — |

*(Tabla vacía: sin hallazgos.)*

**Contexto del renderizado actual:**

- **Cliente (React):** En `App.jsx`, `Profile.page.jsx`, `Login.page.jsx` y `ErrorContext.jsx`, todo el contenido de usuario (títulos de propuestas, descripciones, autores, comentarios, notas, nombre de usuario, descripción de perfil, mensajes de error) se muestra mediante expresiones JSX del tipo `{proposal.title}`, `{c.text}`, `{note.text}`, etc. React escapa automáticamente estas cadenas y no las interpreta como HTML.
- **Servidor:** `src/server` y `functions/[[path]].ts` devuelven JSON o respuestas de API; no generan HTML para inyección en el DOM del cliente.
- **index.html:** Contenido estático; sin inserción de datos de usuario.

---

## 4. Patrones no encontrados (trazabilidad)

Se ejecutaron búsquedas explícitas para los siguientes patrones; en todos los casos el resultado fue **ninguna coincidencia** en código de aplicación:

- `dangerouslySetInnerHTML`
- `__html`
- `suppressContentEditableWarning`
- `.innerHTML =`
- `document.write(`
- `document.writeln(`
- `insertAdjacentHTML(`
- `createContextualFragment(`
- `.html(`
- `v-html`
- Cadenas `javascript:` o `data:text/html` en contexto de atributos

Las únicas menciones de “renderizado no escapado” o “dangerouslySetInnerHTML” aparecen en la documentación (plan global y este documento), no en código ejecutable.

---

## 5. Recomendaciones para A3

Según el [Plan de acción global](Plan%20de%20accion%20global.md), la Fase 1 A3 consiste en integrar una biblioteca de sanitización (p. ej. DOMPurify) para cualquier HTML que en el futuro se deba renderizar de forma explícita.

- **Situación actual:** No existe tal renderizado; no hay puntos que requieran remediación inmediata.
- **Si en el futuro se introduce HTML generado por usuarios (rich text, markdown renderizado a HTML, etc.):**
  1. No usar `dangerouslySetInnerHTML` con contenido crudo de usuario.
  2. Sanitizar siempre con DOMPurify (o equivalente) antes de asignar a `dangerouslySetInnerHTML.__html`.
  3. Re-ejecutar esta auditoría (comandos abajo) tras añadir nuevas pantallas o componentes que rendericen HTML.

No se listan archivos concretos para A3 porque en el estado actual no hay ninguno que inyecte HTML de usuario en el DOM.

---

## 6. Checklist de cierre A2

- [x] Recorrido del repositorio con búsquedas RegEx según los patrones definidos.
- [x] Clasificación de hallazgos por riesgo (en este caso, ninguno).
- [x] Documentación de resultados en este archivo (inventario, patrones no encontrados, metodología).
- [x] Redacción de recomendaciones para A3 y trazabilidad de patrones buscados.

**Conclusión:** A2 completado. El proyecto está listo para continuar con la Fase 1 A3 (integración de sanitización) cuando exista un requisito de renderizado HTML controlado; hasta entonces, mantener el uso exclusivo de texto escapado por React.

---

## 7. Comandos para repetir la auditoría

Ejecutar desde la raíz del repositorio (excluyendo `node_modules` y `dist`):

```bash
rg "dangerouslySetInnerHTML" src/ functions/ index.html
rg "__html\s*:" src/ functions/
rg "\.innerHTML\s*=" src/ functions/
rg "document\.write\s*\(" src/ functions/
rg "insertAdjacentHTML\s*\(" src/ functions/
rg "createContextualFragment\s*\(" src/ functions/
rg "\.html\s*\(" src/ functions/
rg "suppressContentEditableWarning" src/ functions/
```

Si se añaden otras tecnologías (p. ej. Vue), incluir también: `rg "v-html"` en los directorios correspondientes.
