import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, Image, Dimensions,
  ActivityIndicator, LogBox, Alert, StyleSheet, Platform, ScrollView
} from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Feather';

// SERVICIOS
import { DatabaseService } from './services/DatabaseService';
import { ImageProcessingService } from './services/ImageProcessingService';
import LogService from './services/LogService';

LogBox.ignoreAllLogs();

const COLORS = {
  primary: '#FF6B35',
  secondary: '#1A1A2E',
  background: '#F8F9FA',
  card: '#FFFFFF',
  textMuted: '#666',
  success: '#00D9A3',
  error: '#FF5252'
};

// ============== PANTALLAS ==============

const DashboardView = () => {
  const insets = useSafeAreaInsets();
  const [stats, setStats] = useState({ sold: 0, revenue: '0.00' });

  useEffect(() => {
    setStats(DatabaseService.getStats());
  }, []);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}><Text style={styles.headerTitle}>ResellHub <Text style={{color: COLORS.primary}}>v1.0</Text></Text></View>
      <View style={styles.statsCard}>
        <Text style={styles.statsLabel}>VENTAS TOTALES</Text>
        <Text style={styles.statsValue}>{stats.revenue}€</Text>
        <View style={styles.divider} />
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Icon name="check-circle" size={18} color={COLORS.success} />
          <Text style={styles.statsSubtext}>Vendidos: <Text style={{ fontWeight: 'bold', color: COLORS.secondary }}>{stats.sold}</Text></Text>
        </View>
      </View>
    </View>
  );
};

const StockView = () => {
  const insets = useSafeAreaInsets();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);

  const load = () => setProducts(DatabaseService.getAllProducts());
  useEffect(() => { load(); }, []);

  const handleAddProduct = async () => {
    try {
      // 1. Tomar la foto
      // Nota: No hace falta LogService.add aquí porque ya lo hace el servicio internamente
      const result = await ImageProcessingService.takePicture();
      
      // Verificamos si el usuario canceló o no hay resultado
      if (!result) {
        // El servicio ya registra si fue cancelado o hubo error
        return;
      }

      setLoading(true);

      // 2. Procesar la imagen (Anti-Hash)
      // Usamos result.uri porque el servicio devuelve el objeto del asset capturado
      const processedUri = await ImageProcessingService.processImage(result.uri);
      
      // 3. Guardar en la base de datos
      const newProduct = {
        title: `Item #${products.length + 1}`,
        price: "25.00",
        images: [processedUri],
        status: 'active'
      };

      DatabaseService.saveProduct(newProduct);
      
      // 4. Refrescar la lista y avisar
      load();
      LogService.add("✅ Producto añadido al inventario");
      
    } catch (e) {
      LogService.add("❌ Error en handleAddProduct: " + e.message);
      Alert.alert("Error", "No se pudo procesar la imagen: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.headerRow}>
        <Text style={styles.headerTitle}>Inventario</Text>
        <TouchableOpacity style={styles.addButton} onPress={handleAddProduct} disabled={loading}>
          {loading ? <ActivityIndicator color="#FFF" /> : <Icon name="plus" size={24} color="#FFF" />}
        </TouchableOpacity>
      </View>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 100 }}>
        {products.map(p => (
          <View key={p.id} style={styles.productCard}>
            <Image source={{ uri: p.images[0] }} style={styles.productImage} />
            <View style={styles.productInfo}>
              <Text style={styles.productTitle}>{p.title}</Text>
              <Text style={styles.productPrice}>{p.price}€</Text>
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
};

const LogsView = () => {
  const insets = useSafeAreaInsets();
  const [logs, setLogs] = useState([]);
  useEffect(() => {
    setLogs([...LogService.logs]);
    return LogService.subscribe(setLogs);
  }, []);

  return (
    <View style={[styles.container, { backgroundColor: '#121212', paddingTop: insets.top }]}>
      <View style={styles.headerRow}>
        <Text style={[styles.headerTitle, { color: '#FFF' }]}>Terminal</Text>
        <TouchableOpacity onPress={() => LogService.clear()}><Icon name="trash-2" size={20} color={COLORS.error} /></TouchableOpacity>
      </View>
      <ScrollView style={{ padding: 15 }}>
        {logs.map((log, i) => (
          <Text key={i} style={{ color: log.type === 'error' ? COLORS.error : '#AAA', fontSize: 11, marginBottom: 5 }}>
            [{log.time}] {log.text}
          </Text>
        ))}
      </ScrollView>
    </View>
  );
};

// ============== NAVEGACIÓN ==============

const Tab = createBottomTabNavigator();

function TabNavigator() {
  const insets = useSafeAreaInsets();
  return (
    <Tab.Navigator 
      screenOptions={{ 
        tabBarActiveTintColor: COLORS.primary,
        headerShown: false,
        tabBarStyle: { 
          height: 70 + insets.bottom, // Se ajusta solo según el sistema
          paddingBottom: insets.bottom + 10,
          paddingTop: 10,
          backgroundColor: '#FFF',
          borderTopWidth: 1,
          borderTopColor: '#EEE'
        }
      }}
    >
      <Tab.Screen name="Home" component={DashboardView} options={{ tabBarIcon: ({color}) => <Icon name="grid" size={22} color={color}/> }} />
      <Tab.Screen name="Stock" component={StockView} options={{ tabBarIcon: ({color}) => <Icon name="list" size={22} color={color}/> }} />
      <Tab.Screen name="Debug" component={LogsView} options={{ tabBarIcon: ({color}) => <Icon name="terminal" size={22} color={color}/> }} />
    </Tab.Navigator>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <TabNavigator />
      </NavigationContainer>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { paddingHorizontal: 25, paddingVertical: 20 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 25, paddingVertical: 20 },
  headerTitle: { fontSize: 26, fontWeight: '800', color: COLORS.secondary },
  statsCard: { marginHorizontal: 25, backgroundColor: COLORS.card, borderRadius: 24, padding: 25, elevation: 8, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 10 },
  statsLabel: { color: COLORS.textMuted, fontSize: 12, fontWeight: 'bold', letterSpacing: 1 },
  statsValue: { fontSize: 44, fontWeight: '900', color: COLORS.primary, marginVertical: 8 },
  divider: { height: 1, backgroundColor: '#F0F0F0', marginVertical: 15 },
  statsSubtext: { marginLeft: 10, fontSize: 14, color: COLORS.textMuted },
  addButton: { backgroundColor: COLORS.primary, width: 44, height: 44, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  productCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.card, borderRadius: 18, padding: 12, marginBottom: 12, marginHorizontal: 5, elevation: 3 },
  productImage: { width: 60, height: 60, borderRadius: 12, backgroundColor: '#F0F0F0' },
  productInfo: { flex: 1, marginLeft: 15 },
  productTitle: { fontWeight: '700', fontSize: 15, color: COLORS.secondary },
  productPrice: { color: COLORS.primary, fontWeight: '800', fontSize: 17 }
});