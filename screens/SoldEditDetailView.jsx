import React, { useState, useMemo, useEffect } from 'react';
import {
  View, Text, ScrollView, Image, StyleSheet, Dimensions,
  TouchableOpacity, TextInput, Modal, Alert, FlatList,
} from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import { DatabaseService } from '../services/DatabaseService';
import LogService, { LOG_CTX } from '../services/LogService';

const { width } = Dimensions.get('window');

// ─── Paleta ──────────────────────────────────────────────────────────────────
const C = {
  bg:      '#F8F9FA',
  white:   '#FFFFFF',
  primary: '#FF6B35',
  blue:    '#004E89',
  success: '#00D9A3',
  warning: '#FFB800',
  danger:  '#E63946',
  purple:  '#6C63FF',
  g900:    '#1A1A2E',
  g700:    '#666666',
  g500:    '#999999',
  g100:    '#F0F0F0',
};

const fmt = (iso) => {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }); }
  catch { return '—'; }
};

// ─── Selector de Categoría/Subcategoría ───────────────────────────────────
function CategoryModal({ visible, onClose, onSelect, currentCat, currentSub }) {
  const [dict, setDict]     = useState({});
  const [selCat, setSelCat] = useState(currentCat || null);
  const [step, setStep]     = useState('cat');

  useEffect(() => {
    if (visible) {
      const full = DatabaseService.getFullDictionary() || {};
      if (Object.keys(full).length) {
        setDict(full);
      } else {
        const legacy = DatabaseService.getDictionary();
        const built  = {};
        Object.keys(legacy).forEach(k => { built[k] = { tags: legacy[k], subcategories: {} }; });
        setDict(built);
      }
      setSelCat(currentCat || null);
      setStep('cat');
    }
  }, [visible, currentCat]);

  const cats    = Object.keys(dict);
  const catData = selCat ? dict[selCat] : null;
  const subs    = catData ? Object.keys(catData.subcategories || {}) : [];

  const handleCatSelect = (cat) => {
    if (Object.keys(dict[cat]?.subcategories || {}).length > 0) {
      setSelCat(cat);
      setStep('sub');
    } else {
      onSelect(cat, null);
      onClose();
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={onClose}>
        <View style={styles.modalSheet}>
          <View style={styles.modalHeader}>
            {step === 'sub' && (
              <TouchableOpacity onPress={() => setStep('cat')} style={styles.modalBack}>
                <Icon name="arrow-left" size={18} color={C.g900} />
              </TouchableOpacity>
            )}
            <Text style={styles.modalTitle}>
              {step === 'cat' ? 'Categoría' : `Subcategoría de "${selCat}"`}
            </Text>
            <TouchableOpacity onPress={onClose}>
              <Icon name="x" size={20} color={C.g500} />
            </TouchableOpacity>
          </View>

          <FlatList
            data={step === 'cat' ? cats : ['Sin subcategoría', ...subs]}
            keyExtractor={i => i}
            renderItem={({ item }) => {
              const isNone = item === 'Sin subcategoría';
              const isCurr = step === 'cat'
                ? item === currentCat
                : (!isNone && item === currentSub) || (isNone && !currentSub);
              return (
                <TouchableOpacity
                  style={[styles.modalItem, isCurr && styles.modalItemActive]}
                  onPress={() => step === 'cat'
                    ? handleCatSelect(item)
                    : (onSelect(selCat, isNone ? null : item), onClose())
                  }
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.modalItemTxt, isCurr && { color: C.blue, fontWeight: '900' }]}>
                      {item}
                    </Text>
                    {step === 'cat' && dict[item]?.tags?.length > 0 && (
                      <Text style={styles.modalItemTags} numberOfLines={1}>
                        {dict[item].tags.slice(0, 5).join(', ')}
                      </Text>
                    )}
                  </View>
                  {isCurr && <Icon name="check" size={16} color={C.blue} />}
                  {step === 'cat' && Object.keys(dict[item]?.subcategories || {}).length > 0 && (
                    <Icon name="chevron-right" size={16} color={C.g500} />
                  )}
                </TouchableOpacity>
              );
            }}
          />
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

// ─── Calendar Modal ────────────────────────────────────────────────────────
function CalendarModal({ visible, onClose, value, onChange, label }) {
  const [nav, setNav] = useState(value ? new Date(value) : new Date());
  useEffect(() => { if (visible) setNav(value ? new Date(value) : new Date()); }, [visible]);

  const year  = nav.getFullYear();
  const month = nav.getMonth();
  const days  = Array.from({ length: new Date(year, month + 1, 0).getDate() }, (_, i) => i + 1);
  const sel   = value ? new Date(value) : null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={onClose}>
        <View style={styles.calCard}>
          {label && <Text style={styles.calLabel}>{label}</Text>}
          <View style={styles.calNav}>
            <TouchableOpacity onPress={() => setNav(new Date(year, month - 1, 1))}>
              <Icon name="chevron-left" size={22} color={C.success} />
            </TouchableOpacity>
            <Text style={styles.calNavTxt}>
              {nav.toLocaleString('es-ES', { month: 'long', year: 'numeric' }).toUpperCase()}
            </Text>
            <TouchableOpacity onPress={() => setNav(new Date(year, month + 1, 1))}>
              <Icon name="chevron-right" size={22} color={C.success} />
            </TouchableOpacity>
          </View>
          <View style={styles.daysGrid}>
            {days.map(d => {
              const active = sel && sel.getFullYear() === year && sel.getMonth() === month && sel.getDate() === d;
              return (
                <TouchableOpacity
                  key={d}
                  style={[styles.dayCircle, active && styles.dayActive]}
                  onPress={() => { onChange(new Date(year, month, d).toISOString()); onClose(); }}
                >
                  <Text style={[styles.dayTxt, active && styles.dayTxtActive]}>{d}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <TouchableOpacity onPress={onClose}>
            <Text style={styles.calClose}>CANCELAR</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

// ─── Pantalla principal ───────────────────────────────────────────────────────
export default function SoldEditDetailView({ route, navigation }) {
  const { product: initialProduct } = route.params;

  const [editForm, setEditForm] = useState({
    ...initialProduct,
    soldPrice:       initialProduct.soldPrice != null  ? initialProduct.soldPrice : (initialProduct.price || 0),
    soldDate:        initialProduct.soldDate           || initialProduct.soldAt   || new Date().toISOString(),
    isBundle:        initialProduct.isBundle           || false,
    category:        initialProduct.category           || 'Otros',
    subcategory:     initialProduct.subcategory        || null,
    firstUploadDate: initialProduct.firstUploadDate    || initialProduct.createdAt || new Date().toISOString(),
  });

  const [showCalSold, setShowCalSold]         = useState(false);
  const [showCalUpload, setShowCalUpload]     = useState(false);
  const [showCatModal, setShowCatModal]       = useState(false);

  // Tags para la categoría seleccionada
  const categoryTags = useMemo(() => {
    const full    = DatabaseService.getFullDictionary() || {};
    const catData = full[editForm.category];
    if (!catData) return [];
    const subTags = editForm.subcategory
      ? (catData.subcategories?.[editForm.subcategory]?.tags || [])
      : [];
    return [...new Set([...(catData.tags || []), ...subTags])].slice(0, 12);
  }, [editForm.category, editForm.subcategory]);

  // Beneficio calculado
  const profit = useMemo(() => {
    const sold   = Number(editForm.soldPrice) || 0;
    const listed = Number(editForm.price)     || 0;
    return (sold - listed).toFixed(2);
  }, [editForm.soldPrice, editForm.price]);

  const handleSave = () => {
    const span = LogService.span(`Guardar vendido ${editForm.id}`, LOG_CTX.UI);

    // Validaciones
    if (!editForm.soldDate) {
      Alert.alert('Campo requerido', 'Indica la fecha real de venta.');
      return;
    }

    const ok = DatabaseService.updateProduct({
      ...editForm,
      // Asegurar tipos correctos
      soldPrice:       Number(editForm.soldPrice),
      price:           Number(editForm.price),
      isBundle:        Boolean(editForm.isBundle),
      // Nunca vaciar firstUploadDate
      firstUploadDate: editForm.firstUploadDate || initialProduct.createdAt || new Date().toISOString(),
    });

    if (ok) {
      span.end({ soldPrice: editForm.soldPrice, category: editForm.category });
      LogService.success(
        `Venta guardada: "${editForm.title}" — ${editForm.soldPrice}€ (beneficio: ${profit}€)`,
        LOG_CTX.UI,
        { id: editForm.id, category: editForm.category, subcategory: editForm.subcategory, isBundle: editForm.isBundle }
      );
      navigation.goBack();
    } else {
      span.fail(new Error('updateProduct false'));
      Alert.alert('Error', 'No se pudo guardar en la base de datos.');
    }
  };

  const tts = useMemo(() => {
    if (!editForm.firstUploadDate || !editForm.soldDate) return null;
    return Math.max(1, Math.round(
      (new Date(editForm.soldDate) - new Date(editForm.firstUploadDate)) / 86_400_000
    ));
  }, [editForm.firstUploadDate, editForm.soldDate]);

  return (
    <View style={styles.container}>
      <CategoryModal
        visible={showCatModal}
        onClose={() => setShowCatModal(false)}
        currentCat={editForm.category}
        currentSub={editForm.subcategory}
        onSelect={(cat, sub) => setEditForm(f => ({ ...f, category: cat, subcategory: sub }))}
      />
      <CalendarModal
        visible={showCalSold}
        onClose={() => setShowCalSold(false)}
        value={editForm.soldDate}
        onChange={iso => setEditForm(f => ({ ...f, soldDate: iso }))}
        label="FECHA REAL DE VENTA"
      />
      <CalendarModal
        visible={showCalUpload}
        onClose={() => setShowCalUpload(false)}
        value={editForm.firstUploadDate}
        onChange={iso => setEditForm(f => ({ ...f, firstUploadDate: iso }))}
        label="FECHA DE SUBIDA ORIGINAL"
      />

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Imagen header */}
        <View style={styles.imgHeader}>
          {editForm.images?.[0] ? (
            <Image source={{ uri: editForm.images[0] }} style={styles.img} resizeMode="cover" />
          ) : (
            <View style={[styles.img, styles.imgPlaceholder]}>
              <Icon name="image" size={48} color={C.g500} />
            </View>
          )}
          <View style={styles.soldBanner}>
            <Icon name="check-circle" size={14} color={C.white} />
            <Text style={styles.soldBannerTxt}>VENDIDO</Text>
          </View>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Icon name="x" size={20} color={C.g900} />
          </TouchableOpacity>
        </View>

        <View style={styles.content}>
          {/* Título */}
          <Text style={styles.title} numberOfLines={2}>{editForm.title}</Text>
          <Text style={styles.brand}>{editForm.brand || 'Sin marca'}</Text>

          {/* Panel TTS si lo sabemos */}
          {tts !== null && (
            <View style={styles.ttsPanel}>
              <View style={styles.ttsStat}>
                <Text style={styles.ttsLbl}>PRECIO ORIGINAL</Text>
                <Text style={styles.ttsVal}>{editForm.price}€</Text>
              </View>
              <View style={styles.ttsStat}>
                <Text style={styles.ttsLbl}>DÍAS HASTA VENTA</Text>
                <Text style={[styles.ttsVal, { color: tts <= 7 ? C.success : tts <= 30 ? C.warning : C.danger }]}>
                  {tts}d
                </Text>
              </View>
              <View style={styles.ttsStat}>
                <Text style={styles.ttsLbl}>BENEFICIO</Text>
                <Text style={[styles.ttsVal, { color: Number(profit) >= 0 ? C.success : C.danger }]}>
                  {Number(profit) >= 0 ? '+' : ''}{profit}€
                </Text>
              </View>
            </View>
          )}

          {/* Formulario */}
          <View style={styles.formCard}>
            <Text style={styles.formTitle}>DATOS DE VENTA — CAMPOS PERMANENTES</Text>
            <Text style={styles.formSubtitle}>
              Se conservan aunque importes un JSON actualizado de Vinted.
            </Text>

            {/* Precio final */}
            <Text style={styles.fieldLabel}>PRECIO FINAL DE VENTA (€)</Text>
            <View style={styles.priceRow}>
              <TextInput
                style={styles.priceInput}
                keyboardType="numeric"
                value={String(editForm.soldPrice)}
                onChangeText={v => setEditForm(f => ({ ...f, soldPrice: v }))}
              />
              <Icon name="edit-2" size={16} color={C.success} />
            </View>

            {/* Fecha venta */}
            <Text style={styles.fieldLabel}>FECHA REAL DE VENTA</Text>
            <TouchableOpacity style={styles.dateBtn} onPress={() => setShowCalSold(true)}>
              <Icon name="calendar" size={16} color={C.success} />
              <Text style={styles.dateBtnTxt}>{fmt(editForm.soldDate)}</Text>
            </TouchableOpacity>

            {/* Categoría + Subcategoría */}
            <Text style={styles.fieldLabel}>CATEGORÍA / SUBCATEGORÍA</Text>
            <TouchableOpacity style={styles.catBtn} onPress={() => setShowCatModal(true)}>
              <Icon name="tag" size={15} color={C.blue} />
              <View style={{ flex: 1 }}>
                <Text style={styles.catBtnTxt}>{editForm.category || 'Sin categoría'}</Text>
                {editForm.subcategory && (
                  <Text style={styles.catBtnSub}>{editForm.subcategory}</Text>
                )}
              </View>
              <Icon name="chevron-right" size={15} color={C.g500} />
            </TouchableOpacity>

            {/* Tags de categoría (informativo) */}
            {categoryTags.length > 0 && (
              <View style={styles.tagPreview}>
                <Text style={styles.tagPreviewLbl}>Tags de esta categoría/subcategoría:</Text>
                <View style={styles.tagsCloud}>
                  {categoryTags.map(t => (
                    <View key={t} style={styles.tag}>
                      <Text style={styles.tagTxt}>{t}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* Fecha subida original */}
            <Text style={styles.fieldLabel}>FECHA DE SUBIDA ORIGINAL</Text>
            <TouchableOpacity style={styles.dateBtn} onPress={() => setShowCalUpload(true)}>
              <Icon name="upload" size={16} color={C.primary} />
              <Text style={styles.dateBtnTxt}>{fmt(editForm.firstUploadDate)}</Text>
              <Text style={styles.dateHint}>(para TTS correcto)</Text>
            </TouchableOpacity>

            {/* Lote */}
            <TouchableOpacity
              style={[styles.loteBtn, editForm.isBundle && styles.loteBtnActive]}
              onPress={() => setEditForm(f => ({ ...f, isBundle: !f.isBundle }))}
            >
              <Icon
                name={editForm.isBundle ? 'check-square' : 'square'}
                size={20}
                color={editForm.isBundle ? C.white : C.purple}
              />
              <View>
                <Text style={[styles.loteTxt, editForm.isBundle && { color: C.white }]}>
                  VENTA EN LOTE / PACK
                </Text>
                <Text style={[styles.loteHint, editForm.isBundle && { color: C.white + 'AA' }]}>
                  El precio agrupa varios artículos
                </Text>
              </View>
            </TouchableOpacity>
          </View>

          {/* Guardar */}
          <TouchableOpacity style={styles.saveBtn} onPress={handleSave} activeOpacity={0.85}>
            <Icon name="check-circle" size={18} color={C.white} />
            <Text style={styles.saveBtnTxt}>GUARDAR DATOS DE VENTA</Text>
          </TouchableOpacity>

          <View style={{ height: 50 }} />
        </View>
      </ScrollView>
    </View>
  );
}

// ─── Estilos ───────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container:     { flex: 1, backgroundColor: C.white },

  imgHeader:     { height: 300, position: 'relative' },
  img:           { width, height: 300 },
  imgPlaceholder:{ backgroundColor: C.g100, justifyContent: 'center', alignItems: 'center' },
  soldBanner:    { position: 'absolute', bottom: 20, right: 20, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.success, paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20 },
  soldBannerTxt: { color: C.white, fontWeight: '900', fontSize: 12, letterSpacing: 0.5 },
  backBtn:       { position: 'absolute', top: 52, left: 20, backgroundColor: C.white, width: 42, height: 42, borderRadius: 21, justifyContent: 'center', alignItems: 'center', elevation: 5 },

  content:       { padding: 24, marginTop: -24, backgroundColor: C.white, borderTopLeftRadius: 28, borderTopRightRadius: 28 },
  title:         { fontSize: 20, fontWeight: '900', color: C.g900, marginBottom: 4 },
  brand:         { fontSize: 11, fontWeight: '800', color: C.primary, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 16 },

  ttsPanel:      { flexDirection: 'row', backgroundColor: C.bg, borderRadius: 20, padding: 16, marginBottom: 20, gap: 4 },
  ttsStat:       { flex: 1, alignItems: 'center' },
  ttsLbl:        { fontSize: 8, color: C.g500, fontWeight: '900', letterSpacing: 0.8, marginBottom: 4 },
  ttsVal:        { fontSize: 18, fontWeight: '900', color: C.g900 },

  formCard:      { backgroundColor: C.bg, borderRadius: 24, padding: 20, borderWidth: 1, borderColor: '#EEE', marginBottom: 20 },
  formTitle:     { fontSize: 10, fontWeight: '900', color: C.success, letterSpacing: 1.5, marginBottom: 4 },
  formSubtitle:  { fontSize: 11, color: C.g500, marginBottom: 20, lineHeight: 16 },

  fieldLabel:    { fontSize: 9, fontWeight: '900', color: C.g500, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 8, marginTop: 16 },

  priceRow:      { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 2, borderBottomColor: C.success, paddingBottom: 6, marginBottom: 4 },
  priceInput:    { flex: 1, fontSize: 28, fontWeight: '900', color: C.g900 },

  dateBtn:       { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.white, padding: 16, borderRadius: 16, borderWidth: 1, borderColor: '#EEE' },
  dateBtnTxt:    { flex: 1, fontSize: 15, fontWeight: '700', color: C.g900 },
  dateHint:      { fontSize: 10, color: C.g500 },

  catBtn:        { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.blue + '10', padding: 16, borderRadius: 16, borderWidth: 1, borderColor: C.blue + '30' },
  catBtnTxt:     { fontSize: 15, fontWeight: '800', color: C.g900 },
  catBtnSub:     { fontSize: 12, color: C.g500, marginTop: 2 },

  tagPreview:    { backgroundColor: C.white, borderRadius: 14, padding: 12, marginTop: 8 },
  tagPreviewLbl: { fontSize: 10, color: C.g500, fontWeight: '700', marginBottom: 8 },
  tagsCloud:     { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  tag:           { backgroundColor: C.blue + '12', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 },
  tagTxt:        { fontSize: 11, color: C.blue, fontWeight: '700' },

  loteBtn:       { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 18, backgroundColor: C.purple + '10', borderRadius: 18, marginTop: 10 },
  loteBtnActive: { backgroundColor: C.purple },
  loteTxt:       { fontSize: 12, fontWeight: '900', color: C.purple },
  loteHint:      { fontSize: 10, color: C.purple + 'AA', marginTop: 2 },

  saveBtn:       { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10, backgroundColor: C.g900, padding: 20, borderRadius: 22, elevation: 4 },
  saveBtnTxt:    { color: C.white, fontWeight: '900', fontSize: 15, letterSpacing: 0.5 },

  // Modales compartidos
  modalOverlay:  { flex: 1, backgroundColor: '#00000055', justifyContent: 'flex-end' },
  modalSheet:    { backgroundColor: C.white, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 20, paddingTop: 20, maxHeight: '70%' },
  modalHeader:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, gap: 12 },
  modalBack:     { width: 36, height: 36, borderRadius: 18, backgroundColor: C.g100, justifyContent: 'center', alignItems: 'center' },
  modalTitle:    { flex: 1, fontSize: 17, fontWeight: '900', color: C.g900 },
  modalItem:     { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: C.g100, gap: 10 },
  modalItemActive:{ backgroundColor: C.blue + '0D', paddingHorizontal: 10, marginHorizontal: -10, borderRadius: 10 },
  modalItemTxt:  { fontSize: 15, color: C.g900, fontWeight: '600' },
  modalItemTags: { fontSize: 10, color: C.g500, marginTop: 2 },

  calCard:       { backgroundColor: C.white, borderRadius: 24, padding: 20, margin: 20, elevation: 8 },
  calLabel:      { fontSize: 10, fontWeight: '900', color: C.g500, letterSpacing: 1.5, textAlign: 'center', marginBottom: 12 },
  calNav:        { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  calNavTxt:     { fontSize: 13, fontWeight: '900', color: C.g900 },
  daysGrid:      { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 4 },
  dayCircle:     { width: 40, height: 40, justifyContent: 'center', alignItems: 'center', borderRadius: 20 },
  dayActive:     { backgroundColor: C.success },
  dayTxt:        { fontSize: 14, fontWeight: '600', color: C.g900 },
  dayTxtActive:  { color: C.white, fontWeight: '900' },
  calClose:      { textAlign: 'center', marginTop: 20, color: C.g500, fontWeight: '900', paddingBottom: 10 },
});
