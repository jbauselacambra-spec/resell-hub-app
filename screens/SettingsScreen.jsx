/**
 * SettingsScreen.jsx — Design System v2
 *
 * Tabs: Umbrales | Calendario | Categorías | BBDD | Import | Alertas
 * useRef para stale closure en diccionario (Regla 9)
 *
 * [FIX post-auditoría]
 * - El diccionario solo se cargaba UNA VEZ al montar (useEffect con []).
 *   Con bottom-tabs las pantallas no se desmontan al cambiar de tab, así
 *   que si el usuario importaba un JSON en la tab "Importar" y
 *   VintedImportScreen.autoRegisterCategories() añadía una categoría nueva
 *   directamente en MMKV, SettingsScreen seguía mostrando el diccionario
 *   viejo. Si el usuario editaba cualquier categoría existente y pulsaba
 *   "Guardar categorías", `handleSaveDictionary()` sobreescribía MMKV con
 *   el estado local desactualizado → LA CATEGORÍA AUTO-REGISTRADA
 *   DESAPARECÍA (pérdida de datos silenciosa).
 *   Fix: listener de `focus` que fusiona (merge aditivo) categorías nuevas
 *   detectadas en el diccionario persistido, sin tocar/sobreescribir las
 *   que el usuario ya tiene cargadas o está editando localmente.
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Modal, Alert, ActivityIndicator,
} from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import { DatabaseService } from '../services/DatabaseService';
import { BackupService }   from '../services/BackupService';
import { VintedSalesDB }   from '../services/VintedParserService';
import {
  DS, RADIUS, SPACE, FONT_SIZE, FONT_FAMILY,
  TRACKING, LAYOUT,
} from '../theme';

const MONTHS = [
  'Enero','Febrero','Marzo','Abril','Mayo','Junio',
  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre',
];

const TABS = [
  { id: 'thresholds', label: 'Umbrales',   icon: 'sliders'   },
  { id: 'calendar',   label: 'Calendario', icon: 'calendar'  },
  { id: 'categories', label: 'Categorías', icon: 'tag'       },
  { id: 'database',   label: 'BBDD',       icon: 'database'  },
  { id: 'import',     label: 'Import',     icon: 'upload'    },
  { id: 'notif',      label: 'Alertas',    icon: 'bell'      },
];

// ─── Componentes auxiliares ───────────────────────────────────────────────────

const SectionLabel = ({ children }) => (
  <Text style={s.sectionLabel}>{children}</Text>
);

function SettingRow({ label, desc, children }) {
  return (
    <View style={s.settingRow}>
      <View style={s.settingLeft}>
        <Text style={s.settingLabel}>{label}</Text>
        {desc ? <Text style={s.settingDesc}>{desc}</Text> : null}
      </View>
      <View style={s.settingRight}>{children}</View>
    </View>
  );
}

function NumInput({ value, onChangeText, unit, width = 64 }) {
  return (
    <View style={s.numRow}>
      <TextInput
        style={[s.numInput, { width }]}
        keyboardType="numeric"
        value={String(value)}
        onChangeText={onChangeText}
      />
      {unit ? <Text style={s.numUnit}>{unit}</Text> : null}
    </View>
  );
}

function Toggle({ value, onPress }) {
  return (
    <TouchableOpacity
      style={[s.toggle, value && s.toggleOn]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={[s.toggleThumb, value && s.toggleThumbOn]} />
    </TouchableOpacity>
  );
}

function SaveBtn({ onPress, label = 'Guardar cambios' }) {
  return (
    <TouchableOpacity style={s.saveBtn} onPress={onPress} activeOpacity={0.8}>
      <Icon name="save" size={15} color="#fff" />
      <Text style={s.saveBtnText}>{label}</Text>
    </TouchableOpacity>
  );
}

// ─── CatCard expandible ───────────────────────────────────────────────────────
function CatCard({ cat, data, onDelete, onUpdateTags, onAddSub, onDeleteSub }) {
  const [expanded,   setExpanded]   = useState(false);
  const [newTag,     setNewTag]     = useState('');
  const [newSubName, setNewSubName] = useState('');
  const tags    = data?.tags                || [];
  const subcats = Object.keys(data?.subcategories || {});

  const addTag = () => {
    const t = newTag.trim();
    if (t && !tags.includes(t)) { onUpdateTags([...tags, t]); setNewTag(''); }
  };
  const addSub = () => {
    const n = newSubName.trim();
    if (n && !subcats.includes(n)) { onAddSub(n); setNewSubName(''); }
  };

  return (
    <View style={s.catCard}>
      <TouchableOpacity style={s.catCardHeader} onPress={() => setExpanded(e => !e)} activeOpacity={0.7}>
        <Icon name={expanded ? 'chevron-up' : 'chevron-down'} size={14} color={DS.text3} />
        <Text style={s.catCardName}>{cat}</Text>
        <Text style={s.catCardMeta}>{subcats.length} subs · {tags.length} tags</Text>
        <TouchableOpacity onPress={onDelete} hitSlop={{ top:8, bottom:8, left:8, right:8 }}>
          <Icon name="trash-2" size={14} color={DS.danger} />
        </TouchableOpacity>
      </TouchableOpacity>

      {expanded && (
        <View style={{ paddingTop: SPACE[3] }}>
          <Text style={s.catSubLabel}>Tags de búsqueda</Text>
          <View style={s.tagsRow}>
            {tags.map(t => (
              <TouchableOpacity key={t} style={s.tagChip} onPress={() => onUpdateTags(tags.filter(x => x !== t))}>
                <Text style={s.tagChipText}>{t}</Text>
                <Icon name="x" size={9} color={DS.brand} />
              </TouchableOpacity>
            ))}
          </View>
          <View style={s.addRow}>
            <TextInput
              style={[s.addInput, { flex: 1 }]}
              placeholder="Añadir tag…"
              placeholderTextColor={DS.text3}
              value={newTag}
              onChangeText={setNewTag}
              onSubmitEditing={addTag}
            />
            <TouchableOpacity style={s.addBtn} onPress={addTag}>
              <Icon name="plus" size={14} color="#fff" />
            </TouchableOpacity>
          </View>

          <Text style={[s.catSubLabel, { marginTop: SPACE[3] }]}>Subcategorías</Text>
          {subcats.map(sub => (
            <View key={sub} style={s.subRow}>
              <Icon name="corner-down-right" size={11} color={DS.blue} />
              <View style={s.subChip}><Text style={s.subChipText}>{sub}</Text></View>
              <TouchableOpacity onPress={() => onDeleteSub(sub)} hitSlop={{ top:8, bottom:8, left:8, right:8 }}>
                <Icon name="x" size={12} color={DS.danger} />
              </TouchableOpacity>
            </View>
          ))}
          <View style={[s.addRow, { marginTop: SPACE[2] }]}>
            <TextInput
              style={[s.addInput, { flex: 1 }]}
              placeholder="Nueva subcategoría…"
              placeholderTextColor={DS.text3}
              value={newSubName}
              onChangeText={setNewSubName}
              onSubmitEditing={addSub}
            />
            <TouchableOpacity style={[s.addBtn, { backgroundColor: DS.blue }]} onPress={addSub}>
              <Icon name="plus" size={14} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

// ─── Pantalla principal ───────────────────────────────────────────────────────
export default function SettingsScreen({ navigation }) {
  const [activeTab,  setActiveTab]  = useState('thresholds');
  const [config,     setConfig]     = useState(() => DatabaseService.getConfig());

  const dictionaryRef = useRef({});
  const [dictionary,  setDictionary] = useState({});
  const updateDictionary = (updater) => {
    if (typeof updater === 'function') {
      setDictionary(prev => { const next = updater(prev); dictionaryRef.current = next; return next; });
    } else {
      dictionaryRef.current = updater; setDictionary(updater);
    }
  };

  const [calModal,   setCalModal]   = useState({ visible: false, monthIdx: null });
  const [calExpCat,  setCalExpCat]  = useState(null);
  const [newCatName, setNewCatName] = useState('');
  const [dbStats,    setDbStats]    = useState(null);
  const [backupInfo, setBackupInfo] = useState(null);
  const [exporting,  setExporting]  = useState(false);
  const [forcingBak, setForcingBak] = useState(false);

  useEffect(() => {
    const saved = DatabaseService.getConfig();
    if (saved) {
      const sm = saved.seasonalMap || {};
      const newSm = {};
      for (let i = 0; i < 12; i++) {
        const v = sm[i]; newSm[i] = Array.isArray(v) ? v : (v ? [v] : []);
      }
      setConfig(c => ({ ...c, ...saved, seasonalMap: newSm }));
    }
    const full = DatabaseService.getFullDictionary();
    if (full && Object.keys(full).length > 0) {
      try { updateDictionary(JSON.parse(JSON.stringify(full))); } catch { updateDictionary(full); }
    } else {
      const leg = DatabaseService.getDictionary();
      if (leg && Object.keys(leg).length > 0) {
        const m = {};
        for (const [cat, val] of Object.entries(leg))
          m[cat] = Array.isArray(val) ? { tags: val, subcategories: {} } : { tags: val?.tags || [], subcategories: val?.subcategories || {} };
        updateDictionary(m);
      }
    }
  }, []);

  // [FIX post-auditoría] Con bottom-tabs esta pantalla NUNCA se desmonta al
  // cambiar de tab. Si el usuario importa un JSON en "Importar" y se
  // auto-registran categorías nuevas directamente en MMKV
  // (VintedImportScreen.autoRegisterCategories), el estado local `dictionary`
  // de esta pantalla se queda desactualizado. Si luego el usuario guarda
  // cualquier cambio de categorías, `handleSaveDictionary()` sobreescribiría
  // MMKV con el diccionario viejo y la categoría auto-registrada
  // desaparecería silenciosamente.
  //
  // Fix: al recuperar el foco, fusiona (merge ADITIVO) categorías nuevas
  // presentes en el diccionario persistido que no existan ya localmente.
  // Nunca toca ni sobreescribe categorías que el usuario ya tiene cargadas
  // o está editando — solo añade las que faltan.
  useEffect(() => {
    const unsub = navigation.addListener('focus', () => {
      const full = DatabaseService.getFullDictionary();
      if (full && Object.keys(full).length > 0) {
        updateDictionary(prev => {
          const merged = { ...prev };
          let added = false;
          Object.entries(full).forEach(([cat, data]) => {
            if (!merged[cat]) { merged[cat] = data; added = true; }
          });
          return added ? merged : prev;
        });
      }
    });
    return unsub;
  }, [navigation]);

  useEffect(() => {
    if (activeTab === 'database') { loadDbStats(); loadBackupInfo(); }
  }, [activeTab]);

  const loadDbStats = () => {
    try {
      const prods = DatabaseService.getAllProducts();
      const ss    = VintedSalesDB.getStats?.() || {};
      setDbStats({ total: prods.length, sold: prods.filter(p => p.status === 'sold').length, active: prods.filter(p => p.status !== 'sold').length, records: ss.totalRecords || 0, ingresos: ss.ingresosBrutos || 0 });
    } catch { setDbStats(null); }
  };
  const loadBackupInfo = async () => {
    try { setBackupInfo(await BackupService.getBackupInfo()); } catch { setBackupInfo(null); }
  };

  const handleSave = () => {
    DatabaseService.saveConfig(config)
      ? Alert.alert('✅ Guardado', 'Configuración actualizada.')
      : Alert.alert('❌ Error',   'No se pudo guardar.');
  };
  const updateCfg = (key, val) => setConfig(c => ({ ...c, [key]: val }));

  const toggleMonthItem = (monthIdx, item) => {
    const sm = { ...config.seasonalMap };
    const arr = sm[monthIdx] ? [...sm[monthIdx]] : [];
    const idx = arr.indexOf(item);
    idx === -1 ? arr.push(item) : arr.splice(idx, 1);
    sm[monthIdx] = arr;
    updateCfg('seasonalMap', sm);
  };

  const handleSaveDictionary = () => {
    const current = dictionaryRef.current;
    let clean;
    try { clean = JSON.parse(JSON.stringify(current)); } catch (e) { Alert.alert('Error', e.message); return; }
    const legacy = {};
    for (const [cat, val] of Object.entries(clean)) legacy[cat] = val?.tags || [];
    const ok = DatabaseService.saveFullDictionary(clean) && DatabaseService.saveDictionary(legacy);
    ok
      ? Alert.alert('✅ Categorías guardadas', `${Object.keys(clean).length} categorías actualizadas.`)
      : Alert.alert('⚠️ Error', 'Revisa los logs.');
  };

  // ── Renders ──────────────────────────────────────────────────────────────

  const renderThresholds = () => (
    <View>
      <SectionLabel>Velocidad de venta (TTS)</SectionLabel>
      <SettingRow label="⚡ Relámpago" desc="TTS menor → sube precios">
        <NumInput value={config.ttsLightning || 7}   onChangeText={v => updateCfg('ttsLightning', v)} unit="días" />
      </SettingRow>
      <SettingRow label="⚓ Ancla" desc="TTS mayor → baja precios">
        <NumInput value={config.ttsAnchor    || 30}  onChangeText={v => updateCfg('ttsAnchor', v)} unit="días" />
      </SettingRow>
      <SettingRow label="📈 Subida de precio">
        <NumInput value={config.priceBoostPct || 10} onChangeText={v => updateCfg('priceBoostPct', v)} unit="%" />
      </SettingRow>
      <SettingRow label="📉 Bajada de precio">
        <NumInput value={config.priceCutPct  || 10}  onChangeText={v => updateCfg('priceCutPct', v)} unit="%" />
      </SettingRow>

      <SectionLabel>Stock frío</SectionLabel>
      <SettingRow label="Días estancamiento">
        <NumInput value={config.daysInvisible || 60} onChangeText={v => updateCfg('daysInvisible', v)} unit="días" />
      </SettingRow>
      <SettingRow label="Días crítico">
        <NumInput value={config.daysCritical  || 90} onChangeText={v => updateCfg('daysCritical', v)} unit="días" />
      </SettingRow>

      <SectionLabel>Oportunidades</SectionLabel>
      <SettingRow label="⚡ Producto HOT">
        <View style={{ flexDirection: 'row', gap: SPACE[2] }}>
          <NumInput value={config.hotFavs  || 10} onChangeText={v => updateCfg('hotFavs', v)} unit="favs" />
          <NumInput value={config.hotViews || 50} onChangeText={v => updateCfg('hotViews', v)} unit="vis." />
        </View>
      </SettingRow>
      <SettingRow label="💚 Casi listo">
        <View style={{ flexDirection: 'row', gap: SPACE[2] }}>
          <NumInput value={config.daysAlmostReady || 30} onChangeText={v => updateCfg('daysAlmostReady', v)} unit="días" />
          <NumInput value={config.favsAlmostReady || 8}  onChangeText={v => updateCfg('favsAlmostReady', v)} unit="favs" />
        </View>
      </SettingRow>
      <SettingRow label="🔔 Alerta oportunidad">
        <View style={{ flexDirection: 'row', gap: SPACE[2] }}>
          <NumInput value={config.opportunityFavs || 5}  onChangeText={v => updateCfg('opportunityFavs', v)} unit="favs" />
          <NumInput value={config.opportunityDays || 30} onChangeText={v => updateCfg('opportunityDays', v)} unit="días" />
        </View>
      </SettingRow>
      <SaveBtn onPress={handleSave} />
    </View>
  );

  const renderCalendar = () => {
    const catNames = Object.keys(dictionary);
    return (
      <View>
        <SectionLabel>Calendario de oportunidades</SectionLabel>
        <Text style={s.hintText}>Asigna categorías o subcategorías a cada mes para alertas estacionales.</Text>
        {MONTHS.map((mes, idx) => {
          const selected = Array.isArray(config.seasonalMap?.[idx]) ? config.seasonalMap[idx] : [];
          return (
            <View key={idx} style={s.monthRow}>
              <Text style={s.monthName}>{mes}</Text>
              <View style={s.monthChips}>
                {selected.length === 0
                  ? <Text style={s.monthEmpty}>Sin asignar</Text>
                  : selected.map(item => {
                      const label = item.includes(' › ') ? item.split(' › ')[1] : item;
                      return (
                        <TouchableOpacity key={item} style={s.monthChip} onPress={() => toggleMonthItem(idx, item)} activeOpacity={0.7}>
                          <Text style={s.monthChipText}>{label}</Text>
                          <Icon name="x" size={9} color={DS.warning} />
                        </TouchableOpacity>
                      );
                    })
                }
              </View>
              <TouchableOpacity style={s.monthAddBtn} onPress={() => { setCalModal({ visible: true, monthIdx: idx }); setCalExpCat(null); }}>
                <Icon name="plus" size={14} color={DS.brand} />
              </TouchableOpacity>
            </View>
          );
        })}

        <Modal visible={calModal.visible} transparent animationType="slide">
          <View style={s.modalOverlay}>
            <View style={s.modalSheet}>
              <View style={s.modalHandle} />
              <Text style={s.modalTitle}>{calModal.monthIdx !== null ? MONTHS[calModal.monthIdx] : ''}</Text>
              <ScrollView style={{ maxHeight: 400 }}>
                {catNames.length === 0 && (
                  <View style={s.emptyModal}>
                    <Icon name="tag" size={24} color={DS.text3} />
                    <Text style={s.emptyModalText}>Sin categorías. Ve a la pestaña Categorías.</Text>
                  </View>
                )}
                {catNames.map(cat => {
                  const catSubs  = Object.keys(dictionary[cat]?.subcategories || {});
                  const isExp    = calExpCat === cat;
                  const isCatSel = config.seasonalMap?.[calModal.monthIdx]?.includes(cat);
                  return (
                    <View key={cat}>
                      <View style={s.calCatRow}>
                        <TouchableOpacity style={[s.calCatItem, isCatSel && s.calCatItemActive]} onPress={() => toggleMonthItem(calModal.monthIdx, cat)}>
                          <Text style={[s.calCatText, isCatSel && { color: DS.brand, fontWeight: '700' }]}>{cat}</Text>
                          {isCatSel && <Icon name="check" size={13} color={DS.brand} />}
                        </TouchableOpacity>
                        {catSubs.length > 0 && (
                          <TouchableOpacity style={s.calExpBtn} onPress={() => setCalExpCat(isExp ? null : cat)}>
                            <Icon name={isExp ? 'chevron-up' : 'chevron-down'} size={13} color={DS.text3} />
                            <Text style={s.calExpCount}>{catSubs.length}</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                      {isExp && catSubs.map(sub => {
                        const subKey   = `${cat} › ${sub}`;
                        const isSubSel = config.seasonalMap?.[calModal.monthIdx]?.includes(subKey);
                        return (
                          <TouchableOpacity key={subKey} style={[s.calSubItem, isSubSel && s.calSubItemActive]} onPress={() => toggleMonthItem(calModal.monthIdx, subKey)}>
                            <Icon name="corner-down-right" size={11} color={isSubSel ? DS.brand : DS.text3} style={{ marginRight: 6 }} />
                            <Text style={[s.calSubText, isSubSel && { color: DS.brand, fontWeight: '700' }]}>{sub}</Text>
                            {isSubSel && <Icon name="check" size={12} color={DS.brand} style={{ marginLeft: 'auto' }} />}
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  );
                })}
              </ScrollView>
              <TouchableOpacity style={s.modalCloseBtn} onPress={() => setCalModal({ visible: false, monthIdx: null })}>
                <Text style={s.modalCloseBtnText}>Cerrar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
        <SaveBtn onPress={handleSave} />
      </View>
    );
  };

  const renderCategories = () => {
    const catNames = Object.keys(dictionary);
    return (
      <View>
        <SectionLabel>Diccionario de categorías</SectionLabel>
        <Text style={s.hintText}>Añade categorías y subcategorías con sus tags de búsqueda.</Text>
        {catNames.length === 0 && (
          <View style={s.emptyState}>
            <Icon name="tag" size={32} color={DS.text3} />
            <Text style={s.emptyStateText}>Sin categorías. Añade una abajo.</Text>
          </View>
        )}
        {catNames.map(cat => (
          <CatCard
            key={cat} cat={cat} data={dictionary[cat]}
            onDelete={()         => updateDictionary(d => { const n = { ...d }; delete n[cat]; return n; })}
            onUpdateTags={tags   => updateDictionary(d => ({ ...d, [cat]: { ...d[cat], tags } }))}
            onAddSub={sub        => updateDictionary(d => ({ ...d, [cat]: { ...d[cat], subcategories: { ...(d[cat]?.subcategories || {}), [sub]: { tags: [] } } } }))}
            onDeleteSub={sub     => updateDictionary(d => { const subs = { ...(d[cat]?.subcategories || {}) }; delete subs[sub]; return { ...d, [cat]: { ...d[cat], subcategories: subs } }; })}
          />
        ))}
        <View style={s.addRow}>
          <TextInput style={[s.addInput, { flex: 1 }]} placeholder="Nueva categoría…" placeholderTextColor={DS.text3} value={newCatName} onChangeText={setNewCatName} />
          <TouchableOpacity style={s.addBtn} onPress={() => { const n = newCatName.trim(); if (!n || dictionary[n]) return; updateDictionary(d => ({ ...d, [n]: { tags: [], subcategories: {} } })); setNewCatName(''); }}>
            <Icon name="plus" size={14} color="#fff" />
          </TouchableOpacity>
        </View>
        <SaveBtn onPress={handleSaveDictionary} label="Guardar categorías" />
      </View>
    );
  };

  const renderDatabase = () => (
    <View>
      <SectionLabel>Auto-backup</SectionLabel>
      <View style={s.backupCard}>
        <View style={s.backupHeader}>
          <View style={[s.backupDot, { backgroundColor: backupInfo?.exists ? DS.success : DS.warning }]} />
          <Text style={s.backupTitle}>Backup automático</Text>
          <TouchableOpacity onPress={loadBackupInfo} hitSlop={{ top:8, bottom:8, left:8, right:8 }}>
            <Icon name="refresh-cw" size={13} color={DS.text3} />
          </TouchableOpacity>
        </View>
        {backupInfo?.exists ? (
          <View style={s.backupMeta}>
            {[
              { val: backupInfo.products, lab: 'Productos' },
              { val: `${backupInfo.sizeKB} KB`, lab: 'Tamaño' },
              { val: backupInfo.date ? new Date(backupInfo.date).toLocaleDateString('es-ES') : '—', lab: 'Última vez' },
            ].map(m => (
              <View key={m.lab} style={s.backupMetaItem}>
                <Text style={s.backupMetaVal}>{m.val}</Text>
                <Text style={s.backupMetaLab}>{m.lab}</Text>
              </View>
            ))}
          </View>
        ) : <Text style={s.backupWarn}>Sin backup local. Guarda uno ahora.</Text>}
        <TouchableOpacity style={s.backupBtn} disabled={forcingBak} onPress={async () => {
          setForcingBak(true);
          try {
            const FS      = require('expo-file-system');
            const payload = DatabaseService.exportFullDatabase();
            if (!payload) { Alert.alert('❌ Error', 'Payload vacío.'); return; }
            const path    = `${FS.documentDirectory}resellhub_auto_backup.json`;
            await FS.writeAsStringAsync(path, JSON.stringify({ ...payload, autoBackupAt: new Date().toISOString(), exportedBy: 'ResellHub_exportFullDatabase_v9' }), { encoding: FS.EncodingType.UTF8 });
            await loadBackupInfo();
            Alert.alert('✅ Backup guardado', `${payload.products?.length || 0} productos guardados.`);
          } catch (e) { Alert.alert('Error', e.message); }
          finally { setForcingBak(false); }
        }} activeOpacity={0.7}>
          {forcingBak ? <ActivityIndicator size="small" color={DS.blue} /> : <Icon name="save" size={14} color={DS.blue} />}
          <Text style={s.backupBtnText}>Guardar backup ahora</Text>
        </TouchableOpacity>
      </View>

      {dbStats && (
        <>
          <SectionLabel>Estado de la base de datos</SectionLabel>
          <View style={s.dbStatsRow}>
            {[
              { val: dbStats.total,   lab: 'Productos', color: DS.text    },
              { val: dbStats.sold,    lab: 'Vendidos',  color: DS.success },
              { val: dbStats.active,  lab: 'En stock',  color: DS.brand   },
              { val: dbStats.records, lab: 'Historial', color: DS.blue    },
            ].map(st => (
              <View key={st.lab} style={s.dbStatItem}>
                <Text style={[s.dbStatVal, { color: st.color }]}>{st.val}</Text>
                <Text style={s.dbStatLab}>{st.lab}</Text>
              </View>
            ))}
          </View>
        </>
      )}

      <SectionLabel>Seguro externo</SectionLabel>
      <View style={s.dbActionsRow}>
        <TouchableOpacity style={[s.dbAction, { backgroundColor: DS.blue }]} disabled={exporting} onPress={async () => {
          setExporting(true);
          try { const p = DatabaseService.exportFullDatabase(); await BackupService.exportToShare(p); }
          catch (e) { if (e.message !== 'User did not share') Alert.alert('Error', e.message); }
          finally { setExporting(false); }
        }} activeOpacity={0.7}>
          {exporting ? <ActivityIndicator size="small" color="#fff" /> : <Icon name="upload" size={16} color="#fff" />}
          <Text style={s.dbActionText}>Exportar JSON</Text>
          <Text style={s.dbActionSub}>Drive / Email</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.dbAction, { backgroundColor: DS.success }]} onPress={async () => {
          try {
            const r = await BackupService.importFromFile(p => DatabaseService.importFullDatabase(p));
            if (!r.cancelled) { Alert.alert('✅ Restaurado', `${r.products} productos · ${r.salesRecords} ventas`); loadDbStats(); loadBackupInfo(); }
          } catch (e) { Alert.alert('Error', e.message); }
        }} activeOpacity={0.7}>
          <Icon name="download" size={16} color="#fff" />
          <Text style={s.dbActionText}>Restaurar JSON</Text>
          <Text style={s.dbActionSub}>Desde .json</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderImport = () => (
    <View>
      <SectionLabel>Opciones de importación</SectionLabel>
      <View style={s.infoBox}>
        <Icon name="info" size={15} color={DS.blue} />
        <Text style={s.infoBoxText}>La importación se realiza desde la pestaña Importar del menú principal.</Text>
      </View>
      <SettingRow label="Detectar categoría auto" desc="A partir del título y la marca">
        <Toggle value={!!config.autoDetectCategory} onPress={() => updateCfg('autoDetectCategory', !config.autoDetectCategory)} />
      </SettingRow>
      <SettingRow label="Buscar duplicados">
        <TouchableOpacity style={s.linkBtn} onPress={() => navigation.navigate('Deduplication')} activeOpacity={0.7}>
          <Text style={s.linkBtnText}>Abrir</Text>
          <Icon name="arrow-right" size={13} color={DS.brand} />
        </TouchableOpacity>
      </SettingRow>
      <SaveBtn onPress={handleSave} />
    </View>
  );

  const renderNotif = () => (
    <View>
      <SectionLabel>Notificaciones y alertas</SectionLabel>
      <SettingRow label="Alertas de resubida" desc="Cuando un producto deba resubirse">
        <Toggle value={!!config.notifRepost} onPress={() => updateCfg('notifRepost', !config.notifRepost)} />
      </SettingRow>
      <SettingRow label="Alertas de stock frío" desc={`Productos sin vender más de ${config.daysInvisible || 60} días`}>
        <Toggle value={!!config.notifStale} onPress={() => updateCfg('notifStale', !config.notifStale)} />
      </SettingRow>
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
    <View style={s.container}>
      <View style={s.header}>
        <Text style={s.headerTitle}>Configuración</Text>
        <Text style={s.headerSub}>ResellHub · ajustes del sistema</Text>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.tabScroll} contentContainerStyle={s.tabScrollContent}>
        {TABS.map(tab => {
          const active = activeTab === tab.id;
          return (
            <TouchableOpacity key={tab.id} style={[s.tabBtn, active && s.tabBtnActive]} onPress={() => setActiveTab(tab.id)} activeOpacity={0.7}>
              <Icon name={tab.icon} size={13} color={active ? DS.brand : DS.text3} />
              <Text style={[s.tabLabel, active && s.tabLabelActive]}>{tab.label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <ScrollView style={s.content} contentContainerStyle={s.contentPad}>
        {renderTab()}
        <View style={{ height: LAYOUT.tabBarH + SPACE[4] }} />
      </ScrollView>
    </View>
  );
}

// ─── Estilos ──────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: DS.surface2 },
  header: {
    paddingHorizontal: LAYOUT.screenPadH, paddingTop: LAYOUT.headerPadT,
    paddingBottom: SPACE[4], backgroundColor: DS.surface,
    borderBottomWidth: 1, borderBottomColor: DS.border,
  },
  headerTitle: { fontSize: 24, fontWeight: '700', color: DS.text, letterSpacing: -0.4 },
  headerSub:   { fontSize: FONT_SIZE.xs, color: DS.text3, marginTop: 2 },

  tabScroll:        { backgroundColor: DS.surface, borderBottomWidth: 1, borderBottomColor: DS.border, maxHeight: 52 },
  tabScrollContent: { paddingHorizontal: LAYOUT.screenPadH, paddingVertical: SPACE[2], gap: SPACE[1], alignItems: 'center' },
  tabBtn:       { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: SPACE[3], paddingVertical: SPACE[2], borderRadius: RADIUS.full },
  tabBtnActive: { backgroundColor: DS.brandDim },
  tabLabel:     { fontSize: 11, fontWeight: '600', color: DS.text3 },
  tabLabelActive: { color: DS.brand, fontWeight: '700' },

  content:    { flex: 1 },
  contentPad: { padding: LAYOUT.screenPadH, paddingTop: SPACE[5] },

  sectionLabel: { fontSize: 9, fontWeight: '700', color: DS.text3, letterSpacing: TRACKING.widest, textTransform: 'uppercase', marginTop: SPACE[5], marginBottom: SPACE[3] },
  hintText:     { fontSize: FONT_SIZE.xs, color: DS.text3, lineHeight: 16, marginBottom: SPACE[4] },

  settingRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: DS.surface, borderRadius: RADIUS.md, padding: SPACE[4], marginBottom: SPACE[2], borderWidth: 1, borderColor: DS.border, gap: SPACE[3] },
  settingLeft:  { flex: 1 },
  settingLabel: { fontSize: FONT_SIZE.sm + 1, fontWeight: '600', color: DS.text, marginBottom: 2 },
  settingDesc:  { fontSize: FONT_SIZE.xs, color: DS.text3 },
  settingRight: { alignItems: 'flex-end' },

  numRow:  { flexDirection: 'row', alignItems: 'center', gap: 5 },
  numInput:{ borderWidth: 1, borderColor: DS.borderMed, borderRadius: RADIUS.sm, paddingHorizontal: SPACE[2], paddingVertical: SPACE[2], fontSize: 14, fontWeight: '700', color: DS.text, textAlign: 'center', backgroundColor: DS.surface2, fontFamily: FONT_FAMILY.mono },
  numUnit: { fontSize: FONT_SIZE.xs, color: DS.text3, fontWeight: '600' },

  toggle:        { width: 44, height: 24, borderRadius: 12, backgroundColor: DS.surface3, borderWidth: 1, borderColor: DS.borderMed, justifyContent: 'center', paddingHorizontal: 2 },
  toggleOn:      { backgroundColor: DS.brand, borderColor: DS.brand },
  toggleThumb:   { width: 18, height: 18, borderRadius: 9, backgroundColor: DS.text3 },
  toggleThumbOn: { backgroundColor: '#fff', transform: [{ translateX: 20 }] },

  saveBtn:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACE[2], backgroundColor: DS.brand, borderRadius: RADIUS.lg, paddingVertical: SPACE[4], marginTop: SPACE[5] },
  saveBtnText: { color: '#fff', fontSize: FONT_SIZE.base, fontWeight: '600' },

  monthRow:     { flexDirection: 'row', alignItems: 'center', gap: SPACE[2], paddingVertical: SPACE[3], borderBottomWidth: 1, borderBottomColor: DS.border },
  monthName:    { width: 72, fontSize: 12, fontWeight: '600', color: DS.text },
  monthChips:   { flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  monthEmpty:   { fontSize: FONT_SIZE.xs, color: DS.text3, fontStyle: 'italic' },
  monthChip:    { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: DS.warningDim, paddingHorizontal: SPACE[2], paddingVertical: 2, borderRadius: RADIUS.full },
  monthChipText:{ fontSize: 10, fontWeight: '700', color: DS.warning },
  monthAddBtn:  { width: 28, height: 28, borderRadius: 14, backgroundColor: DS.brandDim, alignItems: 'center', justifyContent: 'center' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalSheet:   { backgroundColor: DS.surface, borderTopLeftRadius: RADIUS.xl, borderTopRightRadius: RADIUS.xl, paddingHorizontal: LAYOUT.screenPadH, paddingTop: SPACE[3], paddingBottom: SPACE[8], maxHeight: '75%' },
  modalHandle:  { width: 38, height: 4, backgroundColor: DS.border, borderRadius: 2, alignSelf: 'center', marginBottom: SPACE[4] },
  modalTitle:   { fontSize: 18, fontWeight: '700', color: DS.text, marginBottom: SPACE[4] },
  calCatRow:    { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: DS.border },
  calCatItem:   { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: SPACE[3], paddingHorizontal: SPACE[1] },
  calCatItemActive: { backgroundColor: DS.brandDim, borderRadius: RADIUS.sm, margin: 2 },
  calCatText:   { fontSize: FONT_SIZE.base, color: DS.text },
  calExpBtn:    { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: SPACE[3], paddingVertical: SPACE[3] },
  calExpCount:  { fontSize: 10, fontWeight: '700', color: DS.brand },
  calSubItem:   { flexDirection: 'row', alignItems: 'center', paddingLeft: SPACE[6], paddingVertical: SPACE[3], borderBottomWidth: 1, borderBottomColor: DS.border },
  calSubItemActive: { backgroundColor: DS.brandDim },
  calSubText:   { flex: 1, fontSize: FONT_SIZE.sm + 1, color: DS.text2 },
  emptyModal:   { alignItems: 'center', paddingVertical: SPACE[6], gap: SPACE[2] },
  emptyModalText:{ fontSize: 13, color: DS.text3, textAlign: 'center' },
  modalCloseBtn:{ backgroundColor: DS.text, borderRadius: RADIUS.md, paddingVertical: SPACE[4], alignItems: 'center', marginTop: SPACE[4] },
  modalCloseBtnText: { color: '#fff', fontWeight: '700', fontSize: FONT_SIZE.base },

  catCard:       { backgroundColor: DS.surface, borderRadius: RADIUS.md, borderWidth: 1, borderColor: DS.border, padding: SPACE[3], marginBottom: SPACE[2] },
  catCardHeader: { flexDirection: 'row', alignItems: 'center', gap: SPACE[2] },
  catCardName:   { flex: 1, fontSize: FONT_SIZE.sm + 1, fontWeight: '600', color: DS.text },
  catCardMeta:   { fontSize: FONT_SIZE.xs, color: DS.text3 },
  catSubLabel:   { fontSize: 9, fontWeight: '700', color: DS.text3, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: SPACE[2] },
  tagsRow:       { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: SPACE[2] },
  tagChip:       { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: DS.brandDim, paddingHorizontal: SPACE[2], paddingVertical: 3, borderRadius: RADIUS.full },
  tagChipText:   { fontSize: 11, fontWeight: '600', color: DS.brand },
  addRow:        { flexDirection: 'row', gap: SPACE[2], alignItems: 'center' },
  addInput:      { flex: 1, backgroundColor: DS.surface2, borderRadius: RADIUS.sm, borderWidth: 1, borderColor: DS.border, paddingHorizontal: SPACE[3], paddingVertical: SPACE[2], fontSize: FONT_SIZE.sm + 1, color: DS.text },
  addBtn:        { width: 38, height: 38, borderRadius: RADIUS.sm, backgroundColor: DS.brand, alignItems: 'center', justifyContent: 'center' },
  subRow:        { flexDirection: 'row', alignItems: 'center', gap: SPACE[2], marginBottom: SPACE[2] },
  subChip:       { backgroundColor: DS.blueDim, borderRadius: RADIUS.sm, paddingHorizontal: SPACE[2], paddingVertical: 3, flex: 1 },
  subChipText:   { fontSize: 12, fontWeight: '600', color: DS.blue },
  emptyState:    { alignItems: 'center', paddingVertical: SPACE[6], gap: SPACE[2] },
  emptyStateText:{ fontSize: 13, color: DS.text3, textAlign: 'center' },

  backupCard:    { backgroundColor: DS.surface, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: DS.border, padding: SPACE[4], marginBottom: SPACE[4] },
  backupHeader:  { flexDirection: 'row', alignItems: 'center', gap: SPACE[2], marginBottom: SPACE[3] },
  backupDot:     { width: 8, height: 8, borderRadius: 4 },
  backupTitle:   { flex: 1, fontSize: 13, fontWeight: '700', color: DS.text },
  backupMeta:    { flexDirection: 'row', gap: SPACE[4], marginBottom: SPACE[3] },
  backupMetaItem:{ alignItems: 'center' },
  backupMetaVal: { fontSize: 18, fontWeight: '700', color: DS.text, fontFamily: FONT_FAMILY.mono },
  backupMetaLab: { fontSize: 9, color: DS.text3, fontWeight: '600', marginTop: 2 },
  backupWarn:    { fontSize: 12, color: DS.warning, marginBottom: SPACE[3] },
  backupBtn:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACE[2], borderWidth: 1.5, borderColor: DS.blue, borderRadius: RADIUS.md, paddingVertical: SPACE[3] },
  backupBtnText: { fontSize: 13, fontWeight: '700', color: DS.blue },
  dbStatsRow:    { flexDirection: 'row', backgroundColor: DS.surface, borderRadius: RADIUS.md, borderWidth: 1, borderColor: DS.border, padding: SPACE[4], marginBottom: SPACE[2] },
  dbStatItem:    { flex: 1, alignItems: 'center' },
  dbStatVal:     { fontSize: 20, fontWeight: '700', fontFamily: FONT_FAMILY.mono },
  dbStatLab:     { fontSize: 9, color: DS.text3, fontWeight: '600', marginTop: 2 },
  dbActionsRow:  { flexDirection: 'row', gap: SPACE[2] },
  dbAction:      { flex: 1, alignItems: 'center', padding: SPACE[4], borderRadius: RADIUS.md, gap: SPACE[1] },
  dbActionText:  { color: '#fff', fontWeight: '700', fontSize: 13 },
  dbActionSub:   { color: 'rgba(255,255,255,0.7)', fontSize: 9 },

  infoBox:     { flexDirection: 'row', alignItems: 'flex-start', gap: SPACE[2], backgroundColor: DS.blueLight, borderRadius: RADIUS.md, padding: SPACE[3], marginBottom: SPACE[4] },
  infoBoxText: { flex: 1, fontSize: FONT_SIZE.xs, color: DS.text2, lineHeight: 17 },
  linkBtn:     { flexDirection: 'row', alignItems: 'center', gap: 4 },
  linkBtnText: { fontSize: FONT_SIZE.sm, fontWeight: '600', color: DS.brand },
});