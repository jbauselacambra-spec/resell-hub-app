import React, { useState, useEffect } from 'react';
import { 
  View, Text, ScrollView, Image, StyleSheet, Dimensions, 
  TouchableOpacity, Alert, TextInput, Modal, KeyboardAvoidingView, Platform 
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import Icon from 'react-native-vector-icons/Feather';
import { DatabaseService } from '../services/DatabaseService';
import LogService from '../services/LogService';

const { width } = Dimensions.get('window');

export default function ProductDetailScreen({ route, navigation }) {
  const { product: initialProduct } = route.params || {};
  
  const [product, setProduct] = useState(initialProduct);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({ ...initialProduct });
  const [errors, setErrors] = useState({}); 
  const [showSoldModal, setShowSoldModal] = useState(false);
  const [soldPrice, setSoldPrice] = useState(initialProduct?.price?.toString() || "");
  
  const [existingTags, setExistingTags] = useState([]);
  const [existingBrands, setExistingBrands] = useState([]);

  useEffect(() => {
    const data = DatabaseService.getAllProducts() || [];
    const brands = data.map(p => p.brand).filter(b => b);
    setExistingBrands([...new Set(brands)]);
    const tags = data.flatMap(p => p.tags ? p.tags.split(',').map(t => t.trim()) : []);
    setExistingTags([...new Set(tags)].filter(t => t));
  }, []);

  const filteredBrands = existingBrands.filter(b => 
    editForm.brand && b.toLowerCase().includes(editForm.brand.toLowerCase()) && b.toLowerCase() !== editForm.brand.toLowerCase()
  ).slice(0, 5);

  const filteredTags = existingTags.filter(t => {
    const lastTag = (editForm.seoTags || "").split(',').pop().trim().toLowerCase();
    return lastTag && t.toLowerCase().includes(lastTag) && !(editForm.seoTags || "").toLowerCase().includes(t.toLowerCase());
  }).slice(0, 5);

  const handleQuickAdd = (type, value) => {
    if (type === 'brand') {
      setEditForm({ ...editForm, brand: value });
    } else {
      const parts = (editForm.seoTags || "").split(',').map(t => t.trim());
      parts.pop();
      const newTags = [...parts, value].join(', ');
      setEditForm({ ...editForm, seoTags: newTags + ', ' });
    }
  };

  const pickImage = async (fromCamera = false) => {
    const result = fromCamera 
      ? await ImagePicker.launchCameraAsync({ quality: 0.7 })
      : await ImagePicker.launchImageLibraryAsync({ allowsMultipleSelection: true, quality: 0.7 });

    if (!result.canceled) {
      const uris = result.assets.map(a => a.uri);
      setEditForm({ ...editForm, images: [...editForm.images, ...uris] });
    }
  };

  const handleSaveEdit = () => {
    let currentErrors = {};
    if (!editForm.title?.trim()) currentErrors.title = "Obligatorio";
    if (!editForm.brand?.trim()) currentErrors.brand = "Obligatorio";
    if (!editForm.price?.toString().trim()) currentErrors.price = "Falta precio";
    if (!editForm.description?.trim()) currentErrors.description = "Obligatorio";
    if (!editForm.seoTags?.trim()) currentErrors.seoTags = "Añade etiquetas";
    if (editForm.images.length < 3) currentErrors.images = "Mínimo 3 fotos";

    setErrors(currentErrors);
    if (Object.keys(currentErrors).length > 0) return;

    if (DatabaseService.updateProduct(editForm)) {
      setProduct(editForm);
      setIsEditing(false);
      LogService.success("Producto actualizado");
    }
  };

  const handleDelete = () => {
    Alert.alert(
      "Eliminar Producto",
      "¿Estás seguro de que quieres eliminar este artículo para siempre?",
      [
        { text: "Cancelar", style: "cancel" },
        { 
          text: "Sí, Eliminar", 
          style: "destructive", 
          onPress: () => {
            DatabaseService.deleteProduct(product.id);
            navigation.goBack();
          } 
        }
      ]
    );
  };

  const confirmSold = () => {
    if (DatabaseService.markAsSold(product.id, soldPrice)) {
      setShowSoldModal(false);
      navigation.goBack(); 
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.carouselWrapper}>
          <ScrollView horizontal pagingEnabled>
            {(isEditing ? editForm.images : product.images).map((uri, i) => (
              <View key={i} style={{width}}>
                <Image source={{ uri }} style={styles.mainImage} />
                {isEditing && (
                   <TouchableOpacity 
                    style={styles.removePhotoBadge} 
                    onPress={() => setEditForm({...editForm, images: editForm.images.filter((_, idx) => idx !== i)})}
                   >
                     <Icon name="x" size={16} color="#FFF" />
                   </TouchableOpacity>
                )}
              </View>
            ))}
          </ScrollView>
          <View style={styles.topActions}>
            <TouchableOpacity style={styles.circleBtn} onPress={() => navigation.goBack()}><Icon name="arrow-left" size={24} color="#1A1A2E" /></TouchableOpacity>
          </View>
        </View>

        <View style={styles.content}>
          {isEditing ? (
            <View style={styles.form}>
              <Text style={[styles.label, errors.images && {color: '#FF4D4D'}]}>FOTOS *</Text>
              <View style={styles.photoRow}>
                <TouchableOpacity style={[styles.photoActionBtn, errors.images && styles.inputError]} onPress={() => pickImage(true)}><Icon name="camera" size={18} color="#FF6B35" /><Text style={styles.photoActionText}>Cámara</Text></TouchableOpacity>
                <TouchableOpacity style={[styles.photoActionBtn, errors.images && styles.inputError]} onPress={() => pickImage(false)}><Icon name="image" size={18} color="#FF6B35" /><Text style={styles.photoActionText}>Galería</Text></TouchableOpacity>
              </View>
              {errors.images && <Text style={styles.errorText}>{errors.images}</Text>}

              <Text style={styles.label}>TÍTULO *</Text>
              <TextInput style={[styles.input, errors.title && styles.inputError]} value={editForm.title} onChangeText={t => setEditForm({...editForm, title: t})} />
              {errors.title && <Text style={styles.errorText}>{errors.title}</Text>}

              <Text style={styles.label}>MARCA *</Text>
              <TextInput style={[styles.input, errors.brand && styles.inputError]} value={editForm.brand} onChangeText={t => setEditForm({...editForm, brand: t})} />
              <View style={styles.suggestionRow}>
                {filteredBrands.map(b => (
                  <TouchableOpacity key={b} style={styles.tagChip} onPress={() => handleQuickAdd('brand', b)}><Text style={styles.tagChipText}>+{b}</Text></TouchableOpacity>
                ))}
              </View>

              <Text style={styles.label}>PRECIO (€) *</Text>
              <TextInput style={[styles.input, errors.price && styles.inputError]} value={editForm.price?.toString()} keyboardType="numeric" onChangeText={t => setEditForm({...editForm, price: t})} />

              <Text style={styles.label}>ESTADO</Text>
              <View style={styles.suggestionRow}>
                {['Nuevo', 'Muy bueno', 'Bueno', 'Aceptable'].map(cond => (
                  <TouchableOpacity key={cond} style={[styles.tagChip, editForm.condition === cond && {backgroundColor: '#FF6B35'}]} onPress={() => setEditForm({...editForm, condition: cond})}>
                    <Text style={[styles.tagChipText, editForm.condition === cond && {color: '#FFF'}]}>{cond}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.label}>DESCRIPCIÓN *</Text>
              <TextInput style={[styles.input, styles.textArea, errors.description && styles.inputError]} value={editForm.description} multiline onChangeText={t => setEditForm({...editForm, description: t})} />

              <Text style={styles.label}>ETIQUETAS SEO *</Text>
              <TextInput style={[styles.input, errors.seoTags && styles.inputError]} value={editForm.seoTags} onChangeText={t => setEditForm({...editForm, seoTags: t})} />
              <View style={styles.suggestionRow}>
                {filteredTags.map(t => (
                  <TouchableOpacity key={t} style={styles.tagChip} onPress={() => handleQuickAdd('tag', t)}><Text style={styles.tagChipText}>+{t}</Text></TouchableOpacity>
                ))}
              </View>
              {errors.seoTags && <Text style={styles.errorText}>{errors.seoTags}</Text>}

              <View style={styles.actionButtonsRow}>
                <TouchableOpacity style={styles.btnActionDelete} onPress={handleDelete}>
                  <Icon name="trash-2" size={20} color="#FF4D4D" />
                </TouchableOpacity>
                <TouchableOpacity style={styles.btnActionSave} onPress={handleSaveEdit}>
                  <Text style={styles.btnSaveText}>GUARDAR CAMBIOS</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <>
              <View style={styles.headerInfo}>
                <View style={styles.brandGroup}>
                  <Text style={styles.brandText}>{product.brand}</Text>
                  <View style={styles.tagChip}><Text style={styles.tagChipText}>{product.condition || 'Usado'}</Text></View>
                </View>
                <Text style={styles.price}>{product.price}€</Text>
              </View>
              <Text style={styles.title}>{product.title}</Text>
              <Text style={styles.descriptionText}>{product.description}</Text>
              <View style={styles.suggestionRow}>
                {(product.seoTags || "").split(',').map((tag, i) => tag.trim() ? (
                  <View key={i} style={styles.seoBadge}><Text style={styles.seoBadgeText}>#{tag.trim()}</Text></View>
                ) : null)}
              </View>

              <View style={styles.divider} />

              {/* TRES BOTONES JUNTOS: EDITAR, VENDER Y ELIMINAR (A LA DERECHA) */}
              <View style={styles.mainActionsRow}>
                  <TouchableOpacity 
                  style={styles.premiumSoldBtn} 
                  onPress={() => setShowSoldModal(true)}
                >
                  <View style={styles.iconCircle}><Icon name="dollar-sign" size={20} color="#FFF" /></View>
                  <Text style={styles.premiumSoldText}>Vendido</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={styles.actionCircleBtnDelete} 
                  onPress={handleDelete}
                >
                  <Icon name="trash-2" size={22} color="#FF4D4D" />
                </TouchableOpacity>

                <TouchableOpacity 
                  style={styles.actionCircleBtnEdit} 
                  onPress={() => { setIsEditing(true); setEditForm({...product}); }}
                >
                  <Icon name="edit-2" size={22} color="#1A1A2E" />
                </TouchableOpacity>                
              </View>
            </>
          )}
        </View>
      </ScrollView>

      <Modal visible={showSoldModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.modalBox}>
            <Text style={styles.modalTitle}>Confirmar Venta</Text>
            <TextInput style={styles.modalInput} keyboardType="numeric" value={soldPrice} onChangeText={setSoldPrice} autoFocus />
            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setShowSoldModal(false)}><Text style={styles.modalCancelText}>Cancelar</Text></TouchableOpacity>
              <TouchableOpacity style={styles.modalConfirm} onPress={confirmSold}><Text style={styles.modalConfirmText}>Vendido</Text></TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  carouselWrapper: { height: 400, position: 'relative' },
  mainImage: { width: width, height: 400, resizeMode: 'cover' },
  removePhotoBadge: { position: 'absolute', top: 120, right: 20, backgroundColor: '#FF4D4D', width: 30, height: 30, borderRadius: 15, justifyContent: 'center', alignItems: 'center' },
  topActions: { position: 'absolute', top: 50, left: 20, right: 20, flexDirection: 'row', justifyContent: 'space-between' },
  circleBtn: { backgroundColor: '#FFF', width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', elevation: 5 },
  content: { padding: 25, marginTop: -30, backgroundColor: '#FFF', borderTopLeftRadius: 30, borderTopRightRadius: 30, minHeight: 400 },
  headerInfo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 15 },
  brandGroup: { gap: 8 },
  brandText: { fontSize: 14, fontWeight: '900', color: '#FF6B35', textTransform: 'uppercase' },
  price: { fontSize: 32, fontWeight: '900', color: '#1A1A2E' },
  title: { fontSize: 24, fontWeight: '800', color: '#1A1A2E', marginBottom: 15 },
  descriptionText: { fontSize: 15, color: '#555', lineHeight: 22, marginBottom: 20 },
  divider: { height: 1, backgroundColor: '#EEE', marginVertical: 25 },
  
  // FILA DE ACCIONES PRINCIPALES
  mainActionsRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  premiumSoldBtn: { flex: 1, backgroundColor: '#1A1A2E', flexDirection: 'row', alignItems: 'center', padding: 8, borderRadius: 20, height: 60 },
  iconCircle: { backgroundColor: '#00D9A3', width: 44, height: 44, borderRadius: 15, justifyContent: 'center', alignItems: 'center' },
  premiumSoldText: { color: '#FFF', fontWeight: '900', fontSize: 14, flex: 1, textAlign: 'center', marginRight: 10 },
  actionCircleBtnDelete: { backgroundColor: '#FFF2F2', width: 60, height: 60, borderRadius: 20, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#FF4D4D15' },
  actionCircleBtnEdit: { backgroundColor: '#F8F9FA', width: 60, height: 60, borderRadius: 20, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#EEE' },

  label: { fontSize: 10, fontWeight: '900', color: '#1A1A2E', marginBottom: 8, marginTop: 15, letterSpacing: 1 },
  input: { backgroundColor: '#F8F9FA', borderRadius: 15, padding: 15, fontSize: 15, borderWidth: 1, borderColor: '#EEE' },
  inputError: { borderColor: '#FF4D4D', backgroundColor: '#FFF8F8' },
  errorText: { color: '#FF4D4D', fontSize: 10, fontWeight: '800', marginTop: 5 },
  textArea: { height: 110, textAlignVertical: 'top' },
  photoRow: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  photoActionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#F8F9FA', padding: 15, borderRadius: 15, borderWidth: 1, borderColor: '#EEE' },
  photoActionText: { fontSize: 12, fontWeight: '800', color: '#1A1A2E' },
  suggestionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  tagChip: { backgroundColor: '#FF6B3515', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  tagChipText: { fontSize: 11, color: '#FF6B35', fontWeight: '800' },
  seoBadge: { backgroundColor: '#F0F0F0', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6 },
  seoBadgeText: { fontSize: 11, color: '#666', fontWeight: '700' },
  
  actionButtonsRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 30 },
  btnActionSave: { flex: 1, backgroundColor: '#1A1A2E', padding: 20, borderRadius: 20, alignItems: 'center' },
  btnActionDelete: { backgroundColor: '#FFF2F2', padding: 18, borderRadius: 20, borderWidth: 1, borderColor: '#FF4D4D20', justifyContent: 'center', alignItems: 'center' },
  btnSaveText: { color: '#FFF', fontWeight: '900', fontSize: 15 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' },
  modalBox: { width: '85%', backgroundColor: '#FFF', borderRadius: 25, padding: 25 },
  modalTitle: { fontSize: 20, fontWeight: '900', color: '#1A1A2E', textAlign: 'center' },
  modalInput: { backgroundColor: '#F8F9FA', borderRadius: 15, padding: 15, fontSize: 24, textAlign: 'center', fontWeight: 'bold', color: '#FF6B35', marginVertical: 15 },
  modalButtons: { flexDirection: 'row', gap: 10 },
  modalCancel: { flex: 1, padding: 15, borderRadius: 15, alignItems: 'center' },
  modalCancelText: { color: '#999', fontWeight: 'bold' },
  modalConfirm: { flex: 2, backgroundColor: '#00D9A3', padding: 15, borderRadius: 15, alignItems: 'center' },
  modalConfirmText: { color: '#FFF', fontWeight: 'bold' }
});