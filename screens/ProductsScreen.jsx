import React, { useState, useEffect } from 'react';
import { 
  View, Text, TextInput, FlatList, TouchableOpacity, Image, 
  StyleSheet, Modal, ScrollView, Platform 
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import Icon from 'react-native-vector-icons/Feather';
import LogService from '../services/LogService';
import { DatabaseService } from '../services/DatabaseService';

export default function ProductsScreen({ navigation }) {
  const [products, setProducts] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [images, setImages] = useState([]);
  const [existingTags, setExistingTags] = useState([]);
  const [errors, setErrors] = useState({}); 
  const [form, setForm] = useState({ title: '', description: '', price: '', category: '' });

  const loadData = () => {
    try {
      const data = DatabaseService.getAllProducts();
      const onlyActive = data.filter(p => p.status !== 'sold'); 
      setProducts(onlyActive);
      
      const tagsMap = data.flatMap(p => p.tags ? p.tags.split(',').map(t => t.trim()) : []);
      setExistingTags([...new Set(tagsMap)].filter(t => t.length > 0));
    } catch (e) {
      LogService.error("Error cargando inventario: " + e.message);
    }
  };

  useEffect(() => {
    loadData();
    const unsubscribe = navigation.addListener('focus', loadData);
    return unsubscribe;
  }, [navigation]);

  // LOGICA ESTRATÉGICA: Cálculo de tiempo en stock
  const getStockStatus = (createdAt) => {
    const createdDate = new Date(createdAt);
    const today = new Date();
    const diffDays = Math.ceil((today - createdDate) / (1000 * 60 * 60 * 24));
    
    if (diffDays >= 30) return { label: 'ESTANCADO', color: '#E63946', days: diffDays }; // Rojo/Naranja fuerte
    if (diffDays >= 15) return { label: 'SIN MOVIMIENTO', color: '#FFB703', days: diffDays }; // Amarillo/Dorado
    return null; 
  };

  const pickImage = async (fromCamera = false) => {
    try {
      const permission = fromCamera 
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permission.granted) {
        LogService.error("Permiso de medios denegado");
        return;
      }

      const result = fromCamera 
        ? await ImagePicker.launchCameraAsync({ quality: 0.7, allowsEditing: true })
        : await ImagePicker.launchImageLibraryAsync({ 
            allowsMultipleSelection: true, 
            selectionLimit: 10,
            quality: 0.7 
          });

      if (!result.canceled) {
        const uris = result.assets.map(a => a.uri);
        setImages(prev => [...prev, ...uris]);
      }
    } catch (e) {
      LogService.error("Error al seleccionar imagen: " + e.message);
    }
  };

  const handlePublish = () => {
    let currentErrors = {};
    if (!form.title.trim()) currentErrors.title = true;
    if (!form.price.trim()) currentErrors.price = true;
    if (!form.category.trim()) currentErrors.category = true;
    if (images.length < 3) currentErrors.images = true;

    setErrors(currentErrors);
    if (Object.keys(currentErrors).length > 0) return;

    const newProduct = { 
      ...form, 
      images, 
      id: Date.now().toString(),
      createdAt: new Date().toISOString(),
      status: 'active'
    };

    if (DatabaseService.saveProduct(newProduct)) {
      setShowModal(false);
      setForm({ title: '', description: '', price: '', category: '' });
      setImages([]);
      loadData();
    }
  };

  const renderProductItem = ({ item }) => {
    const status = getStockStatus(item.createdAt);
    
    return (
      <TouchableOpacity 
        style={styles.productCard} 
        onPress={() => navigation.navigate('ProductDetail', { product: item })}
      >
        <View style={styles.imageContainer}>
          <Image source={{ uri: item.images[0] }} style={styles.thumbnail} />
          <View style={styles.photoBadge}>
            <Text style={styles.photoCount}>{item.images.length}</Text>
          </View>
        </View>
        
        <View style={styles.cardContent}>
          <Text style={styles.productTitle} numberOfLines={1}>{item.title}</Text>
          <Text style={styles.productPrice}>{item.price}€</Text>
          
          {/* VISUALIZACIÓN DE ALERTAS DE STOCK FRÍO */}
          {status && (
            <View style={[styles.alertBadge, { backgroundColor: status.color + '15' }]}>
              <Icon name="clock" size={12} color={status.color} />
              <Text style={[styles.alertText, { color: status.color }]}>
                {status.label} ({status.days}d)
              </Text>
            </View>
          )}
        </View>
        
        <Icon name="chevron-right" size={20} color="#CCC" />
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Mi Inventario</Text>
        <TouchableOpacity style={styles.btnAdd} onPress={() => setShowModal(true)}>
          <Icon name="plus" size={24} color="#FFF" />
        </TouchableOpacity>
      </View>

      <FlatList
        data={products}
        keyExtractor={item => item.id}
        renderItem={renderProductItem}
        contentContainerStyle={{ paddingBottom: 100 }}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Icon name="package" size={50} color="#DDD" />
            <Text style={styles.emptyText}>No hay productos activos</Text>
          </View>
        }
      />

      <Modal visible={showModal} animationType="slide">
        <View style={styles.modalRoot}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Nuevo Producto</Text>
            <TouchableOpacity onPress={() => setShowModal(false)}>
              <Icon name="x" size={24} color="#333" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.formContent}>
            <Text style={styles.label}>FOTOS (Mínimo 3) *</Text>
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

            {images.length > 0 && (
              <ScrollView horizontal style={styles.previewWrapper}>
                {images.map((uri, i) => (
                  <View key={i} style={styles.previewItem}>
                    <Image source={{ uri }} style={styles.previewThumb} />
                    <TouchableOpacity 
                      style={styles.removePhoto} 
                      onPress={() => setImages(images.filter((_, idx) => idx !== i))}
                    >
                      <Icon name="x-circle" size={18} color="#E63946" />
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>
            )}

            <Text style={styles.label}>Título *</Text>
            <TextInput style={styles.input} value={form.title} onChangeText={t => setForm({...form, title: t})} />

            <Text style={styles.label}>Precio (€) *</Text>
            <TextInput style={styles.input} value={form.price} keyboardType="numeric" onChangeText={t => setForm({...form, price: t})} />

            <Text style={styles.label}>Categoría *</Text>
            <TextInput style={styles.input} value={form.category} onChangeText={t => setForm({...form, category: t})} />

            <TouchableOpacity style={styles.btnSubmit} onPress={handlePublish}>
              <Text style={styles.btnText}>Guardar Producto</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 25, paddingTop: 60, backgroundColor: '#FFF' },
  headerTitle: { fontSize: 24, fontWeight: '800', color: '#1A1A2E' },
  btnAdd: { backgroundColor: '#FF6B35', width: 48, height: 48, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  productCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', borderRadius: 20, padding: 12, marginBottom: 12, marginHorizontal: 20, elevation: 3, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 10 },
  imageContainer: { position: 'relative' },
  thumbnail: { width: 80, height: 80, borderRadius: 15 },
  photoBadge: { position: 'absolute', bottom: -5, right: -5, backgroundColor: '#1A1A2E', paddingHorizontal: 6, borderRadius: 6 },
  photoCount: { color: '#FFF', fontSize: 10, fontWeight: 'bold' },
  cardContent: { flex: 1, marginLeft: 15 },
  productTitle: { fontSize: 16, fontWeight: '700', color: '#1A1A2E' },
  productPrice: { fontSize: 20, fontWeight: '900', color: '#FF6B35', marginVertical: 2 },
  
  // ESTILOS DE ALERTAS (PILAR 2)
  alertBadge: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, marginTop: 5 },
  alertText: { fontSize: 10, fontWeight: '900', marginLeft: 4 },

  modalRoot: { flex: 1, backgroundColor: '#FFF' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', padding: 25, borderBottomWidth: 1, borderColor: '#EEE' },
  modalTitle: { fontSize: 20, fontWeight: '800' },
  formContent: { padding: 25 },
  label: { fontSize: 14, fontWeight: '700', marginBottom: 8, color: '#333' },
  photoRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  photoActionBtn: { flex: 1, flexDirection: 'row', backgroundColor: '#F8F9FA', padding: 15, borderRadius: 12, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#EEE' },
  photoActionText: { marginLeft: 8, color: '#FF6B35', fontWeight: 'bold' },
  previewWrapper: { marginBottom: 20, flexDirection: 'row' },
  previewItem: { position: 'relative', marginRight: 10 },
  previewThumb: { width: 80, height: 80, borderRadius: 12 },
  removePhoto: { position: 'absolute', top: -5, right: -5, backgroundColor: '#FFF', borderRadius: 10 },
  input: { backgroundColor: '#F8F9FA', borderRadius: 12, padding: 15, fontSize: 16, marginBottom: 15, borderWidth: 1, borderColor: '#EEE' },
  btnSubmit: { backgroundColor: '#FF6B35', padding: 20, borderRadius: 16, alignItems: 'center', marginTop: 10 },
  btnText: { color: '#FFF', fontSize: 16, fontWeight: 'bold' },
  emptyContainer: { alignItems: 'center', marginTop: 100 },
  emptyText: { color: '#CCC', marginTop: 10, fontWeight: '600' }
});