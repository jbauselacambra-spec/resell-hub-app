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
      // FILTRO CRUCIAL: Solo mostramos lo que NO esté vendido
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

  const pickImage = async (fromCamera = false) => {
    try {
      const permission = fromCamera 
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permission.granted) {
        LogService.error("Permiso de medios denegado por el usuario");
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
        // IMPORTANTE: Actualizamos el estado de imágenes correctamente para la previsualización
        setImages(prev => {
            const newImages = [...prev, ...uris];
            if (newImages.length >= 3) setErrors(err => ({ ...err, images: false }));
            return newImages;
        });
        LogService.success(`Imágenes preparadas: ${uris.length}`);
      }
    } catch (e) {
      LogService.error("Error al seleccionar imagen: " + e.message);
    }
  };

  const handlePublish = () => {
    try {
      let currentErrors = {};
      if (!form.title.trim()) currentErrors.title = true;
      if (!form.description.trim()) currentErrors.description = true;
      if (!form.price.trim()) currentErrors.price = true;
      if (!form.category.trim()) currentErrors.category = true;
      if (images.length < 3) currentErrors.images = true;

      setErrors(currentErrors);

      if (Object.keys(currentErrors).length > 0) {
        LogService.info("Intento de publicación bloqueado: Campos incompletos");
        return;
      }

      const titleWords = form.title.toLowerCase().split(' ').filter(w => w.length > 3);
      const finalTags = [...new Set([...titleWords, form.category.trim()])].join(', ');

      const newProduct = { 
        ...form, 
        images, 
        tags: finalTags,
        id: Date.now().toString(),
        createdAt: new Date().toISOString()
      };

      if (DatabaseService.saveProduct(newProduct)) {
        LogService.success(`Producto guardado: ${form.title}`);
        setShowModal(false);
        setForm({ title: '', description: '', price: '', category: '' });
        setImages([]);
        setErrors({});
        loadData();
      }
    } catch (e) {
      LogService.error("Error crítico al publicar: " + e.message);
    }
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
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.productCard} onPress={() => navigation.navigate('ProductDetail', { product: item })}>
            <View style={styles.imageContainer}>
              <Image source={{ uri: item.images[0] }} style={styles.thumbnail} />
              <View style={styles.photoBadge}><Text style={styles.photoCount}>{item.images.length}</Text></View>
            </View>
            <View style={styles.cardContent}>
              <Text style={styles.productTitle}>{item.title}</Text>
              <Text style={styles.productPrice}>{item.price}€</Text>
            </View>
            <Icon name="chevron-right" size={20} color="#CCC" />
          </TouchableOpacity>
        )}
      />

      <Modal visible={showModal} animationType="slide">
        <View style={styles.modalRoot}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Nuevo Producto</Text>
            <TouchableOpacity onPress={() => setShowModal(false)}><Icon name="x" size={24} color="#333" /></TouchableOpacity>
          </View>

          <ScrollView style={styles.formContent} keyboardShouldPersistTaps="handled">
            {/* SECCIÓN FOTOS */}
            <Text style={[styles.label, errors.images && {color: '#E63946'}]}>FOTOS (Mínimo 3) *</Text>
            <View style={styles.photoRow}>
              <TouchableOpacity style={[styles.photoActionBtn, errors.images && styles.inputError]} onPress={() => pickImage(true)}>
                <Icon name="camera" size={20} color="#FF6B35" /><Text style={styles.photoActionText}>Cámara</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.photoActionBtn, errors.images && styles.inputError]} onPress={() => pickImage(false)}>
                <Icon name="image" size={20} color="#FF6B35" /><Text style={styles.photoActionText}>Galería</Text>
              </TouchableOpacity>
            </View>
            
            {/* MENSAJE DE ERROR PARA FOTOS */}
            {errors.images && (
                <Text style={styles.errorTextUnder}>Faltan {3 - images.length} fotos para cumplir el mínimo.</Text>
            )}

            {/* PREVISUALIZACIÓN DE IMÁGENES (FIXED) */}
            {images.length > 0 && (
                <View style={styles.previewWrapper}>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
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
                </View>
            )}

            <Text style={styles.label}>Título *</Text>
            <TextInput style={[styles.input, errors.title && styles.inputError]} value={form.title} onChangeText={t => setForm({...form, title: t})} placeholder="Nombre" />

            <Text style={styles.label}>Precio (€) *</Text>
            <TextInput style={[styles.input, errors.price && styles.inputError]} value={form.price} onChangeText={t => setForm({...form, price: t})} keyboardType="numeric" placeholder="0.00" />

            <Text style={styles.label}>Descripción *</Text>
            <TextInput style={[styles.input, styles.textArea, errors.description && styles.inputError]} value={form.description} onChangeText={t => setForm({...form, description: t})} multiline placeholder="Estado y detalles" />

            <Text style={styles.label}>Categoría *</Text>
            <TextInput style={[styles.input, errors.category && styles.inputError]} value={form.category} onChangeText={t => setForm({...form, category: t})} placeholder="Escribe o selecciona..." />

            {/* SUGERENCIAS */}
            {existingTags.length > 0 && form.category.length > 0 && (
              <View style={styles.suggestionsContainer}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {existingTags.filter(tag => tag.toLowerCase().includes(form.category.toLowerCase())).map((tag, i) => (
                    <TouchableOpacity key={i} style={styles.tagSuggestion} onPress={() => setForm({...form, category: tag})}>
                      <Text style={styles.tagSuggestionText}># {tag}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}

            <TouchableOpacity style={styles.btnSubmit} onPress={handlePublish}>
              <Text style={styles.btnText}>Guardar Producto</Text>
            </TouchableOpacity>
            <View style={{height: 60}} />
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
  productCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', borderRadius: 16, padding: 12, marginBottom: 12, marginHorizontal: 20, elevation: 2 },
  imageContainer: { position: 'relative' },
  thumbnail: { width: 70, height: 70, borderRadius: 12 },
  photoBadge: { position: 'absolute', bottom: -5, right: -5, backgroundColor: '#1A1A2E', paddingHorizontal: 6, borderRadius: 6 },
  photoCount: { color: '#FFF', fontSize: 10, fontWeight: 'bold' },
  cardContent: { flex: 1, marginLeft: 15 },
  productTitle: { fontSize: 16, fontWeight: '700' },
  productPrice: { fontSize: 18, fontWeight: '800', color: '#FF6B35' },
  modalRoot: { flex: 1, backgroundColor: '#FFF' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', padding: 25, borderBottomWidth: 1, borderColor: '#EEE' },
  modalTitle: { fontSize: 20, fontWeight: '800' },
  formContent: { padding: 25 },
  label: { fontSize: 14, fontWeight: '700', marginBottom: 8, color: '#333' },
  errorTextUnder: { color: '#E63946', fontSize: 12, fontWeight: '600', marginTop: -15, marginBottom: 15 },
  photoRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  photoActionBtn: { flex: 1, flexDirection: 'row', backgroundColor: '#FF6B3510', padding: 15, borderRadius: 12, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#FF6B3520' },
  photoActionText: { marginLeft: 8, color: '#FF6B35', fontWeight: 'bold' },
  previewWrapper: { marginBottom: 20 },
  previewItem: { position: 'relative', marginRight: 10 },
  previewThumb: { width: 80, height: 80, borderRadius: 12 },
  removePhoto: { position: 'absolute', top: -5, right: -5, backgroundColor: '#FFF', borderRadius: 10 },
  input: { backgroundColor: '#F8F9FA', borderRadius: 12, padding: 15, fontSize: 16, marginBottom: 15, borderWidth: 1, borderColor: '#EEE' },
  inputError: { borderColor: '#E63946', backgroundColor: '#FFF5F5' },
  textArea: { height: 80, textAlignVertical: 'top' },
  suggestionsContainer: { marginTop: -10, marginBottom: 15 },
  tagSuggestion: { backgroundColor: '#FF6B3520', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, marginRight: 8 },
  tagSuggestionText: { color: '#FF6B35', fontWeight: 'bold' },
  btnSubmit: { backgroundColor: '#FF6B35', padding: 20, borderRadius: 16, alignItems: 'center' },
  btnText: { color: '#FFF', fontSize: 16, fontWeight: 'bold' }
});