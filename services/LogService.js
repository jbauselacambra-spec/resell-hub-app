import { MMKV } from 'react-native-mmkv';

const storage = new MMKV();
const LOGS_KEY = 'app_logs';

const LogService = { // Quitamos el 'export' de aquí para usar default al final
  // Añadimos 'add' como alias de 'log' para que DatabaseService no explote
  add: (message, type = 'info') => LogService.log(message, type),

  log: (message, type = 'info') => {
    const newLog = {
      id: Date.now().toString(),
      timestamp: new Date().toLocaleString(),
      message,
      type, 
    };

    try {
      const existingLogsRaw = storage.getString(LOGS_KEY);
      const existingLogs = existingLogsRaw ? JSON.parse(existingLogsRaw) : [];
      const updatedLogs = [newLog, ...existingLogs].slice(0, 100);
      storage.set(LOGS_KEY, JSON.stringify(updatedLogs));
      console.log(`[${type.toUpperCase()}] ${message}`);
    } catch (e) {
      console.error("Error en LogService:", e);
    }
  },
  info: (msg) => LogService.log(msg, 'info'),
  success: (msg) => LogService.log(msg, 'success'),
  error: (msg) => LogService.log(msg, 'error'),
  getLogs: () => {
    const logs = storage.getString(LOGS_KEY);
    return logs ? JSON.parse(logs) : [];
  },
  clear: () => storage.set(LOGS_KEY, JSON.stringify([]))
};

export default LogService; // Exportación por defecto para asegurar la carga