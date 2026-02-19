import 'react-native-gesture-handler';
import React from 'react';
import { Platform, LogBox } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Feather';

// PANTALLAS
import DashboardScreen from './screens/DashboardScreen';
import ProductsScreen from './screens/ProductsScreen';
import ProductDetailScreen from './screens/ProductDetailScreen';
import LogsScreen from './screens/LogsScreen';

LogBox.ignoreAllLogs();

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

// Stack para el Inventario (Lista + Detalle)
function StockStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen 
        name="StockList" 
        component={ProductsScreen} 
        options={{ title: 'Mi Inventario' }} 
      />
      <Stack.Screen 
        name="ProductDetail" 
        component={ProductDetailScreen} 
        options={{ title: 'Detalle del Producto' }} 
      />
    </Stack.Navigator>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <Tab.Navigator 
          screenOptions={{
            tabBarActiveTintColor: '#FF6B35',
            tabBarInactiveTintColor: '#999',
            headerShown: false,
            tabBarStyle: { 
              height: Platform.OS === 'android' ? 70 : 85,
              paddingBottom: Platform.OS === 'android' ? 10 : 30,
              paddingTop: 10
            }
          }}
        >
          {/* BOTÓN INICIO */}
          <Tab.Screen 
            name="Home" 
            component={DashboardScreen} 
            options={{ 
              tabBarLabel: 'Inicio',
              tabBarIcon: ({color}) => <Icon name="grid" size={22} color={color}/> 
            }} 
          />

          {/* BOTÓN SUBIR (NUEVO) */}
          <Tab.Screen 
            name="Add" 
            component={ProductsScreen} 
            options={{ 
              tabBarLabel: 'Vender',
              headerShown: true,
              title: 'Nuevo Producto',
              tabBarIcon: ({color}) => <Icon name="plus-circle" size={28} color={color}/> 
            }} 
          />

          {/* BOTÓN STOCK */}
          <Tab.Screen 
            name="Stock" 
            component={StockStack} 
            options={{ 
              tabBarLabel: 'Inventario',
              tabBarIcon: ({color}) => <Icon name="list" size={22} color={color}/> 
            }} 
          />

          {/* BOTÓN LOGS */}
          <Tab.Screen 
            name="Debug" 
            component={LogsScreen} 
            options={{ 
              tabBarLabel: 'Logs',
              tabBarIcon: ({color}) => <Icon name="terminal" size={22} color={color}/> 
            }} 
          />
        </Tab.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}