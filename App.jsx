/**
 * App.jsx — Sprint 14 · Design System v2
 *
 * [UI_SPECIALIST] Rediseño completo:
 * - Tab bar con nuevo DS: superficie blanca, bordes sutiles, iconos Feather
 * - Splash screen limpio con branding ResellHub
 * - Safe area y colores actualizados
 */

import 'react-native-gesture-handler';
import React, { useEffect, useState } from 'react';
import {
  Platform, View, Text, ActivityIndicator, StyleSheet,
} from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Feather';

import DashboardScreen            from './screens/DashboardScreen';
import ProductsScreen             from './screens/ProductsScreen';
import SoldHistoryScreen          from './screens/SoldHistoryScreen';
import ProductDetailScreen        from './screens/ProductDetailScreen';
import LogsScreen                 from './screens/LogsScreen';
import SoldEditDetailView         from './screens/SoldEditDetailView';
import AdvancedStatsScreen        from './screens/AdvancedStatsScreen';
import SettingsScreen             from './screens/SettingsScreen';
import LoginScreen                from './src/screens/LoginScreen';
import AuthService                from './src/services/authService';
import VintedImportScreen         from './screens/VintedImportScreen';
import BusinessIntelligenceScreen from './screens/BusinessIntelligenceScreen';
import DeduplicationScreen        from './screens/DeduplicationScreen';

import { BackupService }   from './services/BackupService';
import { DatabaseService } from './services/DatabaseService';
import { DS, RADIUS, SPACE, FONT_SIZE, LAYOUT } from './theme';

const Tab   = createBottomTabNavigator();
const Stack = createStackNavigator();

// ─── Tab icon config ──────────────────────────────────────────────────────────
const TAB_ICONS = {
  Home:     'trending-up',
  Stock:    'package',
  History:  'check-circle',
  Stats:    'bar-chart-2',
  Settings: 'settings',
  Import:   'upload-cloud',
};

// ─── MainTabs ─────────────────────────────────────────────────────────────────
function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color }) => (
          <Icon
            name={TAB_ICONS[route.name] || 'circle'}
            size={22}
            color={color}
            style={focused ? styles.tabIconActive : styles.tabIconInactive}
          />
        ),
        tabBarActiveTintColor:   DS.brand,
        tabBarInactiveTintColor: DS.text3,
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarLabelStyle: styles.tabLabel,
        tabBarItemStyle:  styles.tabItem,
        tabBarActiveBackgroundColor: 'transparent',
      })}
    >
      <Tab.Screen name="Home"     component={DashboardScreen}   options={{ tabBarLabel: 'Inicio'     }} />
      <Tab.Screen name="Stock"    component={ProductsScreen}    options={{ tabBarLabel: 'Inventario' }} />
      <Tab.Screen name="History"  component={SoldHistoryScreen} options={{ tabBarLabel: 'Vendidos'   }} />
      <Tab.Screen name="Stats"    component={AdvancedStatsScreen} options={{ tabBarLabel: 'Stats'    }} />
      <Tab.Screen name="Settings" component={SettingsScreen}    options={{ tabBarLabel: 'Config'     }} />
      <Tab.Screen name="Import"   component={VintedImportScreen} options={{ tabBarLabel: 'Importar'  }} />
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

        const restoreResult = await BackupService.autoRestoreIfNeeded(
          () => DatabaseService.getAllProducts().length,
          (payload) => DatabaseService.importFullDatabase(payload),
        );

        if (restoreResult.restored) {
          setRestoreMsg(`${restoreResult.products} productos restaurados`);
          await new Promise(r => setTimeout(r, 1600));
          setRestoreMsg(null);
        }
      } catch (e) {
        console.warn('[App] autoRestore:', e.message);
      } finally {
        setIsReady(true);
      }
    })();
  }, []);

  if (!isReady) {
    return (
      <View style={styles.splash}>
        <View style={styles.splashLogo}>
          <Text style={styles.splashLogoText}>R</Text>
        </View>
        <Text style={styles.splashTitle}>ResellHub</Text>
        {restoreMsg ? (
          <View style={styles.restoreBanner}>
            <Icon name="check-circle" size={14} color={DS.success} />
            <Text style={styles.restoreText}>{restoreMsg}</Text>
          </View>
        ) : (
          <ActivityIndicator
            size="small"
            color={DS.brand}
            style={{ marginTop: SPACE[6] }}
          />
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
              {(props) => (
                <LoginScreen {...props} onLogin={() => setIsAuthenticated(true)} />
              )}
            </Stack.Screen>
          ) : (
            <>
              <Stack.Screen name="Main"           component={MainTabs} />
              <Stack.Screen name="ProductDetail"  component={ProductDetailScreen} />
              <Stack.Screen name="SoldEditDetail" component={SoldEditDetailView} />
              <Stack.Screen name="Deduplication"  component={DeduplicationScreen} />
              <Stack.Screen name="Logs"           component={LogsScreen} />
              <Stack.Screen name="Intelligence"   component={BusinessIntelligenceScreen} />
            </>
          )}
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}

// ─── Estilos ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({

  // ── Tab Bar ─────────────────────────────────────────────────────────────────
  tabBar: {
    backgroundColor: DS.surface,
    borderTopWidth:  1,
    borderTopColor:  DS.border,
    height:          Platform.OS === 'android' ? 64 : 80,
    paddingBottom:   Platform.OS === 'android' ? 8 : 20,
    paddingTop:      6,
    elevation:       0,
  },
  tabLabel: {
    fontSize:    10,
    fontWeight:  '600',
    marginTop:   2,
    letterSpacing: 0.2,
  },
  tabItem: {
    paddingTop: 4,
  },
  tabIconActive: {
    // El tinte de color lo gestiona tabBarActiveTintColor
  },
  tabIconInactive: {
    // El tinte de color lo gestiona tabBarInactiveTintColor
  },

  // ── Splash ──────────────────────────────────────────────────────────────────
  splash: {
    flex:            1,
    backgroundColor: DS.surface2,
    alignItems:      'center',
    justifyContent:  'center',
    gap:             SPACE[3],
  },
  splashLogo: {
    width:           64,
    height:          64,
    backgroundColor: DS.brand,
    borderRadius:    RADIUS.lg,
    alignItems:      'center',
    justifyContent:  'center',
    marginBottom:    SPACE[2],
  },
  splashLogoText: {
    fontSize:   32,
    fontWeight: '800',
    color:      '#FFFFFF',
    letterSpacing: -1,
  },
  splashTitle: {
    fontSize:     22,
    fontWeight:   '700',
    color:        DS.text,
    letterSpacing: -0.4,
  },
  restoreBanner: {
    flexDirection:  'row',
    alignItems:     'center',
    gap:            SPACE[2],
    backgroundColor: DS.successDim,
    paddingHorizontal: SPACE[4],
    paddingVertical:   SPACE[2],
    borderRadius:   RADIUS.full,
    marginTop:      SPACE[3],
  },
  restoreText: {
    fontSize:   13,
    fontWeight: '500',
    color:      DS.success,
  },
});
