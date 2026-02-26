import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import AuthService from '../services/authService';
import LogService, { LOG_CTX } from '../../services/LogService';

const C = {
  bg: '#0D0D1A',
  surface: '#141428',
  card: '#1A1A35',
  border: '#252540',
  primary: '#FF6B35',
  blue: '#4EA8DE',
  success: '#00D9A3',
  white: '#FFFFFF',
  gray: '#888888',
  gray2: '#BBBBBB',
};

export default function LoginScreen({ navigation, onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const trimmedEmail = email.trim() || 'demo@user.com';

      AuthService.setToken('demo-token');
      AuthService.setUser({
        email: trimmedEmail,
        createdAt: new Date().toISOString(),
      });

      LogService.success('Login simulado correcto', LOG_CTX.UI, { email: trimmedEmail });

      if (typeof onLogin === 'function') {
        onLogin();
      }

      if (navigation && typeof navigation.replace === 'function') {
        navigation.replace('Main');
      }
    } catch (e) {
      LogService.exception('Error en login simulado', e, LOG_CTX.SYSTEM);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.card}>
        <Text style={styles.title}>Resell Hub</Text>
        <Text style={styles.subtitle}>Inicia sesión para continuar</Text>

        <View style={styles.field}>
          <Text style={styles.label}>Email</Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            style={styles.input}
            placeholder="tu@email.com"
            placeholderTextColor={C.gray}
            autoCapitalize="none"
            keyboardType="email-address"
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Contraseña</Text>
          <TextInput
            value={password}
            onChangeText={setPassword}
            style={styles.input}
            placeholder="••••••••"
            placeholderTextColor={C.gray}
            secureTextEntry
          />
        </View>

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleLogin}
          activeOpacity={0.8}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color={C.white} />
          ) : (
            <Text style={styles.buttonText}>Entrar (simulado)</Text>
          )}
        </TouchableOpacity>

        <Text style={styles.helper}>
          Este login es solo de prueba: se guarda un token en MMKV y se navega a la app principal.
        </Text>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.bg,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  card: {
    width: '100%',
    backgroundColor: C.surface,
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: C.border,
  },
  title: {
    fontSize: 26,
    fontWeight: '900',
    color: C.white,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    color: C.gray2,
    marginBottom: 24,
  },
  field: {
    marginBottom: 16,
  },
  label: {
    fontSize: 12,
    color: C.gray2,
    marginBottom: 6,
  },
  input: {
    backgroundColor: C.card,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: C.white,
    borderWidth: 1,
    borderColor: C.border,
    fontSize: 14,
  },
  button: {
    marginTop: 8,
    backgroundColor: C.primary,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: C.white,
    fontSize: 15,
    fontWeight: '800',
  },
  helper: {
    marginTop: 12,
    fontSize: 11,
    color: C.gray,
  },
});

