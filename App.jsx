import 'react-native-gesture-handler';
import React from 'react';
import { Platform } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Feather';

import DashboardScreen from './screens/DashboardScreen';
import ProductsScreen from './screens/ProductsScreen';
import ProductDetailScreen from './screens/ProductDetailScreen';
import LogsScreen from './screens/LogsScreen';

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

function MainTabs() {
  return (
    <Tab.Navigator 
      screenOptions={{
        tabBarActiveTintColor: '#FF6B35',
        headerShown: false,
        tabBarStyle: { height: Platform.OS === 'android' ? 70 : 85 }
      }}
    >
      <Tab.Screen name="Home" component={DashboardScreen} options={{ tabBarLabel: 'Inicio', tabBarIcon: ({color}) => <Icon name="grid" size={22} color={color}/> }} />
      <Tab.Screen name="Add" component={ProductsScreen} options={{ tabBarLabel: 'Vender', tabBarIcon: ({color}) => <Icon name="plus-circle" size={28} color={color}/> }} />
      <Tab.Screen name="Stock" component={ProductsScreen} options={{ tabBarLabel: 'Inventario', tabBarIcon: ({color}) => <Icon name="list" size={22} color={color}/> }} />
      <Tab.Screen name="Debug" component={LogsScreen} options={{ tabBarLabel: 'Logs', tabBarIcon: ({color}) => <Icon name="terminal" size={22} color={color}/> }} />
    </Tab.Navigator>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Main" component={MainTabs} />
          {/* Al estar aquí, es accesible desde cualquier pestaña sin errores */}
          <Stack.Screen name="ProductDetail" component={ProductDetailScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}