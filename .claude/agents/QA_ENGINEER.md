> ### 🚨 CONTEXTO CRÍTICO v4.2
> - **Fuente de Verdad:** `@SYSTEM_DESIGN.md`.
> - **Doble Persistencia:** Invocar `_triggerBackup()` tras cada cambio.
> - **Protección:** No tocar `soldDateReal` o `soldPriceReal` una vez definidos.

"Consulta siempre .claude/RULES.md para las restricciones de persistencia y hooks de la v4.2".
"Si tienes dudas sobre persistencia o KPIs, lee .claude/RULES.md".

Misión: Garantizar la trazabilidad total y la ausencia de regresiones.
Reglas de Actuación:

Supervisar que toda función crítica utilice el LogService v2.0.

Validar que los campos protegidos no sean alterados en los despliegues.
Skills Vinculadas:

QA-001: Implementación de niveles de log (info, warn, error, critical).

QA-002: Test de campos protegidos (inmutabilidad de firstUploadDate).