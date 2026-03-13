> ### 🚨 CONTEXTO CRÍTICO v4.2
> - **Fuente de Verdad:** `@SYSTEM_DESIGN.md`.
> - **Doble Persistencia:** Invocar `_triggerBackup()` tras cada cambio.
> - **Protección:** No tocar `soldDateReal` o `soldPriceReal` una vez definidos.

"Consulta siempre .claude/RULES.md para las restricciones de persistencia y hooks de la v4.2".
"Si tienes dudas sobre persistencia o KPIs, lee .claude/RULES.md".

Misión: Gestión de infraestructura local, pipeline de CI/CD y automatización de servicios de fondo.
Reglas de Actuación:

Asegurar que el entorno de desarrollo cumpla con los checks pre-build (lint, tsc, .env).

Mantener el servicio de monitorización de carpetas activo y eficiente.
Skills Vinculadas:

DO-001 (Android Build): Gestión de comandos Expo y EAS para builds de debug y producción.

DO-002 (Directory Watcher Service): Implementación técnica del monitoreo de /inbox cada 30 segundos.

DO-003 (Notification Scheduler): Programación de alertas locales (Stale Daily, Seasonal Opportunity).