import React, { useState } from 'react';
import { 
  View, Text, ScrollView, Image, StyleSheet, Dimensions, 
  TouchableOpacity, TextInput, Modal, Alert 
} from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import { DatabaseService } from '../services/DatabaseService';
import LogService from '../services/LogService';

const { width } = Dimensions.get('window');

export default function SoldDetailView({ route, navigation }) {
  // 1. Recibimos el producto
  const { product: initialProduct } = route.params || {};
  
  // 2. Estados de control
  const [isEditing, setIsEditing] = useState(false);
  const [product, setProduct] = useState(initialProduct);
  const [showCalendar, setShowCalendar] = useState(false);
  const [navDate, setNavDate] = useState(new Date(product?.soldDate || product?.soldAt || new Date()));

  // 3. Estado del formulario (aquí es donde ocurre la magia de la edición)
  const [editForm, setEditForm] = useState({
    ...initialProduct,
    soldPrice: initialProduct?.soldPrice || initialProduct?.price || 0,
    soldDate: initialProduct?.soldDate || initialProduct?.soldAt || new Date().toISOString(),
    isBundle: initialProduct?.isBundle || false
  });

  // 4. Función para guardar cambios
  const handleSave = () => {
    const success = DatabaseService.updateProduct(editForm);
    if (success) {
      setProduct(editForm); // Actualizamos la vista principal
      setIsEditing(false);  // Salimos del modo edición
      LogService.add(`✅ Actualizado: ${editForm.title}`, "success");
    } else {
      Alert.alert("Error", "No se pudo guardar en la base de datos.");
    }
  };

  // 5. Calendario Navegable (igual al que usas en el detalle de producto)
  const renderCalendar = () => {
    const year = navDate.getFullYear();
    const month = navDate.getMonth();
    const days = Array.from({ length: new Date(year, month + 1, 0).getDate() }, (_, i) => i + 1);

    return (
      <Modal visible={showCalendar} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.calendarCard}>
            <View style={styles.calHeader}>
              <TouchableOpacity onPress={() => setNavDate(new Date(year, month - 1, 1))}>
                <Icon name="chevron-left" size={28} color="#1A1A2E" />
              </TouchableOpacity>
              <View style={{ alignItems: 'center' }}>
                <Text style={styles.monthText}>{new Intl.DateTimeFormat('es-ES', { month: 'long' }).format(navDate).toUpperCase()}</Text>
                <Text style={styles.yearText}>{year}</Text>
              </View>
              <TouchableOpacity onPress={() => setNavDate(new Date(year, month + 1, 1))}>
                <Icon name="chevron-right" size={28} color="#1A1A2E" />
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={styles.daysGrid}>
              {days.map(d => (
                <TouchableOpacity key={d} style={styles.dayCircle} onPress={() => {
                  setEditForm({ ...editForm, soldDate: new Date(year, month, d).toISOString() });
                  setShowCalendar(false);
                }}>
                  <Text style={styles.dayText}>{d}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity style={styles.btnCloseCal} onPress={() => setShowCalendar(false)}>
              <Text style={styles.btnCloseText}>CERRAR</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    );
  };

  return (
    <View style={styles.container}>
      {renderCalendar()}
      <ScrollView showsVerticalScrollIndicator={false}>
        
        {/* IMAGEN Y BOTONES DE CABECERA */}
        <View style={styles.imageContainer}>
          <Image source={{ uri: product?.images?.[0] }} style={styles.image} />
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Icon name="arrow-left" size={24} color="#1A1A2E" />
          </TouchableOpacity>
          
          {/* BOTÓN FLOTANTE QUE CAMBIA DE VISTA A EDICIÓN */}
          <TouchableOpacity 
            style={[styles.floatingActionBtn, isEditing && { backgroundColor: '#FF4D4D' }]} 
            onPress={() => setIsEditing(!isEditing)}
          >
            <Icon name={isEditing ? "x" : "edit-3"} size={22} color="#FFF" />
          </TouchableOpacity>
        </View>

        <View style={styles.contentCard}>
          <View style={styles.statusBadge}>
            <Icon name="check-circle" size={14} color="#FFF" />
            <Text style={styles.statusText}>VENTA FINALIZADA</Text>
          </View>

          {isEditing ? (
            /* --- VISTA DE EDICIÓN --- */
            <View style={styles.form}>
              <Text style={styles.sectionTitle}>Editar Información</Text>
              
              <Text style={styles.label}>PRECIO DE VENTA (€)</Text>
              <TextInput 
                style={styles.input} 
                keyboardType="numeric"
                value={editForm.soldPrice?.toString()}
                onChangeText={(t) => setEditForm({...editForm, soldPrice: t})}
                placeholder="Ej: 12.50"
              />

              <Text style={styles.label}>FECHA DE LA VENTA</Text>
              <TouchableOpacity style={styles.selector} onPress={() => setShowCalendar(true)}>
                <Icon name="calendar" size={18} color="#00D9A3" />
                <Text style={styles.selectorText}>
                  {new Date(editForm.soldDate).toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' })}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.loteBtn, editForm.isBundle && styles.loteBtnActive]} 
                onPress={() => setEditForm({...editForm, isBundle: !editForm.isBundle})}
              >
                <Icon name={editForm.isBundle ? "check-square" : "square"} size={20} color={editForm.isBundle ? "#FFF" : "#6C63FF"} />
                <Text style={[styles.loteLabel, editForm.isBundle && { color: '#FFF' }]}>¿ES VENTA POR LOTE?</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.btnSave} onPress={handleSave}>
                <Icon name="save" size={18} color="#FFF" />
                <Text style={styles.btnSaveText}>GUARDAR CAMBIOS</Text>
              </TouchableOpacity>
            </View>
          ) : (
            /* --- VISTA DE LECTURA (ESTÁTICA) --- */
            <View>
              <Text style={styles.title}>{product?.title}</Text>
              
              <View style={styles.priceRow}>
                <View style={styles.priceCard}>
                  <Text style={styles.priceLabel}>VENDIDO POR</Text>
                  <Text style={styles.priceText}>{product?.soldPrice || product?.price}€</Text>
                </View>
                <View style={styles.priceCard}>
                  <Text style={styles.priceLabel}>FECHA VENTA</Text>
                  <Text style={styles.dateText}>{new Date(product?.soldDate || product?.soldAt).toLocaleDateString()}</Text>
                </View>
              </View>

              <View style={styles.badgeRow}>
                <View style={styles.miniBadge}>
                   <Icon name="layers" size={12} color="#6C63FF" />
                   <Text style={styles.miniBadgeText}>{product?.isBundle ? "Lote" : "Individual"}</Text>
                </View>
                <View style={[styles.miniBadge, { backgroundColor: '#E8FBF6' }]}>
                   <Icon name="tag" size={12} color="#00D9A3" />
                   <Text style={[styles.miniBadgeText, { color: '#00D9A3' }]}>{product?.category || "Sin Categoría"}</Text>
                </View>
              </View>

              <Text style={styles.descTitle}>Descripción</Text>
              <Text style={styles.description}>{product?.description || "Sin descripción disponible."}</Text>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  imageContainer: { height: 380, width: width },
  image: { width: '100%', height: '100%' },
  backBtn: { position: 'absolute', top: 50, left: 20, backgroundColor: '#FFF', width: 45, height: 45, borderRadius: 23, justifyContent: 'center', alignItems: 'center', elevation: 10 },
  floatingActionBtn: { position: 'absolute', bottom: -28, right: 30, backgroundColor: '#1A1A2E', width: 60, height: 60, borderRadius: 30, justifyContent: 'center', alignItems: 'center', elevation: 15, zIndex: 999 },
  
  contentCard: { marginTop: -30, backgroundColor: '#FFF', borderTopLeftRadius: 35, borderTopRightRadius: 35, padding: 25, flex: 1, minHeight: 600 },
  statusBadge: { backgroundColor: '#00D9A3', flexDirection: 'row', alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, alignItems: 'center', marginBottom: 20 },
  statusText: { color: '#FFF', fontWeight: '900', fontSize: 10, marginLeft: 5, letterSpacing: 1 },

  // Estilos Vista Lectura
  title: { fontSize: 24, fontWeight: '800', color: '#1A1A2E', marginBottom: 20 },
  priceRow: { flexDirection: 'row', gap: 15, marginBottom: 20 },
  priceCard: { flex: 1, backgroundColor: '#1A1A2E', padding: 15, borderRadius: 20, alignItems: 'center' },
  priceLabel: { color: 'rgba(255,255,255,0.4)', fontSize: 9, fontWeight: '900', marginBottom: 5 },
  priceText: { color: '#00D9A3', fontSize: 24, fontWeight: '900' },
  dateText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
  badgeRow: { flexDirection: 'row', gap: 10, marginBottom: 25 },
  miniBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#F0EFFF', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12 },
  miniBadgeText: { fontSize: 12, fontWeight: '800', color: '#6C63FF' },
  descTitle: { fontSize: 16, fontWeight: '800', color: '#1A1A2E', marginBottom: 8 },
  description: { color: '#666', lineHeight: 22 },

  // Estilos Formulario (Vista Edición)
  sectionTitle: { fontSize: 20, fontWeight: '900', color: '#1A1A2E', marginBottom: 15 },
  label: { fontSize: 11, fontWeight: '900', color: '#BBB', marginBottom: 8, marginTop: 15 },
  input: { backgroundColor: '#F8F9FA', padding: 18, borderRadius: 18, fontSize: 18, fontWeight: '800', color: '#1A1A2E', borderWidth: 1, borderColor: '#EEE' },
  selector: { backgroundColor: '#F8F9FA', padding: 18, borderRadius: 18, flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderColor: '#EEE' },
  selectorText: { fontSize: 15, fontWeight: '800', color: '#1A1A2E' },
  loteBtn: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 20, backgroundColor: '#F0EFFF', borderRadius: 18, marginTop: 20 },
  loteBtnActive: { backgroundColor: '#6C63FF' },
  loteLabel: { fontWeight: '900', color: '#6C63FF', fontSize: 13 },
  btnSave: { backgroundColor: '#1A1A2E', flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10, padding: 20, borderRadius: 20, marginTop: 30 },
  btnSaveText: { color: '#FFF', fontWeight: '900', fontSize: 16 },

  // Estilos Calendario Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' },
  calendarCard: { width: '85%', backgroundColor: '#FFF', borderRadius: 30, padding: 20 },
  calHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, paddingHorizontal: 10 },
  monthText: { fontSize: 18, fontWeight: '900', color: '#1A1A2E' },
  yearText: { fontSize: 14, fontWeight: '900', color: '#00D9A3' },
  daysGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8 },
  dayCircle: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8F9FA', borderRadius: 12 },
  dayText: { fontWeight: '800', color: '#1A1A2E' },
  btnCloseCal: { marginTop: 20, padding: 10, alignItems: 'center' },
  btnCloseText: { fontWeight: '900', color: '#CCC', letterSpacing: 1 }
});