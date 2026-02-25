import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, Image, StyleSheet, Dimensions,
  TouchableOpacity, Alert, TextInput, Modal, FlatList,
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
  g900:    '#1A1A2E',
  g700:    '#666666',
  g500:    '#999999',
  g100:    '#F0F0F0',
};

// ─── Helpers ────────────────────────────────────────────────────────────────
const fmt = (iso) => {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }); }
  catch { return '—'; }
};

const SectionLabel = ({ children }) => (
  <Text style={styles.sectionLabel}>{children}</Text>
);

// ─── Selector de Categoría/Subcategoría modal ──────────────────────────────
function CategoryModal({ visible, onClose, onSelect, currentCat, currentSub }) {
  const [dict, setDict]       = useState({});
  const [selCat, setSelCat]   = useState(currentCat || null);
  const [step, setStep]       = useState('cat'); // 'cat' | 'sub'

  useEffect(() => {
    if (visible) {
      const full = DatabaseService.getFullDictionary() || {};
      // Fallback: construir desde legacy
      if (!Object.keys(full).length) {
        const legacy = DatabaseService.getDictionary();
        const built  = {};
        Object.keys(legacy).forEach(k => { built[k] = { tags: legacy[k], subcategories: {} }; });
        setDict(built);
      } else {
        setDict(full);
      }
      setSelCat(currentCat || null);
      setStep('cat');
    }
  }, [visible, currentCat]);

  const cats = Object.keys(dict);

  const handleCatSelect = (cat) => {
    const hasSubs = Object.keys(dict[cat]?.subcategories || {}).length > 0;
    if (hasSubs) {
      setSelCat(cat);
      setStep('sub');
    } else {
      onSelect(cat, null);
      onClose();
    }
  };

  const handleSubSelect = (sub) => {
    onSelect(selCat, sub || null);
    onClose();
  };

  const catData = selCat ? dict[selCat] : null;
  const subs    = catData ? Object.keys(catData.subcategories || {}) : [];

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={onClose}>
        <View style={styles.modalSheet}>
          {/* Header */}
          <View style={styles.modalHeader}>
            {step === 'sub' ? (
              <TouchableOpacity onPress={() => setStep('cat')} style={styles.modalBack}>
                <Icon name="arrow-left" size={18} color={C.g900} />
              </TouchableOpacity>
            ) : null}
            <Text style={styles.modalTitle}>
              {step === 'cat' ? 'Seleccionar Categoría' : `Subcategoría de "${selCat}"`}
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
              const isCurrent = step === 'cat'
                ? item === currentCat
                : (!isNone && item === currentSub) || (isNone && !currentSub);
              return (
                <TouchableOpacity
                  style={[styles.modalItem, isCurrent && styles.modalItemActive]}
                  onPress={() => step === 'cat' ? handleCatSelect(item) : handleSubSelect(isNone ? null : item)}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.modalItemTxt, isCurrent && { color: C.blue, fontWeight: '900' }]}>
                      {item}
                    </Text>
                    {step === 'cat' && dict[item]?.subcategories && Object.keys(dict[item].subcategories).length > 0 && (
                      <Text style={styles.modalItemSub}>
                        {Object.keys(dict[item].subcategories).length} subcategorías
                      </Text>
                    )}
                    {step === 'cat' && dict[item]?.tags?.length > 0 && (
                      <Text style={styles.modalItemTags} numberOfLines={1}>
                        {dict[item].tags.slice(0, 5).join(', ')}
                      </Text>
                    )}
                  </View>
                  {isCurrent && <Icon name="check" size={16} color={C.blue} />}
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

// ─── Calendar Picker ─────────────────────────────────────────────────────────
function CalendarModal({ visible, onClose, value, onChange }) {
  const initial   = value ? new Date(value) : new Date();
  const [nav, setNav] = useState(initial);

  useEffect(() => { if (visible) setNav(value ? new Date(value) : new Date()); }, [visible]);

  const year  = nav.getFullYear();
  const month = nav.getMonth();
  const days  = Array.from({ length: new Date(year, month + 1, 0).getDate() }, (_, i) => i + 1);
  const selected = value ? new Date(value) : null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={onClose}>
        <View style={styles.calCard}>
          <View style={styles.calNav}>
            <TouchableOpacity onPress={() => setNav(new Date(year, month - 1, 1))}>
              <Icon name="chevron-left" size={22} color={C.primary} />
            </TouchableOpacity>
            <Text style={styles.calNavTxt}>
              {nav.toLocaleString('es-ES', { month: 'long', year: 'numeric' }).toUpperCase()}
            </Text>
            <TouchableOpacity onPress={() => setNav(new Date(year, month + 1, 1))}>
              <Icon name="chevron-right" size={22} color={C.primary} />
            </TouchableOpacity>
          </View>
          <View style={styles.daysGrid}>
            {days.map(d => {
              const isSelected = selected &&
                selected.getFullYear() === year &&
                selected.getMonth()    === month &&
                selected.getDate()     === d;
              return (
                <TouchableOpacity
                  key={d}
                  style={[styles.dayCircle, isSelected && styles.dayCircleActive]}
                  onPress={() => { onChange(new Date(year, month, d).toISOString()); onClose(); }}
                >
                  <Text style={[styles.dayTxt, isSelected && styles.dayTxtActive]}>{d}</Text>
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
export default function ProductDetailScreen({ route, navigation }) {
  const { product: initialProduct } = route.params || {};
  const [product, setProduct]   = useState(initialProduct);
  const [isEditing, setIsEditing] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const [showCatModal, setShowCatModal] = useState(false);

  const [editForm, setEditForm] = useState(() => ({
    ...initialProduct,
    category:        initialProduct?.category        || 'Otros',
    subcategory:     initialProduct?.subcategory     || null,
    firstUploadDate: initialProduct?.firstUploadDate || initialProduct?.createdAt || new Date().toISOString(),
    price:           initialProduct?.price           || 0,
    isBundle:        initialProduct?.isBundle        || false,
    priceHistory:    initialProduct?.priceHistory    || [],
  }));

  // Diagnóstico
  const statusInfo = useMemo(() => {
    const now        = new Date();
    const uploadDate = new Date(product.firstUploadDate || product.createdAt);
    const daysOld    = Math.max(0, Math.floor((now - uploadDate) / 86_400_000));
    const config     = DatabaseService.getConfig();
    const severity   = DatabaseService.getActiveProductsWithDiagnostic
      ? null  // calculado externamente
      : null;
    return {
      daysOld,
      isHot:  (product.views > 50 || product.favorites > 10) && daysOld < 30,
      isCold: daysOld >= parseInt(config.daysDesinterest || 45),
      isCrit: daysOld >= parseInt(config.daysCritical    || 90),
    };
  }, [product]);

  // Tags del diccionario para la categoría seleccionada
  const categoryTags = useMemo(() => {
    const full = DatabaseService.getFullDictionary() || {};
    const catData = full[editForm.category || product.category];
    if (!catData) return [];
    const subKey  = editForm.subcategory || product.subcategory;
    const subTags = subKey ? (catData.subcategories?.[subKey]?.tags || []) : [];
    return [...new Set([...(catData.tags || []), ...subTags])].slice(0, 12);
  }, [editForm.category, editForm.subcategory, product.category, product.subcategory]);

  // ── Guardar cambios ──────────────────────────────────────────────────────
  const handleSaveEdit = useCallback(() => {
    const span = LogService.span(`Guardar producto ${product.id}`, LOG_CTX.UI);
    let updated = { ...editForm };

    // Historial de precio
    if (Number(editForm.price) !== Number(product.price)) {
      updated.priceHistory = [
        ...(editForm.priceHistory || []),
        { oldPrice: product.price, newPrice: Number(editForm.price), date: new Date().toISOString(), source: 'manual' },
      ];
      LogService.info(
        `Precio cambiado: ${product.price}€ → ${editForm.price}€`,
        LOG_CTX.UI,
        { id: product.id, title: product.title }
      );
    }

    // Garantizar que firstUploadDate NUNCA se vacíe
    if (!updated.firstUploadDate) {
      updated.firstUploadDate = product.createdAt || new Date().toISOString();
    }

    const ok = DatabaseService.updateProduct(updated);
    if (ok) {
      setProduct(updated);
      setIsEditing(false);
      span.end({ fields: Object.keys(editForm) });
      LogService.success(`Producto actualizado: "${product.title}"`, LOG_CTX.UI, { id: product.id });
    } else {
      span.fail(new Error('updateProduct devolvió false'));
      Alert.alert('Error', 'No se pudo guardar en la base de datos.');
    }
  }, [editForm, product]);

  const handleMarkRepublicated = () => {
    Alert.alert('🔄 Confirmar Resubida', '¿Has resubido este artículo en Vinted? Se reseteará la fecha de subida a hoy.', [
      { text: 'No' },
      { text: 'Sí, lo resubí', onPress: () => {
        const ok = DatabaseService.markAsRepublicated(product.id);
        if (ok) {
          const updated = { ...product, firstUploadDate: new Date().toISOString() };
          setProduct(updated);
          setEditForm(f => ({ ...f, firstUploadDate: updated.firstUploadDate }));
          LogService.success(`Resubida registrada: "${product.title}"`, LOG_CTX.UI, { id: product.id });
        }
      }},
    ]);
  };

  const handleDelete = () => {
    Alert.alert('Borrar producto', '¿Eliminar permanentemente de la base de datos local?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: () => {
        DatabaseService.deleteProduct(product.id);
        LogService.warn(`Producto eliminado: "${product.title}"`, LOG_CTX.UI, { id: product.id });
        navigation.goBack();
      }},
    ]);
  };

  const severityColor = statusInfo.isCrit ? C.danger : statusInfo.isCold ? C.warning : C.success;

  // ── Modo Vista ────────────────────────────────────────────────────────────
  const renderView = () => (
    <>
      {/* Cabecera */}
      <View style={styles.topRow}>
        <Text style={styles.brandTxt}>{product.brand || 'Vinted'}</Text>
        <View style={styles.catPill}>
          <Icon name="tag" size={10} color={C.blue} />
          <Text style={styles.catPillTxt}>{product.category || 'Sin categoría'}</Text>
          {product.subcategory ? (
            <>
              <Text style={styles.catSep}>/</Text>
              <Text style={[styles.catPillTxt, { color: C.g500 }]}>{product.subcategory}</Text>
            </>
          ) : null}
        </View>
      </View>

      {/* Título + precio */}
      <View style={styles.titleRow}>
        <Text style={styles.titleTxt}>{product.title}</Text>
        <View style={styles.pricePill}>
          <Text style={styles.pricePillTxt}>{product.price}€</Text>
        </View>
        {product.isBundle && (
          <View style={styles.bundlePill}>
            <Text style={styles.bundlePillTxt}>LOTE</Text>
          </View>
        )}
      </View>

      {/* Historial de precios */}
      {product.priceHistory?.length > 0 && (
        <View style={styles.historyBox}>
          <Text style={styles.historyLabel}>EVOLUCIÓN DE PRECIO</Text>
          {product.priceHistory.slice(-4).map((h, i) => (
            <View key={i} style={styles.historyRow}>
              <Icon name="trending-down" size={11} color={C.primary} />
              <Text style={styles.historyTxt}>
                {h.oldPrice}€ → {h.newPrice || h.price}€  ·  {fmt(h.date)}
                {h.source === 'vinted_import' ? '  [Vinted]' : ''}
              </Text>
            </View>
          ))}
        </View>
      )}

      {/* Stats */}
      <View style={styles.statsRow}>
        <View style={styles.statBox}>
          <Text style={styles.statLbl}>VISTAS</Text>
          <Text style={styles.statVal}>{product.views || 0}</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statLbl}>FAVS</Text>
          <Text style={styles.statVal}>{product.favorites || 0}</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statLbl}>DÍAS</Text>
          <Text style={[styles.statVal, { color: severityColor }]}>{statusInfo.daysOld}</Text>
        </View>
        <View style={[styles.statBox, { borderLeftWidth: 2, borderLeftColor: severityColor }]}>
          <Text style={styles.statLbl}>ESTADO</Text>
          <Text style={[styles.statValSm, { color: severityColor }]}>
            {statusInfo.isCrit ? '🔥 CRÍTICO' : statusInfo.isCold ? '⏱️ FRÍO' : statusInfo.isHot ? '⚡ ACTIVO' : '✅ OK'}
          </Text>
        </View>
      </View>

      {/* Fechas */}
      <View style={styles.datesRow}>
        <View style={styles.dateItem}>
          <Icon name="upload" size={12} color={C.g500} />
          <Text style={styles.dateLbl}>Subida original</Text>
          <Text style={styles.dateVal}>{fmt(product.firstUploadDate || product.createdAt)}</Text>
        </View>
        {product.repostCount > 0 && (
          <View style={styles.dateItem}>
            <Icon name="refresh-cw" size={12} color={C.blue} />
            <Text style={styles.dateLbl}>Resubidas</Text>
            <Text style={[styles.dateVal, { color: C.blue }]}>{product.repostCount}×</Text>
          </View>
        )}
      </View>

      {/* Tags de categoría */}
      {categoryTags.length > 0 && (
        <View style={styles.tagsSection}>
          <SectionLabel>TAGS DE CATEGORÍA</SectionLabel>
          <View style={styles.tagsCloud}>
            {categoryTags.map(tag => (
              <View key={tag} style={styles.tag}>
                <Text style={styles.tagTxt}>{tag}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Descripción */}
      <SectionLabel>DESCRIPCIÓN</SectionLabel>
      <Text style={styles.descTxt}>{product.description || 'Sin descripción'}</Text>

      {/* Acciones */}
      <View style={styles.actionsRow}>
        <TouchableOpacity style={styles.actionBtn} onPress={() => setIsEditing(true)}>
          <Icon name="edit-3" size={17} color={C.g900} />
          <Text style={styles.actionBtnTxt}>Editar</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.actionBtn, { backgroundColor: C.blue + '15' }]} onPress={handleMarkRepublicated}>
          <Icon name="refresh-cw" size={17} color={C.blue} />
          <Text style={[styles.actionBtnTxt, { color: C.blue }]}>Resubido</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.actionBtn, { backgroundColor: C.danger + '15' }]} onPress={handleDelete}>
          <Icon name="trash-2" size={17} color={C.danger} />
          <Text style={[styles.actionBtnTxt, { color: C.danger }]}>Borrar</Text>
        </TouchableOpacity>
      </View>
    </>
  );

  // ── Modo Edición ──────────────────────────────────────────────────────────
  const renderEdit = () => (
    <>
      <Text style={styles.editTitle}>Editar Información Permanente</Text>
      <Text style={styles.editSubtitle}>
        Estos datos se conservan aunque importes un JSON actualizado de Vinted.
      </Text>

      {/* Precio */}
      <SectionLabel>PRECIO DE PUBLICACIÓN (€)</SectionLabel>
      <TextInput
        style={styles.input}
        keyboardType="numeric"
        value={String(editForm.price)}
        onChangeText={v => setEditForm(f => ({ ...f, price: v }))}
      />

      {/* Categoría + Subcategoría */}
      <SectionLabel>CATEGORÍA / SUBCATEGORÍA</SectionLabel>
      <TouchableOpacity style={styles.catSelector} onPress={() => setShowCatModal(true)}>
        <Icon name="tag" size={16} color={C.blue} />
        <View style={{ flex: 1 }}>
          <Text style={styles.catSelectorVal}>{editForm.category || 'Sin categoría'}</Text>
          {editForm.subcategory && (
            <Text style={styles.catSelectorSub}>{editForm.subcategory}</Text>
          )}
        </View>
        <Icon name="chevron-right" size={16} color={C.g500} />
      </TouchableOpacity>

      {/* Tags de categoría (informativo) */}
      {(() => {
        const full    = DatabaseService.getFullDictionary() || {};
        const catData = full[editForm.category];
        const subData = editForm.subcategory ? catData?.subcategories?.[editForm.subcategory] : null;
        const tags    = [...new Set([...(catData?.tags || []), ...(subData?.tags || [])])].slice(0, 10);
        if (!tags.length) return null;
        return (
          <View style={styles.tagPreview}>
            <Text style={styles.tagPreviewLbl}>Tags de esta categoría:</Text>
            <View style={styles.tagsCloud}>
              {tags.map(t => <View key={t} style={styles.tag}><Text style={styles.tagTxt}>{t}</Text></View>)}
            </View>
          </View>
        );
      })()}

      {/* Fecha de subida */}
      <SectionLabel>FECHA DE SUBIDA ORIGINAL</SectionLabel>
      <TouchableOpacity
        style={styles.dateRow}
        onPress={() => setShowCalendar(true)}
      >
        <Icon name="calendar" size={16} color={C.primary} />
        <Text style={styles.dateRowTxt}>{fmt(editForm.firstUploadDate)}</Text>
      </TouchableOpacity>

      {/* Lote */}
      <TouchableOpacity
        style={[styles.loteToggle, editForm.isBundle && styles.loteActive]}
        onPress={() => setEditForm(f => ({ ...f, isBundle: !f.isBundle }))}
      >
        <Icon
          name={editForm.isBundle ? 'check-square' : 'square'}
          size={20}
          color={editForm.isBundle ? C.white : C.blue}
        />
        <Text style={[styles.loteTxt, editForm.isBundle && { color: C.white }]}>
          PUBLICADO EN LOTE / PACK
        </Text>
      </TouchableOpacity>

      {/* Acciones edición */}
      <View style={styles.editActions}>
        <TouchableOpacity style={styles.btnSave} onPress={handleSaveEdit}>
          <Icon name="save" size={16} color={C.white} />
          <Text style={styles.btnSaveTxt}>Guardar cambios</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.btnCancel} onPress={() => setIsEditing(false)}>
          <Text style={styles.btnCancelTxt}>Cancelar</Text>
        </TouchableOpacity>
      </View>
    </>
  );

  return (
    <View style={styles.container}>
      {/* Modales */}
      <CategoryModal
        visible={showCatModal}
        onClose={() => setShowCatModal(false)}
        currentCat={editForm.category}
        currentSub={editForm.subcategory}
        onSelect={(cat, sub) => setEditForm(f => ({ ...f, category: cat, subcategory: sub }))}
      />
      <CalendarModal
        visible={showCalendar}
        onClose={() => setShowCalendar(false)}
        value={editForm.firstUploadDate}
        onChange={iso => setEditForm(f => ({ ...f, firstUploadDate: iso }))}
      />

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Imagen */}
        <View style={styles.imgContainer}>
          {product.images?.[0] ? (
            <Image source={{ uri: product.images[0] }} style={styles.mainImg} resizeMode="cover" />
          ) : (
            <View style={[styles.mainImg, styles.imgPlaceholder]}>
              <Icon name="image" size={48} color={C.g500} />
            </View>
          )}
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Icon name="arrow-left" size={20} color={C.g900} />
          </TouchableOpacity>
        </View>

        {/* Contenido */}
        <View style={styles.contentCard}>
          {isEditing ? renderEdit() : renderView()}
          <View style={{ height: 60 }} />
        </View>
      </ScrollView>
    </View>
  );
}

// ─── Estilos ───────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container:      { flex: 1, backgroundColor: C.bg },

  imgContainer:   { height: 340, position: 'relative' },
  mainImg:        { width, height: 340 },
  imgPlaceholder: { backgroundColor: C.g100, justifyContent: 'center', alignItems: 'center' },
  backBtn:        { position: 'absolute', top: 52, left: 20, backgroundColor: C.white, width: 42, height: 42, borderRadius: 21, justifyContent: 'center', alignItems: 'center', elevation: 6, shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 8 },

  contentCard:    { backgroundColor: C.white, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, marginTop: -28 },

  // Vista normal
  topRow:         { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  brandTxt:       { fontSize: 11, fontWeight: '900', color: C.primary, letterSpacing: 1, textTransform: 'uppercase' },
  catPill:        { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: C.blue + '12', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 },
  catPillTxt:     { fontSize: 11, fontWeight: '800', color: C.blue },
  catSep:         { fontSize: 10, color: C.g500 },

  titleRow:       { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 14 },
  titleTxt:       { flex: 1, fontSize: 20, fontWeight: '900', color: C.g900, lineHeight: 26 },
  pricePill:      { backgroundColor: C.success, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
  pricePillTxt:   { color: C.white, fontWeight: '900', fontSize: 15 },
  bundlePill:     { backgroundColor: '#6C63FF18', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  bundlePillTxt:  { color: '#6C63FF', fontSize: 10, fontWeight: '900' },

  historyBox:     { backgroundColor: '#FFF2EE', borderRadius: 16, padding: 14, marginBottom: 14 },
  historyLabel:   { fontSize: 9, fontWeight: '900', color: C.primary, letterSpacing: 1.2, marginBottom: 8 },
  historyRow:     { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  historyTxt:     { fontSize: 12, color: C.g700, fontWeight: '600' },

  statsRow:       { flexDirection: 'row', backgroundColor: C.bg, borderRadius: 18, padding: 14, marginBottom: 14, gap: 4 },
  statBox:        { flex: 1, alignItems: 'center' },
  statLbl:        { fontSize: 8, color: C.g500, fontWeight: '900', letterSpacing: 1 },
  statVal:        { fontSize: 18, fontWeight: '900', color: C.g900 },
  statValSm:      { fontSize: 11, fontWeight: '900', textAlign: 'center' },

  datesRow:       { flexDirection: 'row', gap: 12, marginBottom: 16 },
  dateItem:       { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.bg, borderRadius: 12, padding: 10 },
  dateLbl:        { fontSize: 10, color: C.g500 },
  dateVal:        { fontSize: 12, fontWeight: '800', color: C.g900 },

  tagsSection:    { marginBottom: 14 },
  tagsCloud:      { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  tag:            { backgroundColor: C.blue + '12', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 },
  tagTxt:         { fontSize: 11, color: C.blue, fontWeight: '700' },

  sectionLabel:   { fontSize: 10, fontWeight: '900', color: C.g500, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 8, marginTop: 14 },
  descTxt:        { fontSize: 14, color: C.g700, lineHeight: 21, marginBottom: 16 },

  actionsRow:     { flexDirection: 'row', gap: 10, marginTop: 12 },
  actionBtn:      { flex: 1, alignItems: 'center', gap: 7, backgroundColor: C.g100, paddingVertical: 14, borderRadius: 18 },
  actionBtnTxt:   { fontSize: 11, fontWeight: '800', color: C.g900 },

  // Modo edición
  editTitle:      { fontSize: 20, fontWeight: '900', color: C.g900, marginBottom: 4 },
  editSubtitle:   { fontSize: 12, color: C.g500, marginBottom: 8, lineHeight: 18 },
  input:          { backgroundColor: C.bg, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#EEE', fontWeight: '700', color: C.g900, fontSize: 16, marginBottom: 4 },

  catSelector:    { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.blue + '10', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: C.blue + '30', marginBottom: 4 },
  catSelectorVal: { fontSize: 15, fontWeight: '800', color: C.g900 },
  catSelectorSub: { fontSize: 12, color: C.g500 },

  tagPreview:     { backgroundColor: C.bg, borderRadius: 14, padding: 12, marginBottom: 4, marginTop: 4 },
  tagPreviewLbl:  { fontSize: 10, color: C.g500, fontWeight: '700', marginBottom: 8 },

  dateRow:        { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.bg, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: '#EEE', marginBottom: 4 },
  dateRowTxt:     { fontSize: 15, fontWeight: '700', color: C.g900 },

  loteToggle:     { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 18, backgroundColor: C.blue + '10', borderRadius: 18, marginTop: 10 },
  loteActive:     { backgroundColor: C.blue },
  loteTxt:        { fontWeight: '900', color: C.blue, fontSize: 12 },

  editActions:    { flexDirection: 'row', gap: 10, marginTop: 24 },
  btnSave:        { flex: 2, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, backgroundColor: C.g900, padding: 16, borderRadius: 18 },
  btnSaveTxt:     { color: C.white, fontWeight: '900', fontSize: 14 },
  btnCancel:      { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: C.g100, padding: 16, borderRadius: 18 },
  btnCancelTxt:   { color: C.g700, fontWeight: '800' },

  // Modales
  modalOverlay:   { flex: 1, backgroundColor: '#00000055', justifyContent: 'flex-end' },
  modalSheet:     { backgroundColor: C.white, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 20, paddingTop: 20, maxHeight: '75%' },
  modalHeader:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, gap: 12 },
  modalBack:      { width: 36, height: 36, borderRadius: 18, backgroundColor: C.g100, justifyContent: 'center', alignItems: 'center' },
  modalTitle:     { flex: 1, fontSize: 17, fontWeight: '900', color: C.g900 },
  modalItem:      { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: C.g100, gap: 10 },
  modalItemActive:{ backgroundColor: C.blue + '0D', paddingHorizontal: 10, marginHorizontal: -10, borderRadius: 10 },
  modalItemTxt:   { fontSize: 15, color: C.g900, fontWeight: '600' },
  modalItemSub:   { fontSize: 11, color: C.blue, fontWeight: '600', marginTop: 2 },
  modalItemTags:  { fontSize: 10, color: C.g500, marginTop: 1 },

  // Calendario
  calCard:        { backgroundColor: C.white, borderRadius: 24, padding: 20, margin: 20, elevation: 8 },
  calNav:         { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  calNavTxt:      { fontSize: 14, fontWeight: '900', color: C.g900 },
  daysGrid:       { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 4 },
  dayCircle:      { width: 40, height: 40, justifyContent: 'center', alignItems: 'center', borderRadius: 20 },
  dayCircleActive:{ backgroundColor: C.primary },
  dayTxt:         { fontSize: 14, fontWeight: '600', color: C.g900 },
  dayTxtActive:   { color: C.white, fontWeight: '900' },
  calClose:       { textAlign: 'center', marginTop: 20, color: C.g500, fontWeight: '900', paddingBottom: 10 },
});
