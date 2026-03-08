# A1: Plan de revisión de dependencias estáticas

## 1. Objetivo y alcance

**Objetivo:** Instituir un proceso repetible de auditoría y remediación de dependencias npm para eliminar vulnerabilidades conocidas (CVE) y dependencias obsoletas o deprecated introducidas por generación de código con LLMs, alineado con la Fase 1 del Plan de acción global (auditoría heurística y remediación de inyecciones).

**Alcance:**

- Dependencias declaradas en `package.json` (dependencies y devDependencies).
- Árbol de dependencias resuelto: lockfile (`package-lock.json` o `npm-shrinkwrap.json`).
- Herramientas: `npm audit`, `npm outdated` y, en repositorios GitHub, Dependabot.

---

## 2. Prerrequisitos técnicos

Antes de ejecutar el plan, verificar:

- **Node.js y npm:** versión LTS compatible con el proyecto (recomendado Node 20+ y npm 10+).
- **Lockfile:** debe existir y estar actualizado. Ejecutar `npm install` sin introducir cambios no deseados antes de auditar, para que los resultados sean reproducibles.
- **Repositorio en GitHub:** necesario para habilitar Dependabot; opcional si solo se usa auditoría local con `npm audit`.

---

## 3. Fases del plan (paso a paso)

### Fase 1: Auditoría local con npm

1. Ejecutar **`npm audit`** en modo solo informe (sin `--fix`) y capturar la salida.
2. Clasificar y documentar las vulnerabilidades por severidad: **critical**, **high**, **moderate**, **low**.
3. Ejecutar **`npm audit --json`** y guardar el resultado en un artefacto (por ejemplo `docs/audit-baseline.json`) para comparación posterior y trazabilidad.
4. Interpretar la salida:
   - Diferenciar vulnerabilidades **directas** (paquetes listados en `package.json`) de **transitivas** (dependencias de dependencias).
   - Complementar con **`npm outdated`** para detectar paquetes obsoletos o deprecated que no aparezcan en el audit.

**Criterio de éxito:** Registro claro de todas las vulnerabilidades existentes y lista de paquetes a actualizar o reemplazar.

---

### Fase 2: Análisis de remediación

1. Para cada vulnerabilidad reportada por `npm audit`:
   - Decidir si aplicar **`npm audit fix`** (actualizaciones automáticas dentro del rango semántico permitido),
   - **`npm audit fix --force`** (puede introducir cambios de versión major; **no usar sin revisar changelog y suite de pruebas**), o
   - **Actualización manual** (cambiar versión en `package.json` y ejecutar `npm install`).
2. Priorizar: abordar primero **critical** y **high**; dejar **moderate** y **low** para un segundo ciclo si es necesario.
3. Para dependencias obsoletas o deprecated (p. ej. detectadas con `npm outdated` o avisos en `npm install`): planificar **reemplazo** por paquete mantenido o **actualización** a la última versión compatible.
4. Elaborar una **matriz de acciones**: por cada dependencia afectada, anotar la acción (actualizar / reemplazar / aceptar riesgo documentado) y la justificación breve.

**Criterio de éxito:** Matriz de acciones definida para cada dependencia afectada, sin vulnerabilidades critical/high sin plan de remediación.

---

### Fase 3: Aplicación segura de correcciones

1. Crear una **rama dedicada** (por ejemplo `fix/deps-a1`) desde la rama principal.
2. Aplicar correcciones en este orden:
   - Primero **`npm audit fix`** (sin `--force` salvo análisis explícito).
   - Luego actualizaciones manuales de versiones según la matriz de la Fase 2.
3. Ejecutar **build** y **pruebas** del proyecto:
   - `npm run build`
   - Si existen tests (p. ej. `npm run check:apis` u otros definidos en `package.json`), ejecutarlos y asegurar que pasen.
4. Revisar los cambios en el lockfile y en `package.json`; realizar un **commit atómico** con mensaje que referencie A1 (por ejemplo: `fix(deps): A1 - remediación de vulnerabilidades y dependencias obsoletas`).
5. Volver a ejecutar **`npm audit`** y verificar que no queden vulnerabilidades critical ni high (o documentar excepciones aceptadas con justificación).

**Criterio de éxito:** `npm audit` sin vulnerabilidades critical/high no aceptadas; build y pruebas en verde; cambios contenidos en una rama lista para merge tras revisión.

---

### Fase 4: Automatización con Dependabot (GitHub)

1. Crear el archivo **`.github/dependabot.yml`** con:
   - Configuración para el ecosistema **npm**.
   - Directorio raíz: `/`.
   - Frecuencia de revisión (por ejemplo **weekly**).
   - Opcional: agrupación de actualizaciones de versión minor/patch para reducir ruido en PRs.
2. En el repositorio de GitHub: habilitar **Dependabot alerts** (Settings > Security > Dependabot alerts).
3. Definir **política de revisión**: revisar los PRs abiertos por Dependabot en una ventana definida (p. ej. semanal); hacer merge solo tras **CI en verde** y **revisión humana** del diff de dependencias.

**Criterio de éxito:** Configuración de Dependabot activa; al menos un ciclo de revisión (primer PR de Dependabot recibido y proceso de revisión documentado o aplicado).

---

### Fase 5: Proceso recurrente y criterios de cierre

1. Establecer una **cadencia** para la revisión de dependencias (por ejemplo: cada sprint, o antes de cada release).
2. Incluir en el **checklist** de desarrollo o release:
   - Ejecución de `npm audit`.
   - Revisión de `npm outdated`.
   - Revisión de Dependabot alerts y PRs pendientes.
3. **Criterios de cierre de A1:**
   - (1) Cero vulnerabilidades **critical** y **high** no aceptadas (con excepciones documentadas si aplica).
   - (2) Dependabot configurado y al menos un ciclo de revisión realizado.
   - (3) Este documento actualizado con la **fecha de última auditoría** y el **resultado de `npm audit`** (por ejemplo: "X vulnerabilidades low, 0 critical/high").

---

## 4. Verificación de viabilidad y seguridad

| Aspecto | Comprobación |
|--------|---------------|
| **Viabilidad** | Todas las acciones utilizan herramientas estándar (npm, Dependabot); el proyecto dispone de `package.json` y scripts de build; no se requieren servicios externos de pago. |
| **Seguridad** | No se ejecuta código arbitrario; `npm audit fix` solo actualiza versiones dentro de los rangos permitidos por `package.json`; el uso de `--force` queda desaconsejado salvo análisis explícito; los cambios se aplican en rama y se validan con build y tests antes del merge. |
| **Efectividad** | El plan concluye con: (1) estado actual documentado, (2) remediación aplicada y verificada con build y tests, (3) automatización (Dependabot) para evitar regresión, (4) proceso repetible documentado en este mismo archivo. |

---

## 5. Referencias técnicas

- **npm audit:** [Documentación oficial](https://docs.npmjs.com/cli/v10/commands/npm-audit) (comandos, severidades, opciones `--fix` y `--force`).
- **npm outdated:** [Documentación oficial](https://docs.npmjs.com/cli/v10/commands/npm-outdated) (detección de paquetes desactualizados).
- **Dependabot:** [Configuración para npm](https://docs.github.com/en/code-security/dependabot/dependabot-version-updates/configuration-options-for-the-dependabot.yml-file) (GitHub Docs).
- **Lockfile:** Importancia de commitear `package-lock.json` para resultados reproducibles y auditorías consistentes entre entornos.

---

## Registro de auditoría (plantilla)

| Fecha | Responsable | Resultado `npm audit` | Acciones realizadas |
|-------|-------------|------------------------|---------------------|
| 2025-03-08 | Ejecución A1 | 0 critical, 0 high (post-remediación) | Baseline en `docs/audit-baseline.json`; 1 high (hono) corregido con `npm audit fix`; Dependabot configurado en `.github/dependabot.yml`. |
| _YYYY-MM-DD_ | _Nombre_ | _X critical, Y high, …_ | _Resumen breve_ |

---

## 6. Lista de verificación: ejecución exitosa de A1

Use esta lista para verificar que la ejecución del plan A1 fue exitosa. Marque cada ítem tras comprobarlo.

### Fase 1 — Auditoría

- [ ] **1.1** Se ejecutó `npm audit` (sin `--fix`) y la salida se revisó o documentó.
- [ ] **1.2** Existe el archivo `docs/audit-baseline.json` generado con `npm audit --json` (baseline de trazabilidad).
- [ ] **1.3** Se ejecutó `npm outdated` y se identificaron paquetes obsoletos (si los hubo).

### Fase 2 — Análisis de remediación

- [ ] **2.1** Para cada vulnerabilidad critical/high se definió una acción (audit fix, actualización manual o aceptación de riesgo documentada).
- [ ] **2.2** No quedan vulnerabilidades **critical** o **high** sin plan de remediación aplicado.

### Fase 3 — Aplicación de correcciones

- [ ] **3.1** Se aplicó `npm audit fix` (sin `--force` salvo justificación).
- [ ] **3.2** `npm audit` final muestra **0 vulnerabilidades** critical y high (o excepciones documentadas en este doc).
- [ ] **3.3** `npm run build` finaliza con código de salida 0.
- [ ] **3.4** Si aplica: tests definidos en el proyecto (p. ej. `npm run check:apis`) se ejecutan con el entorno listo (p. ej. worker local detenido) y pasan.
- [ ] **3.5** Cambios en `package.json` y `package-lock.json` están commiteados (rama `fix/deps-a1` o equivalente recomendada).

### Fase 4 — Automatización Dependabot

- [ ] **4.1** Existe el archivo `.github/dependabot.yml` con ecosistema `npm`, directorio `/` y frecuencia (p. ej. `weekly`).
- [ ] **4.2** En GitHub: Dependabot alerts habilitados (Settings > Security > Dependabot alerts).
- [ ] **4.3** Política de revisión definida: merge de PRs de Dependabot solo con CI en verde y revisión humana.

### Fase 5 — Cierre y recurrencia

- [ ] **5.1** Este documento incluye la **fecha de última auditoría** y el **resultado de `npm audit`** en la tabla de registro (sección anterior).
- [ ] **5.2** Cadencia de revisión definida (p. ej. cada sprint o antes de cada release) y checklist (`npm audit`, `npm outdated`, Dependabot) incorporado al flujo de trabajo.

### Resumen de criterios de éxito

| Criterio | Verificado |
|----------|------------|
| Cero vulnerabilidades critical/high no aceptadas | [ ] Sí |
| Build y pruebas en verde (o documentada limitación, p. ej. `check:apis` requiere worker detenido) | [ ] Sí |
| Dependabot configurado (`.github/dependabot.yml`) | [ ] Sí |
| Proceso documentado y repetible en este documento | [ ] Sí |

Si todos los ítem aplicables están marcados y los criterios de éxito cumplidos, la ejecución de A1 se considera **exitosa**.
