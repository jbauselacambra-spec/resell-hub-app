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
  Animated,
  Alert,
  Platform,
} from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { LineChart } from 'react-native-chart-kit';
import Icon from 'react-native-vector-icons/Feather';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// ============== STORE (Zustand simplificado) ==============
const mockProducts = [
  {
    id: 1,
    title: 'iPhone 13 Pro 128GB',
    brand: 'Apple',
    price: 650,
    images: ['https://picsum.photos/400/400?random=1'],
    tags: ['Electrónica', 'Smartphone', 'Apple'],
    processedDate: new Date('2024-11-10'),
    status: 'needs_repost',
    views: 45,
    daysActive: 92,
  },
  {
    id: 2,
    title: 'Nike Air Max 90',
    brand: 'Nike',
    price: 85,
    images: ['https://picsum.photos/400/400?random=2'],
    tags: ['Moda', 'Zapatillas', 'Hombre'],
    processedDate: new Date('2025-01-05'),
    status: 'active',
    views: 123,
    daysActive: 35,
  },
  {
    id: 3,
    title: 'Chaqueta Vaquera Levi\'s',
    brand: 'Levi\'s',
    price: 45,
    images: ['https://picsum.photos/400/400?random=3'],
    tags: ['Moda', 'Chaqueta', 'Vintage'],
    processedDate: new Date('2024-12-20'),
    status: 'sold',
    views: 89,
    daysActive: 12,
  },
];

// ============== COMPONENTS ==============

// StatCard Component
const StatCard = ({ icon, value, label, color, onPress }) => {
  return (
    <TouchableOpacity
      onPress={() => {
        console.log('StatCard pressed:', label);
        Alert.alert('Estadística', `${label}: ${value}`);
      }}
      activeOpacity={0.7}
      style={{
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 16,
        width: (SCREEN_WIDTH - 48) / 3,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 3,
        minHeight: 120,
      }}
    >
      <View
        style={{
          width: 48,
          height: 48,
          borderRadius: 24,
          backgroundColor: `${color}15`,
          justifyContent: 'center',
          alignItems: 'center',
          marginBottom: 8,
        }}
      >
        <Icon name={icon} size={24} color={color} />
      </View>
      <Text style={{ fontSize: 24, fontWeight: '700', color: '#1A1A2E', marginBottom: 2 }}>
        {value}
      </Text>
      <Text style={{ fontSize: 11, fontWeight: '500', color: '#666', textAlign: 'center' }}>
        {label}
      </Text>
    </TouchableOpacity>
  );
};

// AlertBanner Component
const AlertBanner = ({ count, onPress }) => {
  return (
    <TouchableOpacity
      onPress={() => {
        console.log('AlertBanner pressed');
        Alert.alert(
          '⚠️ Productos para resubir',
          `Tienes ${count} productos que llevan más de 60 días sin vender. ¿Quieres revisarlos ahora?`,
          [
            { text: 'Más tarde', style: 'cancel' },
            { text: 'Ver productos', onPress: () => console.log('Ver productos') },
          ]
        );
      }}
      activeOpacity={0.8}
      style={{
        backgroundColor: '#FFF9E6',
        borderLeftWidth: 4,
        borderLeftColor: '#FFB800',
        borderRadius: 12,
        padding: 16,
        flexDirection: 'row',
        alignItems: 'center',
        shadowColor: '#FFB800',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 4,
      }}
    >
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: 20,
          backgroundColor: '#FFB800',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <Icon name="alert-circle" size={24} color="#FFF" />
      </View>
      <View style={{ flex: 1, marginLeft: 12 }}>
        <Text style={{ fontSize: 16, fontWeight: '700', color: '#1A1A2E', marginBottom: 2 }}>
          ⚠️ Productos para resubir
        </Text>
        <Text style={{ fontSize: 13, color: '#666' }}>
          {count} productos llevan más de 60 días sin vender
        </Text>
      </View>
      <Icon name="chevron-right" size={24} color="#FFB800" />
    </TouchableOpacity>
  );
};

// ProductCard Component
const ProductCard = ({ product, onPress }) => {
  const statusConfig = {
    active: { color: '#004E89', label: 'Activo', icon: 'eye' },
    needs_repost: { color: '#FFB800', label: 'Resubir', icon: 'refresh-cw' },
    sold: { color: '#00D9A3', label: 'Vendido', icon: 'check-circle' },
  };

  const config = statusConfig[product.status];

  return (
    <TouchableOpacity
      onPress={() => {
        console.log('ProductCard pressed:', product.title);
        Alert.alert(
          product.title,
          `Marca: ${product.brand}\nPrecio: ${product.price}€\nEstado: ${config.label}\nVistas: ${product.views}\nDías activo: ${product.daysActive}`,
          [
            { text: 'Cerrar', style: 'cancel' },
            { text: 'Editar', onPress: () => console.log('Editar producto') },
          ]
        );
      }}
      activeOpacity={0.7}
      style={{
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        marginBottom: 16,
        flexDirection: 'row',
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: '#E8E8E8',
        borderLeftWidth: product.status === 'needs_repost' ? 4 : 1,
        borderLeftColor: product.status === 'needs_repost' ? '#FFB800' : '#E8E8E8',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
        elevation: 2,
        opacity: product.status === 'sold' ? 0.6 : 1,
      }}
    >
      {/* Image */}
      <Image
        source={{ uri: product.images[0] }}
        style={{ width: 120, height: 140, backgroundColor: '#F0F0F0' }}
        resizeMode="cover"
      />

      {/* Content */}
      <View style={{ flex: 1, padding: 12, justifyContent: 'space-between' }}>
        {/* Header */}
        <View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <Text
              style={{
                fontSize: 16,
                fontWeight: '600',
                color: '#1A1A2E',
                marginBottom: 4,
                flex: 1,
                marginRight: 8,
              }}
              numberOfLines={2}
            >
              {product.title}
            </Text>
            <View
              style={{
                width: 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: config.color,
              }}
            />
          </View>

          <Text style={{ fontSize: 12, color: '#666', marginBottom: 8 }}>
            {product.brand}
          </Text>

          {/* Tags */}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 8 }}>
            {product.tags.slice(0, 2).map((tag, index) => (
              <View
                key={index}
                style={{
                  backgroundColor: '#F0F0F0',
                  paddingHorizontal: 8,
                  paddingVertical: 4,
                  borderRadius: 6,
                  marginRight: 6,
                  marginBottom: 4,
                }}
              >
                <Text style={{ fontSize: 10, color: '#666', fontWeight: '500' }}>{tag}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Footer */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={{ fontSize: 20, fontWeight: '700', color: '#FF6B35' }}>
            {product.price}€
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Icon name="clock" size={12} color="#999" />
            <Text style={{ fontSize: 11, color: '#999', marginLeft: 4 }}>
              {product.daysActive}d
            </Text>
            <Icon name="eye" size={12} color="#999" style={{ marginLeft: 8 }} />
            <Text style={{ fontSize: 11, color: '#999', marginLeft: 4 }}>
              {product.views}
            </Text>
          </View>
        </View>
      </View>

      {/* Action Menu */}
      <TouchableOpacity
        onPress={() => {
          Alert.alert(
            'Opciones',
            'Selecciona una acción',
            [
              { text: 'Cancelar', style: 'cancel' },
              { text: 'Editar', onPress: () => console.log('Editar') },
              { text: 'Eliminar', onPress: () => console.log('Eliminar'), style: 'destructive' },
            ]
          );
        }}
        style={{
          position: 'absolute',
          top: 8,
          right: 8,
          width: 40,
          height: 40,
          borderRadius: 20,
          backgroundColor: 'rgba(255,255,255,0.95)',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <Icon name="more-vertical" size={18} color="#666" />
      </TouchableOpacity>

      {/* Status Badge */}
      {product.status === 'sold' && (
        <View
          style={{
            position: 'absolute',
            top: 16,
            left: 16,
            backgroundColor: '#00D9A3',
            paddingHorizontal: 12,
            paddingVertical: 6,
            borderRadius: 20,
          }}
        >
          <Text style={{ fontSize: 11, fontWeight: '700', color: '#FFF' }}>VENDIDO</Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

// ============== SCREENS ==============

// Dashboard Screen
const DashboardScreen = ({ navigation }) => {
  const [products] = useState(mockProducts);

  const activeProducts = products.filter(p => p.status === 'active').length;
  const soldProducts = products.filter(p => p.status === 'sold').length;
  const needsRepost = products.filter(p => p.status === 'needs_repost').length;

  // Mock chart data
  const chartData = {
    labels: ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun'],
    datasets: [
      {
        data: [2, 5, 3, 8, 6, 4],
        color: (opacity = 1) => `rgba(0, 217, 163, ${opacity})`,
        strokeWidth: 3,
      },
    ],
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F8F9FA' }}>
      <StatusBar barStyle="dark-content" backgroundColor="#F8F9FA" />
      
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
      >
        {/* Header */}
        <View style={{ marginBottom: 24 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View>
              <Text style={{ fontSize: 28, fontWeight: '800', color: '#1A1A2E', letterSpacing: -0.5 }}>
                ResellHub
              </Text>
              <Text style={{ fontSize: 14, color: '#666', marginTop: 2 }}>
                Gestiona tus productos fácilmente
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => {
                Alert.alert('Perfil', 'Funcionalidad de perfil en desarrollo');
              }}
              style={{
                width: 48,
                height: 48,
                borderRadius: 24,
                backgroundColor: '#FF6B35',
                justifyContent: 'center',
                alignItems: 'center',
              }}
            >
              <Icon name="user" size={24} color="#FFF" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Stats Cards */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 }}>
          <StatCard icon="package" value={activeProducts} label="Activos" color="#004E89" />
          <StatCard icon="check-circle" value={soldProducts} label="Vendidos" color="#00D9A3" />
          <StatCard icon="alert-circle" value={needsRepost} label="Alertas" color="#FFB800" />
        </View>

        {/* Alert Banner */}
        {needsRepost > 0 && (
          <View style={{ marginBottom: 20 }}>
            <AlertBanner count={needsRepost} onPress={() => navigation.navigate('Products')} />
          </View>
        )}

        {/* Chart Section */}
        <View
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: 16,
            padding: 16,
            marginBottom: 20,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.08,
            shadowRadius: 8,
            elevation: 2,
          }}
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <Text style={{ fontSize: 18, fontWeight: '700', color: '#1A1A2E' }}>
              Ventas Mensuales
            </Text>
            <TouchableOpacity 
              onPress={() => Alert.alert('Filtro', 'Selecciona el año')}
              style={{ flexDirection: 'row', alignItems: 'center' }}
            >
              <Text style={{ fontSize: 13, color: '#666', marginRight: 4 }}>
                2025
              </Text>
              <Icon name="chevron-down" size={16} color="#666" />
            </TouchableOpacity>
          </View>
          
          <LineChart
            data={chartData}
            width={SCREEN_WIDTH - 64}
            height={200}
            chartConfig={{
              backgroundColor: '#FFFFFF',
              backgroundGradientFrom: '#FFFFFF',
              backgroundGradientTo: '#FFFFFF',
              decimalPlaces: 0,
              color: (opacity = 1) => `rgba(0, 217, 163, ${opacity})`,
              labelColor: (opacity = 1) => `rgba(102, 102, 102, ${opacity})`,
              style: {
                borderRadius: 16,
              },
              propsForDots: {
                r: '6',
                strokeWidth: '2',
                stroke: '#00D9A3',
              },
            }}
            bezier
            style={{
              borderRadius: 16,
            }}
          />
        </View>

        {/* Products List */}
        <View style={{ marginBottom: 16 }}>
          <Text style={{ fontSize: 18, fontWeight: '700', color: '#1A1A2E', marginBottom: 16 }}>
            Tus Productos
          </Text>
          {products.map(product => (
            <ProductCard key={product.id} product={product} />
          ))}
        </View>

        {/* Add Product Button */}
        <TouchableOpacity
          onPress={() => {
            Alert.alert(
              'Añadir Producto',
              'Selecciona una opción',
              [
                { text: 'Cancelar', style: 'cancel' },
                { text: 'Desde Galería', onPress: () => console.log('Galería') },
                { text: 'Procesar Carpeta', onPress: () => console.log('Carpeta') },
              ]
            );
          }}
          style={{
            backgroundColor: '#FF6B35',
            borderRadius: 16,
            padding: 18,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            shadowColor: '#FF6B35',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.3,
            shadowRadius: 8,
            elevation: 6,
          }}
        >
          <Icon name="plus-circle" size={24} color="#FFF" style={{ marginRight: 8 }} />
          <Text style={{ fontSize: 16, fontWeight: '700', color: '#FFF' }}>
            Añadir Producto
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

// Products Screen
const ProductsScreen = () => {
  const [products] = useState(mockProducts);
  const [filter, setFilter] = useState('all');

  const filteredProducts = products.filter(p => {
    if (filter === 'all') return true;
    return p.status === filter;
  });

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F8F9FA' }}>
      <View style={{ padding: 16 }}>
        <Text style={{ fontSize: 24, fontWeight: '800', color: '#1A1A2E', marginBottom: 16 }}>
          Productos
        </Text>

        {/* Filter Chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ marginBottom: 16 }}
        >
          {[
            { key: 'all', label: 'Todos' },
            { key: 'active', label: 'Activos' },
            { key: 'needs_repost', label: 'Para Resubir' },
            { key: 'sold', label: 'Vendidos' },
          ].map(item => (
            <TouchableOpacity
              key={item.key}
              onPress={() => {
                console.log('Filter selected:', item.key);
                setFilter(item.key);
              }}
              activeOpacity={0.7}
              style={{
                backgroundColor: filter === item.key ? '#FF6B35' : '#FFF',
                paddingHorizontal: 16,
                paddingVertical: 10,
                borderRadius: 20,
                marginRight: 8,
                borderWidth: 1,
                borderColor: filter === item.key ? '#FF6B35' : '#E8E8E8',
                minHeight: 40,
              }}
            >
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: '600',
                  color: filter === item.key ? '#FFF' : '#666',
                }}
              >
                {item.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 0, paddingBottom: 100 }}>
        {filteredProducts.map(product => (
          <ProductCard key={product.id} product={product} />
        ))}
      </ScrollView>
    </SafeAreaView>
  );
};

// Stats Screen
const StatsScreen = () => {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F8F9FA' }}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
        <Text style={{ fontSize: 24, fontWeight: '800', color: '#1A1A2E', marginBottom: 16 }}>
          Estadísticas
        </Text>

        {/* Overview Cards */}
        <TouchableOpacity
          onPress={() => Alert.alert('Ingresos Totales', 'Detalles de tus ingresos totales')}
          activeOpacity={0.8}
          style={{
            backgroundColor: '#004E89',
            borderRadius: 20,
            padding: 20,
            marginBottom: 16,
          }}
        >
          <Text style={{ fontSize: 16, color: '#FFF', opacity: 0.8, marginBottom: 8 }}>
            Ingresos Totales
          </Text>
          <Text style={{ fontSize: 36, fontWeight: '800', color: '#FFF', marginBottom: 4 }}>
            1.245€
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Icon name="trending-up" size={16} color="#00D9A3" />
            <Text style={{ fontSize: 13, color: '#00D9A3', marginLeft: 4, fontWeight: '600' }}>
              +12% vs mes anterior
            </Text>
          </View>
        </TouchableOpacity>

        {/* Category Performance */}
        <View
          style={{
            backgroundColor: '#FFF',
            borderRadius: 16,
            padding: 16,
            marginBottom: 16,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.08,
            shadowRadius: 8,
            elevation: 2,
          }}
        >
          <Text style={{ fontSize: 18, fontWeight: '700', color: '#1A1A2E', marginBottom: 16 }}>
            Rendimiento por Categoría
          </Text>

          {[
            { category: 'Electrónica', sold: 8, total: 12, color: '#004E89' },
            { category: 'Moda', sold: 15, total: 18, color: '#FF6B35' },
            { category: 'Hogar', sold: 4, total: 9, color: '#FFB800' },
          ].map((item, index) => (
            <TouchableOpacity
              key={index}
              onPress={() => Alert.alert(item.category, `Vendidos: ${item.sold} de ${item.total}`)}
              activeOpacity={0.7}
              style={{ marginBottom: 16 }}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                <Text style={{ fontSize: 14, fontWeight: '600', color: '#1A1A2E' }}>
                  {item.category}
                </Text>
                <Text style={{ fontSize: 14, color: '#666' }}>
                  {item.sold}/{item.total}
                </Text>
              </View>
              <View style={{ height: 8, backgroundColor: '#F0F0F0', borderRadius: 4, overflow: 'hidden' }}>
                <View
                  style={{
                    height: '100%',
                    width: `${(item.sold / item.total) * 100}%`,
                    backgroundColor: item.color,
                  }}
                />
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {/* Time Analysis */}
        <View
          style={{
            backgroundColor: '#FFF',
            borderRadius: 16,
            padding: 16,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.08,
            shadowRadius: 8,
            elevation: 2,
          }}
        >
          <Text style={{ fontSize: 18, fontWeight: '700', color: '#1A1A2E', marginBottom: 16 }}>
            Tiempo Promedio de Venta
          </Text>

          {[
            { range: '0-15 días', count: 12, color: '#00D9A3' },
            { range: '16-30 días', count: 8, color: '#FFB800' },
            { range: '30-60 días', count: 5, color: '#FF6B35' },
            { range: '+60 días', count: 2, color: '#E63946' },
          ].map((item, index) => (
            <TouchableOpacity
              key={index}
              onPress={() => Alert.alert(item.range, `${item.count} productos vendidos en este rango`)}
              activeOpacity={0.7}
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                paddingVertical: 12,
                borderBottomWidth: index < 3 ? 1 : 0,
                borderBottomColor: '#F0F0F0',
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View
                  style={{
                    width: 12,
                    height: 12,
                    borderRadius: 6,
                    backgroundColor: item.color,
                    marginRight: 12,
                  }}
                />
                <Text style={{ fontSize: 14, color: '#1A1A2E' }}>{item.range}</Text>
              </View>
              <Text style={{ fontSize: 16, fontWeight: '700', color: '#1A1A2E' }}>
                {item.count}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

// Settings Screen
const SettingsScreen = () => {
  const [notifications, setNotifications] = useState({
    repost: true,
    lowViews: true,
    weekly: false,
  });

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F8F9FA' }}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
        <Text style={{ fontSize: 24, fontWeight: '800', color: '#1A1A2E', marginBottom: 16 }}>
          Configuración
        </Text>

        {/* Notifications Section */}
        <View
          style={{
            backgroundColor: '#FFF',
            borderRadius: 16,
            padding: 16,
            marginBottom: 16,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.08,
            shadowRadius: 8,
            elevation: 2,
          }}
        >
          <Text style={{ fontSize: 18, fontWeight: '700', color: '#1A1A2E', marginBottom: 16 }}>
            Notificaciones
          </Text>

          {[
            { key: 'repost', label: 'Alertas de resubida (60 días)' },
            { key: 'lowViews', label: 'Productos sin vistas (7 días)' },
            { key: 'weekly', label: 'Resumen semanal' },
          ].map((item, index) => (
            <TouchableOpacity
              key={index}
              onPress={() => {
                setNotifications(prev => ({
                  ...prev,
                  [item.key]: !prev[item.key]
                }));
                console.log('Toggle notification:', item.key);
              }}
              activeOpacity={0.7}
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                paddingVertical: 12,
                borderBottomWidth: index < 2 ? 1 : 0,
                borderBottomColor: '#F0F0F0',
                minHeight: 50,
              }}
            >
              <Text style={{ fontSize: 14, color: '#1A1A2E', flex: 1 }}>{item.label}</Text>
              <View
                style={{
                  width: 50,
                  height: 28,
                  borderRadius: 14,
                  backgroundColor: notifications[item.key] ? '#00D9A3' : '#E8E8E8',
                  justifyContent: 'center',
                  paddingHorizontal: 4,
                }}
              >
                <View
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: 10,
                    backgroundColor: '#FFF',
                    alignSelf: notifications[item.key] ? 'flex-end' : 'flex-start',
                  }}
                />
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {/* Folder Settings */}
        <View
          style={{
            backgroundColor: '#FFF',
            borderRadius: 16,
            padding: 16,
            marginBottom: 16,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.08,
            shadowRadius: 8,
            elevation: 2,
          }}
        >
          <Text style={{ fontSize: 18, fontWeight: '700', color: '#1A1A2E', marginBottom: 16 }}>
            Carpetas
          </Text>

          <TouchableOpacity
            onPress={() => Alert.alert('Carpeta de entrada', 'Selecciona la carpeta de entrada')}
            activeOpacity={0.7}
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              paddingVertical: 12,
            }}
          >
            <View>
              <Text style={{ fontSize: 14, color: '#1A1A2E', marginBottom: 4 }}>
                Carpeta de entrada
              </Text>
              <Text style={{ fontSize: 12, color: '#666' }}>
                /storage/emulated/0/ResellHub/
              </Text>
            </View>
            <Icon name="folder" size={20} color="#FF6B35" />
          </TouchableOpacity>
        </View>

        {/* Actions */}
        <TouchableOpacity
          onPress={() => {
            Alert.alert(
              'Procesar Productos',
              '¿Quieres escanear la carpeta en busca de nuevos productos?',
              [
                { text: 'Cancelar', style: 'cancel' },
                { 
                  text: 'Procesar', 
                  onPress: () => {
                    Alert.alert('Éxito', 'Se han procesado 3 nuevos productos');
                  }
                },
              ]
            );
          }}
          activeOpacity={0.8}
          style={{
            backgroundColor: '#FF6B35',
            borderRadius: 12,
            padding: 18,
            alignItems: 'center',
            marginBottom: 12,
            shadowColor: '#FF6B35',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.3,
            shadowRadius: 8,
            elevation: 6,
          }}
        >
          <Text style={{ fontSize: 16, fontWeight: '700', color: '#FFF' }}>
            Procesar Nuevos Productos
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => {
            Alert.alert('Exportar', 'Estadísticas exportadas correctamente');
          }}
          activeOpacity={0.8}
          style={{
            backgroundColor: '#FFF',
            borderRadius: 12,
            padding: 18,
            alignItems: 'center',
            borderWidth: 2,
            borderColor: '#E8E8E8',
          }}
        >
          <Text style={{ fontSize: 16, fontWeight: '600', color: '#666' }}>
            Exportar Estadísticas
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

// ============== NAVIGATION ==============

const Tab = createBottomTabNavigator();

export default function App() {
  return (
    <NavigationContainer>
      <Tab.Navigator
        screenOptions={({ route }) => ({
          headerShown: false,
          tabBarIcon: ({ focused, color, size }) => {
            let iconName;

            if (route.name === 'Dashboard') {
              iconName = 'home';
            } else if (route.name === 'Products') {
              iconName = 'package';
            } else if (route.name === 'Stats') {
              iconName = 'bar-chart-2';
            } else if (route.name === 'Settings') {
              iconName = 'settings';
            }

            return <Icon name={iconName} size={size} color={color} />;
          },
          tabBarActiveTintColor: '#FF6B35',
          tabBarInactiveTintColor: '#999',
          tabBarStyle: {
            height: 70,
            paddingBottom: 16,
            paddingTop: 8,
            borderTopWidth: 0,
            elevation: 8,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: -2 },
            shadowOpacity: 0.1,
            shadowRadius: 8,
            backgroundColor: '#FFFFFF',
          },
          tabBarLabelStyle: {
            fontSize: 11,
            fontWeight: '600',
          },
        })}
      >
        <Tab.Screen name="Dashboard" component={DashboardScreen} options={{ tabBarLabel: 'Inicio' }} />
        <Tab.Screen name="Products" component={ProductsScreen} options={{ tabBarLabel: 'Productos' }} />
        <Tab.Screen name="Stats" component={StatsScreen} options={{ tabBarLabel: 'Stats' }} />
        <Tab.Screen name="Settings" component={SettingsScreen} options={{ tabBarLabel: 'Ajustes' }} />
      </Tab.Navigator>
    </NavigationContainer>
  );
}
