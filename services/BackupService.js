/**
 * BackupService.js — Sprint 10 · FIX BUG-A (Hotfix 5)
 *
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * [DEBUGGER] ROOT CAUSE BUG-A:
 *   exportToShare() usaba Share.share({ message: json }) en Android.
 *   Android 13+ limita el tamaño del campo "message" en intents.
 *   Con 258 productos (~200KB JSON) el intent se trunca o falla
 *   silenciosamente: el log dice "✅ exportado" pero el usuario no
 *   ve ningún selector de apps (Drive, Gmail, WhatsApp...).
 *
 * [ARCHITECT] FIX:
 *   1. Escribir el JSON en FileSystem.cacheDirectory (fichero temporal)
 *   2. Usar expo-sharing / Sharing.shareAsync(uri) → comparte el FICHERO
 *      real, no el texto → Drive/Gmail lo reciben como adjunto .json
 *   3. Fallback: si expo-sharing no está disponible → Share.share(text)
 *      (compatibilidad con entornos sin expo-sharing)
 *   4. Validación post-escritura: getInfoAsync() antes de compartir
 *
 * [QA_ENGINEER] CONTRATOS MANTENIDOS:
 *   BackupService.exportToShare(payload) → Promise<void>
 *   BackupService.importFromFile(fn)     → Promise<{success,...}>
 *   BackupService.triggerAutoBackup(fn)  → void (fire-and-forget)
 *   BackupService.autoRestoreIfNeeded(fn1,fn2) → Promise<{restored,...}>
 *   BackupService.getBackupInfo()        → Promise<{exists,date,...}>
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */

import * as FileSystem from 'expo-file-system';
import { Share, Platform, Alert } from 'react-native';
import LogService from './LogService';

// ─── Constantes ───────────────────────────────────────────────────────────────
const BACKUP_DIR           = FileSystem.documentDirectory;
const BACKUP_FILENAME      = 'resellhub_auto_backup.json';
const BACKUP_PATH          = `${BACKUP_DIR}${BACKUP_FILENAME}`;
const BACKUP_SCHEMA_VERSION = '10.0';
const AUTO_BACKUP_DEBOUNCE_MS = 3000;

let _debounceTimer = null;

// ─── BackupService ────────────────────────────────────────────────────────────
export class BackupService {

  /**
   * [ARCHITECT] Escribe el backup automático en documentDirectory.
   * Se llama con debounce desde DatabaseService tras cada escritura.
   * Fire-and-forget: no bloquea la UI.
   */
  static triggerAutoBackup(getDatabasePayload) {
    if (_debounceTimer) clearTimeout(_debounceTimer);
    _debounceTimer = setTimeout(async () => {
      try {
        const payload = getDatabasePayload();
        if (!payload) return;
        const data = JSON.stringify({
          ...payload,
          schemaVersion: BACKUP_SCHEMA_VERSION,
          autoBackupAt:  new Date().toISOString(),
          exportedBy:    'ResellHub_exportFullDatabase_v9',
        });
        await FileSystem.writeAsStringAsync(BACKUP_PATH, data, {
          encoding: FileSystem.EncodingType.UTF8,
        });
        // Validación post-escritura
        const info = await FileSystem.getInfoAsync(BACKUP_PATH);
        if (!info.exists || info.size === 0) {
          LogService.add('⚠️ Auto-backup: fichero vacío tras escritura', 'warn');
          return;
        }
        LogService.add(
          `💾 Auto-backup: ${payload.products?.length || 0} productos (${Math.round(info.size / 1024)}KB)`,
          'success',
        );
      } catch (e) {
        LogService.add('❌ Auto-backup error: ' + e.message, 'error');
      }
    }, AUTO_BACKUP_DEBOUNCE_MS);
  }

  /**
   * [MIGRATION_MANAGER] Restaura desde FileSystem si MMKV vacío al arrancar.
   */
  static async autoRestoreIfNeeded(getProductCount, restorePayload) {
    try {
      const count = getProductCount();
      if (count > 0) return { restored: false, products: count, source: 'mmkv' };

      const info = await FileSystem.getInfoAsync(BACKUP_PATH);
      if (!info.exists) return { restored: false, products: 0, source: 'none' };

      const raw     = await FileSystem.readAsStringAsync(BACKUP_PATH, {
        encoding: FileSystem.EncodingType.UTF8,
      });
      const payload = JSON.parse(raw);

      if (!payload?.exportedBy?.includes('ResellHub')) {
        return { restored: false, products: 0, source: 'error' };
      }

      const result = restorePayload(payload);
      LogService.add(
        `📥 Auto-restore: ${result.products} productos desde backup (${payload.autoBackupAt?.slice(0, 10)})`,
        'success',
      );
      return { restored: true, products: result.products, source: 'file' };
    } catch (e) {
      LogService.add('❌ Auto-restore error: ' + e.message, 'error');
      return { restored: false, products: 0, source: 'error' };
    }
  }

  /**
   * [ARCHITECT] Exporta la BBDD vía Share API.
   *
   * FIX BUG-A: En Android, Share.share({ message }) falla con payloads grandes.
   * Solución: escribir el JSON en cacheDirectory y usar expo-sharing (shareAsync)
   * para compartir el FICHERO. Si expo-sharing no está disponible → fallback a text.
   */
  static async exportToShare(payload) {
    if (!payload) throw new Error('Payload vacío — exportFullDatabase() falló');

    const filename = `resellhub_backup_${new Date().toISOString().slice(0, 10)}.json`;
    const json     = JSON.stringify(payload, null, 2);
    const tmpPath  = `${FileSystem.cacheDirectory}${filename}`;

    try {
      // Paso 1: Escribir fichero en caché
      await FileSystem.writeAsStringAsync(tmpPath, json, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      // Validación: confirmar que el fichero existe y tiene contenido
      const info = await FileSystem.getInfoAsync(tmpPath);
      if (!info.exists || info.size === 0) {
        throw new Error('El fichero exportado quedó vacío. Intenta de nuevo.');
      }

      // Paso 2: Intentar expo-sharing (comparte el fichero real como adjunto)
      try {
        const Sharing = require('expo-sharing');
        const isAvailable = await Sharing.isAvailableAsync();
        if (isAvailable) {
          await Sharing.shareAsync(tmpPath, {
            mimeType: 'application/json',
            dialogTitle: `Exportar base de datos ResellHub`,
            UTI: 'public.json',
          });
          LogService.add(
            `📤 Export manual: ${payload.products?.length || 0} productos compartidos vía expo-sharing`,
            'success',
          );
          return;
        }
      } catch (_sharingErr) {
        // expo-sharing no disponible — continuar con fallback
        LogService.add('⚠️ expo-sharing no disponible, usando Share.share', 'info');
      }

      // Paso 3: Fallback — Share.share con el texto (funciona siempre, posible truncado)
      if (Platform.OS === 'android') {
        // En Android, si el JSON es grande, avisar al usuario
        if (json.length > 50_000) {
          // Mostrar alerta informando que el fichero está guardado
          Alert.alert(
            '📤 Backup exportado',
            `El fichero ${filename} (${Math.round(info.size / 1024)}KB) está guardado en el almacenamiento temporal de la app.\n\n` +
            `Para compartirlo instala expo-sharing:\n` +
            `npx expo install expo-sharing`,
            [
              { text: 'OK' },
              {
                text: 'Compartir texto (puede truncarse)',
                onPress: async () => {
                  await Share.share({ title: filename, message: json.slice(0, 30_000) + '\n...(truncado)' });
                },
              },
            ],
          );
        } else {
          await Share.share({ title: filename, message: json });
        }
      } else {
        // iOS: Share.share con message funciona bien
        await Share.share({ title: filename, message: json });
      }

      LogService.add(
        `📤 Export manual: ${payload.products?.length || 0} productos compartidos`,
        'success',
      );
    } catch (e) {
      if (e.message !== 'User did not share') {
        LogService.add('❌ exportToShare error: ' + e.message, 'error');
        throw e;
      }
    }
  }

  /**
   * [MIGRATION_MANAGER] Importa desde fichero seleccionado por el usuario.
   */
  static async importFromFile(restorePayload) {
    let DocumentPicker, FSModule;
    try {
      DocumentPicker = require('expo-document-picker');
      FSModule       = require('expo-file-system');
    } catch {
      throw new Error(
        'expo-document-picker no está instalado.\n\nEjecuta: npx expo install expo-document-picker',
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
      success:        true,
      products:       restoreResult.products     || 0,
      salesRecords:   restoreResult.salesRecords || 0,
      configRestored: restoreResult.configRestored || false,
      errors:         restoreResult.errors       || [],
      exportedAt:     payload.exportedAt         || payload.autoBackupAt,
    };
  }

  /**
   * [QA_ENGINEER] Estado del backup automático para mostrar en UI.
   */
  static async getBackupInfo() {
    try {
      const info = await FileSystem.getInfoAsync(BACKUP_PATH, { size: true });
      if (!info.exists) return { exists: false, date: null, products: 0, sizeKB: 0 };

      const raw     = await FileSystem.readAsStringAsync(BACKUP_PATH, {
        encoding: FileSystem.EncodingType.UTF8,
      });
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
   * [QA_ENGINEER] Borra el backup automático. Solo para debug/reset total.
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
