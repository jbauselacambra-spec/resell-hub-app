import React from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity } from 'react-native';
import Icon from 'react-native-vector-icons/Feather';

// Colores del DESIGN_SYSTEM.md
const COLORS = {
  primary: '#FF6B35',
  success: '#00D9A3',
  warning: '#FFB800',
  secondary: '#004E89',
  text: '#1A1A2E',
  lightGray: '#F8F9FA'
};

export const ProductCard = ({ product, onPress }) => {
  // Determinamos el color del badge según el estado
  const getStatusConfig = (status) => {
    switch(status) {
      case 'sold': return { color: COLORS.success, label: 'Vendido' };
      case 'needs_repost': return { color: COLORS.warning, label: 'Resubir' };
      default: return { color: COLORS.secondary, label: 'Activo' };
    }
  };

  const statusConfig = getStatusConfig(product.status);

  return (
    <TouchableOpacity 
      style={styles.card} 
      onPress={onPress}
      activeOpacity={0.8}
    >
      {/* Imagen con el recorte visual aplicado en la UI */}
      <Image 
        source={{ uri: product.images[0] }} 
        style={styles.image} 
      />
      
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.brand}>{product.brand}</Text>
          <View style={[styles.badge, { backgroundColor: statusConfig.color + '20' }]}>
            <Text style={[styles.badgeText, { color: statusConfig.color }]}>
              {statusConfig.label}
            </Text>
          </View>
        </View>

        <Text style={styles.title} numberOfLines={1}>{product.title}</Text>
        
        <View style={styles.footer}>
          <Text style={styles.price}>{product.price}€</Text>
          <View style={styles.stats}>
            <Icon name="eye" size={12} color="#666" />
            <Text style={styles.viewsText}>{product.views || 0}</Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    flexDirection: 'row',
    padding: 12,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
  },
  image: {
    width: 80,
    height: 80,
    borderRadius: 12,
    backgroundColor: COLORS.lightGray,
  },
  content: {
    flex: 1,
    marginLeft: 16,
    justifyContent: 'space-between',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  brand: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.secondary,
    textTransform: 'uppercase',
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
    marginVertical: 4,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  price: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.primary,
  },
  stats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  viewsText: {
    fontSize: 12,
    color: '#666',
  }
});