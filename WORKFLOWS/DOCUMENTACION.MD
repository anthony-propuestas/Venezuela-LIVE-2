# Workflow: Actualizar Documentación

Ejecutar este workflow **después de que los tests pasen** y **antes de comparar código vs documentación**.

Orden completo: CHANGE → TEST → **DOCUMENTACION** → COMPARACION-CODIGO-VS-DOCUMENTACION

---

## Cuándo actualizar qué

| Tipo de cambio | Archivo a actualizar |
|----------------|----------------------|
| Endpoint nuevo o modificado | `docs/API.md` |
| Variable de entorno o config | `docs/CONFIGURATION.md` |
| Schema de base de datos | `docs/DATABASE.md` |
| Módulo nuevo, dependencia, flujo | `docs/ARCHITECTURE.md` |
| Regla de autenticación/autorización | `docs/SECURITY.md` |
| Deploy, CI, Wrangler, Workers | `docs/DEPLOYMENT.md` |
| Estrategia de tests o herramientas | `docs/TESTING.md` |

Si el cambio no encaja en ninguna categoría, no hay nada que documentar.

---

## Cómo escribir

- Describe el **estado actual**, no la historia. Nunca "se añadió" o "antes era".
- Una línea por hecho. Sin párrafos largos.
- Si un endpoint cambió su contrato: actualiza método, ruta, parámetros, respuesta.
- Si eliminaste algo: bórralo del doc también.

---

## Checklist rápido

```
[ ] ¿Cambié algún endpoint? → docs/API.md
[ ] ¿Cambié env vars o configuración? → docs/CONFIGURATION.md
[ ] ¿Cambié el esquema de DB? → docs/DATABASE.md
[ ] ¿Cambié arquitectura o estructura de módulos? → docs/ARCHITECTURE.md
[ ] ¿Cambié reglas de auth/permisos? → docs/SECURITY.md
[ ] ¿Cambié algo del proceso de deploy? → docs/DEPLOYMENT.md
[ ] ¿Cambié estrategia o herramientas de testing? → docs/TESTING.md
```
