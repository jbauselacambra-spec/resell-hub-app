import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  FlatList, 
  TouchableOpacity, 
  Image, 
  StyleSheet, 
  Modal, 
  ScrollView,
  Platform
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import Icon from 'react-native-vector-icons/Feather';
import LogService from '../services/LogService';
import { DatabaseService } from '../services/DatabaseService';

export default function ProductsScreen({ navigation }) {
  const [products, setProducts] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [images, setImages] = useState([]);
  const [form, setForm] = useState({ 
    title: '', 
    description: '', 
    price: '', 
    category: '' 
  });

  // Cargar inventario al iniciar
  useEffect(() => {
    const data = DatabaseService.getAllProducts();
    setProducts(data);
  }, []);

  // Lógica para capturar imágenes (Cámara/Galería)
  const pickImage = async (fromCamera = false) => {
    const permission = fromCamera 
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      LogService.error("Permiso de cámara/galería denegado");
      return;
    }

    const result = fromCamera 
      ? await ImagePicker.launchCameraAsync({ quality: 0.7 })
      : await ImagePicker.launchImageLibraryAsync({ 
          allowsMultipleSelection: true, 
          selectionLimit: 5, 
          quality: 0.7 
        });

    if (!result.canceled) {
      const uris = result.assets.map(a => a.uri);
      setImages([...images, ...uris]);
      LogService.success(`Imágenes añadidas: ${uris.length}`);
    }
  };

  const handlePublish = () => {
    if (!form.title || !form.price) {
      LogService.error("Intento de publicar sin título o precio");
      return;
    }

    const keywords = form.title.toLowerCase().split(' ').filter(w => w.length > 2);
    const tags = [...new Set([...keywords, form.category])].join(', ');
    
    const newProduct = { 
      ...form, 
      images, 
      tags,
      id: Date.now().toString(),
      createdAt: new Date().toISOString()
    };

    const saved = DatabaseService.saveProduct(newProduct);
    if (saved) {
      setProducts([saved, ...products]);
      setShowModal(false);
      setForm({ title: '', description: '', price: '', category: '' });
      setImages([]);
      LogService.success(`Producto publicado: ${form.title}`);
    }
  };

  const renderProduct = ({ item }) => (
    <TouchableOpacity 
      style={styles.productCard} 
      onPress={() => navigation.navigate('ProductDetail', { product: item })}
    >
      <View style={styles.imageContainer}>
        {item.images.length > 0 ? (
          <Image source={{ uri: item.images[0] }} style={styles.thumbnail} />
        ) : (
          <View style={[styles.thumbnail, styles.emptyPhoto]}><Icon name="image" size={20} color="#CCC" /></View>
        )}
        <View style={styles.photoBadge}>
          <Icon name="camera" size={10} color="#FFF" />
          <Text style={styles.photoCount}>{item.images.length}</Text>
        </View>
      </View>
      <View style={styles.cardContent}>
        <Text style={styles.productTitle} numberOfLines={1}>{item.title}</Text>
        <Text style={styles.productPrice}>{item.price}€</Text>
        <Text style={styles.productCategory}>{item.category || 'General'}</Text>
      </View>
      <Icon name="chevron-right" size={20} color="#CCC" />
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {/* HEADER DE INVENTARIO */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Mi Inventario</Text>
        <TouchableOpacity style={styles.btnAdd} onPress={() => setShowModal(true)}>
          <Icon name="plus" size={24} color="#FFF" />
        </TouchableOpacity>
      </View>

      <FlatList
        data={products}
        keyExtractor={item => item.id}
        renderItem={renderProduct}
        contentContainerStyle={{ padding: 20 }}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Icon name="package" size={50} color="#CCC" />
            <Text style={styles.emptyText}>No hay productos registrados</Text>
          </View>
        }
      />

      {/* MODAL DEL FORMULARIO [Añadir Producto] */}
      <Modal visible={showModal} animationType="slide" onRequestClose={() => setShowModal(false)}>
        <View style={styles.modalRoot}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Añadir Producto</Text>
            <TouchableOpacity onPress={() => setShowModal(false)} style={styles.closeBtn}>
              <Icon name="x" size={24} color="#1A1A2E" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.formContent} showsVerticalScrollIndicator={false}>
            {/* SECCIÓN DE FOTOS */}
            <Text style={styles.sectionLabel}>FOTOS DEL PRODUCTO</Text>
            <View style={styles.photoRow}>
              <TouchableOpacity style={styles.photoActionBtn} onPress={() => pickImage(true)}>
                <Icon name="camera" size={20} color="#FF6B35" />
                <Text style={styles.photoActionText}>Cámara</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.photoActionBtn} onPress={() => pickImage(false)}>
                <Icon name="image" size={20} color="#FF6B35" />
                <Text style={styles.photoActionText}>Galería</Text>
              </TouchableOpacity>
            </View>

            {/* PREVISUALIZACIÓN DE IMÁGENES */}
            {images.length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.previewList}>
                {images.map((uri, i) => (
                  <Image key={i} source={{ uri }} style={styles.previewThumb} />
                ))}
              </ScrollView>
            )}

            {/* CAMPOS DE TEXTO */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Título</Text>
              <TextInput 
                style={styles.input} 
                placeholder="Ej: iPhone 13 Pro Max" 
                onChangeText={t => setForm({...form, title: t})}
              />
              
              <Text style={styles.label}>Precio (€)</Text>
              <TextInput 
                style={styles.input} 
                placeholder="0.00" 
                keyboardType="numeric" 
                onChangeText={t => setForm({...form, price: t})}
              />

              <Text style={styles.label}>Descripción</Text>
              <TextInput 
                style={[styles.input, styles.textArea]} 
                placeholder="Describe el estado del producto..." 
                multiline 
                onChangeText={t => setForm({...form, description: t})}
              />

              <Text style={styles.label}>Categoría (SEO)</Text>
              <TextInput 
                style={styles.input} 
                placeholder="Electrónica, Ropa, etc." 
                onChangeText={t => setForm({...form, category: t})}
              />
            </View>

            <TouchableOpacity style={styles.btnSubmit} onPress={handlePublish}>
              <Text style={styles.btnText}>Publicar en ResellHub</Text>
            </TouchableOpacity>
            <View style={{ height: 50 }} />
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  header: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    paddingHorizontal: 25, 
    paddingTop: Platform.OS === 'android' ? 50 : 60, 
    paddingBottom: 20,
    backgroundColor: '#FFF' 
  },
  headerTitle: { fontSize: 24, fontWeight: '800', color: '#1A1A2E' },
  btnAdd: { backgroundColor: '#FF6B35', width: 48, height: 48, borderRadius: 14, justifyContent: 'center', alignItems: 'center', elevation: 4 },
  
  // TARJETAS DE INVENTARIO
  productCard: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: '#FFF', 
    borderRadius: 16, 
    padding: 12, 
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#F0F0F0',
    elevation: 1
  },
  imageContainer: { position: 'relative' },
  thumbnail: { width: 75, height: 75, borderRadius: 12, backgroundColor: '#F8F9FA' },
  emptyPhoto: { justifyContent: 'center', alignItems: 'center', borderStyle: 'dashed', borderWidth: 1, borderColor: '#CCC' },
  photoBadge: { 
    position: 'absolute', 
    bottom: -4, 
    right: -4, 
    backgroundColor: '#1A1A2E', 
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingHorizontal: 6, 
    paddingVertical: 2, 
    borderRadius: 6 
  },
  photoCount: { color: '#FFF', fontSize: 10, fontWeight: 'bold', marginLeft: 3 },
  cardContent: { flex: 1, marginLeft: 15 },
  productTitle: { fontSize: 16, fontWeight: '700', color: '#1A1A2E' },
  productPrice: { fontSize: 18, fontWeight: '800', color: '#FF6B35' },
  productCategory: { fontSize: 11, color: '#999', textTransform: 'uppercase', marginTop: 2 },
  
  // ESTILOS DEL MODAL
  modalRoot: { flex: 1, backgroundColor: '#FFF' },
  modalHeader: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    padding: 25, 
    borderBottomWidth: 1, 
    borderBottomColor: '#F0F0F0' 
  },
  modalTitle: { fontSize: 20, fontWeight: '800', color: '#1A1A2E' },
  formContent: { padding: 25 },
  sectionLabel: { fontSize: 12, fontWeight: '800', color: '#999', marginBottom: 15, letterSpacing: 1 },
  photoRow: { flexDirection: 'row', gap: 12, marginBottom: 20 },
  photoActionBtn: { 
    flex: 1, 
    flexDirection: 'row', 
    backgroundColor: '#FF6B3510', 
    padding: 15, 
    borderRadius: 12, 
    justifyContent: 'center', 
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FF6B3520'
  },
  photoActionText: { marginLeft: 8, fontWeight: '700', color: '#FF6B35' },
  previewList: { marginBottom: 25 },
  previewThumb: { width: 80, height: 80, borderRadius: 12, marginRight: 10 },
  
  // INPUTS
  inputGroup: { marginBottom: 20 },
  label: { fontSize: 14, fontWeight: '700', color: '#1A1A2E', marginBottom: 8 },
  input: { 
    backgroundColor: '#F8F9FA', 
    borderRadius: 12, 
    padding: 15, 
    fontSize: 16, 
    color: '#1A1A2E', 
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#F0F0F0'
  },
  textArea: { height: 100, textAlignVertical: 'top' },
  btnSubmit: { 
    backgroundColor: '#FF6B35', 
    padding: 20, 
    borderRadius: 16, 
    alignItems: 'center', 
    elevation: 4,
    shadowColor: '#FF6B35',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8
  },
  btnText: { color: '#FFF', fontSize: 16, fontWeight: '800' },
  emptyState: { alignItems: 'center', marginTop: 100 },
  emptyText: { color: '#999', marginTop: 10, fontSize: 16 }
});