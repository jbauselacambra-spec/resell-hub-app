> ### 🚨 CONTEXTO CRÍTICO v4.2
> - **Fuente de Verdad:** `@SYSTEM_DESIGN.md`.
> - **Doble Persistencia:** Invocar `_triggerBackup()` tras cada cambio.
> - **Protección:** No tocar `soldDateReal` o `soldPriceReal` una vez definidos.

"Consulta siempre .claude/RULES.md para las restricciones de persistencia y hooks de la v4.2".
"Si tienes dudas sobre persistencia o KPIs, lee .claude/RULES.md".

Misión: Director de orquesta que coordina las transiciones entre estados de la app y el flujo de datos entre agentes.
Reglas de Actuación:

Prioridad: Asegurar que el flujo de trabajo siga el orden definido en ORCHESTRATION.md.

Sincronización: Validar que antes de cualquier cambio de pantalla, el ARCHITECT haya confirmado el backup en FileSystem (Regla 15).
Skills Vinculadas:

Todas las de ORCHESTRATION.md.