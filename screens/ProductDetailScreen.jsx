import React, { useState, useMemo, useCallback } from 'react';
import {
  View, Text, ScrollView, Image, StyleSheet, Dimensions,
  TouchableOpacity, Alert, TextInput, Modal, FlatList, Platform,
} from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import { DatabaseService } from '../services/DatabaseService';
import LogService, { LOG_CTX } from '../services/LogService';

const { width } = Dimensions.get('window');

// ─── Design System Light Canónico v4.2 ───────────────────────────────────────
const DS = {
  bg:        '#F8F9FA',
  white:     '#FFFFFF',
  surface2:  '#F0F2F5',
  border:    '#EAEDF0',
  primary:   '#FF6B35',
  primaryBg: '#FFF2EE',
  success:   '#00D9A3',
  successBg: '#E8FBF6',
  warning:   '#FFB800',
  warningBg: '#FFF8E0',
  danger:    '#E63946',
  dangerBg:  '#FFEBEC',
  blue:      '#004E89',
  blueBg:    '#EAF2FB',
  purple:    '#6C63FF',
  purpleBg:  '#F0EFFE',
  text:      '#1A1A2E',
  textMed:   '#5C6070',
  textLow:   '#A0A5B5',
  mono:      Platform.OS === 'android' ? 'monospace' : 'Courier New',
};

const fmt  = (iso) => { if (!iso) return '—'; try { return new Date(iso).toLocaleDateString('es-ES', { day:'2-digit', month:'long', year:'numeric' }); } catch { return '—'; } };
const fmtS = (iso) => { if (!iso) return '—'; try { return new Date(iso).toLocaleDateString('es-ES', { day:'2-digit', month:'short', year:'numeric' }); } catch { return '—'; } };

// ─── CalPicker canónico ───────────────────────────────────────────────────────
function CalPicker({ visible, onClose, value, onChange, accent = DS.primary, label }) {
  const [nav, setNav]           = useState(value ? new Date(value) : new Date());
  const [yearMode, setYearMode] = useState(false);
  React.useEffect(() => {
    if (visible) { setNav(value ? new Date(value) : new Date()); setYearMode(false); }
  }, [visible]);
  const yr    = nav.getFullYear(), mo = nav.getMonth(), today = new Date();
  const MONTHS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
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
            <Text style={cS.hdrM}>{MONTHS[mo]}</Text>
            {sel && <Text style={cS.hdrD}>{sel.getDate()} de {MONTHS[sel.getMonth()]}</Text>}
          </View>
          <View style={cS.nav}>
            <TouchableOpacity style={cS.navBtn} onPress={() => setNav(new Date(yr, mo-1, 1))}>
              <Icon name="chevron-left" size={18} color={DS.text}/>
            </TouchableOpacity>
            <TouchableOpacity style={cS.navTitleRow} onPress={() => setYearMode(!yearMode)}>
              <Text style={cS.navT}>{MONTHS[mo].toUpperCase()}</Text>
              <Icon name={yearMode ? 'chevron-up' : 'chevron-down'} size={13} color={DS.textMed}/>
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
            <TouchableOpacity onPress={() => { onChange(new Date().toISOString()); onClose(); }} style={[cS.todayBtn,{borderColor:accent}]}>
              <Text style={[cS.todayTxt,{color:accent}]}>HOY</Text>
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
  overlay:      {flex:1,backgroundColor:'#00000055',justifyContent:'center',alignItems:'center',padding:20},
  card:         {backgroundColor:DS.white,borderRadius:24,width:'100%',overflow:'hidden',elevation:16},
  hdr:          {padding:20,paddingBottom:14},
  hdrLbl:       {fontSize:10,color:'rgba(255,255,255,0.75)',fontWeight:'900',letterSpacing:1.5,textTransform:'uppercase',marginBottom:4},
  hdrY:         {fontSize:12,color:'rgba(255,255,255,0.75)',fontWeight:'700'},
  hdrM:         {fontSize:24,color:'#FFF',fontWeight:'900',lineHeight:28},
  hdrD:         {fontSize:12,color:'rgba(255,255,255,0.85)',marginTop:4},
  nav:          {flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingHorizontal:16,paddingVertical:10},
  navBtn:       {width:34,height:34,borderRadius:17,backgroundColor:DS.bg,justifyContent:'center',alignItems:'center'},
  navTitleRow:  {flexDirection:'row',alignItems:'center',gap:5},
  navT:         {fontSize:13,fontWeight:'900',color:DS.text},
  yearRow:      {flexDirection:'row',flexWrap:'wrap',gap:6,paddingHorizontal:14,paddingBottom:8},
  yChip:        {paddingHorizontal:11,paddingVertical:5,borderRadius:20,backgroundColor:DS.surface2},
  yTxt:         {fontSize:12,color:DS.textMed,fontWeight:'700'},
  wdRow:        {flexDirection:'row',paddingHorizontal:8,marginBottom:4},
  wdTxt:        {flex:1,textAlign:'center',fontSize:10,fontWeight:'900',color:DS.textLow},
  grid:         {flexDirection:'row',flexWrap:'wrap',paddingHorizontal:8},
  cell:         {width:`${100/7}%`,aspectRatio:1,justifyContent:'center',alignItems:'center'},
  cellS:        {borderRadius:20},
  cellT:        {borderRadius:20,borderWidth:1.5},
  dTxt:         {fontSize:13,color:DS.text},
  dTxtS:        {color:'#FFF',fontWeight:'900'},
  foot:         {flexDirection:'row',justifyContent:'flex-end',gap:12,padding:14,borderTopWidth:1,borderTopColor:DS.border},
  todayBtn:     {paddingHorizontal:16,paddingVertical:7,borderRadius:20,borderWidth:1.5},
  todayTxt:     {fontSize:11,fontWeight:'900'},
  cancelBtn:    {paddingHorizontal:14,paddingVertical:7},
  cancelTxt:    {fontSize:11,fontWeight:'700',color:DS.textMed},
});

// ─── Modal Categoría con subcategorías — Sprint 11 ────────────────────────────
// Soporta diccionario completo (cat → subcategorías → tags)
// Paso 1: seleccionar categoría
// Paso 2: seleccionar subcategoría (si la categoría tiene subcategorías configuradas)
function CatModal({ visible, onClose, onSelect, currentCat, currentSub }) {
  const [dict, setDict]     = useState({});
  const [selCat, setSelCat] = useState(currentCat || null);
  const [step, setStep]     = useState('cat');

  React.useEffect(() => {
    if (!visible) return;
    // Cargar diccionario completo (con subcategorías)
    const full = DatabaseService.getFullDictionary() || {};
    if (Object.keys(full).length) {
      setDict(full);
    } else {
      // Fallback: convertir diccionario legacy a formato full
      const leg = DatabaseService.getDictionary();
      const b   = {};
      Object.keys(leg).forEach(k => { b[k] = { tags: leg[k], subcategories: {} }; });
      setDict(b);
    }
    setSelCat(currentCat || null);
    setStep('cat');
  }, [visible, currentCat]);

  const cats    = Object.keys(dict);
  const catData = selCat ? dict[selCat] : null;
  const subs    = catData ? Object.keys(catData.subcategories || {}) : [];
  const hasSubs = (cat) => Object.keys(dict[cat]?.subcategories || {}).length > 0;

  const pickCat = (cat) => {
    if (hasSubs(cat)) {
      setSelCat(cat);
      setStep('sub');
    } else {
      onSelect(cat, null);
      onClose();
    }
  };

  const pickSub = (sub) => {
    const isNone = sub === '__none__';
    onSelect(selCat, isNone ? null : sub);
    onClose();
  };

  const listData = step === 'cat'
    ? cats
    : ['__none__', ...subs];

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={mS.overlay} activeOpacity={1} onPress={onClose}>
        <View style={mS.sheet}>
          <View style={mS.handle}/>

          {/* Cabecera del modal */}
          <View style={mS.header}>
            {step === 'sub' && (
              <TouchableOpacity onPress={() => setStep('cat')} style={mS.backBtn}>
                <Icon name="arrow-left" size={16} color={DS.text}/>
              </TouchableOpacity>
            )}
            <View style={{flex:1}}>
              <Text style={mS.title}>
                {step === 'cat' ? 'Categoría' : selCat}
              </Text>
              {step === 'sub' && (
                <Text style={mS.subtitle}>Selecciona una subcategoría</Text>
              )}
            </View>
            <TouchableOpacity onPress={onClose} style={mS.closeBtn}>
              <Icon name="x" size={16} color={DS.textMed}/>
            </TouchableOpacity>
          </View>

          {/* Selección activa (breadcrumb) */}
          {(currentCat || currentSub) && (
            <View style={mS.currentRow}>
              <Icon name="check-circle" size={12} color={DS.success}/>
              <Text style={mS.currentTxt}>
                Actual: {currentCat}{currentSub ? ` › ${currentSub}` : ''}
              </Text>
            </View>
          )}

          <FlatList
            data={listData}
            keyExtractor={item => item}
            style={{flexGrow: 0, maxHeight: 420}}
            renderItem={({item}) => {
              const isNone    = item === '__none__';
              const label     = isNone ? 'Sin subcategoría' : item;
              const subCount  = step === 'cat' ? Object.keys(dict[item]?.subcategories || {}).length : 0;
              const hasSubsNow= step === 'cat' && subCount > 0;
              const isCurrent = step === 'cat'
                ? item === currentCat
                : (!isNone && item === currentSub) || (isNone && !currentSub);

              // Tags para preview en paso cat
              const previewTags = step === 'cat' && dict[item]?.tags?.slice(0,4) || [];

              return (
                <TouchableOpacity
                  style={[mS.item, isCurrent && mS.itemActive]}
                  onPress={() => step === 'cat' ? pickCat(item) : pickSub(item)}
                  activeOpacity={0.7}
                >
                  <View style={{flex:1}}>
                    <View style={{flexDirection:'row', alignItems:'center', gap:6}}>
                      {isNone && <Icon name="x-circle" size={14} color={DS.textLow}/>}
                      <Text style={[mS.itemTxt, isCurrent && {color:DS.blue, fontWeight:'800'}]}>
                        {label}
                      </Text>
                    </View>

                    {/* Preview de tags (solo en paso cat) */}
                    {previewTags.length > 0 && (
                      <Text style={mS.itemSub} numberOfLines={1}>
                        {previewTags.join(' · ')}
                      </Text>
                    )}

                    {/* Indicador de subcategorías disponibles */}
                    {hasSubsNow && (
                      <Text style={[mS.itemSub, {color: DS.blue}]}>
                        {subCount} subcategor{subCount === 1 ? 'ía' : 'ías'}
                      </Text>
                    )}
                  </View>

                  {/* Indicadores de estado */}
                  {isCurrent && <Icon name="check" size={15} color={DS.blue}/>}
                  {!isCurrent && hasSubsNow && <Icon name="chevron-right" size={15} color={DS.textLow}/>}
                </TouchableOpacity>
              );
            }}
          />
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

const mS = StyleSheet.create({
  overlay:    {flex:1,backgroundColor:'#00000060',justifyContent:'flex-end'},
  sheet:      {backgroundColor:DS.white,borderTopLeftRadius:28,borderTopRightRadius:28,
               paddingHorizontal:20,paddingTop:12,maxHeight:'82%',paddingBottom:34},
  handle:     {width:40,height:4,backgroundColor:DS.border,borderRadius:2,alignSelf:'center',marginBottom:14},
  header:     {flexDirection:'row',alignItems:'center',gap:10,marginBottom:8},
  backBtn:    {width:36,height:36,borderRadius:18,backgroundColor:DS.surface2,
               justifyContent:'center',alignItems:'center'},
  closeBtn:   {width:30,height:30,borderRadius:15,backgroundColor:DS.surface2,
               justifyContent:'center',alignItems:'center'},
  title:      {fontSize:18,fontWeight:'900',color:DS.text},
  subtitle:   {fontSize:11,color:DS.textMed,marginTop:2},
  currentRow: {flexDirection:'row',alignItems:'center',gap:6,backgroundColor:DS.successBg,
               borderRadius:10,padding:8,marginBottom:10},
  currentTxt: {fontSize:11,fontWeight:'700',color:DS.success},
  item:       {flexDirection:'row',alignItems:'center',paddingVertical:13,
               borderBottomWidth:1,borderBottomColor:DS.bg,gap:10},
  itemActive: {backgroundColor:DS.blueBg,paddingHorizontal:10,marginHorizontal:-10,borderRadius:10},
  itemTxt:    {fontSize:15,color:DS.text,fontWeight:'600'},
  itemSub:    {fontSize:10,color:DS.textMed,marginTop:3},
});

// ─── Modal Vendido ────────────────────────────────────────────────────────────
function SoldModal({ visible, onClose, product, onConfirm }) {
  const [price, setPrice] = useState('');
  const [date, setDate]   = useState(new Date().toISOString());
  const [showCal, setCal] = useState(false);
  React.useEffect(() => {
    if (visible) { setPrice(String(product?.price || '')); setDate(new Date().toISOString()); }
  }, [visible]);
  const listed = Number(product?.price || 0);
  const final_ = Number(price) || 0;
  const profit = final_ > 0 ? (final_ - listed).toFixed(2) : null;
  const confirm = () => {
    const p = parseFloat(price);
    if (!price || isNaN(p) || p <= 0) { Alert.alert('Precio requerido', 'Introduce el precio real de venta.'); return; }
    onConfirm(p, date);
  };
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} style={styles.soldSheet}>
          <View style={styles.handle}/>
          <View style={styles.soldHdr}>
            <View style={styles.soldIconWrap}><Icon name="check-circle" size={22} color={DS.success}/></View>
            <View style={{flex:1}}>
              <Text style={styles.soldHdrTitle}>Marcar como Vendido</Text>
              <Text style={styles.soldHdrSub} numberOfLines={1}>{product?.title}</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.modalCloseBtn}>
              <Icon name="x" size={16} color={DS.textMed}/>
            </TouchableOpacity>
          </View>
          <View style={styles.soldBody}>
            <View style={styles.soldPriceRow}>
              <View style={[styles.soldPriceCard, {backgroundColor: DS.surface2}]}>
                <Text style={styles.soldPriceLbl}>PRECIO PUBLICADO</Text>
                <Text style={styles.soldPriceVal}>{listed}€</Text>
              </View>
              {profit !== null && (
                <View style={[styles.soldPriceCard, {backgroundColor: Number(profit) >= 0 ? DS.successBg : DS.dangerBg}]}>
                  <Text style={styles.soldPriceLbl}>DIFERENCIA</Text>
                  <Text style={[styles.soldPriceVal, {color: Number(profit) >= 0 ? DS.success : DS.danger}]}>
                    {Number(profit) >= 0 ? '+' : ''}{profit}€
                  </Text>
                </View>
              )}
            </View>
            <Text style={styles.soldFieldLbl}>PRECIO REAL DE VENTA (€) *</Text>
            <View style={[styles.soldInputRow, price && {borderColor: DS.success}]}>
              <TextInput
                value={price} onChangeText={setPrice}
                placeholder={String(listed)} placeholderTextColor={DS.textLow}
                keyboardType="decimal-pad" style={styles.soldInput} autoFocus
              />
              <Text style={styles.soldInputEuro}>€</Text>
            </View>
            <Text style={styles.soldFieldLbl}>FECHA DE VENTA</Text>
            <TouchableOpacity style={styles.soldDateRow} onPress={() => setCal(true)}>
              <Icon name="calendar" size={15} color={DS.success}/>
              <Text style={styles.soldDateTxt}>{fmtS(date)}</Text>
              <Icon name="edit-2" size={12} color={DS.textLow}/>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.soldConfirm, !price && {backgroundColor: DS.textLow}]}
              onPress={confirm} disabled={!price}
            >
              <Icon name="check" size={17} color="#FFF"/>
              <Text style={styles.soldConfirmTxt}>CONFIRMAR VENTA</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
      <CalPicker visible={showCal} onClose={() => setCal(false)} value={date}
        onChange={setDate} accent={DS.success} label="FECHA DE VENTA"/>
    </Modal>
  );
}

// ─── Pantalla Principal ───────────────────────────────────────────────────────
export default function ProductDetailScreen({ route, navigation }) {
  const { product: init } = route.params || {};
  const [product, setProduct]         = useState(init);
  const [isEditing, setEditing]       = useState(false);
  const [showCal, setShowCal]         = useState(false);
  const [showCatModal, setCatModal]   = useState(false);
  const [showSoldModal, setSoldModal] = useState(false);

  const [editForm, setEditForm] = useState(() => ({
    ...init,
    category:        init?.category        || 'Otros',
    subcategory:     init?.subcategory     || null,
    firstUploadDate: init?.firstUploadDate || init?.createdAt || new Date().toISOString(),
    priceHistory:    init?.priceHistory    || [],
  }));

  const cfg = DatabaseService.getConfig();

  const statusInfo = useMemo(() => {
    const now = new Date(), up = new Date(product.firstUploadDate || product.createdAt);
    const d   = Math.max(0, Math.floor((now - up) / 86400000));
    return {
      daysOld: d,
      isHot:   (product.views > parseInt(cfg.hotViews || 50) || product.favorites > parseInt(cfg.hotFavs || 10)) && d < parseInt(cfg.hotDays || 30),
      isCold:  d >= parseInt(cfg.daysDesinterest || 45),
      isCrit:  d >= parseInt(cfg.daysCritical    || 90),
    };
  }, [product]);

  // Tags de categoría (combina cat + subcat del diccionario)
  const catTags = useMemo(() => {
    const full = DatabaseService.getFullDictionary() || {};
    const catD = full[editForm.category || product.category];
    if (!catD) return [];
    const sk  = editForm.subcategory || product.subcategory;
    const st  = sk ? (catD.subcategories?.[sk]?.tags || []) : [];
    return [...new Set([...(catD.tags || []), ...st])].slice(0, 12);
  }, [editForm.category, editForm.subcategory, product.category, product.subcategory]);

  const handleSave = useCallback(() => {
    const span = LogService.span(`Guardar ${product.id}`, LOG_CTX.UI);
    const up   = {...editForm};
    if (!up.firstUploadDate) up.firstUploadDate = product.createdAt || new Date().toISOString();
    if (DatabaseService.updateProduct(up)) {
      setProduct(up);
      setEditing(false);
      span.end({});
    } else {
      span.fail(new Error('false'));
      Alert.alert('Error', 'No se pudo guardar.');
    }
  }, [editForm, product]);

  const handleSold = (soldPrice, soldDateReal) => {
    if (DatabaseService.markAsSold(product.id, soldPrice, soldDateReal, false)) {
      const up = {...product, status:'sold', soldPriceReal: soldPrice, soldDateReal};
      setProduct(up);
      setSoldModal(false);
      LogService.success(`Vendido: "${product.title}" por ${soldPrice}€`, LOG_CTX.UI, {id: product.id});
      Alert.alert('¡Vendido! 🎉', `"${product.title}" marcado por ${soldPrice}€.`, [
        {text: 'Ver historial', onPress: () => navigation.navigate('History')},
        {text: 'OK'},
      ]);
    }
  };

  const sC = statusInfo.isCrit ? DS.danger : statusInfo.isCold ? DS.warning : statusInfo.isHot ? DS.danger : DS.success;
  const sL = statusInfo.isCrit ? '🔥 CRÍTICO' : statusInfo.isCold ? '⏱️ FRÍO' : statusInfo.isHot ? '⚡ HOT' : '✅ OK';

  // ─── Vista de producto ────────────────────────────────────────────────────
  const renderView = () => (
    <>
      {/* Marca + Categoría */}
      <View style={styles.topRow}>
        <Text style={styles.brandTxt}>{product.brand || 'Sin marca'}</Text>
        {(product.category || product.subcategory) && (
          <View style={styles.catPill}>
            <Icon name="tag" size={9} color={DS.blue}/>
            <Text style={styles.catPillTxt}>{product.category || ''}</Text>
            {product.subcategory && (
              <>
                <Text style={styles.catSep}>›</Text>
                <Text style={[styles.catPillTxt, {color: DS.textMed}]}>{product.subcategory}</Text>
              </>
            )}
          </View>
        )}
      </View>

      {/* Título + Precio */}
      <View style={styles.titleRow}>
        <Text style={styles.titleTxt} numberOfLines={3}>{product.title}</Text>
        <View style={styles.pricePill}>
          <Text style={styles.pricePillTxt}>{product.price}€</Text>
        </View>
      </View>

      {/* Bundle badge */}
      {product.isBundle && (
        <View style={styles.bundleBadge}>
          <Icon name="package" size={11} color={DS.purple}/>
          <Text style={styles.bundleTxt}>VENTA EN LOTE</Text>
        </View>
      )}

      {/* Semáforo de estado */}
      <View style={[styles.statusBar, {borderColor: sC+'40', backgroundColor: sC+'0E'}]}>
        <View style={[styles.statusDot, {backgroundColor: sC}]}/>
        <Text style={[styles.statusLbl, {color: sC}]}>{sL}</Text>
        <Text style={styles.statusDays}>{statusInfo.daysOld} días en Vinted</Text>
        {product.repostCount > 0 && (
          <View style={styles.repostChip}>
            <Icon name="refresh-cw" size={9} color={DS.blue}/>
            <Text style={styles.repostTxt}>{product.repostCount}× resubido</Text>
          </View>
        )}
      </View>

      {/* Stats */}
      <View style={styles.statsRow}>
        {[
          {icon:'eye',   lbl:'VISTAS',   val: product.views     || 0, c: DS.blue},
          {icon:'heart', lbl:'FAVS',     val: product.favorites || 0, c: DS.danger},
          {icon:'clock', lbl:'DÍAS',     val: statusInfo.daysOld,     c: sC},
        ].map(s => (
          <View key={s.lbl} style={styles.statCard}>
            <Icon name={s.icon} size={16} color={s.c}/>
            <Text style={[styles.statVal, {color: s.c}]}>{s.val}</Text>
            <Text style={styles.statLbl}>{s.lbl}</Text>
          </View>
        ))}
      </View>

      {/* Historial de precio */}
      {product.priceHistory?.length > 0 && (
        <View style={styles.histBox}>
          <View style={styles.histHdr}>
            <Icon name="trending-down" size={11} color={DS.primary}/>
            <Text style={styles.histLbl}>HISTORIAL DE PRECIO</Text>
          </View>
          {product.priceHistory.slice(-3).map((h, i) => (
            <View key={i} style={styles.histRow}>
              <Text style={styles.histTxt}>{h.oldPrice}€ → {h.newPrice || h.price}€</Text>
              <Text style={styles.histDate}>{fmtS(h.date)}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Fecha de subida */}
      <View style={styles.dateBar}>
        <View style={[styles.dateIcon, {backgroundColor: DS.primaryBg}]}>
          <Icon name="upload" size={13} color={DS.primary}/>
        </View>
        <View>
          <Text style={styles.dateLbl}>Fecha de subida original</Text>
          <Text style={styles.dateVal}>{fmt(product.firstUploadDate || product.createdAt)}</Text>
        </View>
      </View>

      {/* Tags de categoría */}
      {catTags.length > 0 && (
        <View style={styles.tagsSection}>
          <Text style={styles.sectionLabel}>TAGS DE CATEGORÍA</Text>
          <View style={styles.tagsCloud}>
            {catTags.map(t => (
              <View key={t} style={styles.tag}>
                <Text style={styles.tagTxt}>{t}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Descripción */}
      <Text style={styles.sectionLabel}>DESCRIPCIÓN</Text>
      <Text style={styles.descTxt}>{product.description || 'Sin descripción'}</Text>

      {/* Acciones */}
      <View style={styles.actionsRow}>
        <TouchableOpacity style={styles.btnEdit} onPress={() => setEditing(true)}>
          <Icon name="edit-3" size={16} color={DS.text}/>
          <Text style={styles.btnEditTxt}>Editar</Text>
        </TouchableOpacity>
        {product.status !== 'sold' ? (
          <TouchableOpacity style={styles.btnVendido} onPress={() => setSoldModal(true)}>
            <Icon name="check-circle" size={16} color="#FFF"/>
            <Text style={styles.btnVendidoTxt}>VENDIDO</Text>
          </TouchableOpacity>
        ) : (
          <View style={[styles.btnEdit, {backgroundColor: DS.successBg, flex:2, borderColor: DS.success+'40'}]}>
            <Icon name="check-circle" size={16} color={DS.success}/>
            <Text style={[styles.btnEditTxt, {color: DS.success}]}>Ya vendido</Text>
          </View>
        )}
      </View>
    </>
  );

  // ─── Formulario de edición ────────────────────────────────────────────────
  const renderEdit = () => (
    <>
      <View style={styles.editBanner}>
        <Icon name="edit-3" size={16} color={DS.primary}/>
        <View style={{flex:1}}>
          <Text style={styles.editTitle}>Editar datos permanentes</Text>
          <Text style={styles.editSub}>Se conservan al importar JSON de Vinted</Text>
        </View>
      </View>

      {/* Categoría / Subcategoría */}
      <Text style={styles.sectionLabel}>CATEGORÍA / SUBCATEGORÍA</Text>
      <TouchableOpacity style={styles.catSelector} onPress={() => setCatModal(true)}>
        <View style={[styles.catSelIcon, {backgroundColor: DS.blueBg}]}>
          <Icon name="tag" size={14} color={DS.blue}/>
        </View>
        <View style={{flex:1}}>
          <Text style={styles.catSelVal}>{editForm.category || 'Sin categoría'}</Text>
          {editForm.subcategory && (
            <Text style={styles.catSelSub}>
              <Icon name="corner-down-right" size={10} color={DS.textLow}/> {editForm.subcategory}
            </Text>
          )}
          {!editForm.subcategory && (
            <Text style={[styles.catSelSub, {color: DS.textLow}]}>Toca para seleccionar subcategoría</Text>
          )}
        </View>
        <Icon name="chevron-right" size={16} color={DS.textLow}/>
      </TouchableOpacity>

      {/* Preview de tags */}
      {(() => {
        const full = DatabaseService.getFullDictionary() || {};
        const catD = full[editForm.category];
        const subD = editForm.subcategory ? catD?.subcategories?.[editForm.subcategory] : null;
        const tags = [...new Set([...(catD?.tags || []), ...(subD?.tags || [])])].slice(0, 10);
        if (!tags.length) return null;
        return (
          <View style={styles.tagPreview}>
            <Text style={styles.tagPreviewLbl}>
              Tags de {editForm.category}{editForm.subcategory ? ` › ${editForm.subcategory}` : ''}:
            </Text>
            <View style={styles.tagsCloud}>
              {tags.map(t => (
                <View key={t} style={styles.tag}>
                  <Text style={styles.tagTxt}>{t}</Text>
                </View>
              ))}
            </View>
          </View>
        );
      })()}

      {/* Fecha de subida */}
      <Text style={[styles.sectionLabel, {marginTop:16}]}>FECHA DE SUBIDA ORIGINAL</Text>
      <TouchableOpacity style={styles.datePickBtn} onPress={() => setShowCal(true)}>
        <View style={[styles.datePickIcon, {backgroundColor: DS.primaryBg}]}>
          <Icon name="calendar" size={16} color={DS.primary}/>
        </View>
        <View style={{flex:1}}>
          <Text style={styles.datePickVal}>{fmt(editForm.firstUploadDate)}</Text>
          <Text style={styles.datePickHint}>Usada para calcular el TTS</Text>
        </View>
        <Icon name="chevron-right" size={16} color={DS.textLow}/>
      </TouchableOpacity>

      {/* Botones */}
      <View style={styles.editActions}>
        <TouchableOpacity style={styles.btnSave} onPress={handleSave}>
          <Icon name="save" size={15} color="#FFF"/>
          <Text style={styles.btnSaveTxt}>Guardar cambios</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.btnCancel} onPress={() => setEditing(false)}>
          <Text style={styles.btnCancelTxt}>Cancelar</Text>
        </TouchableOpacity>
      </View>
    </>
  );

  return (
    <View style={styles.container}>
      {/* Modales */}
      <SoldModal visible={showSoldModal} onClose={() => setSoldModal(false)}
        product={product} onConfirm={handleSold}/>
      <CatModal visible={showCatModal} onClose={() => setCatModal(false)}
        currentCat={editForm.category} currentSub={editForm.subcategory}
        onSelect={(cat, sub) => setEditForm(f => ({...f, category: cat, subcategory: sub}))}/>
      <CalPicker visible={showCal} onClose={() => setShowCal(false)}
        value={editForm.firstUploadDate}
        onChange={iso => setEditForm(f => ({...f, firstUploadDate: iso}))}
        accent={DS.primary} label="FECHA DE SUBIDA ORIGINAL"/>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Hero */}
        <View style={styles.hero}>
          {product.images?.[0]
            ? <Image source={{uri: product.images[0]}} style={styles.heroImg} resizeMode="cover"/>
            : <View style={[styles.heroImg, styles.heroPlaceholder]}>
                <Icon name="image" size={52} color={DS.textLow}/>
              </View>
          }
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Icon name="arrow-left" size={20} color={DS.text}/>
          </TouchableOpacity>
          <View style={[styles.heroBadge, {backgroundColor: sC}]}>
            <Text style={styles.heroBadgeTxt}>{sL}</Text>
          </View>
        </View>

        {/* Contenido */}
        <View style={styles.contentCard}>
          {isEditing ? renderEdit() : renderView()}
          <View style={{height: 60}}/>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container:      {flex:1, backgroundColor: DS.bg},

  // Hero
  hero:           {height:320, position:'relative'},
  heroImg:        {width, height:320},
  heroPlaceholder:{backgroundColor: DS.border, justifyContent:'center', alignItems:'center'},
  backBtn:        {position:'absolute', top:52, left:20, backgroundColor: DS.white,
                   width:44, height:44, borderRadius:22, justifyContent:'center',
                   alignItems:'center', elevation:6},
  heroBadge:      {position:'absolute', bottom:20, right:20, paddingHorizontal:14,
                   paddingVertical:7, borderRadius:20},
  heroBadgeTxt:   {color:'#FFF', fontWeight:'900', fontSize:12, letterSpacing:0.4},

  // Content card
  contentCard:    {backgroundColor: DS.white, borderTopLeftRadius:28, borderTopRightRadius:28,
                   padding:24, marginTop:-28, minHeight:500},

  // Fila superior
  topRow:         {flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginBottom:10},
  brandTxt:       {fontSize:11, fontWeight:'900', color: DS.primary, letterSpacing:1.2, textTransform:'uppercase'},
  catPill:        {flexDirection:'row', alignItems:'center', gap:4, backgroundColor: DS.blueBg,
                   paddingHorizontal:10, paddingVertical:5, borderRadius:10},
  catPillTxt:     {fontSize:10, fontWeight:'800', color: DS.blue},
  catSep:         {fontSize:10, color: DS.textLow},

  // Título + precio
  titleRow:       {flexDirection:'row', alignItems:'flex-start', gap:10, marginBottom:10},
  titleTxt:       {flex:1, fontSize:21, fontWeight:'900', color: DS.text, lineHeight:27},
  pricePill:      {backgroundColor: DS.primary, paddingHorizontal:14, paddingVertical:8, borderRadius:14},
  pricePillTxt:   {color:'#FFF', fontWeight:'900', fontSize:16},

  // Bundle
  bundleBadge:    {flexDirection:'row', alignItems:'center', gap:6, backgroundColor: DS.purpleBg,
                   paddingHorizontal:10, paddingVertical:5, borderRadius:10,
                   alignSelf:'flex-start', marginBottom:10},
  bundleTxt:      {fontSize:10, fontWeight:'900', color: DS.purple},

  // Semáforo
  statusBar:      {flexDirection:'row', alignItems:'center', gap:8, borderWidth:1,
                   borderRadius:14, padding:12, marginBottom:14},
  statusDot:      {width:8, height:8, borderRadius:4},
  statusLbl:      {fontSize:12, fontWeight:'900'},
  statusDays:     {fontSize:11, color: DS.textMed, marginLeft:'auto'},
  repostChip:     {flexDirection:'row', alignItems:'center', gap:4, backgroundColor: DS.blueBg,
                   paddingHorizontal:7, paddingVertical:3, borderRadius:8},
  repostTxt:      {fontSize:9, fontWeight:'800', color: DS.blue},

  // Stats
  statsRow:       {flexDirection:'row', gap:10, marginBottom:14},
  statCard:       {flex:1, backgroundColor: DS.bg, borderRadius:16, padding:12,
                   alignItems:'center', gap:4},
  statVal:        {fontSize:20, fontWeight:'900', fontFamily: DS.mono},
  statLbl:        {fontSize:8, fontWeight:'900', color: DS.textLow, letterSpacing:1},

  // Historial precio
  histBox:        {backgroundColor: DS.primaryBg, borderRadius:14, padding:14,
                   marginBottom:14, borderWidth:1, borderColor: DS.primary+'25'},
  histHdr:        {flexDirection:'row', alignItems:'center', gap:6, marginBottom:8},
  histLbl:        {fontSize:9, fontWeight:'900', color: DS.primary, letterSpacing:1.2},
  histRow:        {flexDirection:'row', justifyContent:'space-between', paddingVertical:3},
  histTxt:        {fontSize:12, fontWeight:'700', color: DS.text},
  histDate:       {fontSize:10, color: DS.textMed},

  // Fecha bar
  dateBar:        {flexDirection:'row', alignItems:'center', gap:12, backgroundColor: DS.bg,
                   borderRadius:14, padding:12, marginBottom:14},
  dateIcon:       {width:36, height:36, borderRadius:10, justifyContent:'center', alignItems:'center'},
  dateLbl:        {fontSize:10, color: DS.textMed, marginBottom:2},
  dateVal:        {fontSize:13, fontWeight:'800', color: DS.text},

  // Tags
  tagsSection:    {marginBottom:14},
  tagsCloud:      {flexDirection:'row', flexWrap:'wrap', gap:7, marginTop:6},
  tag:            {backgroundColor: DS.blueBg, paddingHorizontal:10, paddingVertical:5, borderRadius:10},
  tagTxt:         {fontSize:11, color: DS.blue, fontWeight:'700'},

  // Descripción
  sectionLabel:   {fontSize:10, fontWeight:'900', color: DS.textLow, letterSpacing:1.5,
                   textTransform:'uppercase', marginBottom:6, marginTop:14},
  descTxt:        {fontSize:14, color: DS.textMed, lineHeight:22, marginBottom:16},

  // Acciones
  actionsRow:     {flexDirection:'row', gap:10, marginTop:16},
  btnEdit:        {flex:1, flexDirection:'row', alignItems:'center', justifyContent:'center',
                   gap:8, backgroundColor: DS.bg, borderWidth:1, borderColor: DS.border,
                   paddingVertical:15, borderRadius:18},
  btnEditTxt:     {fontSize:13, fontWeight:'800', color: DS.text},
  btnVendido:     {flex:2, flexDirection:'row', alignItems:'center', justifyContent:'center',
                   gap:8, backgroundColor: DS.success, paddingVertical:15, borderRadius:18},
  btnVendidoTxt:  {fontSize:13, fontWeight:'900', color:'#FFF', letterSpacing:0.5},

  // Edición
  editBanner:     {flexDirection:'row', alignItems:'center', gap:12, backgroundColor: DS.primaryBg,
                   borderRadius:16, padding:14, marginBottom:16, borderWidth:1, borderColor: DS.primary+'20'},
  editTitle:      {fontSize:15, fontWeight:'900', color: DS.text},
  editSub:        {fontSize:11, color: DS.textMed, marginTop:2},
  catSelector:    {flexDirection:'row', alignItems:'center', gap:12, backgroundColor: DS.white,
                   borderRadius:16, padding:14, borderWidth:1, borderColor: DS.border, marginBottom:4},
  catSelIcon:     {width:36, height:36, borderRadius:10, justifyContent:'center', alignItems:'center'},
  catSelVal:      {fontSize:15, fontWeight:'800', color: DS.text},
  catSelSub:      {fontSize:11, color: DS.textMed, marginTop:2},
  tagPreview:     {backgroundColor: DS.bg, borderRadius:14, padding:12, marginTop:4, marginBottom:4},
  tagPreviewLbl:  {fontSize:10, color: DS.textMed, fontWeight:'700', marginBottom:6},
  datePickBtn:    {flexDirection:'row', alignItems:'center', gap:12, backgroundColor: DS.white,
                   borderRadius:16, padding:14, borderWidth:1, borderColor: DS.border, marginBottom:4},
  datePickIcon:   {width:40, height:40, borderRadius:12, justifyContent:'center', alignItems:'center'},
  datePickVal:    {fontSize:15, fontWeight:'700', color: DS.text},
  datePickHint:   {fontSize:10, color: DS.textLow, marginTop:2},
  editActions:    {flexDirection:'row', gap:10, marginTop:24},
  btnSave:        {flex:2, flexDirection:'row', justifyContent:'center', alignItems:'center',
                   gap:8, backgroundColor: DS.text, padding:16, borderRadius:18},
  btnSaveTxt:     {color:'#FFF', fontWeight:'900', fontSize:14},
  btnCancel:      {flex:1, justifyContent:'center', alignItems:'center', backgroundColor: DS.bg,
                   borderWidth:1, borderColor: DS.border, padding:16, borderRadius:18},
  btnCancelTxt:   {color: DS.textMed, fontWeight:'800'},

  // Modal overlay
  modalOverlay:   {flex:1, backgroundColor:'#00000060', justifyContent:'flex-end'},
  modalCloseBtn:  {width:30, height:30, borderRadius:15, backgroundColor: DS.bg,
                   justifyContent:'center', alignItems:'center'},
  handle:         {width:40, height:4, backgroundColor: DS.border, borderRadius:2,
                   alignSelf:'center', marginBottom:14},

  // Sold modal
  soldSheet:      {backgroundColor: DS.white, borderTopLeftRadius:28, borderTopRightRadius:28,
                   paddingBottom:30},
  soldHdr:        {flexDirection:'row', alignItems:'center', gap:12, padding:20,
                   backgroundColor: DS.successBg, borderTopLeftRadius:28, borderTopRightRadius:28,
                   borderBottomWidth:1, borderBottomColor: DS.success+'25'},
  soldIconWrap:   {width:44, height:44, borderRadius:22, backgroundColor:'#FFF',
                   justifyContent:'center', alignItems:'center'},
  soldHdrTitle:   {fontSize:17, fontWeight:'900', color: DS.text},
  soldHdrSub:     {fontSize:12, color: DS.textMed, marginTop:2},
  soldBody:       {padding:20},
  soldPriceRow:   {flexDirection:'row', gap:10, marginBottom:20},
  soldPriceCard:  {flex:1, borderRadius:14, padding:12},
  soldPriceLbl:   {fontSize:8, fontWeight:'900', color: DS.textLow, letterSpacing:1, marginBottom:4},
  soldPriceVal:   {fontSize:20, fontWeight:'900', color: DS.text, fontFamily: DS.mono},
  soldFieldLbl:   {fontSize:9, fontWeight:'900', color: DS.textLow, letterSpacing:1.5,
                   textTransform:'uppercase', marginBottom:8},
  soldInputRow:   {flexDirection:'row', alignItems:'center', gap:8, backgroundColor: DS.bg,
                   borderWidth:2, borderColor: DS.border, borderRadius:16,
                   paddingHorizontal:16, paddingVertical:10, marginBottom:16},
  soldInput:      {flex:1, fontSize:28, fontWeight:'900', color: DS.text,
                   fontFamily: DS.mono, textAlign:'center'},
  soldInputEuro:  {fontSize:22, fontWeight:'900', color: DS.textMed},
  soldDateRow:    {flexDirection:'row', alignItems:'center', gap:10, backgroundColor: DS.bg,
                   borderRadius:14, padding:14, marginBottom:20,
                   borderWidth:1, borderColor: DS.border},
  soldDateTxt:    {flex:1, fontSize:14, fontWeight:'700', color: DS.text},
  soldConfirm:    {flexDirection:'row', alignItems:'center', justifyContent:'center',
                   gap:10, backgroundColor: DS.success, borderRadius:18, padding:18},
  soldConfirmTxt: {color:'#FFF', fontWeight:'900', fontSize:15, letterSpacing:0.5},
});
