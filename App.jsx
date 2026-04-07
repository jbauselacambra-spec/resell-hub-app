/**
 * App.jsx — Sprint 14
 *
 * [SPRINT 14] Añadido Stack.Screen 'Intelligence' → BusinessIntelligenceScreen
 * [Sprint 10.1] Navegación canónica restaurada (tab Importar, no Logs)
 * [Sprint 10]   autoRestoreIfNeeded() en arranque
 */

import 'react-native-gesture-handler';
import React, { useEffect, useState } from 'react';
import { Platform, View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Feather';

import DashboardScreen           from './screens/DashboardScreen';
import ProductsScreen            from './screens/ProductsScreen';
import SoldHistoryScreen         from './screens/SoldHistoryScreen';
import ProductDetailScreen       from './screens/ProductDetailScreen';
import LogsScreen                from './screens/LogsScreen';
import SoldEditDetailView        from './screens/SoldEditDetailView';
import AdvancedStatsScreen       from './screens/AdvancedStatsScreen';
import SettingsScreen            from './screens/SettingsScreen';
import LoginScreen               from './src/screens/LoginScreen';
import AuthService               from './src/services/authService';
import VintedImportScreen        from './screens/VintedImportScreen';
// [Sprint 14] Motor de Business Intelligence
import BusinessIntelligenceScreen from './screens/BusinessIntelligenceScreen';
import DeduplicationScreen      from './screens/DeduplicationScreen';

import { BackupService }  from './services/BackupService';
import { DatabaseService } from './services/DatabaseService';

const Tab   = createBottomTabNavigator();
const Stack = createStackNavigator();

// ─── MainTabs — 6 tabs canónicas (Regla 11 v4.2) ─────────────────────────────
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
      {/* Sprint 8: "Importar" reemplaza a "Logs" — Tab 6 canónica (Regla 11) */}
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
        const token = AuthService.getToken();
        setIsAuthenticated(!!token);

        // [Sprint 10] Auto-restore si MMKV está vacío (rebuild / reinstalación)
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
        console.warn('[App] Error en autoRestore:', e.message);
      } finally {
        setIsReady(true);
      }
    })();
  }, []);

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
              <Stack.Screen name="Main"           component={MainTabs} />
              <Stack.Screen name="ProductDetail"  component={ProductDetailScreen} />
              <Stack.Screen name="SoldEditDetail" component={SoldEditDetailView} />
              <Stack.Screen name="Deduplication" component={DeduplicationScreen} />
              {/* LogsScreen como Stack.Screen — accesible desde Settings o Importar (Regla 11) */}
              <Stack.Screen name="Logs"           component={LogsScreen} />
              {/* [Sprint 14] Motor de Business Intelligence */}
              <Stack.Screen name="Intelligence"   component={BusinessIntelligenceScreen} />
            </>
          )}
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}

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
