import { MMKV } from 'react-native-mmkv';
import LogService, { LOG_CTX } from '../../services/LogService';

const storage = new MMKV();

const AUTH_KEYS = {
  TOKEN: 'auth_token',
  USER: 'auth_user',
};

const AuthService = {
  getToken() {
    try {
      return storage.getString(AUTH_KEYS.TOKEN) || null;
    } catch (e) {
      LogService.exception('Error leyendo token de auth', e, LOG_CTX.SYSTEM);
      return null;
    }
  },

  setToken(token) {
    try {
      if (!token) {
        storage.delete(AUTH_KEYS.TOKEN);
        LogService.warn('Token vacío, se limpia sesión', LOG_CTX.SYSTEM);
        return;
      }
      storage.set(AUTH_KEYS.TOKEN, String(token));
      LogService.success('Token de usuario guardado', LOG_CTX.SYSTEM);
    } catch (e) {
      LogService.exception('Error guardando token de auth', e, LOG_CTX.SYSTEM);
    }
  },

  clearToken() {
    try {
      storage.delete(AUTH_KEYS.TOKEN);
      LogService.info('Token de usuario eliminado', LOG_CTX.SYSTEM);
    } catch (e) {
      LogService.exception('Error eliminando token de auth', e, LOG_CTX.SYSTEM);
    }
  },

  isAuthenticated() {
    return !!this.getToken();
  },

  getUser() {
    try {
      const raw = storage.getString(AUTH_KEYS.USER);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      LogService.exception('Error leyendo usuario de auth', e, LOG_CTX.SYSTEM);
      return null;
    }
  },

  setUser(user) {
    try {
      if (!user) {
        storage.delete(AUTH_KEYS.USER);
        LogService.info('Usuario de auth eliminado', LOG_CTX.SYSTEM);
        return;
      }
      storage.set(AUTH_KEYS.USER, JSON.stringify(user));
      LogService.success('Usuario de auth guardado', LOG_CTX.SYSTEM, user);
    } catch (e) {
      LogService.exception('Error guardando usuario de auth', e, LOG_CTX.SYSTEM);
    }
  },

  clearSession() {
    this.clearToken();
    try {
      storage.delete(AUTH_KEYS.USER);
      LogService.info('Sesión de usuario limpiada', LOG_CTX.SYSTEM);
    } catch (e) {
      LogService.exception('Error limpiando sesión de auth', e, LOG_CTX.SYSTEM);
    }
  },
};

export default AuthService;

