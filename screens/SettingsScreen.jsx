/**
 * SettingsScreen.jsx — Sprint 11 verificado
 *
 * [UI_SPECIALIST] Sprint 11:
 * - Tab Calendario: modal con subcategorías expandibles
 *   · Categorías con botón [↓ N] para expandir subcategorías
 *   · Subcategorías seleccionables independientemente
 *   · toggleMonthItem() soporta 'Cat' y 'Cat › Sub' en seasonalMap
 *   · Chips del mes truncan al nombre de sub si es "Cat › Sub"
 * - DS Light canónico en toda la pantalla
 *
 * [QA_ENGINEER] Sprint 11:
 * - seasonalMap retrocompatible: strings sin › siguen como categorías
 * - Campos sagrados intactos
 */

import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Modal, Alert, ActivityIndicator, FlatList,
} from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import { DatabaseService } from '../services/DatabaseService';
import { BackupService }   from '../services/BackupService';
import { VintedSalesDB }   from '../services/VintedParserService';
import LogService          from '../services/LogService';

// ─── Design System Light Canónico v4.2 ───────────────────────────────────────
const C = {
  primary:    '#FF6B35',
  primaryBg:  '#FFF2EE',
  blue:       '#004E89',
  blueBg:     '#EAF2FB',
  success:    '#00D9A3',
  successBg:  '#E8FBF6',
  warning:    '#FFB800',
  danger:     '#E63946',
  white:      '#FFFFFF',
  bg:         '#F8F9FA',
  surface2:   '#F0F2F5',
  border:     '#EAEDF0',
  gray100:    '#F0F2F5',
  gray500:    '#A0A5B5',
  gray900:    '#1A1A2E',
  textMed:    '#5C6070',
};

const MONTHS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
                'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

const TABS = [
  { id: 'thresholds', label: 'Umbrales',    icon: 'sliders'    },
  { id: 'calendar',   label: 'Calendario',  icon: 'calendar'   },
  { id: 'categories', label: 'Categorías',  icon: 'tag'        },
  { id: 'database',   label: 'BBDD',        icon: 'database'   },
  { id: 'import',     label: 'Import',      icon: 'upload'     },
  { id: 'notif',      label: 'Alertas',     icon: 'bell'       },
];

// ─── Componentes auxiliares ───────────────────────────────────────────────────
const SectionTitle = ({ children }) => (
  <Text style={styles.sectionTitle}>{children}</Text>
);

const SettingCard = ({ label, desc, children }) => (
  <View style={styles.settingCard}>
    <View style={styles.cardLeft}>
      <Text style={styles.cardLabel}>{label}</Text>
      {desc ? <Text style={styles.cardDesc}>{desc}</Text> : null}
    </View>
    {children}
  </View>
);

const NumInput = ({ value, onChangeText, unit, inputWidth = 65 }) => (
  <View style={styles.numRow}>
    <TextInput
      style={[styles.numInput, { width: inputWidth }]}
      keyboardType="numeric"
      value={String(value)}
      onChangeText={onChangeText}
    />
    {unit ? <Text style={styles.numUnit}>{unit}</Text> : null}
  </View>
);

const SaveBtn = ({ onPress }) => (
  <TouchableOpacity style={styles.saveBtn} onPress={onPress} activeOpacity={0.7}>
    <Icon name="save" size={16} color="#FFF" />
    <Text style={styles.saveBtnTxt}>Guardar cambios</Text>
  </TouchableOpacity>
);

// ─── CatCardExpanded: tarjeta de categoría con subcategorías editables ────────
function CatCardExpanded({ cat, data, onDelete, onUpdateTags, onAddSubcategory, onDeleteSubcategory }) {
  const [expanded, setExpanded] = React.useState(false);
  const [newSubName, setNewSubName] = React.useState('');
  const [newTagText, setNewTagText] = React.useState('');

  const subcats = Object.keys(data?.subcategories || {});
  const tags    = data?.tags || [];

  const addTag = () => {
    const t = newTagText.trim();
    if (!t || tags.includes(t)) return;
    onUpdateTags([...tags, t]);
    setNewTagText('');
  };

  const removeTag = (tag) => onUpdateTags(tags.filter(t => t !== tag));

  const addSub = () => {
    if (!newSubName.trim()) return;
    if (subcats.includes(newSubName.trim())) return;
    onAddSubcategory(newSubName.trim());
    setNewSubName('');
  };

  return (
    <View style={styles.catCardDB}>
      <TouchableOpacity
        style={styles.catCardHeader}
        onPress={() => setExpanded(e => !e)}
        activeOpacity={0.7}
      >
        <Icon name={expanded ? 'chevron-up' : 'chevron-down'} size={14} color={C.gray500} />
        <Text style={styles.catCardName}>{cat}</Text>
        <Text style={styles.catCardTags}>{subcats.length} subs · {tags.length} tags</Text>
        <TouchableOpacity onPress={onDelete} hitSlop={{ top:8, bottom:8, left:8, right:8 }}>
          <Icon name="trash-2" size={14} color={C.danger} />
        </TouchableOpacity>
      </TouchableOpacity>

      {expanded && (
        <View style={{ paddingTop: 8 }}>
          {/* Tags */}
          <Text style={[styles.cardDesc, { marginBottom: 6 }]}>Tags de búsqueda:</Text>
          <View style={{ flexDirection:'row', flexWrap:'wrap', gap:6, marginBottom:8 }}>
            {tags.map(t => (
              <TouchableOpacity
                key={t}
                style={{ backgroundColor: C.primary+'20', paddingHorizontal:8,
                         paddingVertical:3, borderRadius:10 }}
                onPress={() => removeTag(t)}
              >
                <Text style={{ fontSize:11, color: C.primary, fontWeight:'700' }}>{t} ✕</Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={{ flexDirection:'row', gap:8, marginBottom:12 }}>
            <TextInput
              style={[styles.addCatInput, { flex:1 }]}
              placeholder="Añadir tag..."
              placeholderTextColor={C.gray500}
              value={newTagText}
              onChangeText={setNewTagText}
              onSubmitEditing={addTag}
            />
            <TouchableOpacity style={styles.addCatBtn} onPress={addTag}>
              <Icon name="plus" size={14} color="#FFF" />
            </TouchableOpacity>
          </View>

          {/* Subcategorías */}
          <Text style={[styles.cardDesc, { marginBottom: 6 }]}>Subcategorías:</Text>
          {subcats.map(sub => (
            <View key={sub} style={{ flexDirection:'row', alignItems:'center', gap:8, marginBottom:4 }}>
              <Icon name="corner-down-right" size={11} color={C.gray500} />
              <Text style={{ flex:1, fontSize:12, color: C.gray900 }}>{sub}</Text>
              <TouchableOpacity onPress={() => onDeleteSubcategory(sub)}
                hitSlop={{ top:6, bottom:6, left:6, right:6 }}>
                <Icon name="x" size={12} color={C.danger} />
              </TouchableOpacity>
            </View>
          ))}
          <View style={{ flexDirection:'row', gap:8, marginTop:6 }}>
            <TextInput
              style={[styles.addCatInput, { flex:1 }]}
              placeholder="Nueva subcategoría..."
              placeholderTextColor={C.gray500}
              value={newSubName}
              onChangeText={setNewSubName}
              onSubmitEditing={addSub}
            />
            <TouchableOpacity style={[styles.addCatBtn, { backgroundColor: C.blue }]} onPress={addSub}>
              <Icon name="plus" size={14} color="#FFF" />
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function SettingsScreen({ navigation }) {
  const [activeTab,             setActiveTab]             = useState('thresholds');
  const [config,                setConfig]                = useState(() => DatabaseService.getConfig());
  const [dictionary,            setDictionary]            = useState({});
  const [calModal,              setCalModal]              = useState({ visible: false, monthIdx: null });
  // Sprint 11: categoría expandida dentro del modal de calendario
  const [calModalExpandedCat,   setCalModalExpandedCat]   = useState(null);
  const [newCatName,            setNewCatName]            = useState('');

  // BBDD
  const [dbStats,       setDbStats]       = useState(null);
  const [exporting,     setExporting]     = useState(false);
  const [importing,     setImporting]     = useState(false);
  const [backupInfo,    setBackupInfo]    = useState(null);
  const [forcingBackup, setForcingBackup] = useState(false);

  useEffect(() => {
    const saved     = DatabaseService.getConfig();
    const savedDict = DatabaseService.getDictionary();

    if (saved) {
      // Normalizar seasonalMap a arrays
      const sm    = saved.seasonalMap || {};
      const newSm = {};
      for (let i = 0; i < 12; i++) {
        const val = sm[i];
        if (Array.isArray(val))                  newSm[i] = val;
        else if (typeof val === 'string' && val) newSm[i] = [val];
        else                                     newSm[i] = [];
      }
      setConfig(c => ({ ...c, ...saved, seasonalMap: newSm }));
    }

    if (savedDict) {
      // Migrar diccionario legacy a formato full (con subcategorías)
      const migrated = {};
      for (const [cat, val] of Object.entries(savedDict)) {
        migrated[cat] = Array.isArray(val)
          ? { tags: val, subcategories: {} }
          : { tags: val.tags || [], subcategories: val.subcategories || {} };
      }
      setDictionary(migrated);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'database') {
      loadDbStats();
      loadBackupInfo();
    }
  }, [activeTab]);

  const loadBackupInfo = async () => {
    try {
      const info = await BackupService.getBackupInfo();
      setBackupInfo(info);
    } catch { setBackupInfo(null); }
  };

  const loadDbStats = () => {
    try {
      const products   = DatabaseService.getAllProducts();
      const sold       = products.filter(p => p.status === 'sold');
      const salesStats = VintedSalesDB.getStats?.() || {};
      setDbStats({
        totalProducts:  products.length,
        soldProducts:   sold.length,
        activeProducts: products.filter(p => p.status !== 'sold').length,
        salesRecords:   salesStats.totalRecords  || 0,
        ventas:         salesStats.totalVentas   || 0,
        compras:        salesStats.totalCompras  || 0,
        ingresos:       salesStats.ingresosBrutos || 0,
      });
    } catch { setDbStats(null); }
  };

  const handleSave = () => {
    const ok = DatabaseService.saveConfig(config);
    if (ok) Alert.alert('✅ Guardado', 'Configuración actualizada.');
    else    Alert.alert('❌ Error', 'No se pudo guardar la configuración.');
  };

  const updateCfg = (key, val) => setConfig(c => ({ ...c, [key]: val }));

  // ── Sprint 11: toggleMonthItem — soporta 'Cat' y 'Cat › Sub' ─────────────
  // Retrocompatible: strings sin › siguen funcionando como categorías enteras
  const toggleMonthItem = (monthIdx, itemStr) => {
    const sm  = { ...config.seasonalMap };
    const arr = sm[monthIdx] ? [...sm[monthIdx]] : [];
    const idx = arr.indexOf(itemStr);
    if (idx === -1) arr.push(itemStr);
    else arr.splice(idx, 1);
    sm[monthIdx] = arr;
    updateCfg('seasonalMap', sm);
  };

  // ─── RENDER: Tab Umbrales ──────────────────────────────────────────────────
  const renderThresholds = () => (
    <View>
      <SectionTitle>Velocidad de Venta (TTS)</SectionTitle>
      <SettingCard label="⚡ Relámpago" desc="Productos con TTS menor a este umbral → sube precios">
        <NumInput value={config.ttsLightning || 7}  onChangeText={v => updateCfg('ttsLightning', v)} unit="días" />
      </SettingCard>
      <SettingCard label="⚓ Ancla" desc="Productos con TTS mayor a este umbral → baja precios">
        <NumInput value={config.ttsAnchor || 30}    onChangeText={v => updateCfg('ttsAnchor', v)}    unit="días" />
      </SettingCard>
      <SettingCard label="📈 Subida de precio" desc="% a subir en productos relámpago">
        <NumInput value={config.priceBoostPct || 10} onChangeText={v => updateCfg('priceBoostPct', v)} unit="%" />
      </SettingCard>
      <SettingCard label="📉 Bajada de precio" desc="% a bajar en productos ancla">
        <NumInput value={config.priceCutPct || 10}  onChangeText={v => updateCfg('priceCutPct', v)}  unit="%" />
      </SettingCard>

      <SectionTitle>Stock Frío (Estancamiento)</SectionTitle>
      <SettingCard label="Días sin vender" desc="Días en stock para mostrar alerta de estancamiento">
        <NumInput value={config.daysInvisible || 60}  onChangeText={v => updateCfg('daysInvisible', v)}  unit="días" />
      </SettingCard>
      <SettingCard label="Días críticos" desc="Días en stock para alerta de nivel CRÍTICO">
        <NumInput value={config.daysCritical || 90}   onChangeText={v => updateCfg('daysCritical', v)}   unit="días" />
      </SettingCard>
      <SettingCard label="Multiplicador ancla" desc="Días ancla × multiplicador = días para sugerir lote">
        <NumInput value={config.staleMultiplier || 1.5} onChangeText={v => updateCfg('staleMultiplier', v)} inputWidth={70} />
      </SettingCard>

      <SectionTitle>Oportunidades</SectionTitle>
      <SettingCard label="⚡ Producto caliente" desc="Vistas y favs mínimos para marcar como HOT">
        <View style={styles.row}>
          <NumInput value={config.hotFavs  || 10} onChangeText={v => updateCfg('hotFavs', v)}  unit="favs" />
          <NumInput value={config.hotViews || 50} onChangeText={v => updateCfg('hotViews', v)} unit="vistas" />
        </View>
      </SettingCard>
      <SettingCard label="💚 Casi listo" desc="Días publicado y favs mínimos para alerta 'Casi Listo'">
        <View style={styles.row}>
          <NumInput value={config.daysAlmostReady || 30} onChangeText={v => updateCfg('daysAlmostReady', v)} unit="días" />
          <NumInput value={config.favsAlmostReady || 8}  onChangeText={v => updateCfg('favsAlmostReady', v)}  unit="favs" />
        </View>
      </SettingCard>
      <SettingCard label="🔔 Alerta oportunidad" desc="Favs y días para lanzar alerta de oportunidad">
        <View style={styles.row}>
          <NumInput value={config.opportunityFavs || 5}  onChangeText={v => updateCfg('opportunityFavs', v)}  unit="favs" />
          <NumInput value={config.opportunityDays || 30} onChangeText={v => updateCfg('opportunityDays', v)} unit="días" />
        </View>
      </SettingCard>

      <SaveBtn onPress={handleSave} />
    </View>
  );

  // ─── RENDER: Tab Calendario — Sprint 11 ───────────────────────────────────
  const renderCalendar = () => {
    const catNames = Object.keys(dictionary);
    return (
      <View>
        <SectionTitle>Calendario de Oportunidades</SectionTitle>
        <Text style={styles.calHint}>
          Asigna categorías o subcategorías específicas a cada mes.
          El sistema priorizará estos items en alertas y Smart Insights.
        </Text>

        {/* Cada fila de mes */}
        {MONTHS.map((mes, idx) => {
          const selected = Array.isArray(config.seasonalMap?.[idx])
            ? config.seasonalMap[idx] : [];
          return (
            <View key={idx} style={styles.monthRow}>
              <Text style={styles.monthName}>{mes}</Text>
              <View style={styles.monthChips}>
                {selected.length === 0
                  ? <Text style={styles.monthEmpty}>Sin asignar</Text>
                  : selected.map(item => {
                      // Sprint 11: truncar a nombre de sub si es "Cat › Sub"
                      const displayLabel = item.includes(' › ')
                        ? item.split(' › ')[1]
                        : item;
                      return (
                        <TouchableOpacity
                          key={item}
                          style={styles.monthChip}
                          onPress={() => toggleMonthItem(idx, item)}
                          activeOpacity={0.7}
                        >
                          <Text style={styles.monthChipTxt} numberOfLines={1}>
                            {displayLabel} ✕
                          </Text>
                        </TouchableOpacity>
                      );
                    })
                }
              </View>
              <TouchableOpacity
                style={styles.monthAddBtn}
                onPress={() => {
                  setCalModal({ visible: true, monthIdx: idx });
                  setCalModalExpandedCat(null);
                }}
                activeOpacity={0.7}
              >
                <Icon name="plus" size={14} color={C.primary} />
              </TouchableOpacity>
            </View>
          );
        })}

        {/* ── Sprint 11: Modal calendario con subcategorías expandibles ──── */}
        <Modal visible={calModal.visible} transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={styles.modalSheet}>
              {/* Cabecera */}
              <View style={styles.modalHandle}/>
              <Text style={styles.modalTitle}>
                {calModal.monthIdx !== null ? MONTHS[calModal.monthIdx] : ''}
              </Text>
              <Text style={styles.modalHint}>
                Toca una categoría o subcategoría para añadir/quitar al mes
              </Text>

              {/* Lista de categorías + subcategorías expandibles */}
              <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false}>
                {catNames.length === 0 && (
                  <View style={styles.calEmptyBox}>
                    <Icon name="tag" size={28} color={C.gray500}/>
                    <Text style={styles.calEmptyTxt}>
                      No hay categorías configuradas.
                      Ve a la pestaña "Categorías" para añadirlas.
                    </Text>
                  </View>
                )}
                {catNames.map(cat => {
                  const catSelected = config.seasonalMap?.[calModal.monthIdx]?.includes(cat);
                  const catSubs     = Object.keys(dictionary[cat]?.subcategories || {});
                  const isExpanded  = calModalExpandedCat === cat;

                  return (
                    <View key={cat}>
                      {/* Fila de categoría */}
                      <View style={styles.calCatRow}>
                        {/* Botón seleccionar categoría entera */}
                        <TouchableOpacity
                          style={[styles.calCatItem, catSelected && styles.modalItemActive]}
                          onPress={() => toggleMonthItem(calModal.monthIdx, cat)}
                          activeOpacity={0.7}
                        >
                          <Text style={[styles.modalItemTxt, catSelected && styles.modalItemTxtActive]}>
                            {cat}
                          </Text>
                          {catSelected && <Icon name="check" size={14} color={C.blue}/>}
                        </TouchableOpacity>

                        {/* Botón expandir subcategorías */}
                        {catSubs.length > 0 && (
                          <TouchableOpacity
                            style={styles.calExpandBtn}
                            onPress={() => setCalModalExpandedCat(isExpanded ? null : cat)}
                            activeOpacity={0.7}
                          >
                            <Icon
                              name={isExpanded ? 'chevron-up' : 'chevron-down'}
                              size={14} color={C.primary}
                            />
                            <Text style={styles.calExpandTxt}>{catSubs.length}</Text>
                          </TouchableOpacity>
                        )}
                      </View>

                      {/* Subcategorías expandidas */}
                      {isExpanded && catSubs.map(sub => {
                        const subKey      = `${cat} › ${sub}`;
                        const subSelected = config.seasonalMap?.[calModal.monthIdx]?.includes(subKey);
                        return (
                          <TouchableOpacity
                            key={subKey}
                            style={[styles.calSubItem, subSelected && styles.calSubItemActive]}
                            onPress={() => toggleMonthItem(calModal.monthIdx, subKey)}
                            activeOpacity={0.7}
                          >
                            <Icon name="corner-down-right" size={11}
                              color={subSelected ? C.blue : C.gray500}
                              style={{ marginRight:6 }}
                            />
                            <Text style={[
                              styles.calSubTxt,
                              subSelected && { color: C.blue, fontWeight:'700' }
                            ]}>
                              {sub}
                            </Text>
                            {subSelected && (
                              <Icon name="check" size={13} color={C.blue} style={{ marginLeft:'auto' }}/>
                            )}
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  );
                })}
              </ScrollView>

              {/* Botón cerrar */}
              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => {
                  setCalModal({ visible: false, monthIdx: null });
                  setCalModalExpandedCat(null);
                }}
                activeOpacity={0.7}
              >
                <Text style={styles.modalCloseTxt}>Cerrar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        <SaveBtn onPress={handleSave} />
      </View>
    );
  };

  // ─── RENDER: Tab Categorías ───────────────────────────────────────────────
  const renderCategories = () => {
    const catNames = Object.keys(dictionary);

    const handleSaveDictionary = () => {
      // Guardar usando los métodos correctos de DatabaseService (no MMKV directo)
      const legacy = {};
      for (const [cat, val] of Object.entries(dictionary)) {
        legacy[cat] = Array.isArray(val.tags) ? val.tags : [];
      }
      const okFull   = DatabaseService.saveFullDictionary(dictionary);
      const okLegacy = DatabaseService.saveDictionary(legacy);

      if (okFull && okLegacy) {
        LogService.add(`📚 Diccionario guardado: ${catNames.length} categorías`, 'success');
        Alert.alert('✅ Categorías guardadas', `${catNames.length} categorías actualizadas.`);
      } else {
        Alert.alert('⚠️ Error al guardar', 'No se pudieron guardar las categorías.');
      }
    };

    return (
      <View>
        <SectionTitle>Diccionario de Categorías</SectionTitle>
        <Text style={styles.calHint}>
          Añade categorías y subcategorías. Se usarán en los filtros de inventario,
          historial de ventas y calendario de oportunidades.
        </Text>

        {catNames.map(cat => (
          <CatCardExpanded
            key={cat}
            cat={cat}
            data={dictionary[cat]}
            onDelete={() => {
              const d = { ...dictionary };
              delete d[cat];
              setDictionary(d);
            }}
            onUpdateTags={(tags) => {
              setDictionary(d => ({ ...d, [cat]: { ...d[cat], tags } }));
            }}
            onAddSubcategory={(subName) => {
              if (!subName.trim()) return;
              setDictionary(d => ({
                ...d,
                [cat]: {
                  ...d[cat],
                  subcategories: {
                    ...(d[cat]?.subcategories || {}),
                    [subName.trim()]: { tags: [] },
                  },
                },
              }));
            }}
            onDeleteSubcategory={(subName) => {
              setDictionary(d => {
                const subs = { ...(d[cat]?.subcategories || {}) };
                delete subs[subName];
                return { ...d, [cat]: { ...d[cat], subcategories: subs } };
              });
            }}
          />
        ))}

        {/* Añadir nueva categoría */}
        <View style={styles.addCatRow}>
          <TextInput
            style={styles.addCatInput}
            placeholder="Nueva categoría..."
            placeholderTextColor={C.gray500}
            value={newCatName}
            onChangeText={setNewCatName}
          />
          <TouchableOpacity
            style={styles.addCatBtn}
            onPress={() => {
              if (!newCatName.trim()) return;
              setDictionary(d => ({
                ...d,
                [newCatName.trim()]: { tags: [], subcategories: {} },
              }));
              setNewCatName('');
            }}
            activeOpacity={0.7}
          >
            <Icon name="plus" size={16} color="#FFF" />
          </TouchableOpacity>
        </View>

        <SaveBtn onPress={handleSaveDictionary} />
      </View>
    );
  };

  // ─── RENDER: Tab BBDD ──────────────────────────────────────────────────────
  const renderDatabase = () => (
    <View>
      <SectionTitle>Base de Datos</SectionTitle>

      {/* AUTO-BACKUP STATUS */}
      <View style={styles.autoBackupCard}>
        <View style={styles.autoBackupHeader}>
          <View style={[styles.autoBackupDot, { backgroundColor: backupInfo?.exists ? C.success : C.warning }]} />
          <Text style={styles.autoBackupTitle}>Auto-Backup Automático</Text>
          <TouchableOpacity onPress={loadBackupInfo} hitSlop={{ top:8, bottom:8, left:8, right:8 }}>
            <Icon name="refresh-cw" size={13} color={C.gray500} />
          </TouchableOpacity>
        </View>
        {backupInfo?.exists ? (
          <View style={styles.autoBackupBody}>
            <View style={styles.autoBackupRow}>
              <Icon name="check-circle" size={14} color={C.success} />
              <Text style={styles.autoBackupOk}>Backup local disponible en el dispositivo</Text>
            </View>
            <View style={styles.autoBackupMeta}>
              {[
                { val: backupInfo.products, lab: 'Productos' },
                { val: `${backupInfo.sizeKB} KB`, lab: 'Tamaño' },
                { val: backupInfo.date ? new Date(backupInfo.date).toLocaleDateString('es-ES') : '—', lab: 'Última vez' },
              ].map(m => (
                <View key={m.lab} style={styles.autoBackupMetaItem}>
                  <Text style={styles.autoBackupMetaVal}>{m.val}</Text>
                  <Text style={styles.autoBackupMetaLab}>{m.lab}</Text>
                </View>
              ))}
            </View>
          </View>
        ) : (
          <View style={styles.autoBackupBody}>
            <View style={styles.autoBackupRow}>
              <Icon name="alert-circle" size={14} color={C.warning} />
              <Text style={styles.autoBackupWarn}>Sin backup local. Guarda uno ahora.</Text>
            </View>
          </View>
        )}
        <TouchableOpacity
          style={[styles.forceBackupBtn, forcingBackup && { opacity: 0.6 }]}
          onPress={async () => {
            setForcingBackup(true);
            try {
              const FS = require('expo-file-system');
              const payload = DatabaseService.exportFullDatabase();
              if (!payload) { Alert.alert('❌ Error', 'No se pudo generar el backup.'); return; }
              const path = `${FS.documentDirectory}resellhub_auto_backup.json`;
              await FS.writeAsStringAsync(path, JSON.stringify({
                ...payload, autoBackupAt: new Date().toISOString(),
                exportedBy: 'ResellHub_exportFullDatabase_v9',
              }), { encoding: FS.EncodingType.UTF8 });
              await loadBackupInfo();
              Alert.alert('✅ Backup guardado', `${payload.products?.length || 0} productos guardados.`);
            } catch (e) {
              Alert.alert('Error al hacer backup', e.message);
            } finally {
              setForcingBackup(false);
            }
          }}
          disabled={forcingBackup}
          activeOpacity={0.7}
        >
          {forcingBackup
            ? <ActivityIndicator size="small" color={C.blue} />
            : <Icon name="save" size={14} color={C.blue} />
          }
          <Text style={styles.forceBackupTxt}>Guardar backup ahora</Text>
        </TouchableOpacity>
      </View>

      {/* Info */}
      <View style={styles.infoBox}>
        <Icon name="info" size={16} color={C.blue} />
        <Text style={styles.infoTxt}>
          <Text style={{ fontWeight:'700' }}>Backup automático activo.{'\n'}</Text>
          Se actualiza automáticamente tras cada cambio.
          Si reinstelas la app, los datos se restauran solos al arrancar.{'\n\n'}
          Para copias externas (Drive, email) usa "Exportar JSON" abajo.
        </Text>
      </View>

      {/* Estadísticas */}
      {dbStats && (
        <View style={styles.dbStatsCard}>
          <Text style={styles.dbStatsTitle}>Estado actual de la BBDD</Text>
          <View style={styles.dbStatsGrid}>
            {[
              { val: dbStats.totalProducts,  lab: 'Productos', color: C.gray900 },
              { val: dbStats.soldProducts,   lab: 'Vendidos',  color: C.success },
              { val: dbStats.activeProducts, lab: 'En stock',  color: C.primary },
              { val: dbStats.salesRecords,   lab: 'Historial', color: C.blue   },
            ].map(s => (
              <View key={s.lab} style={styles.dbStatItem}>
                <Text style={[styles.dbStatVal, { color: s.color }]}>{s.val}</Text>
                <Text style={styles.dbStatLab}>{s.lab}</Text>
              </View>
            ))}
          </View>
          {dbStats.ingresos > 0 && (
            <View style={styles.dbIngresoRow}>
              <Icon name="trending-up" size={12} color={C.success} />
              <Text style={styles.dbIngresoTxt}>
                Ingresos registrados:{' '}
                <Text style={{ fontWeight:'900', color: C.success }}>{dbStats.ingresos.toFixed(2)}€</Text>
                {` (${dbStats.ventas} ventas · ${dbStats.compras} compras)`}
              </Text>
            </View>
          )}
        </View>
      )}

      {/* Seguro externo */}
      <Text style={styles.sectionTitle}>Seguro Externo</Text>
      <View style={styles.dbActionsRow}>
        <TouchableOpacity
          style={[styles.dbActionBtn, { backgroundColor: C.blue }]}
          onPress={async () => {
            setExporting(true);
            try {
              const payload = DatabaseService.exportFullDatabase();
              await BackupService.exportToShare(payload);
            } catch (e) {
              if (e.message !== 'User did not share') Alert.alert('Error al exportar', e.message);
            } finally { setExporting(false); }
          }}
          disabled={exporting} activeOpacity={0.7}
        >
          {exporting ? <ActivityIndicator size="small" color="#FFF" /> : <Icon name="upload" size={18} color="#FFF" />}
          <Text style={styles.dbActionTxt}>Exportar JSON</Text>
          <Text style={styles.dbActionSub}>Drive / Email / WhatsApp</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.dbActionBtn, { backgroundColor: C.success }]}
          onPress={async () => {
            try {
              const result = await BackupService.importFromFile(
                (payload) => DatabaseService.importFullDatabase(payload),
              );
              if (result.cancelled) return;
              Alert.alert('BBDD Restaurada', `✅ ${result.products} productos · ${result.salesRecords} ventas`, [
                { text: 'OK', onPress: () => { loadDbStats(); loadBackupInfo(); } },
              ]);
            } catch (e) { Alert.alert('Error al importar', e.message); }
            finally { setImporting(false); }
          }}
          disabled={importing} activeOpacity={0.7}
        >
          {importing ? <ActivityIndicator size="small" color="#FFF" /> : <Icon name="download" size={18} color="#FFF" />}
          <Text style={styles.dbActionTxt}>Restaurar JSON</Text>
          <Text style={styles.dbActionSub}>Desde fichero .json</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={styles.refreshStatsBtn}
        onPress={() => { loadDbStats(); loadBackupInfo(); }}
        activeOpacity={0.7}
      >
        <Icon name="refresh-cw" size={13} color={C.blue} />
        <Text style={styles.refreshStatsTxt}>Actualizar estadísticas</Text>
      </TouchableOpacity>
    </View>
  );

  // ─── RENDER: Tab Import ───────────────────────────────────────────────────
  const renderImport = () => (
    <View>
      <SectionTitle>Opciones de Importación</SectionTitle>
      <View style={styles.infoBox}>
        <Icon name="info" size={16} color={C.blue} />
        <Text style={styles.infoTxt}>
          La importación se realiza desde la pestaña "Importar" del menú principal.
          Aquí puedes configurar el comportamiento por defecto.
        </Text>
      </View>
      <SettingCard label="Detectar categoría auto" desc="Intentar detectar categoría a partir del título y marca">
        <TouchableOpacity
          style={[styles.toggleBtn, config.autoDetectCategory && styles.toggleBtnOn]}
          onPress={() => updateCfg('autoDetectCategory', !config.autoDetectCategory)}
          activeOpacity={0.7}
        >
          <Text style={[styles.toggleTxt, config.autoDetectCategory && styles.toggleTxtOn]}>
            {config.autoDetectCategory ? 'ON' : 'OFF'}
          </Text>
        </TouchableOpacity>
      </SettingCard>
      <SaveBtn onPress={handleSave} />
    </View>
  );

  // ─── RENDER: Tab Notificaciones ───────────────────────────────────────────
  const renderNotif = () => (
    <View>
      <SectionTitle>Alertas y Notificaciones</SectionTitle>
      <SettingCard label="Notificaciones de resubida" desc="Recibir alertas cuando un producto deba resubirse">
        <TouchableOpacity
          style={[styles.toggleBtn, config.notifRepost && styles.toggleBtnOn]}
          onPress={() => updateCfg('notifRepost', !config.notifRepost)}
          activeOpacity={0.7}
        >
          <Text style={[styles.toggleTxt, config.notifRepost && styles.toggleTxtOn]}>
            {config.notifRepost ? 'ON' : 'OFF'}
          </Text>
        </TouchableOpacity>
      </SettingCard>
      <SettingCard label="Alertas de stock frío" desc="Notificar productos sin vender más de X días">
        <TouchableOpacity
          style={[styles.toggleBtn, config.notifStale && styles.toggleBtnOn]}
          onPress={() => updateCfg('notifStale', !config.notifStale)}
          activeOpacity={0.7}
        >
          <Text style={[styles.toggleTxt, config.notifStale && styles.toggleTxtOn]}>
            {config.notifStale ? 'ON' : 'OFF'}
          </Text>
        </TouchableOpacity>
      </SettingCard>
      <SaveBtn onPress={handleSave} />
    </View>
  );

  const renderTab = () => {
    switch (activeTab) {
      case 'thresholds': return renderThresholds();
      case 'calendar':   return renderCalendar();
      case 'categories': return renderCategories();
      case 'database':   return renderDatabase();
      case 'import':     return renderImport();
      case 'notif':      return renderNotif();
      default:           return renderThresholds();
    }
  };

  return (
    <View style={styles.root}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Configuración</Text>
        <Text style={styles.headerSub}>ResellHub · ajustes del sistema</Text>
      </View>

      {/* Tab bar */}
      <ScrollView
        horizontal showsHorizontalScrollIndicator={false}
        style={styles.tabBarScroll} contentContainerStyle={styles.tabBar}
      >
        {TABS.map(tab => (
          <TouchableOpacity
            key={tab.id}
            style={[styles.tab, activeTab === tab.id && styles.tabActive]}
            onPress={() => setActiveTab(tab.id)}
            activeOpacity={0.7}
          >
            <Icon name={tab.icon} size={13} color={activeTab === tab.id ? C.primary : C.gray500} />
            <Text style={[styles.tabTxt, activeTab === tab.id && styles.tabTxtActive]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Contenido */}
      <ScrollView style={styles.content} contentContainerStyle={styles.contentPad}>
        {renderTab()}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root:    {flex:1, backgroundColor: C.bg},

  header:      {paddingTop:52, paddingHorizontal:20, paddingBottom:12,
                backgroundColor: C.white, borderBottomWidth:1, borderBottomColor: C.border},
  headerTitle: {fontSize:24, fontWeight:'900', color: C.gray900},
  headerSub:   {fontSize:10, color: C.gray500, fontWeight:'600', marginTop:2},

  tabBarScroll: {maxHeight:52, backgroundColor: C.white, borderBottomWidth:1, borderBottomColor: C.border},
  tabBar:       {paddingHorizontal:12, gap:4, alignItems:'center', paddingVertical:8},
  tab:          {flexDirection:'row', alignItems:'center', gap:5, paddingHorizontal:12,
                 paddingVertical:6, borderRadius:20},
  tabActive:    {backgroundColor: C.primary+'15'},
  tabTxt:       {fontSize:11, fontWeight:'600', color: C.gray500},
  tabTxtActive: {color: C.primary, fontWeight:'800'},

  content:    {flex:1},
  contentPad: {padding:16, paddingBottom:100},

  sectionTitle: {fontSize:11, fontWeight:'900', color: C.gray500, letterSpacing:1.2,
                 marginTop:20, marginBottom:10},

  settingCard:  {flexDirection:'row', justifyContent:'space-between', alignItems:'center',
                 backgroundColor: C.white, borderRadius:12, padding:14, marginBottom:8,
                 borderWidth:1, borderColor: C.border},
  cardLeft:     {flex:1, marginRight:12},
  cardLabel:    {fontSize:13, fontWeight:'700', color: C.gray900, marginBottom:2},
  cardDesc:     {fontSize:11, color: C.gray500},

  numRow:    {flexDirection:'row', alignItems:'center', gap:6},
  numInput:  {borderWidth:1, borderColor: C.border, borderRadius:10, paddingHorizontal:10,
              paddingVertical:8, fontSize:14, fontWeight:'700', color: C.gray900,
              textAlign:'center', backgroundColor: C.bg},
  numUnit:   {fontSize:11, color: C.gray500, fontWeight:'600'},

  row:       {flexDirection:'row', gap:8, flexWrap:'wrap'},

  saveBtn:    {flexDirection:'row', alignItems:'center', justifyContent:'center', gap:8,
               backgroundColor: C.primary, borderRadius:14, padding:14, marginTop:20},
  saveBtnTxt: {color:'#FFF', fontWeight:'900', fontSize:15},

  // Calendario
  calHint:    {fontSize:11, color: C.gray500, marginBottom:16, lineHeight:16},
  monthRow:   {flexDirection:'row', alignItems:'center', gap:10, paddingVertical:10,
               borderBottomWidth:1, borderBottomColor: C.border},
  monthName:  {width:72, fontSize:12, fontWeight:'700', color: C.gray900},
  monthChips: {flex:1, flexDirection:'row', flexWrap:'wrap', gap:5},
  monthEmpty: {fontSize:11, color: C.gray500, fontStyle:'italic'},
  monthChip:  {backgroundColor: C.blue+'15', paddingHorizontal:8, paddingVertical:3, borderRadius:10},
  monthChipTxt: {fontSize:10, fontWeight:'700', color: C.blue, maxWidth:120},
  monthAddBtn:  {width:28, height:28, borderRadius:14, backgroundColor: C.primary+'20',
                 justifyContent:'center', alignItems:'center'},

  // Modal calendario Sprint 11
  modalOverlay: {flex:1, backgroundColor:'rgba(0,0,0,0.4)', justifyContent:'flex-end'},
  modalSheet:   {backgroundColor: C.white, borderTopLeftRadius:24, borderTopRightRadius:24,
                 paddingHorizontal:20, paddingTop:16, paddingBottom:36, maxHeight:'80%'},
  modalHandle:  {width:40, height:4, backgroundColor: C.border, borderRadius:2,
                 alignSelf:'center', marginBottom:16},
  modalTitle:   {fontSize:20, fontWeight:'900', color: C.gray900, marginBottom:4},
  modalHint:    {fontSize:11, color: C.gray500, marginBottom:14, lineHeight:16},
  modalItemTxt:      {fontSize:14, color: C.gray900, fontWeight:'600'},
  modalItemTxtActive:{color: C.blue, fontWeight:'900'},
  modalCloseBtn:     {backgroundColor: C.gray900, borderRadius:14, padding:14,
                      alignItems:'center', marginTop:14},
  modalCloseTxt:     {color:'#FFF', fontWeight:'900', fontSize:14},

  // Sprint 11: filas expandibles
  calCatRow:   {flexDirection:'row', alignItems:'center'},
  calCatItem:  {flex:1, flexDirection:'row', alignItems:'center', justifyContent:'space-between',
                paddingHorizontal:4, paddingVertical:12, borderBottomWidth:1, borderBottomColor: C.border},
  modalItemActive: {backgroundColor: C.blue+'0D', paddingHorizontal:10, borderRadius:8, marginHorizontal:-10},
  calExpandBtn:{flexDirection:'row', alignItems:'center', gap:3, paddingHorizontal:10,
               paddingVertical:12, borderBottomWidth:1, borderBottomColor: C.border},
  calExpandTxt:{fontSize:10, fontWeight:'700', color: C.primary},
  calSubItem:  {flexDirection:'row', alignItems:'center', paddingLeft:28, paddingRight:16,
               paddingVertical:10, backgroundColor: C.bg,
               borderBottomWidth:1, borderBottomColor: C.border},
  calSubItemActive: {backgroundColor: C.blueBg},
  calSubTxt:   {flex:1, fontSize:13, color: C.textMed, fontWeight:'500'},
  calEmptyBox: {padding:20, alignItems:'center', gap:10},
  calEmptyTxt: {fontSize:12, color: C.gray500, textAlign:'center', lineHeight:18},

  // Categorías
  catCardDB:     {backgroundColor: C.white, borderRadius:12, padding:12, marginBottom:8,
                  borderWidth:1, borderColor: C.border},
  catCardHeader: {flexDirection:'row', alignItems:'center', gap:8},
  catCardName:   {flex:1, fontSize:13, fontWeight:'800', color: C.gray900},
  catCardTags:   {fontSize:10, color: C.gray500},
  addCatRow:     {flexDirection:'row', gap:8, marginTop:8},
  addCatInput:   {flex:1, backgroundColor: C.white, borderRadius:12, paddingHorizontal:12,
                  paddingVertical:10, fontSize:13, borderWidth:1, borderColor: C.border,
                  color: C.gray900},
  addCatBtn:     {backgroundColor: C.primary, width:44, height:44, borderRadius:22,
                  justifyContent:'center', alignItems:'center'},

  // BBDD
  autoBackupCard:    {backgroundColor: C.white, borderRadius:14, padding:14, marginBottom:12,
                      borderWidth:1, borderColor: C.border},
  autoBackupHeader:  {flexDirection:'row', alignItems:'center', gap:8, marginBottom:10},
  autoBackupDot:     {width:10, height:10, borderRadius:5},
  autoBackupTitle:   {flex:1, fontSize:13, fontWeight:'800', color: C.gray900},
  autoBackupBody:    {gap:6},
  autoBackupRow:     {flexDirection:'row', alignItems:'center', gap:6},
  autoBackupOk:      {fontSize:12, color: C.success, fontWeight:'600'},
  autoBackupWarn:    {fontSize:12, color: C.warning, fontWeight:'600'},
  autoBackupMeta:    {flexDirection:'row', gap:16, marginTop:6},
  autoBackupMetaItem:{alignItems:'center'},
  autoBackupMetaVal: {fontSize:16, fontWeight:'900', color: C.gray900},
  autoBackupMetaLab: {fontSize:9, color: C.gray500, fontWeight:'600'},
  forceBackupBtn:    {flexDirection:'row', alignItems:'center', justifyContent:'center', gap:6,
                      marginTop:12, borderWidth:1.5, borderColor: C.blue, borderRadius:10, padding:10},
  forceBackupTxt:    {fontSize:13, fontWeight:'700', color: C.blue},

  infoBox:    {flexDirection:'row', gap:10, backgroundColor: C.blueBg, borderRadius:12,
               padding:12, marginBottom:14},
  infoTxt:    {flex:1, fontSize:11, color: C.gray900, lineHeight:18},

  dbStatsCard:  {backgroundColor: C.white, borderRadius:14, padding:14, marginBottom:14,
                 borderWidth:1, borderColor: C.border},
  dbStatsTitle: {fontSize:12, fontWeight:'800', color: C.gray900, marginBottom:10},
  dbStatsGrid:  {flexDirection:'row', gap:12},
  dbStatItem:   {flex:1, alignItems:'center'},
  dbStatVal:    {fontSize:20, fontWeight:'900'},
  dbStatLab:    {fontSize:9, color: C.gray500, fontWeight:'600', marginTop:2},
  dbIngresoRow: {flexDirection:'row', alignItems:'center', gap:6, marginTop:10},
  dbIngresoTxt: {fontSize:11, color: C.gray900},

  dbActionsRow: {flexDirection:'row', gap:10, marginBottom:10},
  dbActionBtn:  {flex:1, alignItems:'center', padding:14, borderRadius:14, gap:4},
  dbActionTxt:  {color:'#FFF', fontWeight:'900', fontSize:13},
  dbActionSub:  {color:'rgba(255,255,255,0.75)', fontSize:9},
  refreshStatsBtn:{flexDirection:'row', alignItems:'center', justifyContent:'center', gap:6, padding:10},
  refreshStatsTxt:{fontSize:12, color: C.blue, fontWeight:'700'},

  toggleBtn:       {paddingHorizontal:14, paddingVertical:7, borderRadius:20,
                    backgroundColor: C.gray100, borderWidth:1, borderColor: C.border},
  toggleBtnOn:     {backgroundColor: C.success, borderColor: C.success},
  toggleTxt:       {fontSize:12, fontWeight:'700', color: C.gray500},
  toggleTxtOn:     {color:'#FFF'},
});
