/**
 * SoldEditDetailView.jsx — Edición de Producto Vendido
 *
 * REFACTORIZADO para usar theme.js (ResellHub Design System v2)
 * - Edición inline de precio de venta, fecha de venta, categoría, fecha de subida
 * - Modal de categoría con subcategorías
 * - CalPicker para selección de fechas
 *
 * [FIX post-auditoría — CRÍTICO]
 * `handleSave()` llamaba a `DatabaseService.updateProduct(product.id, {...})`
 * con DOS argumentos, pero `updateProduct()` solo acepta UNO: un objeto que
 * ya incluye `.id`. El segundo argumento se descartaba silenciosamente;
 * dentro del servicio, `updated.id` sobre el string `product.id` es
 * `undefined`, el findIndex nunca encontraba el producto y la función
 * devolvía `false` sin escribir nada en MMKV. Como el código no comprobaba
 * el retorno, el Alert "✅ Guardado" se mostraba igualmente — CADA edición
 * de venta desde esta pantalla (precio real, fecha real, categoría, fecha
 * de subida) se perdía en silencio. Corregido a un único objeto con `.id`
 * (mismo patrón ya usado correctamente en ProductDetailScreen.jsx), y se
 * comprueba el retorno para no mentir al usuario si algún día vuelve a
 * fallar.
 *
 * [FIX post-auditoría — secundario]
 * CategoryModal recibía `dict` como prop congelada (useMemo con deps [])
 * del padre, en vez de recargar el diccionario cada vez que se abre. Esto
 * contradice lo que la skill UI-006-modal_dictionary_loading.md da por
 * corregido para este archivo. Se alinea con el patrón ya usado en
 * ProductDetailScreen.jsx: el modal carga y refresca su propio dict al
 * abrirse.
 */

import React, { useState, useMemo, useEffect } from 'react';
import {
  View, Text, ScrollView, Image, StyleSheet, Dimensions,
  TouchableOpacity, TextInput, Modal, Alert, FlatList, Platform,
} from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import { DatabaseService } from '../services/DatabaseService';
import LogService, { LOG_CTX } from '../services/LogService';

// ── Importar Design System ───────────────────────────────────────────────────
import {
  DS, SPACE, RADIUS, SHADOW, TXT, BTN, BTN_TEXT, CARD,
  LAYOUT, FONT_SIZE, FONT_FAMILY, MONTH_NAMES,
  ttsColor, ttsEmoji, fmtPrice, fmtDate, fmtDateLong,
} from '../theme';

const { width } = Dimensions.get('window');

// ─── Helper: cargar diccionario completo con fallbacks ────────────────────────
function loadDictionaryWithFallbacks() {
  try {
    const full = DatabaseService.getFullDictionary();
    if (full && typeof full === 'object' && Object.keys(full).length > 0) {
      LogService.debug(
        `CategoryModal: dict completo — ${Object.keys(full).length} cats`,
        LOG_CTX.UI,
      );
      return full;
    }

    const legacy = DatabaseService.getDictionary();
    if (legacy && typeof legacy === 'object' && Object.keys(legacy).length > 0) {
      LogService.debug(
        `CategoryModal: usando dict legacy — ${Object.keys(legacy).length} cats`,
        LOG_CTX.UI,
      );
      const normalized = {};
      Object.entries(legacy).forEach(([cat, val]) => {
        normalized[cat] = Array.isArray(val)
          ? { tags: val, subcategories: {} }
          : { tags: val?.tags || [], subcategories: val?.subcategories || {} };
      });
      return normalized;
    }

    LogService.warn(
      'CategoryModal: diccionario vacío — configura en Ajustes → Categorías',
      LOG_CTX.UI,
    );
    return {};
  } catch (e) {
    LogService.error('CategoryModal.loadDictionaryWithFallbacks', LOG_CTX.UI, e);
    return {};
  }
}

// ─── CalPicker canónico ───────────────────────────────────────────────────────
function CalPicker({ visible, onClose, value, onChange, accent = DS.brand, label }) {
  const [nav, setNav]           = useState(value ? new Date(value) : new Date());
  const [yearMode, setYearMode] = useState(false);
  useEffect(() => {
    if (visible) { setNav(value ? new Date(value) : new Date()); setYearMode(false); }
  }, [visible]);
  const yr    = nav.getFullYear(), mo = nav.getMonth(), today = new Date();
  const WD     = ['L','M','X','J','V','S','D'];
  const firstWD = (new Date(yr, mo, 1).getDay() + 6) % 7;
  const days    = new Date(yr, mo + 1, 0).getDate();
  const cells   = [...Array(firstWD).fill(null), ...Array.from({length: days}, (_, i) => i + 1)];
  const sel     = value ? new Date(value) : null;
  const isSel   = d => sel && sel.getFullYear()===yr && sel.getMonth()===mo && sel.getDate()===d;
  const isTod   = d => today.getFullYear()===yr && today.getMonth()===mo && today.getDate()===d;
  const years   = Array.from({length: 8}, (_, i) => today.getFullYear() - 5 + i);
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={cS.overlay}>
        <TouchableOpacity style={{...StyleSheet.absoluteFillObject}} onPress={onClose}/>
        <View style={cS.card}>
          <View style={[cS.hdr, {backgroundColor: accent}]}>
            {label && <Text style={cS.hdrLbl}>{label}</Text>}
            <Text style={cS.hdrY}>{yr}</Text>
            <Text style={cS.hdrM}>{MONTH_NAMES[mo]}</Text>
            {sel && <Text style={cS.hdrD}>{sel.getDate()} de {MONTH_NAMES[sel.getMonth()]} de {sel.getFullYear()}</Text>}
          </View>
          <View style={cS.nav}>
            <TouchableOpacity style={cS.navBtn} onPress={() => setNav(new Date(yr, mo-1, 1))}>
              <Icon name="chevron-left" size={18} color={DS.text}/>
            </TouchableOpacity>
            <TouchableOpacity style={cS.navTitleRow} onPress={() => setYearMode(!yearMode)}>
              <Text style={cS.navT}>{MONTH_NAMES[mo].toUpperCase()} {yr}</Text>
              <Icon name={yearMode ? 'chevron-up' : 'chevron-down'} size={13} color={DS.text2}/>
            </TouchableOpacity>
            <TouchableOpacity style={cS.navBtn} onPress={() => setNav(new Date(yr, mo+1, 1))}>
              <Icon name="chevron-right" size={18} color={DS.text}/>
            </TouchableOpacity>
          </View>
          {yearMode && (
            <View style={cS.yearRow}>
              {years.map(y => (
                <TouchableOpacity key={y} style={[cS.yChip, y===yr && {backgroundColor: accent}]}
                  onPress={() => { setNav(new Date(y, mo, 1)); setYearMode(false); }}>
                  <Text style={[cS.yTxt, y===yr && {color:'#FFF', fontWeight:'900'}]}>{y}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
          <View style={cS.wdRow}>{WD.map(d => <Text key={d} style={cS.wdTxt}>{d}</Text>)}</View>
          <View style={cS.grid}>
            {cells.map((d, i) => {
              if (!d) return <View key={`b${i}`} style={cS.cell}/>;
              const s = isSel(d), t = isTod(d);
              return (
                <TouchableOpacity key={d}
                  style={[cS.cell, s && [cS.cellS, {backgroundColor: accent}], !s&&t&&[cS.cellT,{borderColor:accent}]]}
                  onPress={() => { onChange(new Date(yr,mo,d,12).toISOString()); onClose(); }}>
                  <Text style={[cS.dTxt, s&&cS.dTxtS, !s&&t&&{color:accent,fontWeight:'800'}]}>{d}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <View style={cS.foot}>
            <TouchableOpacity onPress={() => { onChange(new Date().toISOString()); onClose(); }}
              style={[cS.todayBtn, {borderColor: accent}]}>
              <Icon name="target" size={11} color={accent} style={{marginRight:4}}/>
              <Text style={[cS.todayTxt, {color: accent}]}>HOY</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={onClose} style={cS.cancelBtn}>
              <Text style={cS.cancelTxt}>CANCELAR</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}
const cS = StyleSheet.create({
  overlay:  {flex:1, backgroundColor:'#00000070', justifyContent:'center', alignItems:'center', padding: SPACE[5]},
  card:     {backgroundColor: DS.white, borderRadius: RADIUS.xl, overflow:'hidden', width:'100%', maxWidth:400, ...SHADOW.lg},
  hdr:      {padding: SPACE[5], paddingTop: SPACE[6]},
  hdrLbl:   {...TXT.label, color:'#FFF', marginBottom: SPACE[2]},
  hdrY:     {fontSize: FONT_SIZE['3xl'], fontWeight:'900', color:'#FFF', opacity:0.85, lineHeight: FONT_SIZE['3xl'] * 1.1},
  hdrM:     {fontSize: FONT_SIZE.xl, fontWeight:'600', color:'#FFF', marginBottom: SPACE[1]},
  hdrD:     {fontSize: FONT_SIZE.base, fontWeight:'500', color:'#FFF', opacity:0.9},
  nav:      {flexDirection:'row', alignItems:'center', paddingHorizontal: SPACE[4], paddingVertical: SPACE[3],
             backgroundColor: DS.surface2, borderBottomWidth:1, borderBottomColor: DS.border},
  navBtn:   {padding: SPACE[2]},
  navTitleRow: {flex:1, flexDirection:'row', alignItems:'center', justifyContent:'center', gap: SPACE[1]},
  navT:     {...TXT.label, fontSize: FONT_SIZE.sm, color: DS.text},
  yearRow:  {flexDirection:'row', flexWrap:'wrap', gap: SPACE[2], padding: SPACE[4], backgroundColor: DS.surface2},
  yChip:    {paddingHorizontal: SPACE[3], paddingVertical: SPACE[2], borderRadius: RADIUS.md, backgroundColor: DS.white,
             borderWidth:1, borderColor: DS.border},
  yTxt:     {fontSize: FONT_SIZE.sm, fontWeight:'600', color: DS.text},
  wdRow:    {flexDirection:'row', paddingHorizontal: SPACE[3], paddingVertical: SPACE[2], backgroundColor: DS.surface3},
  wdTxt:    {flex:1, textAlign:'center', fontSize: FONT_SIZE.xs, fontWeight:'900', color: DS.text3},
  grid:     {flexDirection:'row', flexWrap:'wrap', padding: SPACE[3]},
  cell:     {width:'14.28%', aspectRatio:1, justifyContent:'center', alignItems:'center', borderRadius: RADIUS.sm},
  cellS:    {borderRadius: RADIUS.sm},
  cellT:    {borderWidth:2},
  dTxt:     {fontSize: FONT_SIZE.base, fontWeight:'500', color: DS.text},
  dTxtS:    {color:'#FFF', fontWeight:'900'},
  foot:     {flexDirection:'row', gap: SPACE[2], padding: SPACE[4], backgroundColor: DS.surface2},
  todayBtn: {flex:1, paddingVertical: SPACE[3], borderRadius: RADIUS.md, alignItems:'center',
             backgroundColor: DS.white, borderWidth:2, flexDirection:'row', justifyContent:'center'},
  todayTxt: {fontSize: FONT_SIZE.xs, fontWeight:'900', letterSpacing:0.8},
  cancelBtn:{flex:1, paddingVertical: SPACE[3], borderRadius: RADIUS.md, alignItems:'center', backgroundColor: DS.surface3},
  cancelTxt:{fontSize: FONT_SIZE.xs, fontWeight:'700', color: DS.text2},
});

// ─── Modal de Categoría ───────────────────────────────────────────────────────
// [FIX post-auditoría] Antes recibía `dict` como prop congelada del padre
// (useMemo con deps []) — nunca se refrescaba tras cambios en Settings.
// Ahora carga y refresca su propio diccionario cada vez que se abre,
// igual que CategoryModal en ProductDetailScreen.jsx.
function CategoryModal({ visible, onClose, currentCat, currentSub, onSelect }) {
  const [dict,   setDict]   = useState(() => loadDictionaryWithFallbacks());
  const [selCat, setSelCat] = useState(currentCat || '');
  const [selSub, setSelSub] = useState(currentSub || null);

  useEffect(() => {
    if (!visible) return;
    setDict(loadDictionaryWithFallbacks());
    setSelCat(currentCat || '');
    setSelSub(currentSub || null);
  }, [visible, currentCat, currentSub]);

  const cats = Object.keys(dict);
  const subs = selCat && dict[selCat]?.subcategories
    ? Object.keys(dict[selCat].subcategories)
    : [];

  const handleConfirm = () => {
    onSelect(selCat, selSub);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={mS.overlay}>
        <TouchableOpacity style={{flex:1}} onPress={onClose}/>
        <View style={mS.sheet}>
          <View style={mS.handle}/>
          <View style={mS.hdr}>
            <View>
              <Text style={mS.hdrTitle}>Seleccionar categoría</Text>
              <Text style={mS.hdrSub}>
                {selCat ? (selSub ? `${selCat} › ${selSub}` : selCat) : 'Elige una categoría'}
              </Text>
            </View>
            <TouchableOpacity style={mS.closeBtn} onPress={onClose}>
              <Icon name="x" size={18} color={DS.text2}/>
            </TouchableOpacity>
          </View>

          <ScrollView style={mS.body} showsVerticalScrollIndicator={false}>
            <Text style={mS.sectionLbl}>CATEGORÍA PRINCIPAL</Text>
            {cats.map(cat => (
              <TouchableOpacity
                key={cat}
                style={[mS.catRow, selCat === cat && {backgroundColor: DS.brandLight, borderColor: DS.brand}]}
                onPress={() => { setSelCat(cat); setSelSub(null); }}
              >
                <Icon name="tag" size={18} color={selCat === cat ? DS.brand : DS.text2}/>
                <Text style={[mS.catTxt, selCat === cat && {color: DS.brand, fontWeight:'700'}]}>{cat}</Text>
                {selCat === cat && <Icon name="check" size={16} color={DS.brand} style={{marginLeft:'auto'}}/>}
              </TouchableOpacity>
            ))}

            {subs.length > 0 && (
              <>
                <Text style={[mS.sectionLbl, {marginTop: SPACE[5]}]}>SUBCATEGORÍA</Text>
                <TouchableOpacity
                  style={[mS.subRow, !selSub && selCat && {backgroundColor: DS.blueLight, borderColor: DS.blue}]}
                  onPress={() => setSelSub(null)}
                >
                  <Text style={[mS.subTxt, !selSub && selCat && {color: DS.blue, fontWeight:'700'}]}>
                    Sin subcategoría
                  </Text>
                </TouchableOpacity>
                {subs.map(sub => (
                  <TouchableOpacity
                    key={sub}
                    style={[mS.subRow, selSub === sub && {backgroundColor: DS.blueLight, borderColor: DS.blue}]}
                    onPress={() => setSelSub(sub)}
                  >
                    <Text style={[mS.subTxt, selSub === sub && {color: DS.blue, fontWeight:'700'}]}>{sub}</Text>
                    {selSub === sub && <Icon name="check" size={14} color={DS.blue} style={{marginLeft:'auto'}}/>}
                  </TouchableOpacity>
                ))}
              </>
            )}
          </ScrollView>

          <View style={mS.actions}>
            <TouchableOpacity style={[BTN.secondary, {flex:1}]} onPress={onClose}>
              <Text style={BTN_TEXT.secondary}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[BTN.primary, {flex:2}]} onPress={handleConfirm}>
              <Icon name="check" size={16} color="#FFF"/>
              <Text style={BTN_TEXT.primary}>Confirmar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}
const mS = StyleSheet.create({
  overlay: {flex:1, backgroundColor:'#00000060', justifyContent:'flex-end'},
  sheet:   {backgroundColor: DS.white, borderTopLeftRadius: RADIUS.xl, borderTopRightRadius: RADIUS.xl,
            maxHeight:'85%', paddingBottom: SPACE[8]},
  handle:  {width:40, height:4, backgroundColor: DS.border, borderRadius: RADIUS.sm, alignSelf:'center', marginTop: SPACE[3]},
  hdr:     {flexDirection:'row', alignItems:'center', justifyContent:'space-between', padding: SPACE[5],
            borderBottomWidth:1, borderBottomColor: DS.border},
  hdrTitle:{...TXT.heading},
  hdrSub:  {...TXT.caption, marginTop: SPACE[1]},
  closeBtn:{width:36, height:36, borderRadius: RADIUS.md, backgroundColor: DS.surface3,
            justifyContent:'center', alignItems:'center'},
  body:    {paddingHorizontal: SPACE[5], maxHeight:400},
  sectionLbl: {...TXT.label, marginTop: SPACE[4], marginBottom: SPACE[2]},
  catRow:  {flexDirection:'row', alignItems:'center', gap: SPACE[3], backgroundColor: DS.white,
            borderRadius: RADIUS.md, padding: SPACE[3] + 2, borderWidth:1, borderColor: DS.border, marginBottom: SPACE[2]},
  catTxt:  {...TXT.body, fontWeight:'600'},
  subRow:  {flexDirection:'row', alignItems:'center', backgroundColor: DS.surface3,
            borderRadius: RADIUS.sm, padding: SPACE[2] + 2, borderWidth:1, borderColor: DS.border, marginBottom: SPACE[1] + 2},
  subTxt:  {...TXT.caption, fontWeight:'600'},
  actions: {flexDirection:'row', gap: SPACE[2] + 2, padding: SPACE[5], paddingTop: SPACE[4],
            borderTopWidth:1, borderTopColor: DS.border},
});

// ─── PANTALLA PRINCIPAL ───────────────────────────────────────────────────────
export default function SoldEditDetailView({ route, navigation }) {
  const { product } = route.params;

  const [editForm, setEditForm] = useState({
    soldPriceReal:   product.soldPriceReal || product.soldPrice || product.price || '',
    soldDateReal:    product.soldDateReal  || product.soldDate  || product.soldAt || new Date().toISOString(),
    category:        product.category || '',
    subcategory:     product.subcategory || null,
    firstUploadDate: product.firstUploadDate || product.createdAt || new Date().toISOString(),
  });

  const [showCalSold,   setShowCalSold]   = useState(false);
  const [showCalUpload, setShowCalUpload] = useState(false);
  const [showCatModal,  setShowCatModal]  = useState(false);

  // [FIX post-auditoría] useState en vez de useMemo(deps:[]) — así puede
  // refrescarse tras seleccionar categoría, igual que en ProductDetailScreen.
  const [dict, setDict] = useState(() => loadDictionaryWithFallbacks());

  // TTS calculado
  const tts = useMemo(() => {
    const s = editForm.firstUploadDate;
    const e = editForm.soldDateReal;
    if (!s || !e) return null;
    const diff = Math.round((new Date(e) - new Date(s)) / 86_400_000);
    return Math.max(1, diff);
  }, [editForm.firstUploadDate, editForm.soldDateReal]);

  const config = DatabaseService.getConfig();
  const ttsLightning = parseInt(config?.ttsLightning || 7);
  const ttsAnchor    = parseInt(config?.ttsAnchor    || 30);
  const ttsCol = tts && tts > 0
    ? (tts <= ttsLightning ? DS.success : tts <= ttsAnchor ? DS.warning : DS.danger)
    : DS.text3;
  const ttsLbl = tts && tts > 0
    ? (tts <= ttsLightning ? '⚡' : tts <= ttsAnchor ? '🟡' : '⚓')
    : '';

  // Tags de la categoría + subcategoría
  const categoryTags = useMemo(() => {
    const cat = editForm.category;
    const sub = editForm.subcategory;
    if (!cat || !dict[cat]) return [];
    const catData = dict[cat];
    let tags = catData.tags || [];
    if (sub && catData.subcategories?.[sub]?.tags) {
      tags = [...tags, ...catData.subcategories[sub].tags];
    }
    return tags;
  }, [editForm.category, editForm.subcategory, dict]);

  const handleCategorySelect = (cat, sub) => {
    setEditForm(prev => ({ ...prev, category: cat, subcategory: sub }));
    // [FIX post-auditoría] refresca el preview de tags con el dict más reciente
    setDict(loadDictionaryWithFallbacks());
  };

  // [FIX post-auditoría — CRÍTICO] updateProduct() acepta UN único objeto
  // con `.id` incluido, no (id, updates). Antes: DatabaseService.updateProduct(
  // product.id, {...}) — el 2º argumento se descartaba, updated.id era
  // undefined, el findIndex nunca encontraba el producto y la función
  // devolvía false SIN GUARDAR NADA — mientras el Alert de éxito se mostraba
  // igual porque no se comprobaba el retorno. Corregido + se comprueba `ok`.
  const handleSave = () => {
    const sp = parseFloat(editForm.soldPriceReal);
    if (!sp || sp <= 0) {
      Alert.alert('Precio inválido', 'Introduce un precio de venta válido.');
      return;
    }
    try {
      const ok = DatabaseService.updateProduct({
        ...product,
        soldPriceReal:   sp,
        soldDateReal:    editForm.soldDateReal,
        category:        editForm.category,
        subcategory:     editForm.subcategory,
        firstUploadDate: editForm.firstUploadDate,
      });
      if (!ok) {
        LogService.error(
          'SoldEditDetailView.handleSave: updateProduct devolvió false (producto no encontrado)',
          LOG_CTX.UI,
          { productId: product.id },
        );
        Alert.alert('Error', 'No se pudo guardar. El producto no se encontró en la base de datos.');
        return;
      }
      LogService.add(`💾 Venta editada: ${product.title}`, 'success');
      Alert.alert('✅ Guardado', 'Datos de venta actualizados correctamente.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (e) {
      LogService.error('SoldEditDetailView.handleSave', LOG_CTX.UI, e);
      Alert.alert('Error', 'No se pudo guardar la edición.');
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* HERO */}
        <View style={styles.hero}>
          {product.images?.[0] ? (
            <Image source={{uri: product.images[0]}} style={styles.heroImg} resizeMode="cover"/>
          ) : (
            <View style={[styles.heroImg, styles.heroPlaceholder]}>
              <Icon name="image" size={48} color={DS.border}/>
            </View>
          )}
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Icon name="arrow-left" size={20} color={DS.text}/>
          </TouchableOpacity>
          <View style={styles.soldBadge}>
            <Icon name="check-circle" size={14} color="#FFF"/>
            <Text style={styles.soldBadgeTxt}>VENDIDO</Text>
          </View>
        </View>

        {/* CONTENT CARD */}
        <View style={styles.contentCard}>
          <View style={styles.topRow}>
            <Text style={styles.brandTxt}>VINTED</Text>
            {product.category && (
              <View style={styles.catPill}>
                <Icon name="tag" size={10} color={DS.blue}/>
                <Text style={styles.catPillTxt}>
                  {product.category}
                  {product.subcategory && <Text style={styles.catSep}> › {product.subcategory}</Text>}
                </Text>
              </View>
            )}
          </View>

          <Text style={styles.titleTxt}>{product.title}</Text>

          {/* TTS Panel */}
          <View style={styles.ttsPanel}>
            <View style={styles.ttsStat}>
              <Text style={styles.ttsLbl}>PRECIO VENTA</Text>
              <Text style={[styles.ttsVal, {color: DS.success, fontFamily: FONT_FAMILY.mono}]}>
                {editForm.soldPriceReal}€
              </Text>
            </View>
            <View style={styles.ttsDivider}/>
            <View style={styles.ttsStat}>
              <Text style={styles.ttsLbl}>TTS</Text>
              <Text style={[styles.ttsVal, {color: ttsCol, fontFamily: FONT_FAMILY.mono}]}>
                {tts !== null ? `${ttsLbl} ${tts}d` : '—'}
              </Text>
            </View>
            <View style={styles.ttsDivider}/>
            <View style={styles.ttsStat}>
              <Text style={styles.ttsLbl}>FECHA VENTA</Text>
              <Text style={[styles.ttsVal, {fontSize: 13}]}>
                {editForm.soldDateReal
                  ? new Date(editForm.soldDateReal).toLocaleDateString('es-ES', {day:'2-digit', month:'short'})
                  : '—'}
              </Text>
            </View>
          </View>

          {/* FORMULARIO */}
          <View style={styles.formCard}>
            <View style={styles.formBanner}>
              <Icon name="edit-3" size={18} color={DS.success}/>
              <View style={{flex:1}}>
                <Text style={styles.formBannerTitle}>Editar datos de venta</Text>
                <Text style={styles.formBannerSub}>
                  Actualiza el precio, fecha, categoría y fecha de subida original
                </Text>
              </View>
            </View>

            {/* Precio de venta */}
            <Text style={styles.fieldLbl}>PRECIO DE VENTA *</Text>
            <View style={styles.priceInputRow}>
              <TextInput
                style={styles.priceInput}
                keyboardType="numeric"
                placeholder="0"
                placeholderTextColor={DS.text3}
                value={String(editForm.soldPriceReal)}
                onChangeText={v => setEditForm(prev => ({...prev, soldPriceReal: v}))}
              />
              <Text style={styles.priceEuro}>€</Text>
            </View>

            {/* Fecha real de venta */}
            <Text style={styles.fieldLbl}>FECHA REAL DE VENTA *</Text>
            <TouchableOpacity style={[styles.datePickBtn, {borderColor: DS.success+'50'}]}
              onPress={() => setShowCalSold(true)}>
              <View style={[styles.datePickIcon, {backgroundColor: DS.successLight}]}>
                <Icon name="calendar" size={16} color={DS.success}/>
              </View>
              <View style={{flex:1}}>
                <Text style={styles.datePickVal}>{fmtDateLong(editForm.soldDateReal)}</Text>
                <Text style={styles.datePickHint}>Toca para cambiar</Text>
              </View>
              <Icon name="chevron-right" size={16} color={DS.text3}/>
            </TouchableOpacity>

            {/* Categoría / Subcategoría */}
            <Text style={styles.fieldLbl}>CATEGORÍA / SUBCATEGORÍA</Text>
            <TouchableOpacity style={styles.catSelector} onPress={() => setShowCatModal(true)}>
              <View style={[styles.catSelIcon, {backgroundColor: DS.blueLight}]}>
                <Icon name="tag" size={14} color={DS.blue}/>
              </View>
              <View style={{flex:1}}>
                <Text style={styles.catSelVal}>{editForm.category || 'Sin categoría'}</Text>
                {editForm.subcategory && (
                  <View style={{flexDirection:'row', alignItems:'center', gap:4, marginTop:3}}>
                    <Icon name="corner-down-right" size={10} color={DS.text3}/>
                    <Text style={styles.catSelSub}>{editForm.subcategory}</Text>
                  </View>
                )}
                {!editForm.subcategory && (
                  <Text style={[styles.catSelSub, {color: DS.text3}]}>
                    Toca para seleccionar subcategoría
                  </Text>
                )}
              </View>
              <Icon name="chevron-right" size={16} color={DS.text3}/>
            </TouchableOpacity>

            {/* Tags sugeridos de la cat+sub */}
            {categoryTags.length > 0 && (
              <View style={styles.tagPreview}>
                <Text style={styles.tagPreviewLbl}>
                  Tags de {editForm.category}{editForm.subcategory ? ` › ${editForm.subcategory}` : ''}:
                </Text>
                <View style={styles.tagsCloud}>
                  {categoryTags.map(t => (
                    <View key={t} style={styles.tag}>
                      <Text style={styles.tagTxt}>{t}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* Fecha de subida original */}
            <Text style={styles.fieldLbl}>FECHA DE SUBIDA ORIGINAL</Text>
            <TouchableOpacity style={[styles.datePickBtn, {borderColor: DS.brand+'40'}]}
              onPress={() => setShowCalUpload(true)}>
              <View style={[styles.datePickIcon, {backgroundColor: DS.brandLight}]}>
                <Icon name="upload" size={16} color={DS.brand}/>
              </View>
              <View style={{flex:1}}>
                <Text style={styles.datePickVal}>{fmtDateLong(editForm.firstUploadDate)}</Text>
                <Text style={styles.datePickHint}>Usada para calcular el TTS</Text>
              </View>
              <Icon name="chevron-right" size={16} color={DS.text3}/>
            </TouchableOpacity>
          </View>

          {/* Botón guardar */}
          <TouchableOpacity style={styles.saveBtn} onPress={handleSave} activeOpacity={0.85}>
            <Icon name="check-circle" size={18} color="#FFF"/>
            <Text style={styles.saveBtnTxt}>GUARDAR DATOS DE VENTA</Text>
          </TouchableOpacity>

          <View style={{height: 60}}/>
        </View>
      </ScrollView>

      {/* MODALS */}
      <CalPicker
        visible={showCalSold}
        onClose={() => setShowCalSold(false)}
        value={editForm.soldDateReal}
        onChange={d => setEditForm(prev => ({...prev, soldDateReal: d}))}
        accent={DS.success}
        label="FECHA DE VENTA"
      />

      <CalPicker
        visible={showCalUpload}
        onClose={() => setShowCalUpload(false)}
        value={editForm.firstUploadDate}
        onChange={d => setEditForm(prev => ({...prev, firstUploadDate: d}))}
        accent={DS.brand}
        label="FECHA DE SUBIDA"
      />

      <CategoryModal
        visible={showCatModal}
        onClose={() => setShowCatModal(false)}
        currentCat={editForm.category}
        currentSub={editForm.subcategory}
        onSelect={handleCategorySelect}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container:      {flex:1, backgroundColor: DS.surface2},

  hero:           {height:320, position:'relative'},
  heroImg:        {width, height:320},
  heroPlaceholder:{backgroundColor: DS.surface3, justifyContent:'center', alignItems:'center'},
  backBtn:        {position:'absolute', top: LAYOUT.headerPadT, left: SPACE[5], backgroundColor: DS.white,
                   width:44, height:44, borderRadius:22, justifyContent:'center',
                   alignItems:'center', ...SHADOW.lg},
  soldBadge:      {position:'absolute', bottom: SPACE[5], right: SPACE[5], flexDirection:'row',
                   alignItems:'center', gap: SPACE[2], backgroundColor: DS.success,
                   paddingHorizontal: SPACE[3] + 2, paddingVertical: SPACE[2], borderRadius: RADIUS.full},
  soldBadgeTxt:   {color:'#FFF', fontWeight:'900', fontSize: 12, letterSpacing:0.5},

  contentCard:    {backgroundColor: DS.white, borderTopLeftRadius: RADIUS.xl, borderTopRightRadius: RADIUS.xl,
                   padding: SPACE[6], marginTop: -RADIUS.xl - 4, minHeight:500},

  topRow:         {flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginBottom: SPACE[2]},
  brandTxt:       {...TXT.label, color: DS.brand},
  catPill:        {flexDirection:'row', alignItems:'center', gap: SPACE[1], backgroundColor: DS.blueLight,
                   paddingHorizontal: SPACE[2] + 2, paddingVertical: SPACE[1] + 1, borderRadius: RADIUS.sm},
  catPillTxt:     {fontSize: 10, fontWeight:'800', color: DS.blue},
  catSep:         {fontSize: 10, color: DS.text3},
  titleTxt:       {...TXT.display, fontSize: 21, lineHeight: 27, marginBottom: SPACE[4]},

  ttsPanel:       {flexDirection:'row', backgroundColor: DS.surface2, borderRadius: RADIUS.lg, padding: SPACE[4],
                   marginBottom: SPACE[5], gap:0},
  ttsStat:        {flex:1, alignItems:'center', gap: SPACE[1]},
  ttsDivider:     {width:1, backgroundColor: DS.border, marginVertical: SPACE[1]},
  ttsLbl:         {...TXT.label, fontSize: 8},
  ttsVal:         {fontSize: 18, fontWeight:'900', color: DS.text},

  formCard:       {backgroundColor: DS.surface2, borderRadius: RADIUS.lg, padding: SPACE[5], borderWidth:1,
                   borderColor: DS.border, marginBottom: SPACE[5]},
  formBanner:     {flexDirection:'row', alignItems:'center', gap: SPACE[2] + 2, backgroundColor: DS.successLight,
                   borderRadius: RADIUS.md, padding: SPACE[3] + 2, marginBottom: SPACE[5], borderWidth:1, borderColor: DS.success+'25'},
  formBannerTitle:{fontSize: 11, fontWeight:'900', color: DS.text},
  formBannerSub:  {fontSize: 10, color: DS.text2, marginTop: 2},

  fieldLbl:       {...TXT.label, marginBottom: SPACE[2], marginTop: SPACE[4]},

  priceInputRow:  {flexDirection:'row', alignItems:'center', gap: SPACE[2], backgroundColor: DS.white,
                   borderWidth:2, borderColor: DS.border, borderRadius: RADIUS.lg,
                   paddingHorizontal: SPACE[4], paddingVertical: SPACE[2] + 2, marginBottom: SPACE[1]},
  priceInput:     {flex:1, fontSize: 28, fontWeight:'900', color: DS.text, textAlign:'center', fontFamily: FONT_FAMILY.mono},
  priceEuro:      {fontSize: 22, fontWeight:'900', color: DS.text2},

  datePickBtn:    {flexDirection:'row', alignItems:'center', gap: SPACE[3], backgroundColor: DS.white,
                   borderRadius: RADIUS.lg, padding: SPACE[3] + 2, borderWidth:1, borderColor: DS.border, marginBottom: SPACE[1]},
  datePickIcon:   {width:40, height:40, borderRadius: RADIUS.md, justifyContent:'center', alignItems:'center'},
  datePickVal:    {fontSize: 15, fontWeight:'700', color: DS.text},
  datePickHint:   {fontSize: 10, color: DS.text3, marginTop: 2},

  catSelector:    {flexDirection:'row', alignItems:'center', gap: SPACE[3], backgroundColor: DS.white,
                   borderRadius: RADIUS.lg, padding: SPACE[3] + 2, borderWidth:1, borderColor: DS.border, marginBottom: SPACE[1]},
  catSelIcon:     {width:36, height:36, borderRadius: RADIUS.sm, justifyContent:'center', alignItems:'center'},
  catSelVal:      {fontSize: 15, fontWeight:'800', color: DS.text},
  catSelSub:      {fontSize: 11, color: DS.text2},

  tagPreview:     {backgroundColor: DS.white, borderRadius: RADIUS.md, padding: SPACE[3], marginTop: SPACE[1], marginBottom: SPACE[1]},
  tagPreviewLbl:  {fontSize: 10, color: DS.text2, fontWeight:'700', marginBottom: SPACE[2]},
  tagsCloud:      {flexDirection:'row', flexWrap:'wrap', gap: SPACE[2]},
  tag:            {backgroundColor: DS.blueLight, paddingHorizontal: SPACE[2] + 2, paddingVertical: SPACE[1] + 1, borderRadius: RADIUS.sm},
  tagTxt:         {fontSize: 11, color: DS.blue, fontWeight:'700'},

  saveBtn:        {flexDirection:'row', justifyContent:'center', alignItems:'center',
                   gap: SPACE[2] + 2, backgroundColor: DS.text, padding: SPACE[4] + 2, borderRadius: RADIUS.xl, ...SHADOW.md},
  saveBtnTxt:     {color:'#FFF', fontWeight:'900', fontSize: 15, letterSpacing:0.5},
});