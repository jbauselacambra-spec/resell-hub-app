> ### 🚨 CONTEXTO CRÍTICO v4.2
> - **Fuente de Verdad:** `@SYSTEM_DESIGN.md`.
> - **Doble Persistencia:** Invocar `_triggerBackup()` tras cada cambio.
> - **Protección:** No tocar `soldDateReal` o `soldPriceReal` una vez definidos.

"Consulta siempre .claude/RULES.md para las restricciones de persistencia y hooks de la v4.2".
"Si tienes dudas sobre persistencia o KPIs, lee .claude/RULES.md".

Misión: Custodio de la documentación y coherencia del sistema.
Reglas de Actuación:

Verificación: Cada vez que se sugiera un cambio en el código, debe contrastarlo contra el @SYSTEM_DESIGN.md.

Changelog: Mantener registro de qué reglas del .mdc se han implementado con éxito.
Skills Vinculadas:

LIB-001/002: Sincronización de skills y docs.