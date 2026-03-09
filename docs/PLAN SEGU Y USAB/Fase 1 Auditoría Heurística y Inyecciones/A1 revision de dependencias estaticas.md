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

## 3. Implementación en Venezuela LIVE

Este apartado describe **cómo quedó implementado A1 en este repositorio**, más que un checklist de tareas.

- Se ejecutó una **auditoría inicial** con `npm audit` y `npm outdated` para construir la baseline de riesgos sobre el `package.json` actual.
- Se aplicaron correcciones usando `npm audit fix` y, cuando fue necesario, actualizaciones manuales de dependencias, priorizando vulnerabilidades **critical** y **high**.
- Tras la remediación, se volvió a ejecutar `npm audit` hasta dejar el estado actual con **0 vulnerabilidades critical/high** no aceptadas. El resultado se registró en la tabla de auditoría (sección 5).
- Para evitar regresión, se configuró **Dependabot para npm** (archivo `.github/dependabot.yml` apuntando a la raíz `/` con frecuencia al menos `weekly`), de forma que:
  - Las nuevas vulnerabilidades y versiones obsoletas generan PRs automáticos.
  - La revisión humana + CI se encargan de decidir qué actualizar y cuándo.

En la práctica, A1 se traduce en un **proceso recurrente**, no en una acción puntual: cada vez que se hace un ciclo de mantenimiento o antes de un release importante, se reejecutan los comandos de auditoría y se actualiza el registro.

## 4. Cómo repetir la auditoría en este proyecto

Para volver a evaluar el estado de dependencias en Venezuela LIVE, basta con:

1. Ejecutar en la raíz del proyecto:

   ```bash
   npm audit
   npm outdated
   ```

2. Revisar el informe de `npm audit`:
   - Si aparecen vulnerabilidades **critical/high**, aplicar `npm audit fix` y/o actualizar manualmente las dependencias afectadas.
   - Volver a ejecutar `npm audit` hasta que no queden vulnerabilidades critical/high o queden únicamente las que se hayan decidido aceptar explícitamente.

3. Completar el **registro de auditoría** en este archivo (sección 5) con la fecha, responsable, resultado de `npm audit` y un resumen de acciones (por ejemplo: “actualizado hono a X.Y.Z; 0 critical/high posteriores al fix”).

4. Ejecutar al menos:

   ```bash
   npm run build
   ```

   para asegurarse de que la actualización de dependencias no rompe el build.

GitHub y Dependabot se encargan de mantener una vigilancia continua; este flujo solo documenta cómo se ejecuta localmente la misma lógica de A1 cuando se quiere forzar un ciclo de revisión manual.

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
