import React, { useState, useEffect } from 'react';
import { 
  View, Text, ScrollView, Image, StyleSheet, Dimensions, 
  TouchableOpacity, Alert, TextInput, Platform 
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
  const [activeIndex, setActiveIndex] = useState(0);

  if (!product) return null;

  // --- LÓGICA DE FOTOS ---
  const pickImage = async (fromCamera = false) => {
    try {
      const permission = fromCamera 
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permission.granted) return;

      const result = fromCamera 
        ? await ImagePicker.launchCameraAsync({ quality: 0.7, allowsEditing: true })
        : await ImagePicker.launchImageLibraryAsync({ 
            allowsMultipleSelection: true, 
            quality: 0.7 
          });

      if (!result.canceled) {
        const uris = result.assets.map(a => a.uri);
        const newImages = [...editForm.images, ...uris];
        setEditForm({ ...editForm, images: newImages });
        // Validación en tiempo real para las fotos
        if (newImages.length >= 3) setErrors(prev => ({ ...prev, images: false }));
        LogService.success(`Fotos preparadas: ${newImages.length}`);
      }
    } catch (e) {
      LogService.error("Error al añadir imagen: " + e.message);
    }
  };

  // --- VALIDACIÓN Y GUARDADO ---
  const handleSaveEdit = () => {
    let currentErrors = {};
    if (!editForm.title.trim()) currentErrors.title = true;
    if (!editForm.description.trim()) currentErrors.description = true;
    if (!editForm.price.toString().trim()) currentErrors.price = true;
    if (!editForm.category.trim()) currentErrors.category = true;
    if (editForm.images.length < 3) currentErrors.images = true;

    setErrors(currentErrors);

    // Si hay errores, no sale Alert, solo se marcan los campos en rojo
    if (Object.keys(currentErrors).length > 0) {
      LogService.info("Edición bloqueada por validación visual");
      return;
    }

    if (DatabaseService.updateProduct(editForm)) {
      setProduct(editForm);
      setIsEditing(false);
      LogService.success("Producto actualizado correctamente");
    }
  };

// --- LÓGICA DE VENTA INFALIBLE ---
  const handleMarkAsSold = () => {
    LogService.info(`Iniciando venta de: ${product.title}`);
    
    Alert.prompt(
      "Confirmar Venta",
      "Introduce el precio final (se usará el actual por defecto):",
      [
        { 
          text: "Cancelar", 
          onPress: () => LogService.info("Venta cancelada por usuario"),
          style: "cancel" 
        },
        { 
          text: "Vendido", 
          onPress: (price) => {
            // Si el usuario deja el campo vacío o cancela el input, usamos el precio original
            const finalPrice = (price && price.trim() !== "") ? price : product.price;
            
            LogService.info(`Procesando venta por: ${finalPrice}€`);
            
            const success = DatabaseService.markAsSold(product.id, finalPrice);
            
            if (success) {
              LogService.success("¡Base de Datos actualizada!");
              // Pequeña alerta de éxito antes de cerrar
              Alert.alert("¡Vendido!", "El producto se ha movido al historial.", [
                { text: "OK", onPress: () => navigation.goBack() }
              ]);
            } else {
              LogService.error("Error al marcar como vendido en DB");
              Alert.alert("Error", "No se pudo actualizar el estado del producto.");
            }
          } 
        }
      ],
      "plain-text",
      product.price.toString() // Valor por defecto en el input
    );
  };

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        
        {/* CARRUSEL */}
        <View style={styles.carouselWrapper}>
          <ScrollView horizontal pagingEnabled onScroll={(e) => setActiveIndex(Math.round(e.nativeEvent.contentOffset.x / width))}>
            {(isEditing ? editForm.images : product.images).map((uri, i) => (
              <View key={i} style={{width}}>
                <Image source={{ uri }} style={styles.mainImage} />
                {isEditing && (
                   <TouchableOpacity 
                    style={styles.removePhotoBadge} 
                    onPress={() => {
                        const filtered = editForm.images.filter((_, idx) => idx !== i);
                        setEditForm({...editForm, images: filtered});
                        if (filtered.length < 3) setErrors(prev => ({ ...prev, images: true }));
                    }}
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
                <TouchableOpacity style={[styles.circleBtn, {backgroundColor: '#FFF5F5'}]} onPress={() => DatabaseService.deleteProduct(product.id) && navigation.goBack()}>
                  <Icon name="trash-2" size={20} color="#E63946" />
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>

        <View style={styles.content}>
          {isEditing ? (
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

              {/* MENSAJE DE ERROR ROJO BAJO FOTOS */}
              {errors.images && (
                <Text style={styles.errorTextUnder}>Debes tener al menos 3 fotos. Faltan {3 - editForm.images.length}.</Text>
              )}

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
            <>
              <View style={styles.headerInfo}>
                <Text style={styles.categoryBadge}>{product.category}</Text>
                <Text style={styles.price}>{product.price}€</Text>
              </View>
              <Text style={styles.title}>{product.title}</Text>
              <Text style={styles.descriptionText}>{product.description}</Text>
              <View style={styles.divider} />
              
              <TouchableOpacity style={styles.premiumSoldBtn} onPress={handleMarkAsSold}>
                <View style={styles.iconCircle}><Icon name="dollar-sign" size={20} color="#FFF" /></View>
                <Text style={styles.premiumSoldText}>MARCAR COMO VENDIDO</Text>
              </TouchableOpacity>
            </>
          )}
          <View style={{height: 100}} />
        </View>
      </ScrollView>
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
  
  // BOTÓN VENDIDO PREMIUM
  premiumSoldBtn: { backgroundColor: '#1A1A2E', flexDirection: 'row', alignItems: 'center', padding: 8, borderRadius: 50 },
  iconCircle: { backgroundColor: '#00D9A3', width: 45, height: 45, borderRadius: 25, justifyContent: 'center', alignItems: 'center' },
  premiumSoldText: { color: '#FFF', fontWeight: '800', fontSize: 14, flex: 1, textAlign: 'center', marginRight: 40 },

  // FORMULARIO Y VALIDACIÓN (COPIADO DE PRODUCTLIST)
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
  btnText: { color: '#FFF', fontWeight: 'bold', fontSize: 16 }
});