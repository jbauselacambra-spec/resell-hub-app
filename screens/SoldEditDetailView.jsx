import React, { useState } from 'react';
import { 
  View, Text, ScrollView, Image, StyleSheet, Dimensions, 
  TouchableOpacity, TextInput, Modal, Alert 
} from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import { DatabaseService } from '../services/DatabaseService';
import LogService from '../services/LogService';

const { width } = Dimensions.get('window');

// Categorías oficiales de tu app
const CATEGORIES = ['Ropa', 'Calzado', 'Juguetes', 'Entretenimiento', 'Lotes', 'Otros'];

export default function SoldEditDetailView({ route, navigation }) {
  const { product: initialProduct } = route.params;

  // ESTADO DEL FORMULARIO ACTUALIZADO
  const [editForm, setEditForm] = useState({
    ...initialProduct,
    soldPrice: initialProduct.soldPrice || initialProduct.price || 0,
    soldDate: initialProduct.soldDate || initialProduct.soldAt || new Date().toISOString(),
    isBundle: initialProduct.isBundle || false,
    category: initialProduct.category || 'Otros',
    seoTags: initialProduct.seoTags || ""
  });

  const [showCalendar, setShowCalendar] = useState(false);
  const [navDate, setNavDate] = useState(new Date(editForm.soldDate));

  const handleSave = () => {
    if (DatabaseService.updateProduct(editForm)) {
      LogService.add("✅ Datos de venta actualizados", "success");
      navigation.goBack();
    } else {
      Alert.alert("Error", "No se pudo guardar en la base de datos.");
    }
  };

  const renderCalendar = () => {
    const year = navDate.getFullYear();
    const month = navDate.getMonth();
    const days = Array.from({ length: new Date(year, month + 1, 0).getDate() }, (_, i) => i + 1);

    return (
      <Modal visible={showCalendar} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.calendarCard}>
            <View style={styles.calHeader}>
              <TouchableOpacity onPress={() => setNavDate(new Date(year, month - 1, 1))}><Icon name="chevron-left" size={24} /></TouchableOpacity>
              <Text style={styles.monthText}>{new Intl.DateTimeFormat('es-ES', { month: 'long' }).format(navDate).toUpperCase()}</Text>
              <TouchableOpacity onPress={() => setNavDate(new Date(year, month + 1, 1))}><Icon name="chevron-right" size={24} /></TouchableOpacity>
            </View>
            <View style={styles.daysGrid}>
              {days.map(d => (
                <TouchableOpacity key={d} style={styles.dayCircle} onPress={() => {
                  setEditForm({ ...editForm, soldDate: new Date(year, month, d).toISOString() });
                  setShowCalendar(false);
                }}><Text style={styles.dayText}>{d}</Text></TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity onPress={() => setShowCalendar(false)}><Text style={styles.closeCal}>CANCELAR</Text></TouchableOpacity>
          </View>
        </View>
      </Modal>
    );
  };

  return (
    <View style={styles.container}>
      {renderCalendar()}
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.imageHeader}>
          <Image source={{ uri: editForm.images?.[0] }} style={styles.image} />
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Icon name="x" size={24} color="#1A1A2E" />
          </TouchableOpacity>
        </View>

        <View style={styles.content}>
          <Text style={styles.mainTitle}>{editForm.title}</Text>
          
          <View style={styles.formCard}>
            <Text style={styles.sectionLabel}>DATOS DE VENTA Y SEO</Text>
            
            {/* PRECIO */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>PRECIO FINAL (€)</Text>
              <View style={styles.priceInputWrapper}>
                <TextInput 
                  style={styles.priceInput}
                  keyboardType="numeric"
                  value={editForm.soldPrice?.toString()}
                  onChangeText={(t) => setEditForm({...editForm, soldPrice: t})}
                />
                <Icon name="edit-2" size={16} color="#00D9A3" />
              </View>
            </View>

            {/* FECHA */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>FECHA DE VENTA</Text>
              <TouchableOpacity style={styles.dateSelector} onPress={() => setShowCalendar(true)}>
                <Icon name="calendar" size={18} color="#00D9A3" />
                <Text style={styles.dateValue}>{new Date(editForm.soldDate).toLocaleDateString('es-ES')}</Text>
              </TouchableOpacity>
            </View>

            {/* CATEGORÍA */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>CATEGORÍA</Text>
              <View style={styles.catGrid}>
                {CATEGORIES.map(cat => (
                  <TouchableOpacity 
                    key={cat} 
                    style={[styles.catChip, editForm.category === cat && styles.catChipActive]}
                    onPress={() => setEditForm({...editForm, category: cat})}
                  >
                    <Text style={[styles.catChipText, editForm.category === cat && styles.catChipTextActive]}>{cat}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* SEO TAGS */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>ETIQUETAS SEO / PALABRAS CLAVE</Text>
              <TextInput 
                style={styles.seoInput}
                multiline
                numberOfLines={3}
                placeholder="Ej: vintage, coleccionismo, bmx..."
                value={editForm.seoTags}
                onChangeText={(t) => setEditForm({...editForm, seoTags: t})}
              />
            </View>

            {/* LOTE */}
            <TouchableOpacity 
              style={[styles.loteToggle, editForm.isBundle && styles.loteActive]} 
              onPress={() => setEditForm({...editForm, isBundle: !editForm.isBundle})}
            >
              <Icon name={editForm.isBundle ? "check-square" : "square"} size={22} color={editForm.isBundle ? "#FFF" : "#6C63FF"} />
              <Text style={[styles.loteLabel, editForm.isBundle && {color: '#FFF'}]}>VENTA EN LOTE / PACK</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
            <Text style={styles.saveBtnText}>GUARDAR CAMBIOS</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF' },
  imageHeader: { height: 300 },
  image: { width: width, height: 300 },
  backBtn: { position: 'absolute', top: 50, left: 20, backgroundColor: '#FFF', width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', elevation: 5 },
  content: { padding: 25, marginTop: -30, backgroundColor: '#FFF', borderTopLeftRadius: 30, borderTopRightRadius: 30 },
  mainTitle: { fontSize: 22, fontWeight: '800', color: '#1A1A2E', marginBottom: 20 },
  formCard: { backgroundColor: '#F8F9FA', borderRadius: 25, padding: 20, borderWidth: 1, borderColor: '#EEE' },
  sectionLabel: { fontSize: 10, fontWeight: '900', color: '#00D9A3', letterSpacing: 1, marginBottom: 20 },
  inputGroup: { marginBottom: 20 },
  label: { fontSize: 10, fontWeight: '900', color: '#999', marginBottom: 8 },
  
  // Precio
  priceInputWrapper: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 2, borderBottomColor: '#00D9A3', paddingBottom: 5 },
  priceInput: { flex: 1, fontSize: 24, fontWeight: '900', color: '#1A1A2E' },
  
  // Fecha
  dateSelector: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#FFF', padding: 15, borderRadius: 15, borderWidth: 1, borderColor: '#EEE' },
  dateValue: { fontSize: 16, fontWeight: '700', color: '#1A1A2E' },

  // Categorías
  catGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  catChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: '#FFF', borderWidth: 1, borderColor: '#EEE' },
  catChipActive: { backgroundColor: '#FF6B35', borderColor: '#FF6B35' },
  catChipText: { fontSize: 11, fontWeight: '800', color: '#999' },
  catChipTextActive: { color: '#FFF' },

  // SEO
  seoInput: { backgroundColor: '#FFF', borderRadius: 15, padding: 15, fontSize: 14, color: '#1A1A2E', borderWidth: 1, borderColor: '#EEE', textAlignVertical: 'top' },

  // Lote
  loteToggle: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 20, backgroundColor: '#F0EFFF', borderRadius: 18, marginTop: 10 },
  loteActive: { backgroundColor: '#6C63FF' },
  loteLabel: { fontWeight: '900', color: '#6C63FF', fontSize: 12 },

  // Guardar
  saveBtn: { backgroundColor: '#1A1A2E', padding: 20, borderRadius: 20, alignItems: 'center', marginTop: 30, elevation: 5 },
  saveBtnText: { color: '#FFF', fontWeight: '900', letterSpacing: 1 },

  // Modal Calendario
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' },
  calendarCard: { width: '85%', backgroundColor: '#FFF', borderRadius: 25, padding: 20 },
  calHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  monthText: { fontWeight: '900', color: '#1A1A2E' },
  daysGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' },
  dayCircle: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8F9FA', borderRadius: 10 },
  dayText: { fontWeight: '800' },
  closeCal: { textAlign: 'center', marginTop: 20, fontWeight: '900', color: '#BBB' }
});