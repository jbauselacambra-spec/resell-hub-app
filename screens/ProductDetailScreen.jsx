/**
 * ProductDetailScreen.jsx — FIXES:
 * 1. Subcategorías: CategoryModal recarga el dict en cada apertura (useEffect con [visible])
 * 2. Fecha -1 día: CalPicker usa new Date(yr, mo, d, 12) — mediodía local → sin desfase UTC
 * 3. Guardar: updateProduct recibe objeto completo con id; refreshProduct busca en todos los productos
 */

import React, { useState, useMemo, useCallback } from 'react';
import {
  View, Text, ScrollView, Image, StyleSheet, Dimensions,
  TouchableOpacity, Alert, TextInput, Modal,
} from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import { DatabaseService } from '../services/DatabaseService';
import LogService, { LOG_CTX } from '../services/LogService';

import {
  DS, SPACE, RADIUS, SHADOW, TXT, BTN, BTN_TEXT,
  LAYOUT, FONT_SIZE, MONTH_NAMES, FONT_FAMILY,
  fmtPrice, fmtDate,
} from '../theme';

const { width } = Dimensions.get('window');

// ─── loadDictionaryWithFallbacks ──────────────────────────────────────────────
function loadDictionaryWithFallbacks() {
  try {
    const full = DatabaseService.getFullDictionary();
    if (full && Object.keys(full).length > 0) {
      LogService.debug(`CatModal: dict completo — ${Object.keys(full).length} cats`, LOG_CTX.UI);
      return full;
    }
    const legacy = DatabaseService.getDictionary();
    if (legacy && Object.keys(legacy).length > 0) {
      LogService.debug(`CatModal: dict legacy — ${Object.keys(legacy).length} cats`, LOG_CTX.UI);
      const normalized = {};
      Object.entries(legacy).forEach(([cat, val]) => {
        normalized[cat] = Array.isArray(val)
          ? { tags: val, subcategories: {} }
          : { tags: val?.tags || [], subcategories: val?.subcategories || {} };
      });
      return normalized;
    }
    LogService.warn('CatModal: diccionario vacío — configura en Ajustes → Categorías', LOG_CTX.UI);
    return {};
  } catch (e) {
    LogService.error('loadDictionaryWithFallbacks', LOG_CTX.UI, e);
    return {};
  }
}

// ─── CalPicker ────────────────────────────────────────────────────────────────
// FIX #2: new Date(yr, mo, d, 12) → mediodía local evita desfase UTC
function CalPicker({ visible, onClose, value, onChange, accent = DS.brand, label }) {
  const [nav, setNav]           = useState(value ? new Date(value) : new Date());
  const [yearMode, setYearMode] = useState(false);

  React.useEffect(() => {
    if (visible) { setNav(value ? new Date(value) : new Date()); setYearMode(false); }
  }, [visible]);

  const yr      = nav.getFullYear();
  const mo      = nav.getMonth();
  const today   = new Date();
  const WD      = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
  const firstWD = (new Date(yr, mo, 1).getDay() + 6) % 7;
  const days    = new Date(yr, mo + 1, 0).getDate();
  const cells   = [...Array(firstWD).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];
  const sel     = value ? new Date(value) : null;
  const isSel   = d => sel && sel.getFullYear() === yr && sel.getMonth() === mo && sel.getDate() === d;
  const isTod   = d => today.getFullYear() === yr && today.getMonth() === mo && today.getDate() === d;
  const years   = Array.from({ length: 8 }, (_, i) => today.getFullYear() - 5 + i);

  const pickDate = (d) => {
    // FIX #2: hora 12 → en UTC+1/+2 no retrocede al día anterior
    const iso = new Date(yr, mo, d, 12, 0, 0).toISOString().split('T')[0];
    onChange(iso);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={cS.overlay}>
        <TouchableOpacity style={{ ...StyleSheet.absoluteFillObject }} onPress={onClose} />
        <View style={cS.card}>
          <View style={[cS.hdr, { backgroundColor: accent }]}>
            {label && <Text style={cS.hdrLbl}>{label}</Text>}
            <Text style={cS.hdrY}>{yr}</Text>
            <Text style={cS.hdrM}>{MONTH_NAMES[mo]}</Text>
            {sel && <Text style={cS.hdrD}>{sel.getDate()} de {MONTH_NAMES[sel.getMonth()]}</Text>}
          </View>
          <View style={cS.nav}>
            <TouchableOpacity style={cS.navBtn} onPress={() => setNav(new Date(yr, mo - 1, 1))}>
              <Icon name="chevron-left" size={18} color={DS.text} />
            </TouchableOpacity>
            <TouchableOpacity style={cS.navTitleRow} onPress={() => setYearMode(!yearMode)}>
              <Text style={cS.navT}>{MONTH_NAMES[mo].toUpperCase()}</Text>
              <Icon name={yearMode ? 'chevron-up' : 'chevron-down'} size={13} color={DS.text2} />
            </TouchableOpacity>
            <TouchableOpacity style={cS.navBtn} onPress={() => setNav(new Date(yr, mo + 1, 1))}>
              <Icon name="chevron-right" size={18} color={DS.text} />
            </TouchableOpacity>
          </View>
          {yearMode && (
            <View style={cS.yearRow}>
              {years.map(y => (
                <TouchableOpacity key={y} style={[cS.yChip, y === yr && { backgroundColor: accent }]}
                  onPress={() => { setNav(new Date(y, mo, 1)); setYearMode(false); }}>
                  <Text style={[cS.yTxt, y === yr && { color: '#FFF', fontWeight: '900' }]}>{y}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
          <View style={cS.weekRow}>{WD.map(d => <Text key={d} style={cS.wTxt}>{d}</Text>)}</View>
          <View style={cS.grid}>
            {cells.map((d, i) =>
              d ? (
                <TouchableOpacity key={i} style={[cS.dCell, isSel(d) && { backgroundColor: accent }]}
                  onPress={() => pickDate(d)}>
                  <Text style={[cS.dTxt, isSel(d) && { color: '#FFF', fontWeight: '900' },
                    isTod(d) && !isSel(d) && { color: accent, fontWeight: '700' }]}>{d}</Text>
                </TouchableOpacity>
              ) : <View key={i} style={cS.dCell} />
            )}
          </View>
          <View style={cS.act}>
            <TouchableOpacity style={[cS.aBtn, { backgroundColor: '#FFF' }]} onPress={onClose}>
              <Text style={[cS.aTxt, { color: DS.text2 }]}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[cS.aBtn, { backgroundColor: accent }]}
              onPress={() => {
                const t = new Date();
                onChange(new Date(t.getFullYear(), t.getMonth(), t.getDate(), 12).toISOString().split('T')[0]);
                onClose();
              }}>
              <Text style={[cS.aTxt, { color: '#FFF' }]}>Hoy</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const cS = StyleSheet.create({
  overlay:     { flex: 1, backgroundColor: '#00000070', justifyContent: 'center', alignItems: 'center', padding: SPACE[5] },
  card:        { backgroundColor: DS.white, borderRadius: RADIUS.xl, overflow: 'hidden', width: '100%', maxWidth: 400, ...SHADOW.lg },
  hdr:         { padding: SPACE[5], paddingTop: SPACE[6] },
  hdrLbl:      { ...TXT.label, color: '#FFF', marginBottom: SPACE[2] },
  hdrY:        { fontSize: FONT_SIZE['3xl'], fontWeight: '900', color: '#FFF', opacity: 0.85 },
  hdrM:        { fontSize: FONT_SIZE.xl, fontWeight: '600', color: '#FFF', marginBottom: SPACE[1] },
  hdrD:        { fontSize: FONT_SIZE.base, fontWeight: '500', color: '#FFF', opacity: 0.9 },
  nav:         { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACE[4], paddingVertical: SPACE[3], backgroundColor: DS.surface2, borderBottomWidth: 1, borderBottomColor: DS.border },
  navBtn:      { padding: SPACE[2] },
  navTitleRow: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACE[1] },
  navT:        { ...TXT.label, fontSize: FONT_SIZE.sm, color: DS.text },
  yearRow:     { flexDirection: 'row', flexWrap: 'wrap', gap: SPACE[2], padding: SPACE[4], backgroundColor: DS.surface2 },
  yChip:       { paddingHorizontal: SPACE[3], paddingVertical: SPACE[2], borderRadius: RADIUS.md, backgroundColor: DS.white, borderWidth: 1, borderColor: DS.border },
  yTxt:        { fontSize: FONT_SIZE.sm, fontWeight: '600', color: DS.text },
  weekRow:     { flexDirection: 'row', paddingHorizontal: SPACE[3], paddingVertical: SPACE[2], backgroundColor: DS.surface3 },
  wTxt:        { flex: 1, textAlign: 'center', fontSize: FONT_SIZE.xs, fontWeight: '900', color: DS.text3 },
  grid:        { flexDirection: 'row', flexWrap: 'wrap', padding: SPACE[3] },
  dCell:       { width: '14.28%', aspectRatio: 1, justifyContent: 'center', alignItems: 'center', borderRadius: RADIUS.sm },
  dTxt:        { fontSize: FONT_SIZE.base, fontWeight: '500', color: DS.text },
  act:         { flexDirection: 'row', gap: SPACE[2], padding: SPACE[4], backgroundColor: DS.surface2 },
  aBtn:        { flex: 1, paddingVertical: SPACE[3], borderRadius: RADIUS.md, alignItems: 'center' },
  aTxt:        { fontSize: FONT_SIZE.sm, fontWeight: '700' },
});

// ─── CategoryModal ────────────────────────────────────────────────────────────
// FIX #1: dict se recarga en cada apertura con useEffect([visible])
// ─── CategoryModal — reemplazar SOLO la función CategoryModal ────────────────
function CategoryModal({ visible, onClose, currentCat, currentSub, onSelect }) {
  const [dict,   setDict]   = useState({});
  const [selCat, setSelCat] = useState(currentCat || '');
  const [selSub, setSelSub] = useState(currentSub || null);
  const [step,   setStep]   = useState('cat'); // 'cat' | 'sub'

  React.useEffect(() => {
    if (!visible) return;
    const freshDict = loadDictionaryWithFallbacks();
    setDict(freshDict);
    setSelCat(currentCat || '');
    setSelSub(currentSub || null);
    setStep('cat');
    const catCount = Object.keys(freshDict).length;
    const subCount = Object.values(freshDict).reduce(
      (acc, v) => acc + Object.keys(v?.subcategories || {}).length, 0,
    );
    LogService.debug(`CategoryModal: ${catCount} cats, ${subCount} subs`, LOG_CTX.UI);
  }, [visible, currentCat, currentSub]);

  const cats = Object.keys(dict);
  const subs = selCat && dict[selCat]?.subcategories
    ? Object.keys(dict[selCat].subcategories)
    : [];
  const hasSubs = subs.length > 0;

  const handlePickCat = (cat) => {
    setSelCat(cat);
    setSelSub(null);
    // Si tiene subs, avanzar al paso 2 automáticamente
    const catSubs = Object.keys(dict[cat]?.subcategories || {});
    if (catSubs.length > 0) {
      setStep('sub');
    }
    // Si no tiene subs, se queda en paso 1 y el usuario confirma directamente
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={mS.overlay}>
        <TouchableOpacity style={{ flex: 1 }} onPress={onClose} />
        <View style={mS.sheet}>
          <View style={mS.handle} />
          <View style={mS.hdr}>
            <View style={{ flex: 1 }}>
              <Text style={mS.hdrTitle}>
                {step === 'cat' ? 'Seleccionar categoría' : selCat}
              </Text>
              <Text style={mS.hdrSub}>
                {step === 'cat'
                  ? (selCat ? selCat : 'Elige una categoría')
                  : (selSub ? `${selCat} › ${selSub}` : 'Elige una subcategoría')}
              </Text>
            </View>
            <TouchableOpacity style={mS.closeBtn} onPress={onClose}>
              <Icon name="x" size={18} color={DS.text2} />
            </TouchableOpacity>
          </View>

          {/* Botón volver al paso 1 */}
          {step === 'sub' && (
            <TouchableOpacity
              style={mS.backRow}
              onPress={() => setStep('cat')}>
              <Icon name="arrow-left" size={15} color={DS.brand} />
              <Text style={mS.backTxt}>Cambiar categoría</Text>
            </TouchableOpacity>
          )}

          <ScrollView style={mS.body} showsVerticalScrollIndicator={false}>
            {/* PASO 1: elegir categoría */}
            {step === 'cat' && (
              cats.length === 0 ? (
                <View style={mS.emptyBox}>
                  <Icon name="tag" size={28} color={DS.text3} />
                  <Text style={mS.emptyTxt}>Sin categorías configuradas</Text>
                  <Text style={mS.emptyHint}>Ve a Config → Categorías para añadirlas</Text>
                </View>
              ) : (
                <>
                  <Text style={mS.sectionLbl}>CATEGORÍA PRINCIPAL</Text>
                  {cats.map(cat => {
                    const catSubCount = Object.keys(dict[cat]?.subcategories || {}).length;
                    return (
                      <TouchableOpacity key={cat}
                        style={[mS.catRow, selCat === cat && { backgroundColor: DS.brandLight, borderColor: DS.brand }]}
                        onPress={() => handlePickCat(cat)}>
                        <Icon name="tag" size={18} color={selCat === cat ? DS.brand : DS.text2} />
                        <Text style={[mS.catTxt, selCat === cat && { color: DS.brand, fontWeight: '700' }]}>{cat}</Text>
                        {catSubCount > 0 && (
                          <Text style={mS.subCountBadge}>{catSubCount} subs</Text>
                        )}
                        <Icon
                          name={catSubCount > 0 ? 'chevron-right' : 'check'}
                          size={16}
                          color={selCat === cat ? DS.brand : DS.text3}
                          style={{ marginLeft: 'auto' }}
                        />
                      </TouchableOpacity>
                    );
                  })}
                </>
              )
            )}

            {/* PASO 2: elegir subcategoría */}
            {step === 'sub' && (
              <>
                <Text style={mS.sectionLbl}>SUBCATEGORÍA</Text>
                <TouchableOpacity
                  style={[mS.subRow, !selSub && { backgroundColor: DS.blueLight, borderColor: DS.blue }]}
                  onPress={() => setSelSub(null)}>
                  <Icon name="x-circle" size={16} color={!selSub ? DS.blue : DS.text3} />
                  <Text style={[mS.subTxt, !selSub && { color: DS.blue, fontWeight: '700' }]}>
                    Sin subcategoría
                  </Text>
                  {!selSub && <Icon name="check" size={14} color={DS.blue} style={{ marginLeft: 'auto' }} />}
                </TouchableOpacity>
                {subs.map(sub => (
                  <TouchableOpacity key={sub}
                    style={[mS.subRow, selSub === sub && { backgroundColor: DS.blueLight, borderColor: DS.blue }]}
                    onPress={() => setSelSub(sub)}>
                    <Icon name="corner-down-right" size={16} color={selSub === sub ? DS.blue : DS.text3} />
                    <Text style={[mS.subTxt, selSub === sub && { color: DS.blue, fontWeight: '700' }]}>{sub}</Text>
                    {selSub === sub && <Icon name="check" size={14} color={DS.blue} style={{ marginLeft: 'auto' }} />}
                  </TouchableOpacity>
                ))}
              </>
            )}
          </ScrollView>

          <View style={mS.actions}>
            <TouchableOpacity style={[BTN.secondary, { flex: 1 }]} onPress={onClose}>
              <Text style={BTN_TEXT.secondary}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[BTN.primary, { flex: 2 }]}
              onPress={() => { onSelect(selCat, selSub); onClose(); }}>
              <Icon name="check" size={16} color="#FFF" />
              <Text style={BTN_TEXT.primary}>Confirmar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const mS = StyleSheet.create({
  overlay:    { flex: 1, backgroundColor: '#00000060', justifyContent: 'flex-end' },
  sheet:      { backgroundColor: DS.white, borderTopLeftRadius: RADIUS.xl, borderTopRightRadius: RADIUS.xl, maxHeight: '85%', paddingBottom: SPACE[8] },
  handle:     { width: 40, height: 4, backgroundColor: DS.border, borderRadius: RADIUS.sm, alignSelf: 'center', marginTop: SPACE[3] },
  hdr:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: SPACE[5], borderBottomWidth: 1, borderBottomColor: DS.border },
  hdrTitle:   { ...TXT.heading },
  hdrSub:     { ...TXT.caption, marginTop: SPACE[1] },
  closeBtn:   { width: 36, height: 36, borderRadius: RADIUS.md, backgroundColor: DS.surface3, justifyContent: 'center', alignItems: 'center' },
  body:       { paddingHorizontal: SPACE[5], maxHeight: 400 },
  sectionLbl: { ...TXT.label, marginTop: SPACE[4], marginBottom: SPACE[2] },
  catRow:     { flexDirection: 'row', alignItems: 'center', gap: SPACE[3], backgroundColor: DS.white, borderRadius: RADIUS.md, padding: SPACE[3] + 2, borderWidth: 1, borderColor: DS.border, marginBottom: SPACE[2] },
  catTxt:     { ...TXT.body, fontWeight: '600' },
  subRow:     { flexDirection: 'row', alignItems: 'center', backgroundColor: DS.surface3, borderRadius: RADIUS.sm, padding: SPACE[2] + 2, borderWidth: 1, borderColor: DS.border, marginBottom: SPACE[1] + 2 },
  subTxt:     { ...TXT.caption, fontWeight: '600' },
  actions:    { flexDirection: 'row', gap: SPACE[2] + 2, padding: SPACE[5], paddingTop: SPACE[4], borderTopWidth: 1, borderTopColor: DS.border },
  emptyBox:   { alignItems: 'center', paddingVertical: SPACE[8], gap: SPACE[2] },
  emptyTxt:   { fontSize: 15, fontWeight: '800', color: DS.text2 },
  emptyHint:  { fontSize: 12, color: DS.text3, textAlign: 'center' },
  backRow:       { flexDirection: 'row', alignItems: 'center', gap: SPACE[2], paddingHorizontal: SPACE[5], paddingVertical: SPACE[3], borderBottomWidth: 1, borderBottomColor: DS.border, backgroundColor: DS.brandLight },
backTxt:       { fontSize: 13, fontWeight: '700', color: DS.brand },
subCountBadge: { fontSize: 10, color: DS.text3, backgroundColor: DS.surface2, paddingHorizontal: SPACE[2], paddingVertical: 2, borderRadius: RADIUS.full, marginLeft: SPACE[2] },
});

// ─── PANTALLA PRINCIPAL ───────────────────────────────────────────────────────
export default function ProductDetailScreen({ route, navigation }) {
  const { product: initialProd } = route.params;
  const [product,            setProduct]            = useState(initialProd);
  const [edit,               setEdit]               = useState(false);
  const [soldModal,          setSoldModal]          = useState(false);
  const [soldPrice,          setSoldPrice]          = useState('');
  const [soldDate,           setSoldDate]           = useState(new Date().toISOString().split('T')[0]);
  const [showDatePicker,     setShowDatePicker]     = useState(false);
  const [showSoldDatePicker, setShowSoldDatePicker] = useState(false);
  const [catModal,           setCatModal]           = useState(false);

  const [editData, setEditData] = useState({
    category:        product.category        || '',
    subcategory:     product.subcategory     || null,
    firstUploadDate: product.firstUploadDate || new Date().toISOString().split('T')[0],
  });

  // dict solo para currentTags preview; CategoryModal recarga el suyo propio
  const [dict, setDict] = useState(() => loadDictionaryWithFallbacks());

  // FIX #3: busca en TODOS los productos, no solo en activos
  const refreshProduct = useCallback(() => {
    try {
      const all    = DatabaseService.getAllProducts();
      const fresh  = all.find(p => String(p.id) === String(product.id));
      if (!fresh) return;
      // intentar enriquecer con diagnóstico si es activo
      const enriched = DatabaseService.getActiveProductsWithDiagnostic();
      const enrichedFresh = enriched.find(p => String(p.id) === String(product.id));
      setProduct(enrichedFresh || fresh);
      LogService.debug(`ProductDetail: ${product.id} refrescado`, LOG_CTX.UI);
    } catch (e) {
      LogService.error('ProductDetail.refreshProduct', LOG_CTX.UI, e);
    }
  }, [product.id]);

  React.useEffect(() => {
    const unsub = navigation.addListener('focus', refreshProduct);
    return unsub;
  }, [navigation, refreshProduct]);

  const handleCategorySelect = (cat, sub) => {
    setEditData(prev => ({ ...prev, category: cat, subcategory: sub }));
    setDict(loadDictionaryWithFallbacks()); // actualizar tags preview
  };

  // FIX #3: spread completo del producto + campos editados con id incluido
  const handleSaveEdit = () => {
    try {
      const { category, subcategory, firstUploadDate } = editData;
      DatabaseService.updateProduct({
        ...product,
        category,
        subcategory,
        firstUploadDate,
      });
      LogService.add(`✏️ Editado: ${product.title}`, 'info');
      setEdit(false);
      refreshProduct();
      Alert.alert('✅ Guardado', 'Cambios aplicados correctamente.');
    } catch (e) {
      LogService.error('ProductDetail.handleSaveEdit', LOG_CTX.UI, e);
      Alert.alert('Error', 'No se pudo guardar.');
    }
  };

  const handleMarkSold = () => {
    const sp = parseFloat(soldPrice);
    if (!sp || sp <= 0) { Alert.alert('Precio inválido', 'Introduce un precio válido.'); return; }
    try {
      DatabaseService.markAsSold(product.id, sp, soldDate, false);
      LogService.add(`💰 Vendido: ${product.title} por ${sp}€`, 'success');
      setSoldModal(false);
      navigation.goBack();
    } catch (e) {
      LogService.error('ProductDetail.handleMarkSold', LOG_CTX.UI, e);
      Alert.alert('Error', 'No se pudo marcar como vendido.');
    }
  };

  const currentTags = useMemo(() => {
    const cat = editData.category;
    const sub = editData.subcategory;
    if (!cat || !dict[cat]) return [];
    const catData = dict[cat];
    let tags = catData.tags || [];
    if (sub && catData.subcategories?.[sub]?.tags) {
      tags = [...tags, ...catData.subcategories[sub].tags];
    }
    return tags;
  }, [editData.category, editData.subcategory, dict]);

  const sev       = product.severity;
  const heroColor = sev ? sev.color : (product.isHot ? DS.danger : DS.brand);

  return (
    <View style={s.container}>
      <ScrollView showsVerticalScrollIndicator={false}>

        {/* HERO */}
        <View style={[s.hero, { backgroundColor: DS.surface3 }]}>
          {product.images?.[0]
            ? <Image source={{ uri: product.images[0] }} style={s.heroImage} resizeMode="cover" />
            : <View style={s.heroPlaceholder}><Icon name="image" size={48} color={DS.border} /></View>
          }
          <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()}>
            <Icon name="arrow-left" size={20} color={DS.text} />
          </TouchableOpacity>
          {sev && (
            <View style={[s.heroBadge, { backgroundColor: heroColor }]}>
              <Text style={s.heroBadgeTxt}>{sev.emoji} {sev.type}</Text>
            </View>
          )}
        </View>

        {/* CONTENT CARD */}
        <View style={s.contentCard}>

          {/* Top row */}
          <View style={s.topRow}>
            <Text style={s.brandTxt}>VINTED</Text>
            {product.category && (
              <View style={s.catPill}>
                <Icon name="tag" size={10} color={DS.blue} />
                <Text style={s.catPillTxt}>
                  {product.category}
                  {product.subcategory && <Text style={s.catSep}> › {product.subcategory}</Text>}
                </Text>
              </View>
            )}
          </View>

          {/* Title + Price */}
          <View style={s.titleRow}>
            <Text style={s.titleTxt}>{product.title}</Text>
            <View style={s.pricePill}><Text style={s.pricePillTxt}>{fmtPrice(product.price)}</Text></View>
          </View>

          {/* Bundle */}
          {product.isBundle && (
            <View style={s.bundleBadge}>
              <Icon name="package" size={12} color={DS.purple} />
              <Text style={s.bundleTxt}>Pack de {product.bundleQty || 2} artículos</Text>
            </View>
          )}

          {/* Status */}
          <View style={[s.statusBar, { backgroundColor: heroColor + '10', borderColor: heroColor + '30' }]}>
            <View style={[s.statusDot, { backgroundColor: heroColor }]} />
            <Text style={[s.statusLbl, { color: heroColor }]}>
              {sev ? sev.type : product.isHot ? '🔥 HOT' : 'Activo'}
            </Text>
            {product.daysOld > 0 && <Text style={s.statusDays}>{product.daysOld} días en stock</Text>}
          </View>

          {/* Stats */}
          <View style={s.statsRow}>
            {[
              { val: product.views    || 0, lbl: 'VISTAS'  },
              { val: product.likes    || 0, lbl: 'LIKES'   },
              { val: `${product.price}€`,   lbl: 'PRECIO'  },
            ].map(st => (
              <View key={st.lbl} style={s.statCard}>
                <Text style={[s.statVal, { color: DS.text }]}>{st.val}</Text>
                <Text style={s.statLbl}>{st.lbl}</Text>
              </View>
            ))}
          </View>

          {/* Upload date */}
          <View style={s.dateBar}>
            <View style={[s.dateIcon, { backgroundColor: DS.brandLight }]}>
              <Icon name="calendar" size={16} color={DS.brand} />
            </View>
            <View>
              <Text style={s.dateLbl}>Primera subida</Text>
              <Text style={s.dateVal}>{fmtDate(product.firstUploadDate)}</Text>
            </View>
          </View>

          {/* Tags */}
          {product.tags && product.tags.length > 0 && (
            <View style={s.tagsSection}>
              <Text style={s.sectionLabel}>ETIQUETAS</Text>
              <View style={s.tagsCloud}>
                {product.tags.map((tag, i) => (
                  <View key={i} style={s.tag}><Text style={s.tagTxt}>{tag}</Text></View>
                ))}
              </View>
            </View>
          )}

          {/* Description */}
          {product.description && (
            <>
              <Text style={s.sectionLabel}>DESCRIPCIÓN</Text>
              <Text style={s.descTxt}>{product.description}</Text>
            </>
          )}

          {/* Actions */}
          {!edit && (
            <View style={s.actionsRow}>
              <TouchableOpacity style={s.btnEdit} onPress={() => setEdit(true)}>
                <Icon name="edit-2" size={16} color={DS.text} />
                <Text style={s.btnEditTxt}>Editar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.btnVendido} onPress={() => setSoldModal(true)}>
                <Icon name="check-circle" size={16} color="#FFF" />
                <Text style={s.btnVendidoTxt}>Marcar vendido</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* ── EDIT MODE ─────────────────────────────────── */}
          {edit && (
            <>
              <View style={s.editBanner}>
                <Icon name="edit-3" size={20} color={DS.brand} />
                <View style={{ flex: 1 }}>
                  <Text style={s.editTitle}>Modo edición</Text>
                  <Text style={s.editSub}>Categoría y fecha de primera subida</Text>
                </View>
              </View>

              {/* Category selector */}
              <TouchableOpacity style={s.catSelector} onPress={() => setCatModal(true)}>
                <View style={[s.catSelIcon, { backgroundColor: DS.blueLight }]}>
                  <Icon name="tag" size={16} color={DS.blue} />
                </View>
                <View style={{ flex: 1 }}>
                  {editData.category ? (
                    <>
                      <Text style={s.catSelVal}>{editData.category}</Text>
                      <Text style={s.catSelSub}>
                        {editData.subcategory ? editData.subcategory : 'Sin subcategoría · toca para cambiar'}
                      </Text>
                    </>
                  ) : (
                    <Text style={[s.catSelVal, { color: DS.text3 }]}>Sin categoría — toca para elegir</Text>
                  )}
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACE[1] }}>
                  {editData.subcategory && (
                    <TouchableOpacity
                      style={s.clearSubBtn}
                      onPress={() => setEditData(prev => ({ ...prev, subcategory: null }))}>
                      <Icon name="x" size={12} color={DS.text2} />
                    </TouchableOpacity>
                  )}
                  <Icon name="chevron-right" size={18} color={DS.text3} />
                </View>
              </TouchableOpacity>

              {/* Chips resumen categoría › subcategoría */}
              {editData.category && (
                <View style={s.selectionSummary}>
                  <View style={s.selectionChip}>
                    <Icon name="tag" size={11} color={DS.brand} />
                    <Text style={s.selectionChipTxt}>{editData.category}</Text>
                  </View>
                  {editData.subcategory && (
                    <>
                      <Icon name="chevron-right" size={11} color={DS.text3} />
                      <View style={[s.selectionChip, { backgroundColor: DS.blueLight }]}>
                        <Icon name="corner-down-right" size={11} color={DS.blue} />
                        <Text style={[s.selectionChipTxt, { color: DS.blue }]}>{editData.subcategory}</Text>
                        <TouchableOpacity onPress={() => setEditData(prev => ({ ...prev, subcategory: null }))}>
                          <Icon name="x" size={11} color={DS.blue} />
                        </TouchableOpacity>
                      </View>
                    </>
                  )}
                </View>
              )}

              {/* Tag preview */}
              {currentTags.length > 0 && (
                <View style={s.tagPreview}>
                  <Text style={s.tagPreviewLbl}>Etiquetas que se aplicarán:</Text>
                  <View style={s.tagsCloud}>
                    {currentTags.map((tag, i) => (
                      <View key={i} style={s.tag}><Text style={s.tagTxt}>{tag}</Text></View>
                    ))}
                  </View>
                </View>
              )}

              {/* Date picker */}
              <TouchableOpacity style={s.datePickBtn} onPress={() => setShowDatePicker(true)}>
                <View style={[s.datePickIcon, { backgroundColor: DS.brandLight }]}>
                  <Icon name="calendar" size={18} color={DS.brand} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.datePickVal}>{fmtDate(editData.firstUploadDate)}</Text>
                  <Text style={s.datePickHint}>Primera fecha de subida</Text>
                </View>
                <Icon name="chevron-right" size={18} color={DS.text3} />
              </TouchableOpacity>

              {/* Edit actions */}
              <View style={s.editActions}>
                <TouchableOpacity style={s.btnCancel}
                  onPress={() => {
                    setEdit(false);
                    setEditData({
                      category:        product.category        || '',
                      subcategory:     product.subcategory     || null,
                      firstUploadDate: product.firstUploadDate || new Date().toISOString().split('T')[0],
                    });
                  }}>
                  <Text style={s.btnCancelTxt}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.btnSave} onPress={handleSaveEdit}>
                  <Icon name="check" size={16} color="#FFF" />
                  <Text style={s.btnSaveTxt}>Guardar</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      </ScrollView>

      {/* ── MODALS ─────────────────────────────────────────────────────────── */}

      <CalPicker
        visible={showDatePicker}
        onClose={() => setShowDatePicker(false)}
        value={editData.firstUploadDate}
        onChange={(d) => setEditData(prev => ({ ...prev, firstUploadDate: d }))}
        accent={DS.brand}
        label="PRIMERA SUBIDA"
      />

      {/* FIX #1: CategoryModal ya no recibe dict como prop; lo carga internamente */}
      <CategoryModal
        visible={catModal}
        onClose={() => setCatModal(false)}
        currentCat={editData.category}
        currentSub={editData.subcategory}
        onSelect={handleCategorySelect}
      />

      {/* SOLD MODAL */}
      <Modal visible={soldModal} transparent animationType="slide"
        onRequestClose={() => setSoldModal(false)}>
        <View style={s.modalOverlay}>
          <TouchableOpacity style={{ flex: 1 }} onPress={() => setSoldModal(false)} />
          <View style={s.soldSheet}>
            <View style={s.soldHdr}>
              <View style={s.soldIconWrap}>
                <Icon name="check-circle" size={22} color={DS.success} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.soldHdrTitle}>Marcar como vendido</Text>
                <Text style={s.soldHdrSub} numberOfLines={1}>{product.title}</Text>
              </View>
              <TouchableOpacity style={s.modalCloseBtn} onPress={() => setSoldModal(false)}>
                <Icon name="x" size={16} color={DS.text2} />
              </TouchableOpacity>
            </View>
            <View style={s.soldBody}>
              <View style={s.soldPriceRow}>
                <View style={[s.soldPriceCard, { backgroundColor: DS.surface3 }]}>
                  <Text style={s.soldPriceLbl}>PRECIO ORIGINAL</Text>
                  <Text style={s.soldPriceVal}>{fmtPrice(product.price)}</Text>
                </View>
                <View style={[s.soldPriceCard, { backgroundColor: DS.successLight }]}>
                  <Text style={s.soldPriceLbl}>PRECIO VENTA</Text>
                  <Text style={[s.soldPriceVal, { color: DS.success }]}>
                    {soldPrice ? `${soldPrice}€` : '—'}
                  </Text>
                </View>
              </View>

              <Text style={s.soldFieldLbl}>PRECIO DE VENTA</Text>
              <View style={s.soldInputRow}>
                <TextInput
                  style={s.soldInput}
                  keyboardType="numeric"
                  placeholder="0"
                  placeholderTextColor={DS.text3}
                  value={soldPrice}
                  onChangeText={setSoldPrice}
                  autoFocus
                />
                <Text style={s.soldInputEuro}>€</Text>
              </View>

              <Text style={s.soldFieldLbl}>FECHA DE VENTA</Text>
              <TouchableOpacity style={s.soldDateRow} onPress={() => setShowSoldDatePicker(true)}>
                <Icon name="calendar" size={16} color={DS.text2} />
                <Text style={s.soldDateTxt}>{fmtDate(soldDate)}</Text>
                <Icon name="chevron-right" size={16} color={DS.text3} />
              </TouchableOpacity>

              <TouchableOpacity style={s.soldConfirm} onPress={handleMarkSold}>
                <Icon name="check" size={18} color="#FFF" />
                <Text style={s.soldConfirmTxt}>Confirmar venta</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <CalPicker
        visible={showSoldDatePicker}
        onClose={() => setShowSoldDatePicker(false)}
        value={soldDate}
        onChange={setSoldDate}
        accent={DS.success}
        label="FECHA DE VENTA"
      />
    </View>
  );
}

// ─── Estilos ──────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  container:     { flex: 1, backgroundColor: DS.surface2 },

  hero:          { width, height: width, position: 'relative' },
  heroImage:     { width: '100%', height: '100%' },
  heroPlaceholder: { width: '100%', height: '100%', backgroundColor: DS.border, justifyContent: 'center', alignItems: 'center' },
  backBtn:       { position: 'absolute', top: LAYOUT.headerPadT, left: SPACE[5], backgroundColor: DS.white, width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', ...SHADOW.lg },
  heroBadge:     { position: 'absolute', bottom: SPACE[5], right: SPACE[5], paddingHorizontal: SPACE[3] + 2, paddingVertical: SPACE[2] - 1, borderRadius: RADIUS.full },
  heroBadgeTxt:  { color: '#FFF', fontWeight: '900', fontSize: 12, letterSpacing: 0.4 },

  contentCard:   { backgroundColor: DS.white, borderTopLeftRadius: RADIUS.xl, borderTopRightRadius: RADIUS.xl, padding: SPACE[6], marginTop: -RADIUS.xl - 4, minHeight: 500 },

  topRow:        { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACE[2] + 2 },
  brandTxt:      { ...TXT.label, color: DS.brand },
  catPill:       { flexDirection: 'row', alignItems: 'center', gap: SPACE[1], backgroundColor: DS.blueLight, paddingHorizontal: SPACE[2] + 2, paddingVertical: SPACE[1] + 1, borderRadius: RADIUS.sm },
  catPillTxt:    { fontSize: 10, fontWeight: '800', color: DS.blue },
  catSep:        { fontSize: 10, color: DS.text3 },

  titleRow:      { flexDirection: 'row', alignItems: 'flex-start', gap: SPACE[2] + 2, marginBottom: SPACE[2] + 2 },
  titleTxt:      { ...TXT.display, fontSize: 21, lineHeight: 27, flex: 1 },
  pricePill:     { backgroundColor: DS.brand, paddingHorizontal: SPACE[3] + 2, paddingVertical: SPACE[2], borderRadius: RADIUS.md },
  pricePillTxt:  { ...TXT.priceSm, color: '#FFF', fontSize: 16 },

  bundleBadge:   { flexDirection: 'row', alignItems: 'center', gap: SPACE[2] - 2, backgroundColor: DS.purpleLight, paddingHorizontal: SPACE[2] + 2, paddingVertical: SPACE[1] + 1, borderRadius: RADIUS.sm, alignSelf: 'flex-start', marginBottom: SPACE[2] + 2 },
  bundleTxt:     { fontSize: 10, fontWeight: '900', color: DS.purple },

  statusBar:     { flexDirection: 'row', alignItems: 'center', gap: SPACE[2], borderWidth: 1, borderRadius: RADIUS.md, padding: SPACE[3], marginBottom: SPACE[3] + 2 },
  statusDot:     { width: 8, height: 8, borderRadius: 4 },
  statusLbl:     { fontSize: 12, fontWeight: '900' },
  statusDays:    { fontSize: 11, color: DS.text2, marginLeft: 'auto' },

  statsRow:      { flexDirection: 'row', gap: SPACE[2] + 2, marginBottom: SPACE[3] + 2 },
  statCard:      { flex: 1, backgroundColor: DS.surface2, borderRadius: RADIUS.lg, padding: SPACE[3], alignItems: 'center', gap: SPACE[1] },
  statVal:       { ...TXT.price, fontSize: 20, fontFamily: FONT_FAMILY.mono },
  statLbl:       { ...TXT.label, fontSize: 8 },

  dateBar:       { flexDirection: 'row', alignItems: 'center', gap: SPACE[3], backgroundColor: DS.surface2, borderRadius: RADIUS.md, padding: SPACE[3], marginBottom: SPACE[3] + 2 },
  dateIcon:      { width: 36, height: 36, borderRadius: RADIUS.sm, justifyContent: 'center', alignItems: 'center' },
  dateLbl:       { fontSize: 10, color: DS.text2, marginBottom: 2 },
  dateVal:       { fontSize: 13, fontWeight: '800', color: DS.text },

  tagsSection:   { marginBottom: SPACE[3] + 2 },
  tagsCloud:     { flexDirection: 'row', flexWrap: 'wrap', gap: SPACE[2] - 1, marginTop: SPACE[2] - 2 },
  tag:           { backgroundColor: DS.blueLight, paddingHorizontal: SPACE[2] + 2, paddingVertical: SPACE[1] + 1, borderRadius: RADIUS.sm },
  tagTxt:        { fontSize: 11, color: DS.blue, fontWeight: '700' },

  sectionLabel:  { ...TXT.label, marginBottom: SPACE[2] - 2, marginTop: SPACE[3] + 2 },
  descTxt:       { ...TXT.body, lineHeight: 22, marginBottom: SPACE[4] },

  actionsRow:    { flexDirection: 'row', gap: SPACE[2] + 2, marginTop: SPACE[4] },
  btnEdit:       { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACE[2], backgroundColor: DS.surface2, borderWidth: 1, borderColor: DS.border, paddingVertical: SPACE[4] - 1, borderRadius: RADIUS.lg },
  btnEditTxt:    { fontSize: 13, fontWeight: '800', color: DS.text },
  btnVendido:    { flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACE[2], backgroundColor: DS.success, paddingVertical: SPACE[4] - 1, borderRadius: RADIUS.lg },
  btnVendidoTxt: { fontSize: 13, fontWeight: '900', color: '#FFF', letterSpacing: 0.5 },

  editBanner:    { flexDirection: 'row', alignItems: 'center', gap: SPACE[3], backgroundColor: DS.brandLight, borderRadius: RADIUS.lg, padding: SPACE[3] + 2, marginBottom: SPACE[4], borderWidth: 1, borderColor: DS.brand + '20' },
  editTitle:     { fontSize: 15, fontWeight: '900', color: DS.text },
  editSub:       { fontSize: 11, color: DS.text2, marginTop: 2 },
  catSelector:   { flexDirection: 'row', alignItems: 'center', gap: SPACE[3], backgroundColor: DS.white, borderRadius: RADIUS.lg, padding: SPACE[3] + 2, borderWidth: 1, borderColor: DS.border, marginBottom: SPACE[1] },
  catSelIcon:    { width: 36, height: 36, borderRadius: RADIUS.sm, justifyContent: 'center', alignItems: 'center' },
  catSelVal:        { fontSize: 15, fontWeight: '800', color: DS.text },
  catSelSub:        { fontSize: 11, color: DS.blue, marginTop: 2 },
  clearSubBtn:      { width: 22, height: 22, borderRadius: 11, backgroundColor: DS.surface3, justifyContent: 'center', alignItems: 'center' },
  selectionSummary: { flexDirection: 'row', alignItems: 'center', gap: SPACE[2], marginBottom: SPACE[3], flexWrap: 'wrap' },
  selectionChip:    { flexDirection: 'row', alignItems: 'center', gap: SPACE[1], backgroundColor: DS.brandLight, paddingHorizontal: SPACE[2] + 2, paddingVertical: SPACE[1] + 1, borderRadius: RADIUS.full },
  selectionChipTxt: { fontSize: 12, fontWeight: '700', color: DS.brand },
  tagPreview:    { backgroundColor: DS.surface2, borderRadius: RADIUS.md, padding: SPACE[3], marginTop: SPACE[1], marginBottom: SPACE[1] },
  tagPreviewLbl: { fontSize: 10, color: DS.text2, fontWeight: '700', marginBottom: SPACE[2] - 2 },
  datePickBtn:   { flexDirection: 'row', alignItems: 'center', gap: SPACE[3], backgroundColor: DS.white, borderRadius: RADIUS.lg, padding: SPACE[3] + 2, borderWidth: 1, borderColor: DS.border, marginBottom: SPACE[1] },
  datePickIcon:  { width: 40, height: 40, borderRadius: RADIUS.md, justifyContent: 'center', alignItems: 'center' },
  datePickVal:   { fontSize: 15, fontWeight: '700', color: DS.text },
  datePickHint:  { fontSize: 10, color: DS.text3, marginTop: 2 },
  editActions:   { flexDirection: 'row', gap: SPACE[2] + 2, marginTop: SPACE[6] },
  btnSave:       { flex: 2, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: SPACE[2], backgroundColor: DS.text, padding: SPACE[4], borderRadius: RADIUS.lg },
  btnSaveTxt:    { color: '#FFF', fontWeight: '900', fontSize: 14 },
  btnCancel:     { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: DS.surface2, borderWidth: 1, borderColor: DS.border, padding: SPACE[4], borderRadius: RADIUS.lg },
  btnCancelTxt:  { color: DS.text2, fontWeight: '800' },

  modalOverlay:  { flex: 1, backgroundColor: '#00000060', justifyContent: 'flex-end' },
  modalCloseBtn: { width: 30, height: 30, borderRadius: RADIUS.md, backgroundColor: DS.surface3, justifyContent: 'center', alignItems: 'center' },

  soldSheet:     { backgroundColor: DS.white, borderTopLeftRadius: RADIUS.xl, borderTopRightRadius: RADIUS.xl, paddingBottom: SPACE[8] },
  soldHdr:       { flexDirection: 'row', alignItems: 'center', gap: SPACE[3], padding: SPACE[5], backgroundColor: DS.successLight, borderTopLeftRadius: RADIUS.xl, borderTopRightRadius: RADIUS.xl, borderBottomWidth: 1, borderBottomColor: DS.success + '25' },
  soldIconWrap:  { width: 44, height: 44, borderRadius: 22, backgroundColor: '#FFF', justifyContent: 'center', alignItems: 'center' },
  soldHdrTitle:  { fontSize: 17, fontWeight: '900', color: DS.text },
  soldHdrSub:    { fontSize: 12, color: DS.text2, marginTop: 2 },
  soldBody:      { padding: SPACE[5] },
  soldPriceRow:  { flexDirection: 'row', gap: SPACE[2] + 2, marginBottom: SPACE[5] },
  soldPriceCard: { flex: 1, borderRadius: RADIUS.md, padding: SPACE[3] },
  soldPriceLbl:  { ...TXT.label, fontSize: 8, marginBottom: SPACE[1] },
  soldPriceVal:  { ...TXT.price, fontSize: 20, fontFamily: FONT_FAMILY.mono },
  soldFieldLbl:  { ...TXT.label, fontSize: 9, marginBottom: SPACE[2] },
  soldInputRow:  { flexDirection: 'row', alignItems: 'center', gap: SPACE[2], backgroundColor: DS.surface2, borderWidth: 2, borderColor: DS.border, borderRadius: RADIUS.lg, paddingHorizontal: SPACE[4], paddingVertical: SPACE[2] + 2, marginBottom: SPACE[4] },
  soldInput:     { flex: 1, fontSize: 28, fontWeight: '900', color: DS.text, fontFamily: FONT_FAMILY.mono, textAlign: 'center' },
  soldInputEuro: { fontSize: 22, fontWeight: '900', color: DS.text2 },
  soldDateRow:   { flexDirection: 'row', alignItems: 'center', gap: SPACE[2] + 2, backgroundColor: DS.surface2, borderRadius: RADIUS.md, padding: SPACE[3] + 2, marginBottom: SPACE[5], borderWidth: 1, borderColor: DS.border },
  soldDateTxt:   { flex: 1, fontSize: 14, fontWeight: '700', color: DS.text },
  soldConfirm:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACE[2] + 2, backgroundColor: DS.success, borderRadius: RADIUS.lg, padding: SPACE[4] + 2 },
  soldConfirmTxt:{ color: '#FFF', fontWeight: '900', fontSize: 15, letterSpacing: 0.5 },
});