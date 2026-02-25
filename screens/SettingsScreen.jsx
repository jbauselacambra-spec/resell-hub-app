import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput,
  TouchableOpacity, Alert, Modal, FlatList, Switch,
  Animated, Dimensions,
} from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import { DatabaseService } from '../services/DatabaseService';

const { width } = Dimensions.get('window');

const MONTHS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

// ─── Paleta ────────────────────────────────────────────────────────────────
const C = {
  bg:       '#F8F9FA',
  white:    '#FFFFFF',
  primary:  '#FF6B35',
  blue:     '#004E89',
  success:  '#00D9A3',
  warning:  '#FFB800',
  danger:   '#E63946',
  gray900:  '#1A1A2E',
  gray700:  '#666666',
  gray500:  '#999999',
  gray100:  '#F0F0F0',
};

// ─── Secc tabs ─────────────────────────────────────────────────────────────
const TABS = [
  { id: 'thresholds', label: 'Umbrales',  icon: 'sliders' },
  { id: 'calendar',  label: 'Calendario', icon: 'calendar' },
  { id: 'categories',label: 'Categorías', icon: 'tag' },
  { id: 'import',    label: 'Importación',icon: 'download' },
  { id: 'notif',     label: 'Avisos',     icon: 'bell' },
];

// ─── Helpers ────────────────────────────────────────────────────────────────
const SectionTitle = ({ children, style }) => (
  <Text style={[styles.sectionTitle, style]}>{children}</Text>
);

const SettingCard = ({ label, desc, children }) => (
  <View style={styles.settingCard}>
    <View style={styles.cardInfo}>
      <Text style={styles.cardLabel}>{label}</Text>
      {desc ? <Text style={styles.cardDesc}>{desc}</Text> : null}
    </View>
    {children}
  </View>
);

const NumInput = ({ value, onChangeText, unit, width: w = 65 }) => (
  <View style={styles.numRow}>
    <TextInput
      style={[styles.numInput, { width: w }]}
      keyboardType="numeric"
      value={String(value)}
      onChangeText={onChangeText}
    />
    {unit ? <Text style={styles.numUnit}>{unit}</Text> : null}
  </View>
);

// ────────────────────────────────────────────────────────────────────────────
export default function SettingsScreen({ navigation }) {
  const [activeTab, setActiveTab] = useState('thresholds');

  // Configuración general
  const [config, setConfig] = useState({
    // Umbrales
    daysInvisible:        '60',
    viewsInvisible:       '20',
    daysDesinterest:      '45',
    daysCritical:         '90',
    // Estrategia
    staleMultiplier:      '1.5',
    criticalMonthThreshold: '6',
    ttsLightning:         '7',    // días TTS relámpago
    ttsAnchor:            '30',   // días TTS ancla
    priceBoostPct:        '10',   // % subida en relámpago
    priceCutPct:          '10',   // % bajada en ancla
    // Importación
    preserveCategory:     true,
    preserveUploadDate:   true,
    preserveSoldPrice:    true,
    preserveSoldDate:     true,
    preserveIsBundle:     true,
    autoDetectCategory:   true,
    autoGenerateSeoTags:  true,
    // Notificaciones
    notifEnabled:         true,
    notifDays:            '3',    // cada cuántos días revisar
    notifCritical:        true,
    notifStale:           true,
    notifSeasonal:        true,
    notifOpportunity:     true,
    // Calendario estacional — ahora es array por mes
    seasonalMap: {
      0: ['Juguetes'],
      1: ['Ropa'],
      2: ['Calzado'],
      3: ['Accesorios'],
      4: ['Calzado'],
      5: ['Entretenimiento'],
      6: ['Lotes'],
      7: ['Juguetes'],
      8: ['Ropa'],
      9: ['Disfraces'],
      10: ['Juguetes'],
      11: ['Juguetes'],
    },
  });

  // Diccionario categorías → { tags: [], subcategories: [] }
  const [dictionary, setDictionary] = useState({});
  const [newCatName, setNewCatName]   = useState('');
  const [newSubName, setNewSubName]   = useState('');
  const [newTag, setNewTag]           = useState('');
  const [expandedCat, setExpandedCat] = useState(null);
  const [expandedSub, setExpandedSub] = useState(null);  // {cat, sub}
  const [tagTarget, setTagTarget]     = useState(null);  // {cat, sub?}

  // Modal selector de categorías para el calendario
  const [calModal, setCalModal] = useState({ visible: false, monthIdx: null });

  // ── Carga inicial ────────────────────────────────────────────────────────
  useEffect(() => {
    const saved    = DatabaseService.getConfig();
    const savedDict = DatabaseService.getDictionary();

    if (saved) {
      // Migramos seasonalMap viejo (string) → nuevo (array)
      const sm = saved.seasonalMap || {};
      const newSm = {};
      for (let i = 0; i < 12; i++) {
        const val = sm[i];
        if (Array.isArray(val))        newSm[i] = val;
        else if (typeof val === 'string' && val) newSm[i] = [val];
        else                           newSm[i] = [];
      }
      setConfig(c => ({ ...c, ...saved, seasonalMap: newSm }));
    }

    if (savedDict) {
      // Migramos diccionario viejo (array de strings) → nuevo (objeto {tags, subcategories})
      const migrated = {};
      for (const [cat, val] of Object.entries(savedDict)) {
        if (Array.isArray(val)) {
          migrated[cat] = { tags: val, subcategories: {} };
        } else {
          migrated[cat] = {
            tags: val.tags || [],
            subcategories: val.subcategories || {},
          };
        }
      }
      setDictionary(migrated);
    }
  }, []);

  // ── Guardar config ───────────────────────────────────────────────────────
  const handleSave = () => {
    const ok = DatabaseService.saveConfig(config);
    if (ok) Alert.alert('✅ Guardado', 'Configuración actualizada correctamente.');
    else    Alert.alert('❌ Error', 'No se pudo guardar la configuración.');
  };

  const updateCfg = (key, val) => setConfig(c => ({ ...c, [key]: val }));

  // ── Calendario: añadir/quitar categoría de un mes ────────────────────────
  const toggleMonthCategory = (monthIdx, catName) => {
    const sm = { ...config.seasonalMap };
    const arr = sm[monthIdx] ? [...sm[monthIdx]] : [];
    const idx = arr.indexOf(catName);
    if (idx >= 0) arr.splice(idx, 1);
    else arr.push(catName);
    sm[monthIdx] = arr;
    setConfig(c => ({ ...c, seasonalMap: sm }));
  };

  const categoryNames = Object.keys(dictionary);

  // ── Categorías ────────────────────────────────────────────────────────────
  const saveDict = useCallback((newDict) => {
    setDictionary(newDict);
    // Convertimos al formato antiguo (array de strings) para compatibilidad con detectCategory
    const legacyDict = {};
    for (const [cat, val] of Object.entries(newDict)) {
      // Unificamos tags de categoría y de subcategorías
      const allTags = [...(val.tags || [])];
      for (const sub of Object.values(val.subcategories || {})) {
        allTags.push(...(sub.tags || []));
      }
      legacyDict[cat] = allTags;
    }
    DatabaseService.saveDictionary(legacyDict);
    // Guardamos versión completa en clave dedicada
    DatabaseService.saveFullDictionary(newDict);
  }, []);

  const addCategory = () => {
    const name = newCatName.trim();
    if (!name) return;
    if (dictionary[name]) { Alert.alert('Error', 'Categoría ya existe'); return; }
    const d = { ...dictionary, [name]: { tags: [], subcategories: {} } };
    saveDict(d);
    setNewCatName('');
  };

  const removeCategory = (cat) => {
    Alert.alert('Eliminar', `¿Borrar categoría "${cat}" y todas sus subcategorías?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: () => {
        const d = { ...dictionary };
        delete d[cat];
        saveDict(d);
        if (expandedCat === cat) setExpandedCat(null);
      }},
    ]);
  };

  const addSubcategory = (cat) => {
    const name = newSubName.trim();
    if (!name) return;
    const d = { ...dictionary };
    if (!d[cat].subcategories[name]) {
      d[cat].subcategories[name] = { tags: [] };
      saveDict(d);
    }
    setNewSubName('');
  };

  const removeSubcategory = (cat, sub) => {
    const d = { ...dictionary };
    delete d[cat].subcategories[sub];
    saveDict(d);
  };

  const addTag = (cat, sub) => {
    const tag = newTag.trim().toLowerCase();
    if (!tag) return;
    const d = { ...dictionary };
    const target = sub ? d[cat].subcategories[sub] : d[cat];
    if (!target.tags.includes(tag)) {
      target.tags.push(tag);
      saveDict(d);
    }
    setNewTag('');
    setTagTarget(null);
  };

  const removeTag = (cat, sub, tag) => {
    const d = { ...dictionary };
    const target = sub ? d[cat].subcategories[sub] : d[cat];
    target.tags = target.tags.filter(t => t !== tag);
    saveDict(d);
  };

  // ─── RENDERS POR TAB ─────────────────────────────────────────────────────

  const renderThresholds = () => (
    <View>
      <SectionTitle>Diagnóstico de productos</SectionTitle>

      <SettingCard
        label="Producto invisible"
        desc="Días sin ventas + pocas vistas para alertar"
      >
        <View style={styles.dualRow}>
          <NumInput value={config.daysInvisible} onChangeText={v => updateCfg('daysInvisible', v)} unit="días" />
          <NumInput value={config.viewsInvisible} onChangeText={v => updateCfg('viewsInvisible', v)} unit="vistas" />
        </View>
      </SettingCard>

      <SettingCard
        label="Falta de interés"
        desc="Días con vistas pero 0 favoritos"
      >
        <NumInput value={config.daysDesinterest} onChangeText={v => updateCfg('daysDesinterest', v)} unit="días" />
      </SettingCard>

      <SettingCard
        label="Estado crítico"
        desc="Días hasta marcar como urgente"
      >
        <NumInput value={config.daysCritical} onChangeText={v => updateCfg('daysCritical', v)} unit="días" />
      </SettingCard>

      <SectionTitle style={{ marginTop: 20 }}>Estrategia de velocidad (TTS)</SectionTitle>

      <SettingCard label="⚡ TTS Relámpago" desc="Vende en menos de estos días → sube precio">
        <View style={styles.dualRow}>
          <NumInput value={config.ttsLightning} onChangeText={v => updateCfg('ttsLightning', v)} unit="días" />
          <NumInput value={config.priceBoostPct} onChangeText={v => updateCfg('priceBoostPct', v)} unit="% sube" />
        </View>
      </SettingCard>

      <SettingCard label="⚓ TTS Ancla" desc="Tarda más de estos días → baja precio">
        <View style={styles.dualRow}>
          <NumInput value={config.ttsAnchor} onChangeText={v => updateCfg('ttsAnchor', v)} unit="días" />
          <NumInput value={config.priceCutPct} onChangeText={v => updateCfg('priceCutPct', v)} unit="% baja" />
        </View>
      </SettingCard>

      <SectionTitle style={{ marginTop: 20 }}>Inteligencia de estancamiento</SectionTitle>

      <SettingCard
        label="Sensibilidad (× media)"
        desc="Alertar cuando el producto tarda X veces más que la media de su categoría"
      >
        <NumInput value={config.staleMultiplier} onChangeText={v => updateCfg('staleMultiplier', v)} unit="× media" />
      </SettingCard>

      <SettingCard
        label="Límite histórico"
        desc="Meses antes de republicación obligatoria"
      >
        <NumInput value={config.criticalMonthThreshold} onChangeText={v => updateCfg('criticalMonthThreshold', v)} unit="meses" />
      </SettingCard>

      <SaveBtn onPress={handleSave} />
    </View>
  );

  const renderCalendar = () => (
    <View>
      <SectionTitle>Calendario de oportunidades</SectionTitle>
      <Text style={styles.calHint}>
        Asigna una o varias categorías a cada mes. El sistema priorizará esas categorías en las alertas y en "Smart Insights".
      </Text>

      {MONTHS.map((mes, idx) => {
        const selected = config.seasonalMap?.[idx] || [];
        return (
          <View key={idx} style={styles.calRow}>
            <View style={styles.calLeft}>
              <Text style={styles.calMonth}>{mes}</Text>
              <View style={styles.calChips}>
                {selected.length === 0 && (
                  <Text style={styles.calEmpty}>Sin categoría</Text>
                )}
                {selected.map(cat => (
                  <TouchableOpacity
                    key={cat}
                    style={styles.calChip}
                    onPress={() => toggleMonthCategory(idx, cat)}
                  >
                    <Text style={styles.calChipTxt}>{cat}</Text>
                    <Icon name="x" size={10} color={C.blue} />
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            <TouchableOpacity
              style={styles.calAddBtn}
              onPress={() => setCalModal({ visible: true, monthIdx: idx })}
            >
              <Icon name="plus" size={18} color={C.white} />
            </TouchableOpacity>
          </View>
        );
      })}

      <SaveBtn onPress={handleSave} />

      {/* Modal selector categoría */}
      <Modal
        visible={calModal.visible}
        transparent
        animationType="slide"
        onRequestClose={() => setCalModal({ visible: false, monthIdx: null })}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setCalModal({ visible: false, monthIdx: null })}
        >
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>
              Categorías para {calModal.monthIdx !== null ? MONTHS[calModal.monthIdx] : ''}
            </Text>
            <Text style={styles.modalHint}>Toca para añadir/quitar</Text>
            <FlatList
              data={categoryNames}
              keyExtractor={i => i}
              renderItem={({ item }) => {
                const active = (config.seasonalMap?.[calModal.monthIdx] || []).includes(item);
                return (
                  <TouchableOpacity
                    style={[styles.modalItem, active && styles.modalItemActive]}
                    onPress={() => toggleMonthCategory(calModal.monthIdx, item)}
                  >
                    <Text style={[styles.modalItemTxt, active && styles.modalItemTxtActive]}>
                      {item}
                    </Text>
                    {active && <Icon name="check" size={16} color={C.blue} />}
                  </TouchableOpacity>
                );
              }}
              ListEmptyComponent={
                <Text style={styles.calEmpty}>
                  No hay categorías. Créalas en la pestaña "Categorías".
                </Text>
              }
            />
            <TouchableOpacity
              style={styles.modalClose}
              onPress={() => setCalModal({ visible: false, monthIdx: null })}
            >
              <Text style={styles.modalCloseTxt}>Cerrar</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );

  const renderCategories = () => (
    <View>
      <SectionTitle>Diccionario de categorías</SectionTitle>
      <Text style={styles.calHint}>
        Las palabras clave (tags) permiten la detección automática de categoría. Las subcategorías ayudan a afinar el análisis de estadísticas.
      </Text>

      {/* Nueva categoría */}
      <View style={styles.addRow}>
        <TextInput
          style={styles.addInput}
          placeholder="Nueva categoría..."
          value={newCatName}
          onChangeText={setNewCatName}
          onSubmitEditing={addCategory}
        />
        <TouchableOpacity style={styles.addBtn} onPress={addCategory}>
          <Icon name="plus" size={20} color={C.white} />
        </TouchableOpacity>
      </View>

      {Object.keys(dictionary).map(cat => {
        const isExpanded = expandedCat === cat;
        const catData    = dictionary[cat];
        return (
          <View key={cat} style={styles.dictCard}>
            {/* Header categoría */}
            <TouchableOpacity
              style={styles.dictHeader}
              onPress={() => setExpandedCat(isExpanded ? null : cat)}
            >
              <View style={styles.dictHeaderLeft}>
                <View style={styles.catBadge}>
                  <Text style={styles.catBadgeTxt}>
                    {(catData.tags?.length || 0) + Object.values(catData.subcategories || {}).reduce((a, s) => a + (s.tags?.length || 0), 0)}
                  </Text>
                </View>
                <Text style={styles.dictTitle}>{cat}</Text>
                {Object.keys(catData.subcategories || {}).length > 0 && (
                  <View style={styles.subBadge}>
                    <Text style={styles.subBadgeTxt}>
                      {Object.keys(catData.subcategories).length} sub
                    </Text>
                  </View>
                )}
              </View>
              <View style={styles.dictActions}>
                <Icon name={isExpanded ? 'chevron-up' : 'chevron-down'} size={18} color={C.gray500} />
                <TouchableOpacity
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                  onPress={() => removeCategory(cat)}
                >
                  <Icon name="trash-2" size={18} color={C.danger} />
                </TouchableOpacity>
              </View>
            </TouchableOpacity>

            {isExpanded && (
              <View style={styles.dictBody}>
                {/* Tags de la categoría raíz */}
                <Text style={styles.subSectionLabel}>Tags generales</Text>
                <TagCloud
                  tags={catData.tags || []}
                  onRemove={tag => removeTag(cat, null, tag)}
                />
                {tagTarget?.cat === cat && !tagTarget?.sub ? (
                  <TagInput
                    value={newTag}
                    onChange={setNewTag}
                    onAdd={() => addTag(cat, null)}
                    onCancel={() => { setNewTag(''); setTagTarget(null); }}
                  />
                ) : (
                  <TouchableOpacity
                    style={styles.addTagBtn}
                    onPress={() => setTagTarget({ cat, sub: null })}
                  >
                    <Icon name="plus-circle" size={14} color={C.blue} />
                    <Text style={styles.addTagBtnTxt}>Añadir tag</Text>
                  </TouchableOpacity>
                )}

                {/* Subcategorías */}
                <View style={styles.subDivider} />
                <Text style={styles.subSectionLabel}>Subcategorías</Text>

                {Object.keys(catData.subcategories || {}).map(sub => {
                  const subData   = catData.subcategories[sub];
                  const isSubExp  = expandedSub?.cat === cat && expandedSub?.sub === sub;
                  return (
                    <View key={sub} style={styles.subCard}>
                      <TouchableOpacity
                        style={styles.subHeader}
                        onPress={() => setExpandedSub(isSubExp ? null : { cat, sub })}
                      >
                        <Icon name="corner-down-right" size={14} color={C.blue} />
                        <Text style={styles.subTitle}>{sub}</Text>
                        <Text style={styles.subCount}>{subData.tags?.length || 0} tags</Text>
                        <TouchableOpacity
                          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                          onPress={() => removeSubcategory(cat, sub)}
                        >
                          <Icon name="x" size={14} color={C.danger} />
                        </TouchableOpacity>
                      </TouchableOpacity>

                      {isSubExp && (
                        <View style={{ paddingLeft: 20 }}>
                          <TagCloud
                            tags={subData.tags || []}
                            onRemove={tag => removeTag(cat, sub, tag)}
                            small
                          />
                          {tagTarget?.cat === cat && tagTarget?.sub === sub ? (
                            <TagInput
                              value={newTag}
                              onChange={setNewTag}
                              onAdd={() => addTag(cat, sub)}
                              onCancel={() => { setNewTag(''); setTagTarget(null); }}
                            />
                          ) : (
                            <TouchableOpacity
                              style={styles.addTagBtn}
                              onPress={() => setTagTarget({ cat, sub })}
                            >
                              <Icon name="plus-circle" size={13} color={C.blue} />
                              <Text style={styles.addTagBtnTxt}>Añadir tag</Text>
                            </TouchableOpacity>
                          )}
                        </View>
                      )}
                    </View>
                  );
                })}

                {/* Nueva subcategoría */}
                <View style={styles.newSubRow}>
                  <TextInput
                    style={styles.newSubInput}
                    placeholder="Nueva subcategoría..."
                    value={newSubName}
                    onChangeText={setNewSubName}
                    onSubmitEditing={() => addSubcategory(cat)}
                  />
                  <TouchableOpacity
                    style={styles.newSubBtn}
                    onPress={() => addSubcategory(cat)}
                  >
                    <Icon name="plus" size={16} color={C.white} />
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        );
      })}

      <View style={{ height: 20 }} />
    </View>
  );

  const renderImport = () => (
    <View>
      <SectionTitle>Campos protegidos al importar</SectionTitle>
      <Text style={styles.calHint}>
        Cuando cargues un JSON actualizado de Vinted, estos campos manuales se conservarán aunque el producto haya cambiado.
      </Text>

      {[
        { key: 'preserveCategory',   label: 'Categoría / Subcategoría',    desc: 'Asignada manualmente — nunca se sobreescribe' },
        { key: 'preserveUploadDate', label: 'Fecha de subida original',     desc: 'El JSON siempre trae la fecha de extracción. Esta la protege.' },
        { key: 'preserveSoldPrice',  label: 'Precio final de venta',        desc: 'El precio real al que se vendió (campo manual)' },
        { key: 'preserveSoldDate',   label: 'Fecha real de venta',          desc: 'Fecha manual de cierre de venta' },
        { key: 'preserveIsBundle',   label: 'Venta en lote/pack',           desc: 'Marcado manual de si fue vendido como lote' },
      ].map(item => (
        <View key={item.key} style={styles.toggleCard}>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardLabel}>{item.label}</Text>
            <Text style={styles.cardDesc}>{item.desc}</Text>
          </View>
          <Switch
            value={!!config[item.key]}
            onValueChange={v => updateCfg(item.key, v)}
            trackColor={{ false: C.gray100, true: C.blue + '55' }}
            thumbColor={config[item.key] ? C.blue : C.gray500}
          />
        </View>
      ))}

      <SectionTitle style={{ marginTop: 24 }}>Automatización al importar</SectionTitle>

      {[
        { key: 'autoDetectCategory',  label: 'Detección automática de categoría', desc: 'Usa el diccionario para inferir categoría si no existe' },
        { key: 'autoGenerateSeoTags', label: 'Generación automática de SEO tags',  desc: 'Crea tags de búsqueda basados en título, marca y categoría' },
      ].map(item => (
        <View key={item.key} style={styles.toggleCard}>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardLabel}>{item.label}</Text>
            <Text style={styles.cardDesc}>{item.desc}</Text>
          </View>
          <Switch
            value={!!config[item.key]}
            onValueChange={v => updateCfg(item.key, v)}
            trackColor={{ false: C.gray100, true: C.success + '55' }}
            thumbColor={config[item.key] ? C.success : C.gray500}
          />
        </View>
      ))}

      <View style={styles.infoBox}>
        <Icon name="info" size={16} color={C.blue} />
        <Text style={styles.infoTxt}>
          Cuando importes <Text style={{ fontWeight: '900' }}>mis_productos_vinted_ACTUALIZADO.json</Text>, el sistema detectará automáticamente: cambios de precio, productos nuevos, posibles resubidas (mismo producto con ID diferente) y actualizaciones de estado. Los campos manuales marcados arriba jamás serán sobreescritos.
        </Text>
      </View>

      <SaveBtn onPress={handleSave} />
    </View>
  );

  const renderNotifications = () => (
    <View>
      <SectionTitle>Centro de notificaciones</SectionTitle>

      <View style={styles.toggleCard}>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardLabel}>Notificaciones activas</Text>
          <Text style={styles.cardDesc}>Habilita/deshabilita todos los avisos</Text>
        </View>
        <Switch
          value={!!config.notifEnabled}
          onValueChange={v => updateCfg('notifEnabled', v)}
          trackColor={{ false: C.gray100, true: C.primary + '55' }}
          thumbColor={config.notifEnabled ? C.primary : C.gray500}
        />
      </View>

      <SettingCard
        label="Frecuencia de revisión"
        desc="Cada cuántos días el sistema comprueba alertas activas"
      >
        <NumInput
          value={config.notifDays}
          onChangeText={v => updateCfg('notifDays', v)}
          unit="días"
          width={60}
        />
      </SettingCard>

      <SectionTitle style={{ marginTop: 20 }}>Tipos de alerta</SectionTitle>

      {[
        { key: 'notifCritical',    label: '🚨 Crítico',       desc: 'Producto supera el límite de meses sin venderse', color: C.danger },
        { key: 'notifStale',       label: '⏱️ Estancado',     desc: 'Producto más lento que la media de su categoría', color: C.warning },
        { key: 'notifSeasonal',    label: '📅 Estacional',    desc: 'Categoría prioritaria según el calendario de ventas', color: C.blue },
        { key: 'notifOpportunity', label: '💡 Oportunidad',   desc: 'Muchos favoritos → hacer oferta directa', color: C.success },
      ].map(item => (
        <View key={item.key} style={[styles.toggleCard, { borderLeftWidth: 3, borderLeftColor: item.color }]}>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardLabel}>{item.label}</Text>
            <Text style={styles.cardDesc}>{item.desc}</Text>
          </View>
          <Switch
            value={!!config[item.key]}
            onValueChange={v => updateCfg(item.key, v)}
            disabled={!config.notifEnabled}
            trackColor={{ false: C.gray100, true: item.color + '55' }}
            thumbColor={config[item.key] ? item.color : C.gray500}
          />
        </View>
      ))}

      <SaveBtn onPress={handleSave} />
    </View>
  );

  const tabContent = {
    thresholds: renderThresholds,
    calendar:   renderCalendar,
    categories: renderCategories,
    import:     renderImport,
    notif:      renderNotifications,
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Icon name="arrow-left" size={24} color={C.gray900} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Configuración</Text>
        <TouchableOpacity onPress={handleSave}>
          <Icon name="save" size={22} color={C.primary} />
        </TouchableOpacity>
      </View>

      {/* Tab bar */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.tabBar}
        contentContainerStyle={styles.tabBarContent}
      >
        {TABS.map(tab => (
          <TouchableOpacity
            key={tab.id}
            style={[styles.tab, activeTab === tab.id && styles.tabActive]}
            onPress={() => setActiveTab(tab.id)}
          >
            <Icon name={tab.icon} size={15} color={activeTab === tab.id ? C.blue : C.gray500} />
            <Text style={[styles.tabLabel, activeTab === tab.id && styles.tabLabelActive]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Content */}
      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentInner}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {(tabContent[activeTab] || (() => null))()}
        <View style={{ height: 120 }} />
      </ScrollView>
    </View>
  );
}

// ─── Sub-componentes internos ─────────────────────────────────────────────

const TagCloud = ({ tags, onRemove, small }) => (
  <View style={styles.tagCloud}>
    {tags.map(tag => (
      <View key={tag} style={[styles.tag, small && styles.tagSm]}>
        <Text style={[styles.tagTxt, small && styles.tagTxtSm]}>{tag}</Text>
        <TouchableOpacity
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          onPress={() => onRemove(tag)}
        >
          <Icon name="x" size={small ? 10 : 12} color={C.gray500} />
        </TouchableOpacity>
      </View>
    ))}
  </View>
);

const TagInput = ({ value, onChange, onAdd, onCancel }) => (
  <View style={styles.tagInputRow}>
    <TextInput
      style={styles.tagInput}
      placeholder="Escribe un tag..."
      value={value}
      onChangeText={onChange}
      autoFocus
      onSubmitEditing={onAdd}
    />
    <TouchableOpacity style={styles.tagAddBtn} onPress={onAdd}>
      <Icon name="check" size={14} color={C.white} />
    </TouchableOpacity>
    <TouchableOpacity style={styles.tagCancelBtn} onPress={onCancel}>
      <Icon name="x" size={14} color={C.gray700} />
    </TouchableOpacity>
  </View>
);

const SaveBtn = ({ onPress }) => (
  <TouchableOpacity style={styles.saveBtn} onPress={onPress} activeOpacity={0.85}>
    <Icon name="save" size={18} color={C.white} />
    <Text style={styles.saveBtnTxt}>GUARDAR CONFIGURACIÓN</Text>
  </TouchableOpacity>
);

// ─── Estilos ──────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container:       { flex: 1, backgroundColor: C.bg },

  // Header
  header:          { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 60, paddingBottom: 16, backgroundColor: C.white, elevation: 2, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8 },
  headerTitle:     { fontSize: 20, fontWeight: '900', color: C.gray900 },

  // Tabs
  tabBar:          { backgroundColor: C.white, maxHeight: 52, borderBottomWidth: 1, borderBottomColor: C.gray100 },
  tabBarContent:   { paddingHorizontal: 12, alignItems: 'center', gap: 6 },
  tab:             { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 20, marginVertical: 6 },
  tabActive:       { backgroundColor: C.blue + '15' },
  tabLabel:        { fontSize: 12, fontWeight: '600', color: C.gray500 },
  tabLabelActive:  { color: C.blue, fontWeight: '800' },

  // Content
  content:         { flex: 1 },
  contentInner:    { padding: 20 },

  sectionTitle:    { fontSize: 10, fontWeight: '900', color: C.gray500, letterSpacing: 1.8, textTransform: 'uppercase', marginBottom: 14 },

  // Setting cards
  settingCard:     { backgroundColor: C.white, padding: 18, borderRadius: 20, marginBottom: 14, elevation: 1, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6 },
  toggleCard:      { backgroundColor: C.white, flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 20, marginBottom: 12, elevation: 1, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, gap: 12 },
  cardInfo:        { marginBottom: 12 },
  cardLabel:       { fontSize: 15, fontWeight: '800', color: C.gray900 },
  cardDesc:        { fontSize: 11, color: C.gray500, marginTop: 3 },
  dualRow:         { flexDirection: 'row', gap: 16, flexWrap: 'wrap' },

  // Numeric input
  numRow:          { flexDirection: 'row', alignItems: 'center', gap: 8 },
  numInput:        { backgroundColor: C.bg, padding: 10, borderRadius: 12, textAlign: 'center', fontWeight: '900', color: C.gray900, borderWidth: 1, borderColor: C.gray100 },
  numUnit:         { fontSize: 11, fontWeight: '700', color: C.gray700 },

  // Calendario
  calHint:         { fontSize: 12, color: C.gray700, marginBottom: 18, lineHeight: 18 },
  calRow:          { backgroundColor: C.white, borderRadius: 18, padding: 16, marginBottom: 10, flexDirection: 'row', alignItems: 'flex-start', elevation: 1 },
  calLeft:         { flex: 1 },
  calMonth:        { fontSize: 14, fontWeight: '800', color: C.gray900, marginBottom: 8 },
  calChips:        { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  calChip:         { flexDirection: 'row', alignItems: 'center', backgroundColor: C.blue + '18', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10, gap: 5 },
  calChipTxt:      { fontSize: 11, fontWeight: '700', color: C.blue },
  calEmpty:        { fontSize: 11, color: C.gray500, fontStyle: 'italic' },
  calAddBtn:       { backgroundColor: C.blue, width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center', marginLeft: 10 },

  // Diccionario
  addRow:          { flexDirection: 'row', gap: 10, marginBottom: 20 },
  addInput:        { flex: 1, backgroundColor: C.white, padding: 14, borderRadius: 16, fontWeight: '700', color: C.gray900, elevation: 1 },
  addBtn:          { backgroundColor: C.primary, width: 50, justifyContent: 'center', alignItems: 'center', borderRadius: 16 },

  dictCard:        { backgroundColor: C.white, borderRadius: 20, marginBottom: 14, overflow: 'hidden', elevation: 1 },
  dictHeader:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 18 },
  dictHeaderLeft:  { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  catBadge:        { backgroundColor: C.primary + '20', width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  catBadgeTxt:     { fontSize: 11, fontWeight: '900', color: C.primary },
  dictTitle:       { fontSize: 16, fontWeight: '900', color: C.gray900 },
  subBadge:        { backgroundColor: C.blue + '18', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  subBadgeTxt:     { fontSize: 10, fontWeight: '700', color: C.blue },
  dictActions:     { flexDirection: 'row', gap: 16, alignItems: 'center' },

  dictBody:        { paddingHorizontal: 18, paddingBottom: 18 },
  subSectionLabel: { fontSize: 10, fontWeight: '800', color: C.gray500, letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 10 },
  subDivider:      { height: 1, backgroundColor: C.gray100, marginVertical: 14 },

  // Subcategorías
  subCard:         { backgroundColor: C.bg, borderRadius: 14, marginBottom: 8, overflow: 'hidden' },
  subHeader:       { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12 },
  subTitle:        { flex: 1, fontSize: 13, fontWeight: '700', color: C.gray900 },
  subCount:        { fontSize: 10, color: C.gray500 },

  // Tags
  tagCloud:        { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginBottom: 10 },
  tag:             { flexDirection: 'row', alignItems: 'center', backgroundColor: C.bg, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10, gap: 7, borderWidth: 1, borderColor: C.gray100 },
  tagSm:           { paddingHorizontal: 9, paddingVertical: 5 },
  tagTxt:          { fontSize: 12, color: C.blue, fontWeight: '700' },
  tagTxtSm:        { fontSize: 11 },
  tagInputRow:     { flexDirection: 'row', gap: 8, marginBottom: 10, alignItems: 'center' },
  tagInput:        { flex: 1, backgroundColor: C.bg, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, fontSize: 13, borderWidth: 1, borderColor: C.gray100 },
  tagAddBtn:       { backgroundColor: C.success, width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  tagCancelBtn:    { backgroundColor: C.gray100, width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  addTagBtn:       { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 6 },
  addTagBtnTxt:    { fontSize: 12, fontWeight: '700', color: C.blue },

  // Nueva sub
  newSubRow:       { flexDirection: 'row', gap: 8, marginTop: 10 },
  newSubInput:     { flex: 1, backgroundColor: C.bg, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, fontSize: 13, borderWidth: 1, borderColor: C.gray100 },
  newSubBtn:       { backgroundColor: C.blue, width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },

  // Modal
  modalOverlay:    { flex: 1, backgroundColor: '#00000055', justifyContent: 'flex-end' },
  modalSheet:      { backgroundColor: C.white, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, maxHeight: '70%' },
  modalTitle:      { fontSize: 18, fontWeight: '900', color: C.gray900, marginBottom: 4 },
  modalHint:       { fontSize: 12, color: C.gray500, marginBottom: 16 },
  modalItem:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: C.gray100 },
  modalItemActive: { backgroundColor: C.blue + '0D', paddingHorizontal: 12, borderRadius: 10, marginHorizontal: -12 },
  modalItemTxt:    { fontSize: 15, color: C.gray900, fontWeight: '600' },
  modalItemTxtActive: { color: C.blue, fontWeight: '900' },
  modalClose:      { backgroundColor: C.gray900, borderRadius: 16, padding: 16, alignItems: 'center', marginTop: 16 },
  modalCloseTxt:   { color: C.white, fontWeight: '900', fontSize: 15 },

  // Info box
  infoBox:         { backgroundColor: C.blue + '0D', borderRadius: 16, padding: 16, flexDirection: 'row', gap: 12, marginTop: 20, marginBottom: 10 },
  infoTxt:         { flex: 1, fontSize: 12, color: C.blue, lineHeight: 18 },

  // Save
  saveBtn:         { backgroundColor: C.gray900, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10, padding: 18, borderRadius: 20, marginTop: 24, marginBottom: 10 },
  saveBtnTxt:      { color: C.white, fontWeight: '900', fontSize: 14, letterSpacing: 0.5 },
});
