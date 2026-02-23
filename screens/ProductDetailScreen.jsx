import React, { useState, useMemo, useEffect } from 'react';
import { 
  View, Text, ScrollView, Image, StyleSheet, Dimensions, 
  TouchableOpacity, Alert, TextInput, Modal, Platform 
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
    seoTags: initialProduct?.seoTags || "",
    category: initialProduct?.category || "Otros",
    firstUploadDate: initialProduct?.firstUploadDate || initialProduct?.createdAt || new Date().toISOString()
  });

  const categories = ["Juguetes", "Abrigo", "Camisetas", "Pantalones", "Calzado", "Libros", "Accesorios", "Lotes", "Sudaderas", "Vestidos", "Otros"];

  // Lógica de Temperatura sincronizada con ProductList (45 días)
  const statusInfo = useMemo(() => {
    const now = new Date();
    const uploadDate = new Date(product.firstUploadDate || product.createdAt);
    const daysOld = Math.floor((now - uploadDate) / (1000 * 60 * 60 * 24));
    
    return {
      daysOld,
      isNew: daysOld <= 7,
      isHot: (product.views > 50 || product.favorites > 10) && daysOld < 30,
      isCold: daysOld >= 45 // Sincronizado a 45 días
    };
  }, [product]);

  const handleSaveEdit = () => {
    const updatedData = { ...product, ...editForm };
    if (DatabaseService.updateProduct(updatedData)) {
      setProduct(updatedData);
      setIsEditing(false);
      LogService.add("✅ Cambios guardados", "success");
    } else {
      Alert.alert("Error", "No se pudo actualizar la base de datos.");
    }
  };

  const handleMarkRepublicated = () => {
    Alert.alert("🔄 Confirmar Resubida", "¿Has resubido este artículo? Se reseteará la fecha a hoy.", [
      { text: "No" },
      { text: "Sí, Resubido", onPress: () => {
          const now = new Date().toISOString();
          const updatedProduct = { ...product, firstUploadDate: now };
          if (DatabaseService.updateProduct(updatedProduct)) {
             setProduct(updatedProduct);
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
    const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

    return (
      <Modal visible={showCalendar} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.calendarCard}>
            <View style={styles.calHeader}>
              <TouchableOpacity onPress={() => setNavDate(new Date(year + (-1), month, 1))}><Icon name="chevrons-left" size={20} color="#FF6B35" /></TouchableOpacity>
              <TouchableOpacity onPress={() => setNavDate(new Date(year, month - 1, 1))}><Icon name="chevron-left" size={20} color="#FF6B35" /></TouchableOpacity>
              <View style={styles.monthYearTitle}>
                <Text style={styles.monthText}>{monthNames[month]}</Text>
                <Text style={styles.yearText}>{year}</Text>
              </View>
              <TouchableOpacity onPress={() => setNavDate(new Date(year, month + 1, 1))}><Icon name="chevron-right" size={20} color="#FF6B35" /></TouchableOpacity>
              <TouchableOpacity onPress={() => setNavDate(new Date(year + 1, month, 1))}><Icon name="chevrons-right" size={20} color="#FF6B35" /></TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={styles.daysGrid}>
              {days.map(d => {
                const isSelected = new Date(editForm.firstUploadDate).getDate() === d && 
                                   new Date(editForm.firstUploadDate).getMonth() === month &&
                                   new Date(editForm.firstUploadDate).getFullYear() === year;
                return (
                  <TouchableOpacity 
                    key={d} 
                    style={[styles.dayCircle, isSelected && styles.dayCircleActive]}
                    onPress={() => {
                      setEditForm({...editForm, firstUploadDate: new Date(year, month, d).toISOString()});
                      setShowCalendar(false);
                    }}
                  >
                    <Text style={[styles.dayText, isSelected && styles.dayTextActive]}>{d}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            <TouchableOpacity style={styles.closeCal} onPress={() => setShowCalendar(false)}>
              <Text style={styles.closeCalText}>CERRAR</Text>
            </TouchableOpacity>
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
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Icon name="arrow-left" size={22} color="#1A1A2E" />
          </TouchableOpacity>
        </View>

        <View style={styles.contentCard}>
          {isEditing ? (
            <View>
              <Text style={styles.editTitle}>Editar Información</Text>
              
              <Text style={styles.label}>FECHA DE SUBIDA REAL</Text>
              <TouchableOpacity style={styles.calendarTrigger} onPress={() => {
                setNavDate(new Date(editForm.firstUploadDate));
                setShowCalendar(true);
              }}>
                <Icon name="calendar" size={18} color="#FF6B35" />
                <Text style={styles.calendarTriggerText}>
                  {new Date(editForm.firstUploadDate).toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' })}
                </Text>
              </TouchableOpacity>

              <Text style={styles.label}>CATEGORÍA</Text>
              <View style={styles.catGrid}>
                {categories.map(cat => (
                  <TouchableOpacity 
                    key={cat} 
                    style={[styles.catBtn, editForm.category === cat && styles.catBtnActive]}
                    onPress={() => setEditForm({...editForm, category: cat})}
                  >
                    <Text style={[styles.catBtnText, editForm.category === cat && styles.catBtnTextActive]}>{cat}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.label}>ETIQUETAS SEO</Text>
              <TextInput 
                style={styles.input} 
                multiline value={editForm.seoTags} 
                placeholder="Ej: vintage, oversized, cotton..."
                onChangeText={t => setEditForm({...editForm, seoTags: t})}
              />

              <View style={styles.editActions}>
                <TouchableOpacity style={styles.btnSave} onPress={handleSaveEdit}><Text style={styles.btnSaveText}>Guardar</Text></TouchableOpacity>
                <TouchableOpacity style={styles.btnCancel} onPress={() => setIsEditing(false)}><Text style={styles.btnCancelText}>Cerrar</Text></TouchableOpacity>
              </View>
            </View>
          ) : (
            <>
              <View style={styles.topRow}>
                <Text style={styles.brandText}>{product.brand || 'Vinted'}</Text>
                <View style={styles.categoryBadge}>
                   <Text style={styles.categoryBadgeText}>{product.category || 'Otros'}</Text>
                </View>
              </View>
              
              <Text style={styles.titleText}>{product.title}</Text>
              
              <View style={styles.statsPanel}>
                <View style={styles.stat}><Text style={styles.statLabel}>VISTAS</Text><Text style={styles.statVal}>{product.views || 0}</Text></View>
                <View style={styles.stat}>
                  <Text style={styles.statLabel}>DÍAS</Text>
                  <Text style={[styles.statVal, statusInfo.isCold && {color: '#FF4D4D'}]}>{statusInfo.daysOld}</Text>
                </View>
                <View style={styles.stat}>
                  <Text style={styles.statLabel}>TEMP</Text>
                  <Icon name={statusInfo.isHot ? "zap" : (statusInfo.isCold ? "wind" : "activity")} size={16} color={statusInfo.isHot ? "#FF4D4D" : (statusInfo.isCold ? "#33b5e5" : "#CCC")} />
                </View>
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
                  <Icon name="edit-3" size={18} color="#1A1A2E" />
                  <Text style={styles.actionBtnText}>Editar</Text>
                </TouchableOpacity>

                <TouchableOpacity style={[styles.actionBtn, {backgroundColor: '#33b5e515'}]} onPress={handleMarkRepublicated}>
                  <Icon name="refresh-cw" size={18} color="#33b5e5" />
                  <Text style={[styles.actionBtnText, {color: '#33b5e5'}]}>Resubido</Text>
                </TouchableOpacity>

                <TouchableOpacity style={[styles.actionBtn, {backgroundColor: '#FF4D4D15'}]} onPress={() => {
                  DatabaseService.deleteProduct(product.id);
                  navigation.goBack();
                }}>
                  <Icon name="trash-2" size={18} color="#FF4D4D" />
                  <Text style={[styles.actionBtnText, {color: '#FF4D4D'}]}>Borrar</Text>
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
  titleText: { fontSize: 22, fontWeight: '900', color: '#1A1A2E' },
  statsPanel: { flexDirection: 'row', justifyContent: 'space-around', backgroundColor: '#F8F9FA', padding: 15, borderRadius: 20, marginVertical: 20 },
  stat: { alignItems: 'center' },
  statLabel: { fontSize: 9, color: '#999', fontWeight: '800' },
  statVal: { fontSize: 16, fontWeight: '900', color: '#1A1A2E' },
  sectionTitle: { fontSize: 12, fontWeight: '900', color: '#1A1A2E', marginBottom: 8, marginTop: 10 },
  descText: { fontSize: 14, color: '#666', lineHeight: 20, marginBottom: 15 },
  tagSection: { marginBottom: 20 },
  tagCloud: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  seoTag: { backgroundColor: '#F0F0F0', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  seoTagText: { fontSize: 11, color: '#444', fontWeight: '700' },
  bottomActionsRow: { flexDirection: 'row', gap: 10, marginTop: 10, marginBottom: 30 },
  actionBtn: { flex: 1, alignItems: 'center', gap: 8, backgroundColor: '#F0F0F0', paddingVertical: 15, borderRadius: 20 },
  actionBtnText: { fontSize: 11, fontWeight: '800', color: '#1A1A2E' },
  editTitle: { fontSize: 18, fontWeight: '900', marginBottom: 15 },
  label: { fontSize: 10, fontWeight: '900', color: '#999', marginTop: 15, marginBottom: 8 },
  calendarTrigger: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 15, backgroundColor: '#F8F9FA', borderRadius: 15, borderWidth: 1, borderColor: '#EEE' },
  calendarTriggerText: { fontWeight: '700', color: '#1A1A2E' },
  input: { backgroundColor: '#F8F9FA', borderRadius: 12, padding: 12, minHeight: 60, textAlignVertical: 'top', borderWidth: 1, borderColor: '#EEE' },
  catGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  catBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: '#F0F0F0' },
  catBtnActive: { backgroundColor: '#1A1A2E' },
  catBtnText: { fontSize: 11, color: '#666', fontWeight: '700' },
  catBtnTextActive: { color: '#FFF' },
  editActions: { flexDirection: 'row', gap: 10, marginTop: 25 },
  btnSave: { flex: 2, backgroundColor: '#1A1A2E', padding: 15, borderRadius: 15, alignItems: 'center' },
  btnSaveText: { color: '#FFF', fontWeight: '900' },
  btnCancel: { flex: 1, backgroundColor: '#EEE', padding: 15, borderRadius: 15, alignItems: 'center' },
  btnCancelText: { color: '#666', fontWeight: '800' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  calendarCard: { width: '90%', maxHeight: '70%', backgroundColor: '#FFF', borderRadius: 25, padding: 20, alignItems: 'center' },
  calHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%', marginBottom: 20, borderBottomWidth: 1, borderBottomColor: '#EEE', paddingBottom: 15 },
  monthYearTitle: { alignItems: 'center' },
  monthText: { fontSize: 16, fontWeight: '900', color: '#1A1A2E' },
  yearText: { fontSize: 12, color: '#FF6B35', fontWeight: '800' },
  daysGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center' },
  dayCircle: { width: 40, height: 40, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginBottom: 5 },
  dayCircleActive: { backgroundColor: '#1A1A2E' },
  dayText: { fontSize: 14, fontWeight: '600', color: '#1A1A2E' },
  dayTextActive: { color: '#FFF' },
  closeCal: { marginTop: 15, padding: 10 },
  closeCalText: { fontWeight: '900', color: '#999', fontSize: 12 }
});