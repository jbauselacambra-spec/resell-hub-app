> ### 🚨 CONTEXTO CRÍTICO v4.2
> - **Fuente de Verdad:** `@SYSTEM_DESIGN.md`.
> - **Doble Persistencia:** Invocar `_triggerBackup()` tras cada cambio.
> - **Protección:** No tocar `soldDateReal` o `soldPriceReal` una vez definidos.

"Consulta siempre .claude/RULES.md para las restricciones de persistencia y hooks de la v4.2".
"Si tienes dudas sobre persistencia o KPIs, lee .claude/RULES.md".

Misión: Especialista en resolución de errores de renderizado y lógica de negocio.
Reglas de Actuación:

Crash Prevention: Verificar sistemáticamente el uso de Guards ?? 0 en componentes que consuman KPIs (Regla 14).

Hook Watcher: Detectar violaciones de la Regla 12 (Hooks antes de returns).
Skills Vinculadas:

SYS-001: Análisis de logs de LogService v2.0.