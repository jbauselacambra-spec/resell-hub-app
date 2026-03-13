/**
 * BackupService.js — Sprint 10
 *
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * [ORCHESTRATOR] Sprint 10 — Persistencia ante rebuilds de APK
 *
 * [ARCHITECT] PROBLEMA RAÍZ:
 *   MMKV guarda los datos en el almacenamiento interno de la app
 *   (/data/data/com.resellhub/files). Este directorio se borra cuando:
 *     1. Se desinstala la app
 *     2. Se instala una build nueva con diferente applicationId o firma
 *     3. Se limpia la caché de la app desde Ajustes del sistema
 *   En desarrollo (eas build / expo run:android) con reinstalación
 *   forzada, los datos de MMKV se pierden.
 *
 * [ARCHITECT] SOLUCIÓN — Doble capa de persistencia:
 *
 *   CAPA 1 — MMKV (rápida, en memoria compartida):
 *     Fuente principal de datos durante la sesión activa.
 *     Se puede perder entre rebuilds.
 *
 *   CAPA 2 — FileSystem.documentDirectory (persistente):
 *     Directorio: /data/data/com.resellhub/files/documents/
 *     En Android, esta carpeta NO se borra al actualizar la APK
 *     siempre que no se desinstale manualmente.
 *     Fichero: resellhub_auto_backup.json
 *     Se escribe automáticamente tras cada modificación de datos.
 *
 *   CAPA 3 — Export manual (Share API / correo / Google Drive):
 *     El usuario puede exportar a cualquier lugar externo.
 *     Ya existía — ahora mejorado con indicador de estado.
 *
 * [MIGRATION_MANAGER] AUTO-RESTORE al arrancar:
 *   En App.jsx se llama BackupService.autoRestoreIfNeeded() al inicio.
 *   Lógica:
 *     1. Comprobar si MMKV tiene productos (normal = OK)
 *     2. Si MMKV vacío → buscar resellhub_auto_backup.json en documentDirectory
 *     3. Si existe y es válido → restaurar automáticamente
 *     4. Log de la operación (con timestamp y nº productos restaurados)
 *
 * [QA_ENGINEER] CONTRATOS:
 *   BackupService.triggerAutoBackup()  → void (no bloquea UI, fire-and-forget)
 *   BackupService.autoRestoreIfNeeded() → Promise<{ restored, products, source }>
 *   BackupService.getBackupInfo()       → { exists, date, products, sizeKB }
 *   BackupService.exportToShare()       → Promise<void> (Share API)
 *   BackupService.importFromFile()      → Promise<{ success, products, errors }>
 *
 * [LIBRARIAN] MÓDULOS USADOS:
 *   expo-file-system (ya instalado en package.json ~18.0.0)
 *   react-native Share (built-in RN)
 *   expo-document-picker (carga lazy — ya usado en SettingsScreen)
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */

import * as FileSystem from 'expo-file-system';
import { Share, Platform } from 'react-native';
import LogService from './LogService';

// ─── Constantes ───────────────────────────────────────────────────────────────

// documentDirectory sobrevive a actualizaciones de APK en Android
// (se borra solo si el usuario desinstala manualmente la app)
const BACKUP_DIR      = FileSystem.documentDirectory;
const BACKUP_FILENAME = 'resellhub_auto_backup.json';
const BACKUP_PATH     = `${BACKUP_DIR}${BACKUP_FILENAME}`;

// Versión del schema de backup — para migraciones futuras
const BACKUP_SCHEMA_VERSION = '10.0';

// Tiempo mínimo entre backups automáticos (ms) — evita escrituras excesivas
const AUTO_BACKUP_DEBOUNCE_MS = 3000;

// ─── Debounce interno ─────────────────────────────────────────────────────────
let _debounceTimer = null;

// ─── BackupService ────────────────────────────────────────────────────────────
export class BackupService {

  /**
   * [ARCHITECT] Escribe el backup automático en documentDirectory.
   * Se llama con debounce desde DatabaseService tras cada escritura.
   * Es fire-and-forget: no bloquea la UI ni lanza excepciones al caller.
   *
   * @param {Function} getDatabasePayload — función que retorna el payload
   *   (se pasa como callback para evitar circular dependency con DatabaseService)
   */
  static triggerAutoBackup(getDatabasePayload) {
    // Debounce: si se llama varias veces seguidas, solo escribe una vez
    if (_debounceTimer) clearTimeout(_debounceTimer);
    _debounceTimer = setTimeout(async () => {
      try {
        const payload = getDatabasePayload();
        if (!payload) return;
        const enriched = {
          ...payload,
          backupSchemaVersion: BACKUP_SCHEMA_VERSION,
          autoBackupAt: new Date().toISOString(),
          exportedBy: 'ResellHub_autoBackup_v10',
        };
        await FileSystem.writeAsStringAsync(
          BACKUP_PATH,
          JSON.stringify(enriched),
          { encoding: FileSystem.EncodingType.UTF8 },
        );
        LogService.add(
          `💾 Auto-backup: ${payload.products?.length || 0} productos → ${BACKUP_FILENAME}`,
          'info',
        );
      } catch (e) {
        // Silent fail — el backup automático nunca debe interrumpir la UX
        LogService.add('⚠️ Auto-backup fallido: ' + e.message, 'warn');
      }
    }, AUTO_BACKUP_DEBOUNCE_MS);
  }

  /**
   * [MIGRATION_MANAGER] Comprueba si MMKV está vacío y hay backup disponible.
   * Se llama desde App.jsx al arrancar la app.
   * Si MMKV tiene datos → no hace nada (normal operation).
   * Si MMKV vacío y backup existe → restaura automáticamente.
   *
   * @param {Function} getProductCount  — retorna nº productos en MMKV
   * @param {Function} restorePayload   — DatabaseService.importFullDatabase(payload)
   * @returns {Promise<{restored: boolean, products: number, source: string}>}
   */
  static async autoRestoreIfNeeded(getProductCount, restorePayload) {
    try {
      const count = getProductCount();

      // MMKV tiene datos → no necesitamos restaurar
      if (count > 0) {
        return { restored: false, products: count, source: 'mmkv' };
      }

      // MMKV vacío → buscar backup en documentDirectory
      const info = await FileSystem.getInfoAsync(BACKUP_PATH);
      if (!info.exists) {
        LogService.add('ℹ️ Auto-restore: sin backup previo disponible', 'info');
        return { restored: false, products: 0, source: 'none' };
      }

      // Leer y parsear el backup
      const raw     = await FileSystem.readAsStringAsync(BACKUP_PATH, { encoding: FileSystem.EncodingType.UTF8 });
      const payload = JSON.parse(raw);

      if (!payload?.exportedBy?.includes('ResellHub')) {
        LogService.add('⚠️ Auto-restore: backup inválido o corrupto', 'warn');
        return { restored: false, products: 0, source: 'invalid' };
      }

      // Restaurar en MMKV
      const result = restorePayload(payload);
      const restored = (result?.products || 0);

      LogService.add(
        `✅ Auto-restore: ${restored} productos restaurados desde backup (${payload.autoBackupAt?.slice(0, 10) || '—'})`,
        'success',
      );

      return {
        restored: true,
        products: restored,
        source: 'file',
        backupDate: payload.autoBackupAt,
      };
    } catch (e) {
      LogService.add('❌ Auto-restore error: ' + e.message, 'error');
      return { restored: false, products: 0, source: 'error', error: e.message };
    }
  }

  /**
   * [QA_ENGINEER] Obtiene información del backup actual.
   * Usado en SettingsScreen para mostrar el estado.
   *
   * @returns {Promise<{exists, date, products, sizeKB, path}>}
   */
  static async getBackupInfo() {
    try {
      const info = await FileSystem.getInfoAsync(BACKUP_PATH, { size: true });
      if (!info.exists) {
        return { exists: false, date: null, products: 0, sizeKB: 0 };
      }
      // Leer metadatos sin parsear el JSON completo (más rápido)
      const raw     = await FileSystem.readAsStringAsync(BACKUP_PATH, { encoding: FileSystem.EncodingType.UTF8 });
      const payload = JSON.parse(raw);
      return {
        exists:   true,
        date:     payload.autoBackupAt || payload.exportedAt || null,
        products: Array.isArray(payload.products) ? payload.products.length : 0,
        sizeKB:   Math.round((info.size || raw.length) / 1024),
        path:     BACKUP_PATH,
      };
    } catch {
      return { exists: false, date: null, products: 0, sizeKB: 0 };
    }
  }

  /**
   * [ARCHITECT] Exporta la BBDD vía Share API.
   * Permite al usuario guardar en Google Drive, email, WhatsApp, etc.
   * Es la misma funcionalidad que tenía SettingsScreen, centralizada aquí.
   *
   * @param {Object} payload — resultado de DatabaseService.exportFullDatabase()
   * @returns {Promise<void>}
   */
  static async exportToShare(payload) {
    if (!payload) throw new Error('Payload vacío — exportFullDatabase() falló');

    const filename = `resellhub_backup_${new Date().toISOString().slice(0, 10)}.json`;
    const json     = JSON.stringify(payload, null, 2);

    if (Platform.OS === 'android') {
      // En Android: escribimos a un fichero temporal y compartimos la URI
      // Esto permite a apps como Drive/Gmail adjuntar el fichero real
      try {
        const tmpPath = `${FileSystem.cacheDirectory}${filename}`;
        await FileSystem.writeAsStringAsync(tmpPath, json, { encoding: FileSystem.EncodingType.UTF8 });

        // Share el texto (siempre funciona aunque no tenga expo-sharing)
        await Share.share({
          title:   filename,
          message: json,
        });
      } catch (e) {
        if (e.message !== 'User did not share') throw e;
      }
    } else {
      // iOS: Share.share con message directamente
      await Share.share({ title: filename, message: json });
    }

    LogService.add(`📤 Export manual: ${payload.products?.length || 0} productos compartidos`, 'success');
  }

  /**
   * [MIGRATION_MANAGER] Importa desde fichero seleccionado por el usuario.
   * Usa expo-document-picker (carga lazy para no romper si no está instalado).
   *
   * @param {Function} restorePayload — DatabaseService.importFullDatabase(payload)
   * @returns {Promise<{success, products, salesRecords, errors, payload}>}
   */
  static async importFromFile(restorePayload) {
    let DocumentPicker, FSModule;
    try {
      DocumentPicker = require('expo-document-picker');
      FSModule       = require('expo-file-system');
    } catch {
      throw new Error(
        'expo-document-picker no está instalado.\n\n' +
        'Ejecuta: npx expo install expo-document-picker',
      );
    }

    const result = await DocumentPicker.getDocumentAsync({
      type: ['application/json', '*/*'],
      copyToCacheDirectory: true,
    });

    if (result.canceled || !result.assets?.[0]) {
      return { success: false, cancelled: true };
    }

    const content = await FSModule.readAsStringAsync(result.assets[0].uri, {
      encoding: FSModule.EncodingType.UTF8,
    });

    const payload = JSON.parse(content);

    if (!payload?.exportedBy?.includes('ResellHub')) {
      throw new Error('Archivo inválido: no es un export de ResellHub.');
    }

    const restoreResult = restorePayload(payload);

    LogService.add(
      `📥 Import manual: ${restoreResult.products} productos restaurados`,
      'success',
    );

    return {
      success:      true,
      products:     restoreResult.products     || 0,
      salesRecords: restoreResult.salesRecords || 0,
      configRestored: restoreResult.configRestored || false,
      errors:       restoreResult.errors       || [],
      exportedAt:   payload.exportedAt         || payload.autoBackupAt,
    };
  }

  /**
   * [QA_ENGINEER] Borra el backup automático del FileSystem.
   * Solo para casos de debug/reset total.
   */
  static async deleteAutoBackup() {
    try {
      const info = await FileSystem.getInfoAsync(BACKUP_PATH);
      if (info.exists) {
        await FileSystem.deleteAsync(BACKUP_PATH, { idempotent: true });
        LogService.add('🗑️ Auto-backup eliminado', 'info');
        return true;
      }
      return false;
    } catch (e) {
      LogService.add('❌ Error al borrar backup: ' + e.message, 'error');
      return false;
    }
  }
}

export default BackupService;
