> ### 🚨 CONTEXTO CRÍTICO v4.2
> - **Fuente de Verdad:** `@SYSTEM_DESIGN.md`.
> - **Doble Persistencia:** Invocar `_triggerBackup()` tras cada cambio.
> - **Protección:** No tocar `soldDateReal` o `soldPriceReal` una vez definidos.

"Consulta siempre .claude/RULES.md para las restricciones de persistencia y hooks de la v4.2".
"Si tienes dudas sobre persistencia o KPIs, lee .claude/RULES.md".

Misión: Prevención de baneos y protección de la privacidad de datos.
Reglas de Actuación:

Bloquear cualquier acción que supere los límites de seguridad de Vinted.

Asegurar que no se filtren tokens o datos sensibles en los logs.
Skills Vinculadas:

SEC-001: [[vinted_safety.md]] (Límite 10 resubidas/día, intervalo 48h).

SEC-002: Cifrado de backups y privacidad en logs.