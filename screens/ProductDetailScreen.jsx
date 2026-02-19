import React from 'react';
import { View, Text, ScrollView, Image, StyleSheet, Dimensions } from 'react-native';
import LogService from '../services/LogService';

const { width } = Dimensions.get('window');

export default function ProductDetailScreen({ route }) {
  // Recibimos el producto por parámetros de navegación
  const { product } = route.params || {};

  if (!product) {
    LogService.error("Fallo al cargar detalle: No se recibieron datos del producto");
    return (
      <View style={styles.center}><Text>Error al cargar producto</Text></View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      {/* Carrusel de Imágenes */}
      <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false}>
        {product.images && product.images.length > 0 ? (
          product.images.map((uri, i) => (
            <Image key={i} source={{ uri }} style={styles.image} />
          ))
        ) : (
          <View style={[styles.image, styles.noImage]}><Text>Sin imágenes</Text></View>
        )}
      </ScrollView>

      <View style={styles.infoContainer}>
        <Text style={styles.price}>{product.price}€</Text>
        <Text style={styles.title}>{product.title}</Text>
        
        <View style={styles.divider} />
        
        <Text style={styles.sectionTitle}>Descripción</Text>
        <Text style={styles.description}>{product.description || 'Sin descripción disponible.'}</Text>

        <View style={styles.divider} />

        <Text style={styles.sectionTitle}>Etiquetas SEO (Meta-data)</Text>
        <View style={styles.tagContainer}>
          {product.tags.split(',').map((tag, i) => (
            <View key={i} style={styles.tag}>
              <Text style={styles.tagText}>#{tag.trim()}</Text>
            </View>
          ))}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  image: { width: width, height: 350, resizeMode: 'cover' },
  noImage: { backgroundColor: '#f0f0f0', justifyContent: 'center', alignItems: 'center' },
  infoContainer: { padding: 20 },
  price: { fontSize: 28, fontWeight: 'bold', color: '#FF6B35', marginBottom: 5 },
  title: { fontSize: 22, fontWeight: '600', color: '#333' },
  divider: { height: 1, backgroundColor: '#eee', marginVertical: 15 },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', color: '#666', marginBottom: 10 },
  description: { fontSize: 15, color: '#444', lineHeight: 22 },
  tagContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tag: { backgroundColor: '#f0faff', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 15, borderWidth: 1, borderColor: '#bcdff1' },
  tagText: { color: '#2a7596', fontSize: 12, fontWeight: '500' }
});