/**
 * App.jsx — Sprint 10.1
 *
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * [ORCHESTRATOR] Sprint 10.1 — Fix navegación + persistencia BBDD
 *
 * [ARCHITECT] ESTRUCTURA DE NAVEGACIÓN CANÓNICA (Sprint 8+):
 *
 *   Tab.Navigator (MainTabs):
 *     Inicio     → DashboardScreen
 *     Inventario → ProductsScreen
 *     Vendidos   → SoldHistoryScreen
 *     Stats      → AdvancedStatsScreen
 *     Config     → SettingsScreen
 *     Importar   → VintedImportScreen  ← TAB (reemplaza "Logs" desde Sprint 8)
 *
 *   Stack.Navigator (Stack.Screen):
 *     ProductDetail  → ProductDetailScreen
 *     SoldEditDetail → SoldEditDetailView
 *     Logs           → LogsScreen  ← accesible desde Settings o VintedImportScreen
 *
 * [QA_ENGINEER] BUG SPRINT 10 CORREGIDO:
 *   Sprint 10 entregó App.jsx con tab "Logs"→LogsScreen, revirtiendo
 *   la estructura de Sprint 8 que convirtió "Importar" en tab principal.
 *   Este fichero restaura la navegación canónica.
 *
 * [MIGRATION_MANAGER] SPRINT 10 — Arranque con auto-restore:
 *   BackupService.autoRestoreIfNeeded() antes de setIsReady(true).
 *   Si MMKV vacío y hay backup en FileSystem.documentDirectory,
 *   restaura automáticamente con splash visual de 1.8s.
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */

import 'react-native-gesture-handler';
import React, { useEffect, useState } from 'react';
import { Platform, View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Feather';

import DashboardScreen      from './screens/DashboardScreen';
import ProductsScreen       from './screens/ProductsScreen';
import SoldHistoryScreen    from './screens/SoldHistoryScreen';
import ProductDetailScreen  from './screens/ProductDetailScreen';
import LogsScreen           from './screens/LogsScreen';
import SoldEditDetailView   from './screens/SoldEditDetailView';
import AdvancedStatsScreen  from './screens/AdvancedStatsScreen';
import SettingsScreen       from './screens/SettingsScreen';
import LoginScreen          from './src/screens/LoginScreen';
import AuthService          from './src/services/authService';
// Sprint 8: VintedImportScreen ocupa la posición del tab "Logs"
import VintedImportScreen   from './screens/VintedImportScreen';

// [Sprint 10] Capa de persistencia ante rebuilds de APK
import { BackupService }    from './services/BackupService';
import { DatabaseService }  from './services/DatabaseService';

const Tab   = createBottomTabNavigator();
const Stack = createStackNavigator();

// ─── MainTabs ─────────────────────────────────────────────────────────────────
function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        tabBarActiveTintColor:   '#FF6B35',
        tabBarInactiveTintColor: '#999',
        headerShown: false,
        tabBarStyle: {
          height:          Platform.OS === 'android' ? 70 : 85,
          paddingBottom:   Platform.OS === 'android' ? 10 : 25,
          backgroundColor: '#FFFFFF',
          borderTopColor:  '#EAEDF0',
          borderTopWidth:  1,
          elevation:       8,
        },
      }}
    >
      <Tab.Screen
        name="Home"
        component={DashboardScreen}
        options={{ tabBarLabel: 'Inicio', tabBarIcon: ({ color }) => <Icon name="trending-up" size={22} color={color} /> }}
      />
      <Tab.Screen
        name="Stock"
        component={ProductsScreen}
        options={{ tabBarLabel: 'Inventario', tabBarIcon: ({ color }) => <Icon name="package" size={22} color={color} /> }}
      />
      <Tab.Screen
        name="History"
        component={SoldHistoryScreen}
        options={{ tabBarLabel: 'Vendidos', tabBarIcon: ({ color }) => <Icon name="check-circle" size={22} color={color} /> }}
      />
      <Tab.Screen
        name="Stats"
        component={AdvancedStatsScreen}
        options={{ tabBarLabel: 'Stats', tabBarIcon: ({ color }) => <Icon name="bar-chart-2" size={22} color={color} /> }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{ tabBarLabel: 'Config', tabBarIcon: ({ color }) => <Icon name="settings" size={22} color={color} /> }}
      />
      {/* Sprint 8: "Importar" reemplaza a "Logs" en la barra de tabs */}
      <Tab.Screen
        name="Import"
        component={VintedImportScreen}
        options={{ tabBarLabel: 'Importar', tabBarIcon: ({ color }) => <Icon name="upload-cloud" size={22} color={color} /> }}
      />
    </Tab.Navigator>
  );
}

// ─── App ──────────────────────────────────────────────────────────────────────
export default function App() {
  const [isReady,         setIsReady]         = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [restoreMsg,      setRestoreMsg]      = useState(null);

  useEffect(() => {
    (async () => {
      try {
        // 1. Autenticación
        const token = AuthService.getToken();
        setIsAuthenticated(!!token);

        // 2. [Sprint 10] Auto-restore si MMKV está vacío (rebuild / reinstalación)
        const restoreResult = await BackupService.autoRestoreIfNeeded(
          () => DatabaseService.getAllProducts().length,
          (payload) => DatabaseService.importFullDatabase(payload),
        );

        if (restoreResult.restored) {
          setRestoreMsg(`✅ ${restoreResult.products} productos restaurados desde backup`);
          await new Promise(r => setTimeout(r, 1800));
          setRestoreMsg(null);
        }
      } catch (e) {
        // Nunca bloquear el arranque por un error de backup
        console.warn('[App] Error en autoRestore:', e.message);
      } finally {
        setIsReady(true);
      }
    })();
  }, []);

  // ── Splash / Loading ──────────────────────────────────────────────────────
  if (!isReady) {
    return (
      <View style={styles.splash}>
        {restoreMsg ? (
          <>
            <Text style={styles.splashEmoji}>💾</Text>
            <Text style={styles.splashTitle}>Restaurando datos</Text>
            <Text style={styles.splashMsg}>{restoreMsg}</Text>
          </>
        ) : (
          <ActivityIndicator size="large" color="#FF6B35" />
        )}
      </View>
    );
  }

  // ── Navegación ────────────────────────────────────────────────────────────
  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          {!isAuthenticated ? (
            <Stack.Screen name="Login">
              {(props) => <LoginScreen {...props} onLogin={() => setIsAuthenticated(true)} />}
            </Stack.Screen>
          ) : (
            <>
              <Stack.Screen name="Main"          component={MainTabs} />
              <Stack.Screen name="ProductDetail" component={ProductDetailScreen} />
              <Stack.Screen name="SoldEditDetail"component={SoldEditDetailView} />
              {/* Sprint 8: LogsScreen como Stack.Screen — accesible desde Settings o Importar */}
              <Stack.Screen name="Logs"          component={LogsScreen} />
            </>
          )}
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}

// ─── Estilos splash ───────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  splash: {
    flex: 1,
    backgroundColor: '#F8F9FA',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 40,
  },
  splashEmoji: { fontSize: 48 },
  splashTitle: { fontSize: 20, fontWeight: '900', color: '#1A1A2E' },
  splashMsg:   { fontSize: 14, color: '#5C6070', textAlign: 'center', lineHeight: 20 },
});