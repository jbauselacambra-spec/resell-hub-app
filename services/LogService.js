import { MMKV } from 'react-native-mmkv';

const storage = new MMKV();
const LOGS_KEY = 'app_logs';

const LogService = {
  add: (message, type = 'info') => LogService.log(message, type),

  log: (message, type = 'info') => {
    // ID único con Random para evitar el error de "Same Key"
    const newLog = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
      timestamp: new Date().toLocaleTimeString(),
      message,
      type, 
    };

    try {
      const existingLogsRaw = storage.getString(LOGS_KEY);
      const existingLogs = existingLogsRaw ? JSON.parse(existingLogsRaw) : [];
      const updatedLogs = [newLog, ...existingLogs].slice(0, 70); // Máximo 70 logs
      storage.set(LOGS_KEY, JSON.stringify(updatedLogs));
      
      const emoji = type === 'error' ? '❌' : type === 'success' ? '✅' : 'ℹ️';
      console.log(`${emoji} [EAS_LOG] ${message}`);
    } catch (e) {
      console.error("Error en LogService:", e);
    }
  },

  info: (msg) => LogService.log(msg, 'info'),
  success: (msg) => LogService.log(msg, 'success'),
  error: (msg) => LogService.log(msg, 'error'),
  
  getLogs: () => {
    try {
      const logs = storage.getString(LOGS_KEY);
      return logs ? JSON.parse(logs) : [];
    } catch (e) { return []; }
  },
  
  clear: () => {
    storage.set(LOGS_KEY, JSON.stringify([]));
    console.log("[EAS_LOG] Logs limpiados");
  }
};

export default LogService;