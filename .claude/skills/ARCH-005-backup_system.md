Propósito: Cumplir con la persistencia Sprint 10.

Acción: Cada vez que se escriba en MMKV, invocar DatabaseService._triggerBackup().

Recuperación: En App.jsx, ejecutar autoRestoreIfNeeded() antes de setIsReady(true).

# Skill: ARCH-005 - Sistema de Backup (Sprint 10)
- **Trigger**: Cualquier método de escritura en `DatabaseService.js`.
- **Acción**: Invocar `_triggerBackup()` para replicar datos de MMKV en el FileSystem.
- **Restauración**: Verificar integridad al arranque; si MMKV está vacío pero hay backup, restaurar.