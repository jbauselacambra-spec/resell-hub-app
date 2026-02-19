import React, { useState } from 'react';
import { 
  View, Text, ScrollView, Image, StyleSheet, Dimensions, 
  TouchableOpacity, Platform 
} from 'react-native';
import Icon from 'react-native-vector-icons/Feather';

const { width } = Dimensions.get('window');

export default function ProductDetailScreen({ route, navigation }) {
  const { product } = route.params || {};
  const [activeIndex, setActiveIndex] = useState(0);

  if (!product) return null;

  const handleScroll = (event) => {
    const index = Math.round(event.nativeEvent.contentOffset.x / width);
    setActiveIndex(index);
  };

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.carouselWrapper}>
          <ScrollView 
            horizontal pagingEnabled 
            showsHorizontalScrollIndicator={false}
            onScroll={handleScroll}
            scrollEventThrottle={16}
          >
            {product.images?.map((uri, i) => (
              <Image key={i} source={{ uri }} style={styles.mainImage} />
            ))}
          </ScrollView>

          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Icon name="chevron-left" size={28} color="#1A1A2E" />
          </TouchableOpacity>

          <View style={styles.pagination}>
            {product.images?.map((_, i) => (
              <View key={i} style={[styles.dot, activeIndex === i ? styles.activeDot : styles.inactiveDot]} />
            ))}
          </View>
        </View>

        <View style={styles.content}>
          <Text style={styles.categoryBadge}>{product.category}</Text>
          <Text style={styles.title}>{product.title}</Text>
          <Text style={styles.price}>{product.price}€</Text>
          <View style={styles.divider} />
          <Text style={styles.descriptionText}>{product.description}</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF' },
  carouselWrapper: { position: 'relative', height: 400 },
  mainImage: { width: width, height: 400, resizeMode: 'cover' },
  backBtn: { position: 'absolute', top: 50, left: 20, backgroundColor: '#FFF', padding: 10, borderRadius: 15 },
  pagination: { position: 'absolute', bottom: 25, flexDirection: 'row', alignSelf: 'center' },
  dot: { height: 8, borderRadius: 4, marginHorizontal: 4 },
  activeDot: { width: 22, backgroundColor: '#FF6B35' },
  inactiveDot: { width: 8, backgroundColor: '#FFF' },
  content: { padding: 25, marginTop: -30, backgroundColor: '#FFF', borderTopLeftRadius: 30, borderTopRightRadius: 30 },
  categoryBadge: { color: '#FF6B35', fontWeight: 'bold', marginBottom: 10 },
  title: { fontSize: 26, fontWeight: '800' },
  price: { fontSize: 32, fontWeight: '900', color: '#FF6B35' },
  divider: { height: 1, backgroundColor: '#F0F0F0', marginVertical: 20 },
  descriptionText: { fontSize: 16, color: '#4A4A4A', lineHeight: 24 }
});