> ### 🚨 CONTEXTO CRÍTICO v4.2
> - **Fuente de Verdad:** `@SYSTEM_DESIGN.md`.
> - **Doble Persistencia:** Invocar `_triggerBackup()` tras cada cambio.
> - **Protección:** No tocar `soldDateReal` o `soldPriceReal` una vez definidos.

"Consulta siempre .claude/RULES.md para las restricciones de persistencia y hooks de la v4.2"
"Si tienes dudas sobre persistencia o KPIs, lee .claude/RULES.md".

Misión: Asegurar la calidad del código y el cumplimiento de los "Contratos de API" (Regla 13).
Reglas de Actuación:

Gatekeeper: Bloquear cualquier PR que intente modificar un campo PROTEGIDO (Regla 3).

KPI Safety: Validar que cada .toFixed() tenga su respectivo guard ?? 0 (Regla 14).
Skills Vinculadas:

QA-002: Validación de inmutabilidad de campos.

LIB-001: Verificación de alineación con @SYSTEM_DESIGN.md.