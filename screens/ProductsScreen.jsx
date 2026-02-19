import React, { useState, useEffect } from 'react';
import { 
  View, Text, TextInput, FlatList, TouchableOpacity, Image, 
  StyleSheet, Modal, ScrollView, Dimensions, ActivityIndicator, Alert 
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import Icon from 'react-native-vector-icons/Feather';
import { DatabaseService } from '../services/DatabaseService';
import { AIService } from '../services/AIService';

const { width } = Dimensions.get('window');

export default function ProductsScreen({ navigation }) {
  const [products, setProducts] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [images, setImages] = useState([]);
  const [loadingAI, setLoadingAI] = useState(false);
  const [existingTags, setExistingTags] = useState([]);
  const [existingBrands, setExistingBrands] = useState([]);
  const [errors, setErrors] = useState({});

  const [form, setForm] = useState({ 
    title: '', 
    description: '', 
    price: '', 
    brand: '', 
    condition: 'Muy bueno',
    seoTags: '' 
  });

  const loadData = () => {
    try {
      const data = DatabaseService.getAllProducts() || [];
      setProducts(data.filter(p => p && p.status !== 'sold'));
      
      const brands = data.map(p => p.brand).filter(b => b && typeof b === 'string');
      setExistingBrands([...new Set(brands)]);

      const tags = data.flatMap(p => p.tags ? p.tags.split(',').map(t => t.trim()) : []);
      setExistingTags([...new Set(tags)].filter(t => t));
    } catch (error) {
      console.error("Error al cargar datos:", error);
    }
  };

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', loadData);
    loadData();
    return unsubscribe;
  }, [navigation]);

  // FILTROS EN TIEMPO REAL
  const filteredBrands = existingBrands.filter(b => 
    form.brand && b.toLowerCase().includes(form.brand.toLowerCase()) && b.toLowerCase() !== form.brand.toLowerCase()
  ).slice(0, 5);

  const filteredTags = existingTags.filter(t => {
    const lastTag = form.seoTags.split(',').pop().trim().toLowerCase();
    return lastTag && t.toLowerCase().includes(lastTag) && !form.seoTags.toLowerCase().includes(t.toLowerCase());
  }).slice(0, 5);

  const pickImage = async (useCamera = false) => {
    const permission = useCamera 
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) return Alert.alert("Permiso denegado", "Necesitamos acceso para las fotos.");

    const result = useCamera 
      ? await ImagePicker.launchCameraAsync({ quality: 0.7 })
      : await ImagePicker.launchImageLibraryAsync({ allowsMultipleSelection: true, quality: 0.7 });

    if (!result.canceled) {
      const newUris = result.assets.map(a => a.uri);
      setImages([...images, ...newUris]);
    }
  };

  const runMagiaIA = async () => {
    if (!form.title) return Alert.alert("Aviso", "Escribe un título para que la IA trabaje.");
    setLoadingAI(true);
    try {
      const result = await AIService.analyzeProduct(form.title);
      setForm({
        ...form,
        brand: result.brand || form.brand,
        price: result.price?.toString() || form.price,
        description: result.description || form.description,
        seoTags: result.seoTags || form.seoTags
      });
      setErrors({});
    } catch (e) {
      Alert.alert("Error", "Fallo al conectar con la IA.");
    } finally {
      setLoadingAI(false);
    }
  };

  const handleQuickAdd = (type, value) => {
    if (type === 'brand') {
      setForm({ ...form, brand: value });
    } else {
      const parts = form.seoTags.split(',').map(t => t.trim());
      parts.pop(); // Quita lo que estaba escribiendo el usuario
      const newTags = [...parts, value].join(', ');
      setForm({ ...form, seoTags: newTags + ', ' });
    }
  };

  const handleSave = () => {
    let newErrors = {};
    if (images.length < 3) newErrors.images = "Mínimo 3 fotos";
    if (!form.title.trim()) newErrors.title = "Título obligatorio";
    if (!form.brand.trim()) newErrors.brand = "Marca obligatoria";
    if (!form.description.trim()) newErrors.description = "Descripción obligatoria";
    if (!form.price) newErrors.price = "Indica un precio";
    if (!form.seoTags.trim()) newErrors.seoTags = "Etiquetas obligatorias"; // NUEVA VALIDACIÓN

    if (Object.keys(newErrors).length > 0) return setErrors(newErrors);

    DatabaseService.saveProduct({
      ...form,
      id: Date.now().toString(),
      images,
      status: 'available',
      createdAt: new Date().toISOString(),
      tags: form.seoTags
    });
    
    setShowModal(false);
    resetForm();
    loadData();
  };

  const resetForm = () => {
    setForm({ title: '', description: '', price: '', brand: '', condition: 'Muy bueno', seoTags: '' });
    setImages([]);
    setErrors({});
  };

  const renderItem = ({ item }) => (
    <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('ProductDetail', { product: item })}>
      <Image source={{ uri: item.images[0] }} style={styles.cardImage} />
      <View style={styles.cardPriceTag}><Text style={styles.cardPriceText}>{item.price}€</Text></View>
      <View style={styles.cardInfo}>
        <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
        <Text style={styles.cardBrand}>{item.brand}</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View><Text style={styles.headerSubtitle}>TU INVENTARIO</Text><Text style={styles.headerTitle}>Productos</Text></View>
        <TouchableOpacity style={styles.btnAdd} onPress={() => setShowModal(true)}><Icon name="plus" size={24} color="#FFF" /></TouchableOpacity>
      </View>

      <FlatList data={products} renderItem={renderItem} keyExtractor={item => item.id} numColumns={2} contentContainerStyle={{ paddingHorizontal: 15, paddingBottom: 100 }} />
      
      <Modal visible={showModal} animationType="slide">
        <View style={styles.modalRoot}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowModal(false)}><Icon name="x" size={26} color="#1A1A2E" /></TouchableOpacity>
            <Text style={styles.modalTitle}>Nuevo Artículo</Text>
            <TouchableOpacity style={styles.magicBtn} onPress={runMagiaIA}>
              {loadingAI ? <ActivityIndicator size="small" color="#FFF" /> : <><Icon name="zap" size={14} color="#FFF" /><Text style={styles.magicBtnText}>MAGIA</Text></>}
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.formContent} showsVerticalScrollIndicator={false}>
            {/* FOTOS */}
            <Text style={[styles.label, errors.images && {color: '#FF4D4D'}]}>FOTOS (MÍNIMO 3) *</Text>
            <View style={styles.photoActions}>
              <TouchableOpacity style={[styles.photoActionBtn, errors.images && styles.inputError]} onPress={() => pickImage(true)}><Icon name="camera" size={18} color="#FF6B35" /><Text style={styles.photoActionText}>Cámara</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.photoActionBtn, errors.images && styles.inputError]} onPress={() => pickImage(false)}><Icon name="image" size={18} color="#FF6B35" /><Text style={styles.photoActionText}>Galería</Text></TouchableOpacity>
            </View>
            <ScrollView horizontal style={styles.previewWrapper}>
              {images.map((uri, idx) => (
                <View key={idx} style={styles.miniPreviewContainer}>
                  <Image source={{ uri }} style={styles.miniPreview} />
                  <TouchableOpacity style={styles.removePhoto} onPress={() => setImages(images.filter((_, i) => i !== idx))}><Icon name="x" size={12} color="#FFF" /></TouchableOpacity>
                </View>
              ))}
            </ScrollView>

            <Text style={styles.label}>TÍTULO *</Text>
            <TextInput style={[styles.input, errors.title && styles.inputError]} placeholder="Ej: Camiseta Vintage..." value={form.title} onChangeText={t => setForm({...form, title: t})} />
            {errors.title && <Text style={styles.errorText}>{errors.title}</Text>}

            <Text style={styles.label}>MARCA *</Text>
            <TextInput style={[styles.input, errors.brand && styles.inputError]} placeholder="Ej: Nike..." value={form.brand} onChangeText={t => setForm({...form, brand: t})} />
            <View style={styles.suggestionRow}>
              {filteredBrands.map(b => (
                <TouchableOpacity key={b} style={styles.tagChip} onPress={() => handleQuickAdd('brand', b)}><Text style={styles.tagChipText}>+{b}</Text></TouchableOpacity>
              ))}
            </View>
            {errors.brand && <Text style={styles.errorText}>{errors.brand}</Text>}

            <Text style={styles.label}>PRECIO (€) *</Text>
            <TextInput style={[styles.input, errors.price && styles.inputError]} placeholder="0.00" keyboardType="numeric" value={form.price} onChangeText={t => setForm({...form, price: t})} />
            {errors.price && <Text style={styles.errorText}>{errors.price}</Text>}

            <Text style={styles.label}>ESTADO</Text>
            <View style={styles.suggestionRow}>
              {['Nuevo', 'Muy bueno', 'Bueno', 'Aceptable'].map(cond => (
                <TouchableOpacity key={cond} style={[styles.tagChip, form.condition === cond && {backgroundColor: '#FF6B35'}]} onPress={() => setForm({...form, condition: cond})}>
                  <Text style={[styles.tagChipText, form.condition === cond && {color: '#FFF'}]}>{cond}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>DESCRIPCIÓN *</Text>
            <TextInput style={[styles.input, styles.textArea, errors.description && styles.inputError]} placeholder="Detalla el artículo..." multiline value={form.description} onChangeText={t => setForm({...form, description: t})} />
            {errors.description && <Text style={styles.errorText}>{errors.description}</Text>}

            <Text style={styles.label}>ETIQUETAS SEO *</Text>
            <TextInput style={[styles.input, errors.seoTags && styles.inputError]} placeholder="vintage, verano..." value={form.seoTags} onChangeText={t => setForm({...form, seoTags: t})} />
            <View style={styles.suggestionRow}>
              {filteredTags.map(t => (
                <TouchableOpacity key={t} style={styles.tagChip} onPress={() => handleQuickAdd('tag', t)}><Text style={styles.tagChipText}>+{t}</Text></TouchableOpacity>
              ))}
            </View>
            {errors.seoTags && <Text style={styles.errorText}>{errors.seoTags}</Text>}

            <TouchableOpacity style={styles.btnSave} onPress={handleSave}><Text style={styles.btnSaveText}>GUARDAR PRODUCTO</Text></TouchableOpacity>
            <View style={{ height: 50 }} />
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  header: { paddingHorizontal: 25, paddingTop: 60, paddingBottom: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  headerSubtitle: { color: '#FF6B35', fontSize: 10, fontWeight: '900', letterSpacing: 2 },
  headerTitle: { fontSize: 26, fontWeight: '900', color: '#1A1A2E' },
  btnAdd: { backgroundColor: '#1A1A2E', width: 50, height: 50, borderRadius: 15, justifyContent: 'center', alignItems: 'center' },
  card: { width: (width / 2) - 22, margin: 7, backgroundColor: '#FFF', borderRadius: 20, overflow: 'hidden', elevation: 3 },
  cardImage: { width: '100%', height: 160 },
  cardPriceTag: { position: 'absolute', top: 10, right: 10, backgroundColor: '#00D9A3', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  cardPriceText: { color: '#FFF', fontWeight: '900', fontSize: 11 },
  cardInfo: { padding: 12 },
  cardTitle: { fontSize: 13, fontWeight: '700', color: '#1A1A2E' },
  cardBrand: { fontSize: 10, color: '#999', marginTop: 2, fontWeight: '700' },
  modalRoot: { flex: 1, backgroundColor: '#FFF' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderColor: '#F5F5F5' },
  modalTitle: { fontSize: 17, fontWeight: '900' },
  magicBtn: { backgroundColor: '#FF6B35', flexDirection: 'row', paddingHorizontal: 15, paddingVertical: 8, borderRadius: 12, alignItems: 'center', gap: 6 },
  magicBtnText: { color: '#FFF', fontSize: 11, fontWeight: '900' },
  formContent: { padding: 20 },
  label: { fontSize: 10, fontWeight: '900', color: '#1A1A2E', marginBottom: 8, marginTop: 15, letterSpacing: 1 },
  input: { backgroundColor: '#F8F9FA', borderRadius: 15, padding: 15, fontSize: 15, borderWidth: 1, borderColor: '#EEE' },
  inputError: { borderColor: '#FF4D4D', backgroundColor: '#FFF8F8' },
  errorText: { color: '#FF4D4D', fontSize: 10, fontWeight: '800', marginTop: 5 },
  textArea: { height: 110, textAlignVertical: 'top' },
  photoActions: { flexDirection: 'row', gap: 10, marginBottom: 15 },
  photoActionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#F8F9FA', padding: 15, borderRadius: 15, borderWidth: 1, borderColor: '#EEE' },
  photoActionText: { fontSize: 12, fontWeight: '800', color: '#1A1A2E' },
  previewWrapper: { flexDirection: 'row', marginBottom: 10 },
  miniPreviewContainer: { position: 'relative', marginRight: 10 },
  miniPreview: { width: 70, height: 70, borderRadius: 12 },
  removePhoto: { position: 'absolute', top: -5, right: -5, backgroundColor: '#FF4D4D', width: 20, height: 20, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  suggestionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  tagChip: { backgroundColor: '#FF6B3515', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  tagChipText: { fontSize: 11, color: '#FF6B35', fontWeight: '800' },
  btnSave: { backgroundColor: '#1A1A2E', padding: 20, borderRadius: 20, alignItems: 'center', marginTop: 30 },
  btnSaveText: { color: '#FFF', fontWeight: '900', fontSize: 15 }
});