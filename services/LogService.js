/**
 * LogService v2.0 — Sistema de logging detallado para depuración exhaustiva
 *
 * Niveles:    debug | info | success | warn | error | critical
 * Contextos:  IMPORT | DB | UI | NAV | CAT | NOTIF | SYSTEM
 * Máx logs:  200 (rotativos)
 */

import { MMKV } from 'react-native-mmkv';

const storage  = new MMKV();
const LOGS_KEY = 'app_logs_v2';
const MAX_LOGS = 200;

// Emojis por nivel
const LEVEL_META = {
  debug:    { emoji: '🔍', color: '#888888', console: 'log'   },
  info:     { emoji: 'ℹ️',  color: '#4EA8DE', console: 'info'  },
  success:  { emoji: '✅', color: '#00D9A3', console: 'log'   },
  warn:     { emoji: '⚠️',  color: '#FFB800', console: 'warn'  },
  error:    { emoji: '❌', color: '#E63946', console: 'error' },
  critical: { emoji: '🔥', color: '#FF0000', console: 'error' },
};

// Contextos del sistema
export const LOG_CTX = {
  IMPORT:  'IMPORT',   // Importación de JSON
  DB:      'DB',       // Operaciones de base de datos
  UI:      'UI',       // Interacciones de usuario
  NAV:     'NAV',      // Navegación entre pantallas
  CAT:     'CAT',      // Categorías y diccionario
  NOTIF:   'NOTIF',    // Notificaciones
  SYSTEM:  'SYSTEM',   // Arranque, MMKV, config
};

// ─── Helpers ────────────────────────────────────────────────────────────────

function getCallerInfo() {
  try {
    const err = new Error();
    const lines = (err.stack || '').split('\n');
    // Buscamos la primera línea que NO sea del propio LogService
    const caller = lines.find(l =>
      l.includes('.jsx') || (l.includes('.js') && !l.includes('LogService'))
    ) || '';
    // Extraer filename:line
    const match = caller.match(/([A-Za-z0-9_]+\.[jt]sx?)(?::(\d+))?/);
    return match ? `${match[1]}:${match[2] || '?'}` : 'unknown';
  } catch {
    return 'unknown';
  }
}

function buildEntry(level, message, context, extra) {
  const now  = new Date();
  const meta = LEVEL_META[level] || LEVEL_META.info;
  return {
    id:        `${now.getTime()}_${Math.random().toString(36).slice(2, 7)}`,
    ts:        now.toISOString(),
    tsDisplay: now.toLocaleTimeString('es-ES', { hour12: false }),
    date:      now.toLocaleDateString('es-ES'),
    level,
    context:   context || LOG_CTX.SYSTEM,
    message:   String(message),
    // Datos extra serializados
    extra:     extra ? safeStringify(extra) : null,
    // Archivo llamante (best-effort)
    caller:    getCallerInfo(),
    emoji:     meta.emoji,
    color:     meta.color,
  };
}

function safeStringify(obj) {
  try {
    return JSON.stringify(obj, null, 0);
  } catch {
    return String(obj);
  }
}

function persist(entry) {
  try {
    const raw  = storage.getString(LOGS_KEY);
    const logs = raw ? JSON.parse(raw) : [];
    logs.unshift(entry);
    if (logs.length > MAX_LOGS) logs.length = MAX_LOGS;
    storage.set(LOGS_KEY, JSON.stringify(logs));
  } catch (e) {
    console.error('[LogService] persist failed:', e);
  }
}

function toConsole(entry) {
  const line = `${entry.emoji} [${entry.context}] ${entry.message}${entry.caller ? ` — ${entry.caller}` : ''}${entry.extra ? `\n  ${entry.extra}` : ''}`;
  const method = LEVEL_META[entry.level]?.console || 'log';
  console[method](line);
}

// ─── LogService ──────────────────────────────────────────────────────────────

const LogService = {

  // ── API principal ──────────────────────────────────────────────────────────

  /**
   * Registra un mensaje de log.
   * @param {string} message  Mensaje legible
   * @param {string} level    debug|info|success|warn|error|critical
   * @param {string} context  Contexto del sistema (LOG_CTX.*)
   * @param {*}      extra    Datos adicionales (objeto, string, número)
   */
  log(message, level = 'info', context = LOG_CTX.SYSTEM, extra = null) {
    const entry = buildEntry(level, message, context, extra);
    persist(entry);
    toConsole(entry);
    return entry.id;
  },

  // ── Alias por nivel ────────────────────────────────────────────────────────

  debug   (msg, ctx, extra) { return this.log(msg, 'debug',    ctx, extra); },
  info    (msg, ctx, extra) { return this.log(msg, 'info',     ctx, extra); },
  success (msg, ctx, extra) { return this.log(msg, 'success',  ctx, extra); },
  warn    (msg, ctx, extra) { return this.log(msg, 'warn',     ctx, extra); },
  error   (msg, ctx, extra) { return this.log(msg, 'error',    ctx, extra); },
  critical(msg, ctx, extra) { return this.log(msg, 'critical', ctx, extra); },

  /** Compatibilidad con la API anterior: add(message, type) */
  add(message, type = 'info') {
    const level = type === 'error' ? 'error' : type === 'success' ? 'success' : type === 'warn' ? 'warn' : 'info';
    return this.log(message, level, LOG_CTX.SYSTEM);
  },

  /**
   * Registra un error con stack trace completo.
   * @param {string} message  Descripción del error
   * @param {Error}  err      Objeto Error
   * @param {string} context  Contexto del sistema
   */
  exception(message, err, context = LOG_CTX.SYSTEM) {
    const extra = {
      errorMessage: err?.message,
      stack: (err?.stack || '').split('\n').slice(0, 8).join(' | '),
    };
    return this.log(`${message}: ${err?.message || 'error desconocido'}`, 'error', context, extra);
  },

  /**
   * Registra el inicio y fin de una operación con duración.
   * Devuelve función `end(extra?)` para cerrar el span.
   */
  span(name, context = LOG_CTX.SYSTEM) {
    const start = Date.now();
    this.log(`▶ ${name}`, 'debug', context);
    return {
      end: (extra) => {
        const ms = Date.now() - start;
        LogService.log(`◀ ${name} [${ms}ms]`, 'debug', context, extra);
        return ms;
      },
      fail: (err) => {
        const ms = Date.now() - start;
        LogService.exception(`✗ ${name} [${ms}ms]`, err, context);
        return ms;
      },
    };
  },

  // ── Importación detallada ─────────────────────────────────────────────────

  /**
   * Registra el resultado completo de una importación de JSON.
   */
  logImportResult(result) {
    if (!result) return;
    const { success, count, created, updated, reposted, priceChanged, error } = result;
    if (!success) {
      this.error(`Import fallido: ${error}`, LOG_CTX.IMPORT, { error });
      return;
    }
    this.success(
      `Import OK — total:${count} | nuevos:${created} | actualizados:${updated} | resubidas:${reposted} | cambios precio:${priceChanged}`,
      LOG_CTX.IMPORT,
      result
    );
  },

  /**
   * Registra el merge de un producto individual durante la importación.
   */
  logProductMerge(id, title, changes) {
    if (!changes || Object.keys(changes).length === 0) return;
    this.debug(
      `Merge [${id}] "${title?.slice(0, 40)}"`,
      LOG_CTX.IMPORT,
      changes
    );
  },

  // ── Categorías ─────────────────────────────────────────────────────────────

  logCategoryDetection(text, result) {
    this.debug(
      `Detección cat: "${text?.slice(0, 30)}" → ${result?.category}${result?.subcategory ? '/' + result.subcategory : ''}`,
      LOG_CTX.CAT,
      result
    );
  },

  // ── DB ─────────────────────────────────────────────────────────────────────

  logDBWrite(operation, productId, fields) {
    this.debug(
      `DB.${operation}(${productId})`,
      LOG_CTX.DB,
      fields
    );
  },

  logDBRead(operation, count) {
    this.debug(`DB.${operation} → ${count} items`, LOG_CTX.DB);
  },

  // ── Consulta y filtrado ────────────────────────────────────────────────────

  getLogs(options = {}) {
    try {
      const raw  = storage.getString(LOGS_KEY);
      let logs   = raw ? JSON.parse(raw) : [];

      if (options.level) {
        const levels = Array.isArray(options.level) ? options.level : [options.level];
        logs = logs.filter(l => levels.includes(l.level));
      }
      if (options.context) {
        const ctxs = Array.isArray(options.context) ? options.context : [options.context];
        logs = logs.filter(l => ctxs.includes(l.context));
      }
      if (options.search) {
        const q = options.search.toLowerCase();
        logs = logs.filter(l =>
          l.message.toLowerCase().includes(q) ||
          (l.extra || '').toLowerCase().includes(q)
        );
      }
      if (options.since) {
        logs = logs.filter(l => new Date(l.ts) >= new Date(options.since));
      }
      if (options.limit) {
        logs = logs.slice(0, options.limit);
      }

      return logs;
    } catch {
      return [];
    }
  },

  /** Solo errores y críticos — para badge de alertas en UI */
  getErrors() {
    return this.getLogs({ level: ['error', 'critical'] });
  },

  /** Logs de la última importación */
  getImportLogs() {
    return this.getLogs({ context: LOG_CTX.IMPORT });
  },

  // ── Estadísticas ──────────────────────────────────────────────────────────

  getStats() {
    const logs = this.getLogs();
    const counts = { debug: 0, info: 0, success: 0, warn: 0, error: 0, critical: 0 };
    logs.forEach(l => { if (counts[l.level] !== undefined) counts[l.level]++; });
    return { total: logs.length, ...counts };
  },

  // ── Gestión ────────────────────────────────────────────────────────────────

  clear() {
    storage.set(LOGS_KEY, JSON.stringify([]));
    this.info('🗑️ Logs limpiados', LOG_CTX.SYSTEM);
  },

  export() {
    const logs = this.getLogs();
    return JSON.stringify(logs, null, 2);
  },
};

export default LogService;
