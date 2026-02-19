import React from 'react';
import { View, Text, ScrollView, Image, StyleSheet, Dimensions, TouchableOpacity } from 'react-native';
import Icon from 'react-native-vector-icons/Feather';

const { width } = Dimensions.get('window');

export default function SoldDetailView({ route, navigation }) {
  const { product } = route.params;

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Cabecera con Imagen */}
        <View style={styles.imageContainer}>
          <ScrollView horizontal pagingEnabled>
            {product.images.map((uri, i) => (
              <Image key={i} source={{ uri }} style={styles.image} />
            ))}
          </ScrollView>
          
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Icon name="arrow-left" size={24} color="#1A1A2E" />
          </TouchableOpacity>
        </View>

        <View style={styles.content}>
          <View style={styles.statusBadge}>
            <Icon name="check-circle" size={14} color="#FFF" />
            <Text style={styles.statusText}>VENTA FINALIZADA</Text>
          </View>

          <Text style={styles.title}>{product.title}</Text>
          
          {/* Bloque Económico de la Venta */}
          <View style={styles.statsCard}>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>PRECIO INICIAL</Text>
              <Text style={styles.oldPrice}>{product.price}€</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>VENDIDO POR</Text>
              <Text style={styles.soldPriceText}>{product.soldPrice}€</Text>
            </View>
          </View>

          <View style={styles.infoRow}>
            <Icon name="calendar" size={18} color="#999" />
            <Text style={styles.infoText}>Vendido el {new Date(product.soldAt).toLocaleDateString()}</Text>
          </View>

          <View style={styles.infoRow}>
            <Icon name="tag" size={18} color="#999" />
            <Text style={styles.infoText}>Categoría: {product.category}</Text>
          </View>

          <Text style={styles.descriptionTitle}>Descripción del artículo</Text>
          <Text style={styles.description}>{product.description}</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF' },
  imageContainer: { height: 350, position: 'relative' },
  image: { width: width, height: 350, resizeMode: 'cover' },
  backBtn: { position: 'absolute', top: 50, left: 20, backgroundColor: '#FFF', width: 45, height: 45, borderRadius: 23, justifyContent: 'center', alignItems: 'center', elevation: 5 },
  content: { padding: 25, marginTop: -20, backgroundColor: '#FFF', borderTopLeftRadius: 25, borderTopRightRadius: 25 },
  statusBadge: { backgroundColor: '#00D9A3', flexDirection: 'row', alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, alignItems: 'center', marginBottom: 15 },
  statusText: { color: '#FFF', fontWeight: 'bold', fontSize: 11, marginLeft: 5 },
  title: { fontSize: 28, fontWeight: '800', color: '#1A1A2E', marginBottom: 20 },
  statsCard: { backgroundColor: '#1A1A2E', borderRadius: 20, padding: 20, flexDirection: 'row', alignItems: 'center', marginBottom: 25 },
  statItem: { flex: 1, alignItems: 'center' },
  statLabel: { color: 'rgba(255,255,255,0.5)', fontSize: 10, fontWeight: 'bold', marginBottom: 5 },
  oldPrice: { color: '#FFF', fontSize: 18, textDecorationLine: 'line-through', opacity: 0.6 },
  soldPriceText: { color: '#00D9A3', fontSize: 26, fontWeight: '900' },
  divider: { width: 1, height: 40, backgroundColor: 'rgba(255,255,255,0.1)' },
  infoRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  infoText: { marginLeft: 10, color: '#666', fontSize: 14, fontWeight: '500' },
  descriptionTitle: { fontSize: 16, fontWeight: '700', color: '#1A1A2E', marginTop: 15, marginBottom: 8 },
  description: { fontSize: 15, color: '#444', lineHeight: 22 }
});