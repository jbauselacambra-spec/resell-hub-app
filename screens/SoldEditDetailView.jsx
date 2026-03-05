import React, { useState, useMemo, useEffect } from 'react';
import {
  View, Text, ScrollView, Image, StyleSheet, Dimensions,
  TouchableOpacity, TextInput, Modal, Alert, FlatList, Platform,
} from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import { DatabaseService } from '../services/DatabaseService';
import LogService, { LOG_CTX } from '../services/LogService';

const { width } = Dimensions.get('window');

// ─── Design System Light — Canónico ResellHub ────────────────────────────────
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
  danger:    '#E63946',
  blue:      '#004E89',
  blueBg:    '#EAF2FB',
  purple:    '#6C63FF',
  text:      '#1A1A2E',
  textMed:   '#5C6070',
  textLow:   '#A0A5B5',
  mono:      Platform.OS === 'android' ? 'monospace' : 'Courier New',
};

const fmt  = (iso) => { if (!iso) return '—'; try { return new Date(iso).toLocaleDateString('es-ES', { day:'2-digit', month:'long', year:'numeric' }); } catch { return '—'; } };
const fmtS = (iso) => { if (!iso) return '—'; try { return new Date(iso).toLocaleDateString('es-ES', { day:'2-digit', month:'short', year:'numeric' }); } catch { return '—'; } };

// ─── Calendario mejorado (mismo que ProductDetailScreen) ─────────────────────
function CalPicker({ visible, onClose, value, onChange, accent = DS.primary, label }) {
  const [nav, setNav]           = useState(value ? new Date(value) : new Date());
  const [yearMode, setYearMode] = useState(false);
  useEffect(() => {
    if (visible) { setNav(value ? new Date(value) : new Date()); setYearMode(false); }
  }, [visible]);

  const yr    = nav.getFullYear();
  const mo    = nav.getMonth();
  const today = new Date();
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
          {/* Header coloreado */}
          <View style={[cS.hdr, {backgroundColor: accent}]}>
            {label && <Text style={cS.hdrLbl}>{label}</Text>}
            <Text style={cS.hdrY}>{yr}</Text>
            <Text style={cS.hdrM}>{MONTHS[mo]}</Text>
            {sel && <Text style={cS.hdrD}>{sel.getDate()} de {MONTHS[sel.getMonth()]} de {sel.getFullYear()}</Text>}
          </View>
          {/* Navegación mes */}
          <View style={cS.nav}>
            <TouchableOpacity style={cS.navBtn} onPress={() => setNav(new Date(yr, mo-1, 1))}>
              <Icon name="chevron-left" size={18} color={DS.text}/>
            </TouchableOpacity>
            <TouchableOpacity style={cS.navTitleRow} onPress={() => setYearMode(!yearMode)}>
              <Text style={cS.navT}>{MONTHS[mo].toUpperCase()} {yr}</Text>
              <Icon name={yearMode ? 'chevron-up' : 'chevron-down'} size={13} color={DS.textMed}/>
            </TouchableOpacity>
            <TouchableOpacity style={cS.navBtn} onPress={() => setNav(new Date(yr, mo+1, 1))}>
              <Icon name="chevron-right" size={18} color={DS.text}/>
            </TouchableOpacity>
          </View>
          {/* Selector de año */}
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
          {/* Días semana */}
          <View style={cS.wdRow}>
            {WD.map(d => <Text key={d} style={cS.wdTxt}>{d}</Text>)}
          </View>
          {/* Grid días */}
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
          {/* Pie */}
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
  overlay:      {flex:1,backgroundColor:'#00000055',justifyContent:'center',alignItems:'center',padding:20},
  card:         {backgroundColor:DS.white,borderRadius:24,width:'100%',overflow:'hidden',elevation:16},
  hdr:          {padding:20,paddingBottom:14},
  hdrLbl:       {fontSize:10,color:'rgba(255,255,255,0.7)',fontWeight:'900',letterSpacing:1.5,textTransform:'uppercase',marginBottom:6},
  hdrY:         {fontSize:12,color:'rgba(255,255,255,0.75)',fontWeight:'700'},
  hdrM:         {fontSize:24,color:'#FFF',fontWeight:'900',lineHeight:28},
  hdrD:         {fontSize:13,color:'rgba(255,255,255,0.9)',marginTop:4,fontWeight:'600'},
  nav:          {flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingHorizontal:16,paddingVertical:12},
  navBtn:       {width:34,height:34,borderRadius:17,backgroundColor:DS.bg,justifyContent:'center',alignItems:'center'},
  navTitleRow:  {flexDirection:'row',alignItems:'center',gap:5},
  navT:         {fontSize:13,fontWeight:'900',color:DS.text},
  yearRow:      {flexDirection:'row',flexWrap:'wrap',gap:6,paddingHorizontal:14,paddingBottom:10},
  yChip:        {paddingHorizontal:12,paddingVertical:6,borderRadius:20,backgroundColor:DS.surface2},
  yTxt:         {fontSize:12,color:DS.textMed,fontWeight:'700'},
  wdRow:        {flexDirection:'row',paddingHorizontal:8,marginBottom:4},
  wdTxt:        {flex:1,textAlign:'center',fontSize:10,fontWeight:'900',color:DS.textLow},
  grid:         {flexDirection:'row',flexWrap:'wrap',paddingHorizontal:8,paddingBottom:4},
  cell:         {width:`${100/7}%`,aspectRatio:1,justifyContent:'center',alignItems:'center'},
  cellS:        {borderRadius:22},
  cellT:        {borderRadius:22,borderWidth:1.5},
  dTxt:         {fontSize:14,color:DS.text},
  dTxtS:        {color:'#FFF',fontWeight:'900'},
  foot:         {flexDirection:'row',justifyContent:'flex-end',gap:12,padding:14,borderTopWidth:1,borderTopColor:DS.border,alignItems:'center'},
  todayBtn:     {flexDirection:'row',alignItems:'center',paddingHorizontal:16,paddingVertical:8,borderRadius:20,borderWidth:1.5},
  todayTxt:     {fontSize:11,fontWeight:'900'},
  cancelBtn:    {paddingHorizontal:14,paddingVertical:8},
  cancelTxt:    {fontSize:11,fontWeight:'700',color:DS.textMed},
});

// ─── Modal Categoría ─────────────────────────────────────────────────────────
function CategoryModal({ visible, onClose, onSelect, currentCat, currentSub }) {
  const [dict, setDict]     = useState({});
  const [selCat, setSelCat] = useState(currentCat || null);
  const [step, setStep]     = useState('cat');

  useEffect(() => {
    if (visible) {
      const full = DatabaseService.getFullDictionary() || {};
      if (Object.keys(full).length) { setDict(full); }
      else {
        const leg = DatabaseService.getDictionary();
        const b   = {};
        Object.keys(leg).forEach(k => { b[k] = { tags: leg[k], subcategories: {} }; });
        setDict(b);
      }
      setSelCat(currentCat || null);
      setStep('cat');
    }
  }, [visible, currentCat]);

  const cats    = Object.keys(dict);
  const catData = selCat ? dict[selCat] : null;
  const subs    = catData ? Object.keys(catData.subcategories || {}) : [];
  const handleCatSelect = (cat) => {
    if (Object.keys(dict[cat]?.subcategories || {}).length > 0) { setSelCat(cat); setStep('sub'); }
    else { onSelect(cat, null); onClose(); }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={mS.overlay} activeOpacity={1} onPress={onClose}>
        <View style={mS.sheet}>
          <View style={mS.handle}/>
          <View style={mS.header}>
            {step==='sub' && (
              <TouchableOpacity onPress={()=>setStep('cat')} style={mS.backBtn}>
                <Icon name="arrow-left" size={16} color={DS.text}/>
              </TouchableOpacity>
            )}
            <Text style={mS.title}>{step==='cat' ? 'Categoría' : `${selCat} — Subcategoría`}</Text>
            <TouchableOpacity onPress={onClose} style={mS.closeBtn}>
              <Icon name="x" size={16} color={DS.textMed}/>
            </TouchableOpacity>
          </View>
          <FlatList
            data={step==='cat' ? cats : ['Sin subcategoría', ...subs]}
            keyExtractor={i => i}
            renderItem={({item}) => {
              const isNone = item==='Sin subcategoría';
              const isCurr = step==='cat' ? item===currentCat : (!isNone&&item===currentSub)||(isNone&&!currentSub);
              const hasSubs = step==='cat' && Object.keys(dict[item]?.subcategories||{}).length>0;
              return (
                <TouchableOpacity style={[mS.item, isCurr&&mS.itemActive]}
                  onPress={()=>step==='cat'?handleCatSelect(item):(onSelect(selCat,isNone?null:item),onClose())}>
                  <View style={{flex:1}}>
                    <Text style={[mS.itemTxt, isCurr&&{color:DS.blue,fontWeight:'800'}]}>{item}</Text>
                    {step==='cat'&&dict[item]?.tags?.length>0&&<Text style={mS.itemSub} numberOfLines={1}>{dict[item].tags.slice(0,5).join(' · ')}</Text>}
                    {hasSubs&&<Text style={[mS.itemSub,{color:DS.blue}]}>{Object.keys(dict[item].subcategories).length} subcategorías</Text>}
                  </View>
                  {isCurr&&<Icon name="check" size={15} color={DS.blue}/>}
                  {hasSubs&&<Icon name="chevron-right" size={15} color={DS.textLow}/>}
                </TouchableOpacity>
              );
            }}
            style={{flexGrow:0,maxHeight:420}}
          />
        </View>
      </TouchableOpacity>
    </Modal>
  );
}
const mS = StyleSheet.create({
  overlay:  {flex:1,backgroundColor:'#00000060',justifyContent:'flex-end'},
  sheet:    {backgroundColor:DS.white,borderTopLeftRadius:28,borderTopRightRadius:28,paddingHorizontal:20,paddingTop:12,paddingBottom:34,maxHeight:'80%'},
  handle:   {width:40,height:4,backgroundColor:DS.border,borderRadius:2,alignSelf:'center',marginBottom:14},
  header:   {flexDirection:'row',alignItems:'center',gap:10,marginBottom:16},
  backBtn:  {width:34,height:34,borderRadius:17,backgroundColor:DS.bg,justifyContent:'center',alignItems:'center'},
  closeBtn: {width:30,height:30,borderRadius:15,backgroundColor:DS.bg,justifyContent:'center',alignItems:'center'},
  title:    {flex:1,fontSize:17,fontWeight:'900',color:DS.text},
  item:     {flexDirection:'row',alignItems:'center',paddingVertical:13,borderBottomWidth:1,borderBottomColor:DS.bg,gap:10},
  itemActive:{backgroundColor:DS.blueBg,paddingHorizontal:10,marginHorizontal:-10,borderRadius:10},
  itemTxt:  {fontSize:15,color:DS.text,fontWeight:'600'},
  itemSub:  {fontSize:10,color:DS.textMed,marginTop:2},
});

// ─── Pantalla principal ───────────────────────────────────────────────────────
export default function SoldEditDetailView({ route, navigation }) {
  const { product: initialProduct } = route.params;

  // Umbrales dinámicos desde Settings (lectura síncrona)
  const _cfg         = DatabaseService.getConfig();
  const ttsLightning = parseInt(_cfg?.ttsLightning || 7);
  const ttsAnchor    = parseInt(_cfg?.ttsAnchor    || 30);

  const [editForm, setEditForm] = useState({
    ...initialProduct,
    soldPriceReal:   initialProduct.soldPriceReal ?? initialProduct.soldPrice ?? (initialProduct.price || 0),
    soldDateReal:    initialProduct.soldDateReal  || initialProduct.soldDate  || initialProduct.soldAt || new Date().toISOString(),
    isBundle:        initialProduct.isBundle      || false,
    category:        initialProduct.category      || 'Otros',
    subcategory:     initialProduct.subcategory   || null,
    firstUploadDate: initialProduct.firstUploadDate || initialProduct.createdAt || new Date().toISOString(),
  });

  const [showCalSold,   setShowCalSold]   = useState(false);
  const [showCalUpload, setShowCalUpload] = useState(false);
  const [showCatModal,  setShowCatModal]  = useState(false);

  // Tags de categoría
  const categoryTags = useMemo(() => {
    const full    = DatabaseService.getFullDictionary() || {};
    const catData = full[editForm.category];
    if (!catData) return [];
    const subTags = editForm.subcategory ? (catData.subcategories?.[editForm.subcategory]?.tags || []) : [];
    return [...new Set([...(catData.tags || []), ...subTags])].slice(0, 12);
  }, [editForm.category, editForm.subcategory]);

  // Beneficio calculado
  const profit = useMemo(() => {
    const sold   = Number(editForm.soldPriceReal) || 0;
    const listed = Number(editForm.price)         || 0;
    return (sold - listed).toFixed(2);
  }, [editForm.soldPriceReal, editForm.price]);

  // TTS (Time-to-Sell)
  const tts = useMemo(() => {
    if (!editForm.firstUploadDate || !editForm.soldDateReal) return null;
    return Math.max(1, Math.round(
      (new Date(editForm.soldDateReal) - new Date(editForm.firstUploadDate)) / 86_400_000
    ));
  }, [editForm.firstUploadDate, editForm.soldDateReal]);

  const handleSave = () => {
    const span = LogService.span(`Guardar vendido ${editForm.id}`, LOG_CTX.UI);
    if (!editForm.soldDateReal) { Alert.alert('Campo requerido', 'Indica la fecha real de venta.'); return; }
    const ok = DatabaseService.updateProduct({
      ...editForm,
      soldPriceReal:   Number(editForm.soldPriceReal),
      price:           Number(editForm.price),
      isBundle:        Boolean(editForm.isBundle),
      firstUploadDate: editForm.firstUploadDate || initialProduct.createdAt || new Date().toISOString(),
    });
    if (ok) {
      span.end({ soldPriceReal: editForm.soldPriceReal, category: editForm.category });
      LogService.success(`Venta guardada: "${editForm.title}" — ${editForm.soldPriceReal}€`, LOG_CTX.UI, { id: editForm.id });
      navigation.goBack();
    } else {
      span.fail(new Error('updateProduct false'));
      Alert.alert('Error', 'No se pudo guardar en la base de datos.');
    }
  };

  const ttsColor = tts === null ? DS.textMed : tts <= ttsLightning ? DS.success : tts <= ttsAnchor ? DS.warning : DS.danger;
  const ttsEmoji = tts === null ? '' : tts <= ttsLightning ? '⚡' : tts <= ttsAnchor ? '🟡' : '⚓';

  return (
    <View style={styles.container}>
      <CategoryModal
        visible={showCatModal} onClose={()=>setShowCatModal(false)}
        currentCat={editForm.category} currentSub={editForm.subcategory}
        onSelect={(cat, sub) => setEditForm(f => ({...f, category:cat, subcategory:sub}))}
      />
      <CalPicker
        visible={showCalSold} onClose={()=>setShowCalSold(false)}
        value={editForm.soldDateReal} accent={DS.success} label="FECHA REAL DE VENTA"
        onChange={iso => setEditForm(f => ({...f, soldDateReal:iso}))}
      />
      <CalPicker
        visible={showCalUpload} onClose={()=>setShowCalUpload(false)}
        value={editForm.firstUploadDate} accent={DS.primary} label="FECHA DE SUBIDA ORIGINAL"
        onChange={iso => setEditForm(f => ({...f, firstUploadDate:iso}))}
      />

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Hero imagen */}
        <View style={styles.hero}>
          {editForm.images?.[0]
            ? <Image source={{uri:editForm.images[0]}} style={styles.heroImg} resizeMode="cover"/>
            : <View style={[styles.heroImg, styles.heroPlaceholder]}><Icon name="image" size={52} color={DS.textLow}/></View>
          }
          <TouchableOpacity style={styles.backBtn} onPress={()=>navigation.goBack()}>
            <Icon name="arrow-left" size={20} color={DS.text}/>
          </TouchableOpacity>
          <View style={styles.soldBadge}>
            <Icon name="check-circle" size={13} color="#FFF"/>
            <Text style={styles.soldBadgeTxt}>VENDIDO</Text>
          </View>
        </View>

        {/* Contenido */}
        <View style={styles.contentCard}>

          {/* Identidad del producto */}
          <View style={styles.topRow}>
            <Text style={styles.brandTxt}>{editForm.brand || 'Sin marca'}</Text>
            <View style={styles.catPill}>
              <Icon name="tag" size={9} color={DS.blue}/>
              <Text style={styles.catPillTxt}>{editForm.category || 'Sin cat.'}</Text>
              {editForm.subcategory && <>
                <Text style={styles.catSep}>›</Text>
                <Text style={[styles.catPillTxt,{color:DS.textMed}]}>{editForm.subcategory}</Text>
              </>}
            </View>
          </View>
          <Text style={styles.titleTxt} numberOfLines={2}>{editForm.title}</Text>

          {/* Panel TTS */}
          {tts !== null && (
            <View style={styles.ttsPanel}>
              <View style={styles.ttsStat}>
                <Icon name="tag" size={14} color={DS.textLow}/>
                <Text style={styles.ttsLbl}>PRECIO SUBIDO</Text>
                <Text style={styles.ttsVal}>{editForm.price}€</Text>
              </View>
              <View style={[styles.ttsDivider]}/>
              <View style={styles.ttsStat}>
                <Icon name="clock" size={14} color={ttsColor}/>
                <Text style={styles.ttsLbl}>DÍAS HASTA VENTA</Text>
                <Text style={[styles.ttsVal, {color:ttsColor}]}>{ttsEmoji} {tts}d</Text>
              </View>
              <View style={styles.ttsDivider}/>
              <View style={styles.ttsStat}>
                <Icon name="trending-up" size={14} color={Number(profit)>=0?DS.success:DS.danger}/>
                <Text style={styles.ttsLbl}>BENEFICIO</Text>
                <Text style={[styles.ttsVal, {color:Number(profit)>=0?DS.success:DS.danger}]}>
                  {Number(profit)>=0?'+':''}{profit}€
                </Text>
              </View>
            </View>
          )}

          {/* Formulario permanente */}
          <View style={styles.formCard}>
            <View style={styles.formBanner}>
              <Icon name="shield" size={14} color={DS.success}/>
              <View style={{flex:1}}>
                <Text style={styles.formBannerTitle}>DATOS PERMANENTES</Text>
                <Text style={styles.formBannerSub}>Se conservan al importar JSON de Vinted</Text>
              </View>
            </View>

            {/* Precio real de venta */}
            <Text style={styles.fieldLbl}>PRECIO FINAL DE VENTA (€) *</Text>
            <View style={[styles.priceInputRow, editForm.soldPriceReal&&{borderColor:DS.success}]}>
              <TextInput
                style={styles.priceInput}
                keyboardType="decimal-pad"
                value={String(editForm.soldPriceReal)}
                onChangeText={v => setEditForm(f => ({...f, soldPriceReal:v}))}
                placeholderTextColor={DS.textLow}
                placeholder={String(editForm.price)}
              />
              <Text style={styles.priceEuro}>€</Text>
            </View>

            {/* Fecha real de venta */}
            <Text style={styles.fieldLbl}>FECHA REAL DE VENTA *</Text>
            <TouchableOpacity style={[styles.datePickBtn, {borderColor:DS.success+'50'}]} onPress={()=>setShowCalSold(true)}>
              <View style={[styles.datePickIcon, {backgroundColor:DS.successBg}]}>
                <Icon name="calendar" size={16} color={DS.success}/>
              </View>
              <View style={{flex:1}}>
                <Text style={styles.datePickVal}>{fmt(editForm.soldDateReal)}</Text>
                <Text style={styles.datePickHint}>Toca para cambiar</Text>
              </View>
              <Icon name="chevron-right" size={16} color={DS.textLow}/>
            </TouchableOpacity>

            {/* Categoría / Subcategoría */}
            <Text style={styles.fieldLbl}>CATEGORÍA / SUBCATEGORÍA</Text>
            <TouchableOpacity style={styles.catSelector} onPress={()=>setShowCatModal(true)}>
              <View style={[styles.catSelIcon, {backgroundColor:DS.blueBg}]}>
                <Icon name="tag" size={14} color={DS.blue}/>
              </View>
              <View style={{flex:1}}>
                <Text style={styles.catSelVal}>{editForm.category || 'Sin categoría'}</Text>
                {editForm.subcategory && <Text style={styles.catSelSub}>{editForm.subcategory}</Text>}
              </View>
              <Icon name="chevron-right" size={16} color={DS.textLow}/>
            </TouchableOpacity>

            {/* Tags sugeridos */}
            {categoryTags.length > 0 && (
              <View style={styles.tagPreview}>
                <Text style={styles.tagPreviewLbl}>Tags sugeridos:</Text>
                <View style={styles.tagsCloud}>
                  {categoryTags.map(t => (
                    <View key={t} style={styles.tag}><Text style={styles.tagTxt}>{t}</Text></View>
                  ))}
                </View>
              </View>
            )}

            {/* Fecha de subida original */}
            <Text style={styles.fieldLbl}>FECHA DE SUBIDA ORIGINAL</Text>
            <TouchableOpacity style={[styles.datePickBtn, {borderColor:DS.primary+'40'}]} onPress={()=>setShowCalUpload(true)}>
              <View style={[styles.datePickIcon, {backgroundColor:DS.primaryBg}]}>
                <Icon name="upload" size={16} color={DS.primary}/>
              </View>
              <View style={{flex:1}}>
                <Text style={styles.datePickVal}>{fmt(editForm.firstUploadDate)}</Text>
                <Text style={styles.datePickHint}>Usada para calcular el TTS</Text>
              </View>
              <Icon name="chevron-right" size={16} color={DS.textLow}/>
            </TouchableOpacity>
          </View>

          {/* Guardar */}
          <TouchableOpacity style={styles.saveBtn} onPress={handleSave} activeOpacity={0.85}>
            <Icon name="check-circle" size={18} color="#FFF"/>
            <Text style={styles.saveBtnTxt}>GUARDAR DATOS DE VENTA</Text>
          </TouchableOpacity>

          <View style={{height:60}}/>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container:     { flex:1, backgroundColor:DS.bg },

  hero:          { height:320, position:'relative' },
  heroImg:       { width, height:320 },
  heroPlaceholder:{ backgroundColor:DS.border, justifyContent:'center', alignItems:'center' },
  backBtn:       { position:'absolute', top:52, left:20, backgroundColor:DS.white, width:44, height:44, borderRadius:22, justifyContent:'center', alignItems:'center', elevation:6 },
  soldBadge:     { position:'absolute', bottom:20, right:20, flexDirection:'row', alignItems:'center', gap:6, backgroundColor:DS.success, paddingHorizontal:14, paddingVertical:8, borderRadius:20 },
  soldBadgeTxt:  { color:'#FFF', fontWeight:'900', fontSize:12, letterSpacing:0.5 },

  contentCard:   { backgroundColor:DS.white, borderTopLeftRadius:28, borderTopRightRadius:28, padding:24, marginTop:-28, minHeight:500 },

  topRow:        { flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginBottom:8 },
  brandTxt:      { fontSize:11, fontWeight:'900', color:DS.primary, letterSpacing:1.2, textTransform:'uppercase' },
  catPill:       { flexDirection:'row', alignItems:'center', gap:4, backgroundColor:DS.blueBg, paddingHorizontal:10, paddingVertical:5, borderRadius:10 },
  catPillTxt:    { fontSize:10, fontWeight:'800', color:DS.blue },
  catSep:        { fontSize:10, color:DS.textLow },
  titleTxt:      { fontSize:21, fontWeight:'900', color:DS.text, lineHeight:27, marginBottom:16 },

  ttsPanel:      { flexDirection:'row', backgroundColor:DS.bg, borderRadius:20, padding:16, marginBottom:20, gap:0 },
  ttsStat:       { flex:1, alignItems:'center', gap:4 },
  ttsDivider:    { width:1, backgroundColor:DS.border, marginVertical:4 },
  ttsLbl:        { fontSize:8, color:DS.textLow, fontWeight:'900', letterSpacing:0.8, textTransform:'uppercase' },
  ttsVal:        { fontSize:18, fontWeight:'900', color:DS.text, fontFamily:DS.mono },

  formCard:      { backgroundColor:DS.bg, borderRadius:20, padding:20, borderWidth:1, borderColor:DS.border, marginBottom:20 },
  formBanner:    { flexDirection:'row', alignItems:'center', gap:10, backgroundColor:DS.successBg, borderRadius:14, padding:14, marginBottom:20, borderWidth:1, borderColor:DS.success+'25' },
  formBannerTitle: { fontSize:11, fontWeight:'900', color:DS.text },
  formBannerSub:   { fontSize:10, color:DS.textMed, marginTop:2 },

  fieldLbl:      { fontSize:9, fontWeight:'900', color:DS.textLow, letterSpacing:1.5, textTransform:'uppercase', marginBottom:8, marginTop:16 },

  priceInputRow: { flexDirection:'row', alignItems:'center', gap:8, backgroundColor:DS.white, borderWidth:2, borderColor:DS.border, borderRadius:16, paddingHorizontal:16, paddingVertical:10, marginBottom:4 },
  priceInput:    { flex:1, fontSize:28, fontWeight:'900', color:DS.text, fontFamily:DS.mono, textAlign:'center' },
  priceEuro:     { fontSize:22, fontWeight:'900', color:DS.textMed },

  datePickBtn:   { flexDirection:'row', alignItems:'center', gap:12, backgroundColor:DS.white, borderRadius:16, padding:14, borderWidth:1, borderColor:DS.border, marginBottom:4 },
  datePickIcon:  { width:40, height:40, borderRadius:12, justifyContent:'center', alignItems:'center' },
  datePickVal:   { fontSize:15, fontWeight:'700', color:DS.text },
  datePickHint:  { fontSize:10, color:DS.textLow, marginTop:2 },

  catSelector:   { flexDirection:'row', alignItems:'center', gap:12, backgroundColor:DS.white, borderRadius:16, padding:14, borderWidth:1, borderColor:DS.border, marginBottom:4 },
  catSelIcon:    { width:36, height:36, borderRadius:10, justifyContent:'center', alignItems:'center' },
  catSelVal:     { fontSize:15, fontWeight:'800', color:DS.text },
  catSelSub:     { fontSize:11, color:DS.textMed, marginTop:2 },

  tagPreview:    { backgroundColor:DS.white, borderRadius:14, padding:12, marginTop:4, marginBottom:4 },
  tagPreviewLbl: { fontSize:10, color:DS.textMed, fontWeight:'700', marginBottom:6 },
  tagsCloud:     { flexDirection:'row', flexWrap:'wrap', gap:7 },
  tag:           { backgroundColor:DS.blueBg, paddingHorizontal:10, paddingVertical:5, borderRadius:10 },
  tagTxt:        { fontSize:11, color:DS.blue, fontWeight:'700' },

  saveBtn:       { flexDirection:'row', justifyContent:'center', alignItems:'center', gap:10, backgroundColor:DS.text, padding:18, borderRadius:22, elevation:4 },
  saveBtnTxt:    { color:'#FFF', fontWeight:'900', fontSize:15, letterSpacing:0.5 },
});
