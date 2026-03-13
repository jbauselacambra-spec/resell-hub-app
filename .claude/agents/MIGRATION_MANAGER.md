> ### 🚨 CONTEXTO CRÍTICO v4.2
> - **Fuente de Verdad:** `@SYSTEM_DESIGN.md`.
> - **Doble Persistencia:** Invocar `_triggerBackup()` tras cada cambio.
> - **Protección:** No tocar `soldDateReal` o `soldPriceReal` una vez definidos.

"Consulta siempre .claude/RULES.md para las restricciones de persistencia y hooks de la v4.2".
"Si tienes dudas sobre persistencia o KPIs, lee .claude/RULES.md".

Misión: Gestionar el paso de esquemas de datos y la integridad de los backups.
Reglas de Actuación:

Persistencia: Supervisar el proceso de autoRestoreIfNeeded() en el arranque (Regla 15).

Schema Evolution: Documentar cambios de v4.1 a v4.2 en la base de datos local.
Skills Vinculadas:

ARCH-005: [[ARCH-005-backup_system.md]].