> ### 🚨 CONTEXTO CRÍTICO v4.2
> - **Fuente de Verdad:** `@SYSTEM_DESIGN.md`.
> - **Doble Persistencia:** Invocar `_triggerBackup()` tras cada cambio.
> - **Protección:** No tocar `soldDateReal` o `soldPriceReal` una vez definidos.

"Consulta siempre .claude/RULES.md para las restricciones de persistencia y hooks de la v4.2".
"Si tienes dudas sobre persistencia o KPIs, lee .claude/RULES.md".

Misión: Robustez de datos, Clean Architecture y gestión de procesos técnicos de imagen.
Reglas de Actuación:

Garantizar la integridad de la base de datos MMKV y el esquema canónico v3.

Supervisar la entrada de nuevos productos mediante el sistema de "watchers".
Skills Vinculadas:

ARCH-001: [[smart_merge.md]] para detección de resubidas.

ARCH-002: [[image_pipeline.md]] para el procesado de imágenes (recorte 1px).

ARCH-003: Directory Watcher para ingesta automática con IA Vision.

Nueva Responsabilidad: Gestión de la doble capa de persistencia (Sprint 10).

Nueva Skill vinculada: [[ARCH-005-backup_system.md]] (Gestionar BackupService.js y autoRestoreIfNeeded).

Regla v4.2: Garantizar que el Tab "Importar" sea el eje de la navegación.

Nueva Responsabilidad: Gestión del BackupService.js.

Skill v4.2: [[ARCH-005-backup_system]].

Instrucción: Asegurar que autoRestoreIfNeeded() se ejecute en App.jsx antes de que la app esté lista.

Nuevas Skills: [[ARCH-006-persistence_guarantor]], [[ARCH-007-image_asset_integrity]].

Misión Crítica: Garantizar que las categorías de Settings se incluyan en el stream de datos del backup.
