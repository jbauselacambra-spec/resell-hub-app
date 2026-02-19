import React, { useState } from 'react';
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
  
  // ESTADOS
  const [product, setProduct] = useState(initialProduct);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({ ...initialProduct });
  const [errors, setErrors] = useState({}); 
  
  // ESTADOS PARA EL NUEVO MODAL DE VENTA
  const [showSoldModal, setShowSoldModal] = useState(false);
  const [soldPrice, setSoldPrice] = useState(initialProduct?.price.toString());

  if (!product) return null;

  // --- LÓGICA DE FOTOS (RESTRICCIÓN MÍNIMO 3) ---
  const pickImage = async (fromCamera = false) => {
    const result = fromCamera 
      ? await ImagePicker.launchCameraAsync({ quality: 0.7 })
      : await ImagePicker.launchImageLibraryAsync({ allowsMultipleSelection: true, quality: 0.7 });

    if (!result.canceled) {
      const uris = result.assets.map(a => a.uri);
      const newImages = [...editForm.images, ...uris];
      setEditForm({ ...editForm, images: newImages });
      if (newImages.length >= 3) setErrors(prev => ({ ...prev, images: false }));
    }
  };

  // --- GUARDAR EDICIÓN (VALIDACIÓN VISUAL ROJA) ---
  const handleSaveEdit = () => {
    let currentErrors = {};
    if (!editForm.title.trim()) currentErrors.title = true;
    if (!editForm.description.trim()) currentErrors.description = true;
    if (!editForm.price.toString().trim()) currentErrors.price = true;
    if (!editForm.category.trim()) currentErrors.category = true;
    if (editForm.images.length < 3) currentErrors.images = true;

    setErrors(currentErrors);
    if (Object.keys(currentErrors).length > 0) return;

    if (DatabaseService.updateProduct(editForm)) {
      setProduct(editForm);
      setIsEditing(false);
      LogService.success("Producto editado con éxito");
    }
  };

  // --- MARCAR COMO VENDIDO (AHORA CON MODAL PROPIO) ---
  const confirmSold = () => {
    LogService.info(`Procesando venta final por: ${soldPrice}€`);
    const success = DatabaseService.markAsSold(product.id, soldPrice);
    if (success) {
      setShowSoldModal(false);
      LogService.success("¡Producto Marcado como Vendido!");
      navigation.goBack(); 
    } else {
      LogService.error("Fallo al guardar venta en DB");
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        
        {/* CARRUSEL Y BOTONES SUPERIORES */}
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
            <TouchableOpacity style={styles.circleBtn} onPress={() => navigation.goBack()}>
              <Icon name="arrow-left" size={24} color="#1A1A2E" />
            </TouchableOpacity>

            <View style={{flexDirection: 'row', gap: 10}}>
              <TouchableOpacity style={styles.circleBtn} onPress={() => setIsEditing(!isEditing)}>
                <Icon name={isEditing ? "x" : "edit-2"} size={20} color={isEditing ? "#E63946" : "#004E89"} />
              </TouchableOpacity>
              {!isEditing && (
                <TouchableOpacity style={[styles.circleBtn, {backgroundColor: '#FFF5F5'}]} onPress={() => {
                  DatabaseService.deleteProduct(product.id);
                  navigation.goBack();
                }}>
                  <Icon name="trash-2" size={20} color="#E63946" />
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>

        <View style={styles.content}>
          {isEditing ? (
            /* --- MODO EDICIÓN (ESTILOS ROJOS) --- */
            <View style={styles.form}>
              <Text style={[styles.label, errors.images && {color: '#E63946'}]}>FOTOS (Mínimo 3) *</Text>
              <View style={styles.photoRow}>
                <TouchableOpacity style={[styles.photoActionBtn, errors.images && styles.inputError]} onPress={() => pickImage(true)}>
                  <Icon name="camera" size={18} color="#FF6B35" /><Text style={styles.photoActionText}>Cámara</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.photoActionBtn, errors.images && styles.inputError]} onPress={() => pickImage(false)}>
                  <Icon name="image" size={18} color="#FF6B35" /><Text style={styles.photoActionText}>Galería</Text>
                </TouchableOpacity>
              </View>
              {errors.images && <Text style={styles.errorTextUnder}>Faltan {3 - editForm.images.length} fotos.</Text>}

              <Text style={styles.label}>Título *</Text>
              <TextInput style={[styles.input, errors.title && styles.inputError]} value={editForm.title} onChangeText={t => setEditForm({...editForm, title: t})} />

              <Text style={styles.label}>Precio (€) *</Text>
              <TextInput style={[styles.input, errors.price && styles.inputError]} value={editForm.price.toString()} keyboardType="numeric" onChangeText={t => setEditForm({...editForm, price: t})} />

              <Text style={styles.label}>Descripción *</Text>
              <TextInput style={[styles.input, styles.textArea, errors.description && styles.inputError]} value={editForm.description} multiline onChangeText={t => setEditForm({...editForm, description: t})} />

              <Text style={styles.label}>Categoría *</Text>
              <TextInput style={[styles.input, errors.category && styles.inputError]} value={editForm.category} onChangeText={t => setEditForm({...editForm, category: t})} />

              <TouchableOpacity style={styles.btnSubmit} onPress={handleSaveEdit}>
                <Text style={styles.btnText}>Guardar Cambios</Text>
              </TouchableOpacity>
            </View>
          ) : (
            /* --- MODO VISTA --- */
            <>
              <View style={styles.headerInfo}>
                <Text style={styles.categoryBadge}>{product.category}</Text>
                <Text style={styles.price}>{product.price}€</Text>
              </View>
              <Text style={styles.title}>{product.title}</Text>
              <Text style={styles.descriptionText}>{product.description}</Text>
              <View style={styles.divider} />
              
              <TouchableOpacity style={styles.premiumSoldBtn} onPress={() => setShowSoldModal(true)}>
                <View style={styles.iconCircle}><Icon name="dollar-sign" size={20} color="#FFF" /></View>
                <Text style={styles.premiumSoldText}>MARCAR COMO VENDIDO</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </ScrollView>

      {/* MODAL DE VENTA PERSONALIZADO (REEMPLAZA AL PROMPT QUE FALLABA) */}
      <Modal visible={showSoldModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.modalBox}>
            <Text style={styles.modalTitle}>Confirmar Venta</Text>
            <Text style={styles.modalSub}>¿A qué precio se ha vendido finalmente?</Text>
            <TextInput 
              style={styles.modalInput} 
              keyboardType="numeric" 
              value={soldPrice} 
              onChangeText={setSoldPrice}
              autoFocus
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setShowSoldModal(false)}>
                <Text style={styles.modalCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalConfirm} onPress={confirmSold}>
                <Text style={styles.modalConfirmText}>Vendido</Text>
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF' },
  carouselWrapper: { height: 400, position: 'relative' },
  mainImage: { width: width, height: 400, resizeMode: 'cover' },
  removePhotoBadge: { position: 'absolute', top: 120, right: 20, backgroundColor: '#E63946', width: 30, height: 30, borderRadius: 15, justifyContent: 'center', alignItems: 'center' },
  topActions: { position: 'absolute', top: 50, left: 20, right: 20, flexDirection: 'row', justifyContent: 'space-between' },
  circleBtn: { backgroundColor: '#FFF', width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', elevation: 5 },
  content: { padding: 25, marginTop: -30, backgroundColor: '#FFF', borderTopLeftRadius: 30, borderTopRightRadius: 30 },
  headerInfo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  categoryBadge: { backgroundColor: '#FF6B3515', color: '#FF6B35', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 8, fontSize: 12, fontWeight: 'bold' },
  price: { fontSize: 32, fontWeight: '900', color: '#FF6B35' },
  title: { fontSize: 26, fontWeight: '800', color: '#1A1A2E', marginBottom: 20 },
  descriptionText: { fontSize: 16, color: '#444', lineHeight: 24 },
  divider: { height: 1, backgroundColor: '#F0F0F0', marginVertical: 20 },
  premiumSoldBtn: { backgroundColor: '#1A1A2E', flexDirection: 'row', alignItems: 'center', padding: 8, borderRadius: 50 },
  iconCircle: { backgroundColor: '#00D9A3', width: 45, height: 45, borderRadius: 25, justifyContent: 'center', alignItems: 'center' },
  premiumSoldText: { color: '#FFF', fontWeight: '800', fontSize: 14, flex: 1, textAlign: 'center', marginRight: 40 },

  // FORMULARIO
  form: { gap: 5 },
  label: { fontSize: 14, fontWeight: '700', color: '#333', marginBottom: 8, marginTop: 10 },
  input: { backgroundColor: '#F8F9FA', borderRadius: 12, padding: 15, fontSize: 16, borderWidth: 1, borderColor: '#EEE' },
  inputError: { borderColor: '#E63946', backgroundColor: '#FFF5F5' },
  errorTextUnder: { color: '#E63946', fontSize: 12, fontWeight: '600', marginTop: 5, marginBottom: 10 },
  textArea: { height: 100, textAlignVertical: 'top' },
  photoRow: { flexDirection: 'row', gap: 10 },
  photoActionBtn: { flex: 1, flexDirection: 'row', backgroundColor: '#FF6B3510', padding: 15, borderRadius: 12, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#FF6B3520' },
  photoActionText: { marginLeft: 8, color: '#FF6B35', fontWeight: 'bold' },
  btnSubmit: { backgroundColor: '#FF6B35', padding: 18, borderRadius: 15, alignItems: 'center', marginTop: 20 },
  btnText: { color: '#FFF', fontWeight: 'bold', fontSize: 16 },

  // MODAL VENTA
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' },
  modalBox: { width: '85%', backgroundColor: '#FFF', borderRadius: 25, padding: 25 },
  modalTitle: { fontSize: 20, fontWeight: '900', color: '#1A1A2E', textAlign: 'center' },
  modalSub: { fontSize: 14, color: '#666', textAlign: 'center', marginVertical: 10 },
  modalInput: { backgroundColor: '#F8F9FA', borderRadius: 15, padding: 15, fontSize: 24, textAlign: 'center', fontWeight: 'bold', color: '#FF6B35', marginVertical: 10 },
  modalButtons: { flexDirection: 'row', gap: 10, marginTop: 15 },
  modalCancel: { flex: 1, padding: 15, borderRadius: 15, alignItems: 'center' },
  modalCancelText: { color: '#999', fontWeight: 'bold' },
  modalConfirm: { flex: 2, backgroundColor: '#00D9A3', padding: 15, borderRadius: 15, alignItems: 'center' },
  modalConfirmText: { color: '#FFF', fontWeight: 'bold' }
});