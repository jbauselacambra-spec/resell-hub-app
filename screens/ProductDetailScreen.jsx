import React, { useState, useMemo, useEffect } from 'react';
import { 
  View, Text, ScrollView, Image, StyleSheet, Dimensions, 
  TouchableOpacity, Alert, TextInput, Modal 
} from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import { DatabaseService } from '../services/DatabaseService';
import LogService from '../services/LogService';

const { width } = Dimensions.get('window');

export default function ProductDetailScreen({ route, navigation }) {
  const { product: initialProduct } = route.params || {};
  const [product, setProduct] = useState(initialProduct);
  const [isEditing, setIsEditing] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  
  const [navDate, setNavDate] = useState(new Date(initialProduct?.firstUploadDate || initialProduct?.createdAt || new Date()));

  const [editForm, setEditForm] = useState({ 
    ...initialProduct,
    category: initialProduct?.category || "Otros",
    firstUploadDate: initialProduct?.firstUploadDate || initialProduct?.createdAt,
    soldDate: initialProduct?.soldDate || null,
    soldPrice: initialProduct?.soldPrice || initialProduct?.price,
    price: initialProduct?.price || 0, // Añadido campo de precio actual
    isBundle: initialProduct?.isBundle || false,
    seoTags: initialProduct?.seoTags || "",
    priceHistory: initialProduct?.priceHistory || [] // Inicializar historial
  });

  const categories = ["Juguetes", "Abrigo", "Camisetas", "Pantalones", "Calzado", "Libros", "Accesorios", "Lotes", "Sudaderas", "Vestidos", "Otros"];

  const statusInfo = useMemo(() => {
    const now = new Date();
    const uploadDate = new Date(product.firstUploadDate || product.createdAt);
    const daysOld = Math.floor((now - uploadDate) / (1000 * 60 * 60 * 24));
    return {
      daysOld,
      isHot: (product.views > 50 || product.favorites > 10) && daysOld < 30,
      isCold: daysOld >= 45 
    };
  }, [product]);

  // LOGICA OPCIÓN B: Guardar cambios y registrar historial si el precio cambia
  const handleSaveEdit = () => {
    let updatedForm = { ...editForm };

    // Si el precio en el formulario es distinto al precio actual del producto
    if (Number(editForm.price) !== Number(product.price)) {
      const newHistoryEntry = {
        price: product.price,
        date: new Date().toISOString()
      };
      updatedForm.priceHistory = [...(editForm.priceHistory || []), newHistoryEntry];
    }

    if (DatabaseService.updateProduct(updatedForm)) {
      setProduct(updatedForm);
      setIsEditing(false);
      LogService.add("✅ Cambios y precio actualizados", "success");
    }
  };

  const handleMarkRepublicated = () => {
    Alert.alert("🔄 Confirmar Resubida", "¿Has resubido este artículo? Se reseteará la fecha a hoy.", [
      { text: "No" },
      { text: "Sí", onPress: () => {
          const now = new Date().toISOString();
          const updated = { ...product, firstUploadDate: now };
          if (DatabaseService.updateProduct(updated)) {
            setProduct(updated);
            setEditForm(prev => ({ ...prev, firstUploadDate: now }));
            LogService.add("🚀 Fecha reseteada", "success");
          }
        }
      }
    ]);
  };

  const renderCalendarPicker = () => {
    const year = navDate.getFullYear();
    const month = navDate.getMonth();
    const days = Array.from({ length: new Date(year, month + 1, 0).getDate() }, (_, i) => i + 1);
    return (
      <Modal visible={showCalendar} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.calendarCard}>
            <View style={styles.calHeader}>
              <TouchableOpacity onPress={() => setNavDate(new Date(year, month - 1, 1))}><Icon name="chevron-left" size={20} color="#FF6B35" /></TouchableOpacity>
              <Text style={styles.monthText}>{month + 1} / {year}</Text>
              <TouchableOpacity onPress={() => setNavDate(new Date(year, month + 1, 1))}><Icon name="chevron-right" size={20} color="#FF6B35" /></TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={styles.daysGrid}>
              {days.map(d => (
                <TouchableOpacity key={d} style={styles.dayCircle} onPress={() => {
                  setEditForm({ ...editForm, firstUploadDate: new Date(year, month, d).toISOString() });
                  setShowCalendar(false);
                }}><Text style={styles.dayText}>{d}</Text></TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity onPress={() => setShowCalendar(false)}><Text style={styles.closeCal}>CERRAR</Text></TouchableOpacity>
          </View>
        </View>
      </Modal>
    );
  };

  return (
    <View style={styles.container}>
      {renderCalendarPicker()}
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.imageContainer}>
          <Image source={{ uri: product.images[0] }} style={styles.mainImage} />
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}><Icon name="arrow-left" size={22} color="#1A1A2E" /></TouchableOpacity>
        </View>

        <View style={styles.contentCard}>
          {isEditing ? (
            <View>
              <Text style={styles.editTitle}>Editar Información Permanente</Text>
              
              <Text style={styles.label}>PRECIO DE PUBLICACIÓN (€)</Text>
              <TextInput 
                style={styles.input} 
                keyboardType="numeric" 
                value={editForm.price?.toString()} 
                onChangeText={t => setEditForm({...editForm, price: t})} 
              />

              <Text style={styles.label}>CATEGORÍA</Text>
              <View style={styles.catGrid}>
                {categories.map(c => (
                  <TouchableOpacity key={c} style={[styles.catBtn, editForm.category === c && styles.catBtnActive]} onPress={() => setEditForm({...editForm, category: c})}>
                    <Text style={[styles.catBtnText, editForm.category === c && {color: '#FFF'}]}>{c}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.label}>FECHA SUBIDA ORIGINAL</Text>
              <TouchableOpacity style={styles.inputRow} onPress={() => { setNavDate(new Date(editForm.firstUploadDate)); setShowCalendar(true); }}>
                <Icon name="calendar" size={18} color="#FF6B35" /><Text style={styles.inputText}>{new Date(editForm.firstUploadDate).toLocaleDateString()}</Text>
              </TouchableOpacity>

              <Text style={styles.label}>ETIQUETAS SEO</Text>
              <TextInput 
                style={styles.input} 
                multiline 
                placeholder="Ej: vintage, oversized, nike..."
                value={editForm.seoTags} 
                onChangeText={t => setEditForm({...editForm, seoTags: t})} 
              />

              <View style={styles.editActions}>
                <TouchableOpacity style={styles.btnSave} onPress={handleSaveEdit}><Text style={styles.btnSaveText}>Guardar</Text></TouchableOpacity>
                <TouchableOpacity style={styles.btnCancel} onPress={() => setIsEditing(false)}><Text style={styles.btnCancelText}>Cancelar</Text></TouchableOpacity>
              </View>
            </View>
          ) : (
            <>
              <View style={styles.topRow}>
                <Text style={styles.brandText}>{product.brand || 'Vinted'}</Text>
                <View style={styles.categoryBadge}><Text style={styles.categoryBadgeText}>{product.category || 'Otros'}</Text></View>
              </View>
              
              <View style={styles.titleRow}>
                <Text style={styles.titleText}>{product.title}</Text>
                <View style={styles.priceTag}><Text style={styles.priceTagText}>{product.price}€</Text></View>
                {product.isBundle && <View style={styles.bundleLabel}><Text style={styles.bundleLabelText}>LOTE</Text></View>}
              </View>

              {/* SECCIÓN VISUAL HISTORIAL DE PRECIOS (OPCIÓN B) */}
              {product.priceHistory && product.priceHistory.length > 0 && (
                <View style={styles.priceHistoryBox}>
                  <Text style={styles.historyTitle}>EVOLUCIÓN DE PRECIO</Text>
                  {product.priceHistory.map((h, i) => (
                    <View key={i} style={styles.historyItem}>
                      <Icon name="trending-down" size={12} color="#FF6B35" />
                      <Text style={styles.historyText}>Antes {h.price}€ ({new Date(h.date).toLocaleDateString()})</Text>
                    </View>
                  ))}
                </View>
              )}
              
              <View style={styles.statsPanel}>
                <View style={styles.stat}><Text style={styles.statLabel}>VISTAS</Text><Text style={styles.statVal}>{product.views || 0}</Text></View>
                <View style={styles.stat}><Text style={styles.statLabel}>DÍAS</Text><Text style={[styles.statVal, statusInfo.isCold && {color: '#33b5e5'}]}>{statusInfo.daysOld}</Text></View>
                <View style={styles.stat}><Icon name={statusInfo.isHot ? "zap" : "activity"} size={16} color={statusInfo.isHot ? "#FF4D4D" : "#CCC"} /></View>
              </View>

              <Text style={styles.sectionTitle}>Descripción</Text>
              <Text style={styles.descText}>{product.description}</Text>

              {product.seoTags ? (
                <View style={styles.tagSection}>
                  <Text style={styles.sectionTitle}>Etiquetas SEO</Text>
                  <View style={styles.tagCloud}>
                    {product.seoTags.split(',').map((tag, i) => (
                      <View key={i} style={styles.seoTag}><Text style={styles.seoTagText}>#{tag.trim()}</Text></View>
                    ))}
                  </View>
                </View>
              ) : null}

              <View style={styles.bottomActionsRow}>
                <TouchableOpacity style={styles.actionBtn} onPress={() => setIsEditing(true)}>
                  <Icon name="edit-3" size={18} color="#1A1A2E" /><Text style={styles.actionBtnText}>Editar</Text>
                </TouchableOpacity>

                <TouchableOpacity style={[styles.actionBtn, {backgroundColor: '#33b5e515'}]} onPress={handleMarkRepublicated}>
                  <Icon name="refresh-cw" size={18} color="#33b5e5" /><Text style={[styles.actionBtnText, {color: '#33b5e5'}]}>Resubido</Text>
                </TouchableOpacity>

                <TouchableOpacity style={[styles.actionBtn, {backgroundColor: '#FF4D4D15'}]} onPress={() => {
                  Alert.alert("Borrar", "¿Eliminar permanentemente de la base de datos local?", [
                    {text: "No"}, {text: "Sí", onPress: () => { DatabaseService.deleteProduct(product.id); navigation.goBack(); }}
                  ]);
                }}>
                  <Icon name="trash-2" size={18} color="#FF4D4D" /><Text style={[styles.actionBtnText, {color: '#FF4D4D'}]}>Borrar</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  imageContainer: { height: 350 },
  mainImage: { width: width, height: 350 },
  backBtn: { position: 'absolute', top: 50, left: 20, backgroundColor: '#FFF', width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', elevation: 5 },
  contentCard: { flex: 1, backgroundColor: '#FFF', borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 25, marginTop: -30 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 },
  brandText: { color: '#FF6B35', fontWeight: '900', fontSize: 11, letterSpacing: 1 },
  categoryBadge: { backgroundColor: '#F0F9FF', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  categoryBadgeText: { color: '#33b5e5', fontSize: 10, fontWeight: '800' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 10 },
  titleText: { fontSize: 20, fontWeight: '900', color: '#1A1A2E', flex: 1 },
  priceTag: { backgroundColor: '#00D9A3', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 },
  priceTagText: { color: '#FFF', fontWeight: '900', fontSize: 14 },
  bundleLabel: { backgroundColor: '#F0EFFF', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  bundleLabelText: { color: '#6C63FF', fontSize: 10, fontWeight: '900' },
  
  // Estilos Opción B
  priceHistoryBox: { backgroundColor: '#FFF2EE', padding: 15, borderRadius: 15, marginBottom: 15 },
  historyTitle: { fontSize: 9, fontWeight: '900', color: '#FF6B35', marginBottom: 8, letterSpacing: 1 },
  historyItem: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  historyText: { fontSize: 12, color: '#666', fontWeight: '700' },

  statsPanel: { flexDirection: 'row', justifyContent: 'space-around', backgroundColor: '#F8F9FA', padding: 15, borderRadius: 20, marginVertical: 10 },
  stat: { alignItems: 'center' },
  statLabel: { fontSize: 9, color: '#999', fontWeight: '800' },
  statVal: { fontSize: 16, fontWeight: '900', color: '#1A1A2E' },
  sectionTitle: { fontSize: 12, fontWeight: '900', color: '#1A1A2E', marginBottom: 8, marginTop: 10 },
  descText: { fontSize: 14, color: '#666', lineHeight: 20, marginBottom: 15 },
  tagSection: { marginVertical: 15 },
  tagCloud: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  seoTag: { backgroundColor: '#F0F0F0', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  seoTagText: { fontSize: 11, color: '#444', fontWeight: '700' },
  bottomActionsRow: { flexDirection: 'row', gap: 10, marginTop: 20, marginBottom: 30 },
  actionBtn: { flex: 1, alignItems: 'center', gap: 8, backgroundColor: '#F0F0F0', paddingVertical: 15, borderRadius: 20 },
  actionBtnText: { fontSize: 11, fontWeight: '800', color: '#1A1A2E' },
  editTitle: { fontSize: 18, fontWeight: '900', marginBottom: 15, color: '#1A1A2E' },
  label: { fontSize: 10, fontWeight: '900', color: '#999', marginTop: 15, marginBottom: 8 },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 15, backgroundColor: '#F8F9FA', borderRadius: 12, borderWidth: 1, borderColor: '#EEE' },
  inputText: { fontWeight: '700', color: '#1A1A2E' },
  input: { backgroundColor: '#F8F9FA', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#EEE', fontWeight: '700', color: '#1A1A2E' },
  catGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  catBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: '#F0F0F0' },
  catBtnActive: { backgroundColor: '#1A1A2E' },
  catBtnText: { fontSize: 11, color: '#666', fontWeight: '700' },
  editActions: { flexDirection: 'row', gap: 10, marginTop: 25 },
  btnSave: { flex: 2, backgroundColor: '#1A1A2E', padding: 15, borderRadius: 15, alignItems: 'center' },
  btnSaveText: { color: '#FFF', fontWeight: '900' },
  btnCancel: { flex: 1, backgroundColor: '#EEE', padding: 15, borderRadius: 15, alignItems: 'center' },
  btnCancelText: { color: '#666', fontWeight: '800' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  calendarCard: { width: '85%', backgroundColor: '#FFF', borderRadius: 25, padding: 20 },
  calHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  monthText: { fontSize: 16, fontWeight: '900' },
  daysGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 5 },
  dayCircle: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  dayText: { fontWeight: '700' },
  closeCal: { textAlign: 'center', marginTop: 20, color: '#CCC', fontWeight: '900' }
});