import React, { useState, useEffect } from 'react';
import {
  SafeAreaView,
  ScrollView,
  View,
  Text,
  TouchableOpacity,
  Image,
  StatusBar,
  Dimensions,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { LineChart } from 'react-native-chart-kit';
import Icon from 'react-native-vector-icons/Feather';

// SERVICIOS (Asegúrate de que las rutas sean correctas)
import { DatabaseService } from './services/DatabaseService';
import { ImageProcessingService } from './services/ImageProcessingService';
import { NotificationService } from './services/NotificationService';

import { LogBox } from 'react-native';

// Ignoramos avisos que ensucian la pantalla
LogBox.ignoreAllLogs();


const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ============== COMPONENTES REUTILIZABLES ==============

const StatCard = ({ icon, value, label, color }) => (
  <View style={{
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    width: (SCREEN_WIDTH - 48) / 3,
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
  }}>
    <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: `${color}15`, justifyContent: 'center', alignItems: 'center', marginBottom: 8 }}>
      <Icon name={icon} size={20} color={color} />
    </View>
    <Text style={{ fontSize: 20, fontWeight: '700', color: '#1A1A2E' }}>{value}</Text>
    <Text style={{ fontSize: 10, color: '#666', textAlign: 'center' }}>{label}</Text>
  </View>
);

const ProductCard = ({ product, onPress }) => {
  const statusConfig = {
    active: { color: '#004E89', label: 'Activo' },
    needs_repost: { color: '#FFB800', label: 'Resubir' },
    sold: { color: '#00D9A3', label: 'Vendido' },
  };
  const config = statusConfig[product.status] || statusConfig.active;

  return (
    <TouchableOpacity 
      onPress={onPress}
      style={{
        backgroundColor: '#FFF',
        borderRadius: 16,
        padding: 12,
        flexDirection: 'row',
        marginBottom: 12,
        elevation: 2,
        opacity: product.status === 'sold' ? 0.7 : 1,
      }}
    >
      <Image 
        source={{ uri: product.images?.[0] || 'https://via.placeholder.com/150' }} 
        style={{ width: 70, height: 70, borderRadius: 12, backgroundColor: '#EEE' }}
      />
      <View style={{ flex: 1, marginLeft: 12, justifyContent: 'center' }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text style={{ fontSize: 10, fontWeight: 'bold', color: '#999' }}>{product.brand?.toUpperCase()}</Text>
          <Text style={{ fontSize: 10, color: config.color, fontWeight: 'bold' }}>{config.label}</Text>
        </View>
        <Text style={{ fontSize: 16, fontWeight: '700', color: '#1A1A2E' }} numberOfLines={1}>{product.title}</Text>
        <Text style={{ fontSize: 18, fontWeight: '800', color: '#FF6B35', marginTop: 4 }}>{product.price}€</Text>
      </View>
    </TouchableOpacity>
  );
};

// ============== SCREENS ==============

const DashboardScreen = ({ navigation }) => {
  const [stats, setStats] = useState({ active: 0, sold: 0, alerts: 0, totalRevenue: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', loadData);
    return unsubscribe;
  }, [navigation]);

  const loadData = () => {
    const s = DatabaseService.getStats();
    const products = DatabaseService.getAllProducts();
    const alerts = products.filter(p => p.status === 'needs_repost').length;
    
    setStats({
      active: products.filter(p => p.status === 'active').length,
      sold: s.sold,
      alerts: alerts,
      totalRevenue: s.revenue
    });
    setLoading(false);
  };

  if (loading) return <ActivityIndicator style={{flex:1}} color="#FF6B35" />;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F8F9FA' }}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
        <Text style={{ fontSize: 28, fontWeight: '800', color: '#1A1A2E', marginBottom: 20 }}>ResellHub</Text>
        
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 25 }}>
          <StatCard icon="package" value={stats.active} label="Activos" color="#004E89" />
          <StatCard icon="check-circle" value={stats.sold} label="Vendidos" color="#00D9A3" />
          <StatCard icon="alert-circle" value={stats.alerts} label="Alertas" color="#FFB800" />
        </View>

        <View style={{ backgroundColor: '#004E89', borderRadius: 20, padding: 20, marginBottom: 25 }}>
          <Text style={{ color: '#FFF', opacity: 0.8 }}>Ingresos Totales</Text>
          <Text style={{ fontSize: 32, fontWeight: '800', color: '#FFF' }}>{stats.totalRevenue}€</Text>
        </View>

        <TouchableOpacity 
          onPress={() => navigation.navigate('Products')}
          style={{ backgroundColor: '#FF6B35', borderRadius: 16, padding: 20, alignItems: 'center', flexDirection: 'row', justifyContent: 'center' }}
        >
          <Icon name="plus-circle" size={24} color="#FFF" style={{ marginRight: 10 }} />
          <Text style={{ color: '#FFF', fontWeight: '700', fontSize: 16 }}>Gestionar Inventario</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

const ProductsScreen = ({ navigation }) => {
  const [products, setProducts] = useState([]);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      setProducts(DatabaseService.getAllProducts());
    });
    return unsubscribe;
  }, [navigation]);

 const handleAddProduct = async () => {
  try {
    // 1. Tomar foto
    const photo = await ImageProcessingService.takePicture();
    if (!photo) return;

    setLoading(true); // Podrías añadir un estado de carga

    // 2. Procesar la imagen (Recorte 1px anti-Vinted)
    // Usamos el método que creamos para procesar una imagen individual
    const processedUri = await ImageProcessingService.processImage(photo.uri);
    
    // 3. Guardar en DB Real (MMKV)
    const newProd = DatabaseService.saveProduct({
      title: `Producto ${Date.now().toString().slice(-4)}`,
      brand: 'Nuevo',
      price: 0,
      images: [processedUri], // Guardamos la imagen ya recortada
      status: 'active'
    });

    setProducts(DatabaseService.getAllProducts());
    Alert.alert("¡Éxito!", "Producto guardado con foto optimizada.");
  } catch (error) {
    Alert.alert("Error", "Asegúrate de dar permisos de cámara: " + error.message);
  } finally {
    setLoading(false);
  }
};

  const filtered = products.filter(p => filter === 'all' ? true : p.status === filter);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F8F9FA' }}>
      <View style={{ padding: 16 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 }}>
          <Text style={{ fontSize: 24, fontWeight: '800', color: '#1A1A2E' }}>Mis Productos</Text>
          <TouchableOpacity onPress={handleAddProduct}>
            <Icon name="plus-square" size={28} color="#FF6B35" />
          </TouchableOpacity>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 15 }}>
          {['all', 'active', 'needs_repost', 'sold'].map(f => (
            <TouchableOpacity 
              key={f} 
              onPress={() => setFilter(f)}
              style={{
                backgroundColor: filter === f ? '#FF6B35' : '#FFF',
                paddingHorizontal: 15, paddingVertical: 8, borderRadius: 20, marginRight: 8, borderWidth: 1, borderColor: '#EEE'
              }}
            >
              <Text style={{ color: filter === f ? '#FFF' : '#666', fontWeight: '600' }}>
                {f === 'all' ? 'Todos' : f === 'needs_repost' ? 'Resubir' : f}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 0, paddingBottom: 100 }}>
        {filtered.length === 0 ? (
          <Text style={{ textAlign: 'center', marginTop: 40, color: '#999' }}>No hay productos en esta categoría</Text>
        ) : (
          filtered.map(p => (
            <ProductCard 
              key={p.id} 
              product={p} 
              onPress={() => Alert.alert(p.title, "¿Marcar como vendido?", [
                { text: "No" },
                { text: "Sí, vendido", onPress: () => {
                  DatabaseService.markProductAsSold(p.id, p.price);
                  setProducts(DatabaseService.getAllProducts());
                }}
              ])} 
            />
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

// ============== APP ROOT ==============

const Tab = createBottomTabNavigator();

export default function App() {
  useEffect(() => {
    const init = async () => {
      try {
        // Inicializar servicios con un pequeño delay para que el motor asiente
        setTimeout(async () => {
          await ImageProcessingService.initialize();
          await NotificationService.initialize();
          console.log("🚀 Servicios listos");
        }, 1000);
      } catch (e) {
        console.log("Error inicializando servicios:", e);
      }
    };
    init();
  }, []);

  return (
    <NavigationContainer>      
      <Tab.Navigator
        screenOptions={({ route }) => ({
          headerShown: false,
          tabBarIcon: ({ color, size }) => {
            const icons = { Dashboard: 'home', Products: 'package', Stats: 'bar-chart-2', Settings: 'settings' };
            return <Icon name={icons[route.name]} size={size} color={color} />;
          },
          tabBarActiveTintColor: '#FF6B35',
          tabBarInactiveTintColor: '#999',
          tabBarStyle: { height: 70, paddingBottom: 15, paddingTop: 10 },
        })}
      >
        <Tab.Screen name="Dashboard" component={DashboardScreen} options={{ tabBarLabel: 'Inicio' }} />
        <Tab.Screen name="Products" component={ProductsScreen} options={{ tabBarLabel: 'Inventario' }} />
        <Tab.Screen name="Stats" component={DashboardScreen} options={{ tabBarLabel: 'Stats' }} />
        <Tab.Screen name="Settings" component={DashboardScreen} options={{ tabBarLabel: 'Ajustes' }} />
      </Tab.Navigator>
    </NavigationContainer>
  );
}