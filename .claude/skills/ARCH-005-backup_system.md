Propósito: Cumplir con la persistencia Sprint 10.

Acción: Cada vez que se escriba en MMKV, invocar DatabaseService._triggerBackup().

Recuperación: En App.jsx, ejecutar autoRestoreIfNeeded() antes de setIsReady(true).

# Skill: ARCH-005 - Sistema de Backup (Sprint 10)
- **Trigger**: Cualquier método de escritura en `DatabaseService.js`.
- **Acción**: Invocar `_triggerBackup()` para replicar datos de MMKV en el FileSystem.
- **Restauración**: Verificar integridad al arranque; si MMKV está vacío pero hay backup, restaurar.

# Skill: ARCH-005 - Sistema de Backup (Corrección v4.2.1)

**Problema Detectado:** El log indica éxito pero el fichero no es persistente o el path es inválido en Android.

**Lógica de Corrección:**
1. **Path Dinámico:** Usar `FileSystem.documentDirectory + 'resellhub_backup.json'` para garantizar persistencia en el almacenamiento privado de la app.
2. **Validación Post-Escritura:** Antes de emitir el log de éxito, ejecutar `FileSystem.getInfoAsync()` para confirmar el tamaño del fichero > 0.
3. **Persistencia de Categorías:** Incluir explícitamente el objeto `categories` del storage en el JSON de exportación, no solo el array de productos.
4. **Permisos:** En Android, asegurar que la exportación manual use `Sharing.shareAsync` sobre el path temporal creado.