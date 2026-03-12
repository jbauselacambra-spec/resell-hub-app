/**
 * SettingsScreen.jsx — Sprint 10
 *
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * [ORCHESTRATOR] Sprint 10 — Persistencia de BBDD ante rebuilds de APK
 *
 * [ARCHITECT] CAMBIOS EN TAB "💾 BBDD":
 *   ANTES (Sprint 9): solo Export manual + Import manual
 *   AHORA (Sprint 10): añade sección "Auto-Backup" con:
 *     - Estado del backup automático (fecha, nº productos, tamaño)
 *     - Botón "Forzar backup ahora" (actualiza el fichero de FileSystem)
 *     - Info card: explica la doble capa de persistencia
 *     - Export manual: ahora delega en BackupService.exportToShare()
 *     - Import manual: ahora delega en BackupService.importFromFile()
 *
 * [MIGRATION_MANAGER] ESTRATEGIA DE PERSISTENCIA SPRINT 10:
 *   CAPA 1 (MMKV): datos en memoria — rápido, puede perderse al reinstalar
 *   CAPA 2 (FileSystem.documentDirectory): auto-backup JSON persistente
 *     → sobrevive a actualizaciones de APK sin desinstalar ✅
 *     → se pierde solo si el usuario desinstala manualmente ⚠️
 *   CAPA 3 (Share API): export manual a Drive/email como seguro externo
 *
 * [QA_ENGINEER] Sin cambios en otras tabs. Solo la tab "database" es nueva.
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput,
  TouchableOpacity, Alert, Modal, FlatList, Share,
  ActivityIndicator, Dimensions,
} from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import { DatabaseService } from '../services/DatabaseService';
import { VintedSalesDB } from '../services/VintedParserService';
import LogService from '../services/LogService';
// [Sprint 10] BackupService para la nueva sección de auto-backup
import { BackupService } from '../services/BackupService';

// DocumentPicker — instalado en Sprint 8
let DocumentPicker, FileSystem;
try {
  DocumentPicker = require('expo-document-picker');
  FileSystem     = require('expo-file-system');
} catch { /* graceful — si no está instalado no rompe */ }

const { width } = Dimensions.get('window');
const MONTHS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

// ─── Paleta canónica DS ───────────────────────────────────────────────────────
const C = {
  bg:      '#F8F9FA', white:   '#FFFFFF', primary: '#FF6B35',
  blue:    '#004E89', success: '#00D9A3', warning: '#FFB800',
  danger:  '#E63946', gray900: '#1A1A2E', gray700: '#5C6070',
  gray500: '#A0A5B5', gray100: '#F0F2F5', border:  '#EAEDF0',
};

const TABS = [
  { id: 'thresholds', label: 'Umbrales',  icon: 'sliders'   },
  { id: 'calendar',  label: 'Calendario', icon: 'calendar'  },
  { id: 'categories',label: 'Categorías', icon: 'tag'       },
  { id: 'database',  label: '💾 BBDD',    icon: 'database'  }, // Sprint 9: NUEVA
  { id: 'import',    label: 'Importación',icon: 'download'  },
  { id: 'notif',     label: 'Avisos',     icon: 'bell'      },
];

// ─── Sub-componentes ──────────────────────────────────────────────────────────
const SectionTitle = ({ children }) => (
  <Text style={styles.sectionTitle}>{children}</Text>
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

// ─── Pantalla principal ───────────────────────────────────────────────────────
export default function SettingsScreen({ navigation }) {
  const [activeTab, setActiveTab] = useState('thresholds');
  const [config, setConfig] = useState(() => DatabaseService.getConfig());
  const [dictionary, setDictionary] = useState({});
  const [calModal, setCalModal] = useState({ visible: false, monthIdx: null });
  const [newCatName, setNewCatName] = useState('');
  const [selectedCatForSub, setSelectedCatForSub] = useState(null);
  const [newSubName, setNewSubName] = useState('');

  // Sprint 9: estados para export/import BBDD
  const [dbStats,     setDbStats]     = useState(null);
  const [exporting,   setExporting]   = useState(false);
  const [importing,   setImporting]   = useState(false);
  // Sprint 10: estado del auto-backup persistente
  const [backupInfo,  setBackupInfo]  = useState(null);
  const [forcingBackup, setForcingBackup] = useState(false);

  useEffect(() => {
    const saved     = DatabaseService.getConfig();
    const savedDict = DatabaseService.getDictionary();

    if (saved) {
      const sm = saved.seasonalMap || {};
      const newSm = {};
      for (let i = 0; i < 12; i++) {
        const val = sm[i];
        if (Array.isArray(val))               newSm[i] = val;
        else if (typeof val === 'string' && val) newSm[i] = [val];
        else                                  newSm[i] = [];
      }
      setConfig(c => ({ ...c, ...saved, seasonalMap: newSm }));
    }

    if (savedDict) {
      const migrated = {};
      for (const [cat, val] of Object.entries(savedDict)) {
        migrated[cat] = Array.isArray(val)
          ? { tags: val, subcategories: {} }
          : { tags: val.tags || [], subcategories: val.subcategories || {} };
      }
      setDictionary(migrated);
    }
  }, []);

  // Cargar estadísticas BBDD cuando se abre la tab
  useEffect(() => {
    if (activeTab === 'database') {
      loadDbStats();
      loadBackupInfo(); // [Sprint 10]
    }
  }, [activeTab]);

  // [Sprint 10] Cargar info del auto-backup desde FileSystem
  const loadBackupInfo = async () => {
    try {
      const info = await BackupService.getBackupInfo();
      setBackupInfo(info);
    } catch { setBackupInfo(null); }
  };

  const loadDbStats = () => {
    try {
      const products    = DatabaseService.getAllProducts();
      const sold        = products.filter(p => p.status === 'sold');
      const salesStats  = VintedSalesDB.getStats?.() || {};
      setDbStats({
        totalProducts:  products.length,
        soldProducts:   sold.length,
        activeProducts: products.filter(p => p.status !== 'sold').length,
        salesRecords:   salesStats.totalRecords || 0,
        ventas:         salesStats.totalVentas  || 0,
        compras:        salesStats.totalCompras || 0,
        ingresos:       salesStats.ingresosBrutos || 0,
        lastProduct:    products.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))[0]?.title || '—',
      });
    } catch { setDbStats(null); }
  };

  const handleSave = () => {
    const ok = DatabaseService.saveConfig(config);
    if (ok) Alert.alert('✅ Guardado', 'Configuración actualizada.');
    else    Alert.alert('❌ Error', 'No se pudo guardar la configuración.');
  };

  const updateCfg = (key, val) => setConfig(c => ({ ...c, [key]: val }));

  const toggleMonthCategory = (monthIdx, catName) => {
    const sm  = { ...config.seasonalMap };
    const arr = sm[monthIdx] ? [...sm[monthIdx]] : [];
    const idx = arr.indexOf(catName);
    if (idx === -1) arr.push(catName);
    else arr.splice(idx, 1);
    sm[monthIdx] = arr;
    updateCfg('seasonalMap', sm);
  };

  // ── [Sprint 10] Forzar backup ahora ──────────────────────────────────────
  const handleForceBackup = async () => {
    setForcingBackup(true);
    try {
      const FS = require('expo-file-system');
      const payload = DatabaseService.exportFullDatabase();
      if (!payload) { Alert.alert('❌ Error', 'No se pudo generar el backup.'); return; }
      const path = `${FS.documentDirectory}resellhub_auto_backup.json`;
      await FS.writeAsStringAsync(
        path,
        JSON.stringify({ ...payload, autoBackupAt: new Date().toISOString(), exportedBy: 'ResellHub_exportFullDatabase_v9' }),
        { encoding: FS.EncodingType.UTF8 },
      );
      await loadBackupInfo();
      Alert.alert('✅ Backup guardado', `${payload.products?.length || 0} productos guardados en el dispositivo.\n\nEste backup se restaura automáticamente si reinstelas la app.`);
    } catch (e) {
      Alert.alert('Error al hacer backup', e.message);
    } finally {
      setForcingBackup(false);
    }
  };

  // ── [Sprint 10] Exportar BBDD (compartir externamente) ───────────────────
  const handleExportDB = async () => {
    setExporting(true);
    try {
      const payload = DatabaseService.exportFullDatabase();
      await BackupService.exportToShare(payload);
    } catch (e) {
      if (e.message !== 'User did not share') {
        Alert.alert('Error al exportar', e.message);
      }
    } finally {
      setExporting(false);
    }
  };

  // ── [Sprint 10] Importar/Restaurar BBDD desde fichero ────────────────────
  const handleImportDB = async () => {
    try {
      const result = await BackupService.importFromFile(
        (payload) => DatabaseService.importFullDatabase(payload),
      );
      if (result.cancelled) return;
      const msg = [
        '✅ Restauración completada',
        `📦 Productos: ${result.products}`,
        `💰 Ventas históricas: ${result.salesRecords}`,
        result.configRestored ? '⚙️ Config restaurada' : '',
        result.exportedAt ? `📅 Backup del: ${result.exportedAt.slice(0, 10)}` : '',
        result.errors?.length > 0 ? `⚠️ Errores: ${result.errors.join(', ')}` : '',
      ].filter(Boolean).join('\n');

      Alert.alert('BBDD Restaurada', msg, [
        { text: 'OK', onPress: () => { loadDbStats(); loadBackupInfo(); } },
      ]);
    } catch (e) {
      Alert.alert('Error al importar', e.message);
    } finally {
      setImporting(false);
    }
  };

  // ─── RENDER: Tab BBDD ─────────────────────────────────────────────────────
  const renderDatabase = () => (
    <View>
      <SectionTitle>Base de Datos</SectionTitle>

      {/* ── AUTO-BACKUP STATUS (Sprint 10) ─────────────────────────────── */}
      <View style={styles.autoBackupCard}>
        <View style={styles.autoBackupHeader}>
          <View style={[styles.autoBackupDot, { backgroundColor: backupInfo?.exists ? C.success : C.warning }]} />
          <Text style={styles.autoBackupTitle}>Auto-Backup Automático</Text>
          <TouchableOpacity onPress={loadBackupInfo} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
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
              <View style={styles.autoBackupMetaItem}>
                <Text style={styles.autoBackupMetaVal}>{backupInfo.products}</Text>
                <Text style={styles.autoBackupMetaLab}>Productos</Text>
              </View>
              <View style={styles.autoBackupMetaItem}>
                <Text style={styles.autoBackupMetaVal}>{backupInfo.sizeKB} KB</Text>
                <Text style={styles.autoBackupMetaLab}>Tamaño</Text>
              </View>
              <View style={styles.autoBackupMetaItem}>
                <Text style={styles.autoBackupMetaVal}>
                  {backupInfo.date ? new Date(backupInfo.date).toLocaleDateString('es-ES') : '—'}
                </Text>
                <Text style={styles.autoBackupMetaLab}>Última vez</Text>
              </View>
            </View>
          </View>
        ) : (
          <View style={styles.autoBackupBody}>
            <View style={styles.autoBackupRow}>
              <Icon name="alert-circle" size={14} color={C.warning} />
              <Text style={styles.autoBackupWarn}>Sin backup local. Pulsa "Guardar ahora" para crearlo.</Text>
            </View>
          </View>
        )}

        <TouchableOpacity
          style={[styles.forceBackupBtn, forcingBackup && { opacity: 0.6 }]}
          onPress={handleForceBackup}
          disabled={forcingBackup}
          activeOpacity={0.7}
        >
          {forcingBackup
            ? <ActivityIndicator size="small" color={C.blue} />
            : <Icon name="save" size={15} color={C.blue} />
          }
          <Text style={styles.forceBackupTxt}>
            {forcingBackup ? 'Guardando...' : 'Guardar backup ahora'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* ── Info doble capa ──────────────────────────────────────────────── */}
      <View style={styles.infoBox}>
        <Icon name="info" size={16} color={C.blue} />
        <Text style={styles.infoTxt}>
          <Text style={{ fontWeight: '800' }}>¿Cómo funciona?{'\n'}</Text>
          Cada vez que guardas un producto, la app actualiza automáticamente un
          fichero de backup en el dispositivo.{'\n\n'}
          Si instalas una nueva build,{' '}
          <Text style={{ fontWeight: '700' }}>la app restaura tus datos automáticamente</Text>
          {' '}al arrancar si detecta que MMKV está vacío.{'\n\n'}
          Solo se pierden datos si <Text style={{ fontWeight: '700' }}>desinstelas la app manualmente</Text>.
          Para ese caso, usa "Exportar" y guarda el .json en Google Drive.
        </Text>
      </View>

      {/* ── Estadísticas MMKV actuales ───────────────────────────────────── */}
      {dbStats && (
        <View style={styles.dbStatsCard}>
          <Text style={styles.dbStatsTitle}>Estado actual de la BBDD</Text>
          <View style={styles.dbStatsGrid}>
            <View style={styles.dbStatItem}>
              <Text style={styles.dbStatVal}>{dbStats.totalProducts}</Text>
              <Text style={styles.dbStatLab}>Productos</Text>
            </View>
            <View style={styles.dbStatItem}>
              <Text style={[styles.dbStatVal, { color: C.success }]}>{dbStats.soldProducts}</Text>
              <Text style={styles.dbStatLab}>Vendidos</Text>
            </View>
            <View style={styles.dbStatItem}>
              <Text style={[styles.dbStatVal, { color: C.primary }]}>{dbStats.activeProducts}</Text>
              <Text style={styles.dbStatLab}>En stock</Text>
            </View>
            <View style={styles.dbStatItem}>
              <Text style={[styles.dbStatVal, { color: C.blue }]}>{dbStats.salesRecords}</Text>
              <Text style={styles.dbStatLab}>Historial</Text>
            </View>
          </View>
          {dbStats.ingresos > 0 && (
            <View style={styles.dbIngresoRow}>
              <Icon name="trending-up" size={12} color={C.success} />
              <Text style={styles.dbIngresoTxt}>
                Ingresos registrados: <Text style={{ fontWeight: '900', color: C.success }}>{dbStats.ingresos.toFixed(2)}€</Text>
                {' '}({dbStats.ventas} ventas · {dbStats.compras} compras)
              </Text>
            </View>
          )}
        </View>
      )}

      {/* ── Seguro externo: Export/Import manual ────────────────────────── */}
      <Text style={styles.sectionTitle}>Seguro Externo</Text>
      <View style={styles.dbActionsRow}>
        <TouchableOpacity
          style={[styles.dbActionBtn, { backgroundColor: C.blue }]}
          onPress={handleExportDB}
          disabled={exporting}
          activeOpacity={0.7}
        >
          {exporting
            ? <ActivityIndicator size="small" color="#FFF" />
            : <Icon name="upload" size={18} color="#FFF" />
          }
          <Text style={styles.dbActionTxt}>Exportar JSON</Text>
          <Text style={styles.dbActionSub}>Drive / Email / WhatsApp</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.dbActionBtn, { backgroundColor: C.success }]}
          onPress={handleImportDB}
          disabled={importing}
          activeOpacity={0.7}
        >
          {importing
            ? <ActivityIndicator size="small" color="#FFF" />
            : <Icon name="download" size={18} color="#FFF" />
          }
          <Text style={styles.dbActionTxt}>Restaurar JSON</Text>
          <Text style={styles.dbActionSub}>Desde fichero .json</Text>
        </TouchableOpacity>
      </View>

      {/* ── Acción: actualizar stats ─────────────────────────────────────── */}
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

  // ─── RENDER: Tab Umbrales ────────────────────────────────────────────────
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
      <SettingCard label="Producto caliente" desc="Favs y vistas para marcar como caliente">
        <View style={styles.row}>
          <NumInput value={config.hotFavs || 10} onChangeText={v => updateCfg('hotFavs', v)} unit="favs" />
          <NumInput value={config.hotViews || 50} onChangeText={v => updateCfg('hotViews', v)} unit="vistas" />
        </View>
      </SettingCard>
      <SettingCard label="Alerta oportunidad" desc="Lanza alerta cuando favs y días superan estos umbrales">
        <View style={styles.row}>
          <NumInput value={config.opportunityFavs || 5}  onChangeText={v => updateCfg('opportunityFavs', v)}  unit="favs" />
          <NumInput value={config.opportunityDays || 30} onChangeText={v => updateCfg('opportunityDays', v)} unit="días" />
        </View>
      </SettingCard>

      <SaveBtn onPress={handleSave} />
    </View>
  );

  // ─── RENDER: Tab Calendario ──────────────────────────────────────────────
  const renderCalendar = () => {
    const catNames = Object.keys(dictionary);
    return (
      <View>
        <SectionTitle>Calendario de Oportunidades</SectionTitle>
        <Text style={styles.calHint}>
          Asigna categorías a cada mes. El sistema priorizará estas categorías en alertas y Smart Insights.
        </Text>
        {MONTHS.map((mes, idx) => {
          const selected = Array.isArray(config.seasonalMap?.[idx]) ? config.seasonalMap[idx] : [];
          return (
            <View key={idx} style={styles.monthRow}>
              <Text style={styles.monthName}>{mes}</Text>
              <View style={styles.monthChips}>
                {selected.length === 0
                  ? <Text style={styles.monthEmpty}>Sin asignar</Text>
                  : selected.map(cat => (
                    <TouchableOpacity key={cat} style={styles.monthChip}
                      onPress={() => toggleMonthCategory(idx, cat)} activeOpacity={0.7}>
                      <Text style={styles.monthChipTxt}>{cat} ✕</Text>
                    </TouchableOpacity>
                  ))
                }
              </View>
              <TouchableOpacity style={styles.monthAddBtn}
                onPress={() => setCalModal({ visible: true, monthIdx: idx })} activeOpacity={0.7}>
                <Icon name="plus" size={14} color={C.primary} />
              </TouchableOpacity>
            </View>
          );
        })}

        <Modal visible={calModal.visible} transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={styles.modalSheet}>
              <Text style={styles.modalTitle}>
                {calModal.monthIdx !== null ? MONTHS[calModal.monthIdx] : ''}
              </Text>
              <Text style={styles.modalHint}>Toca una categoría para añadir/quitar</Text>
              <FlatList
                data={catNames}
                keyExtractor={k => k}
                renderItem={({ item }) => {
                  const isSelected = config.seasonalMap?.[calModal.monthIdx]?.includes(item);
                  return (
                    <TouchableOpacity
                      style={[styles.modalItem, isSelected && styles.modalItemActive]}
                      onPress={() => { toggleMonthCategory(calModal.monthIdx, item); }}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.modalItemTxt, isSelected && styles.modalItemTxtActive]}>{item}</Text>
                      {isSelected && <Icon name="check" size={16} color={C.blue} />}
                    </TouchableOpacity>
                  );
                }}
              />
              <TouchableOpacity style={styles.modalClose} onPress={() => setCalModal({ visible: false, monthIdx: null })} activeOpacity={0.7}>
                <Text style={styles.modalCloseTxt}>Cerrar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        <SaveBtn onPress={handleSave} />
      </View>
    );
  };

  // ─── RENDER: Tab Categorías ──────────────────────────────────────────────
  const renderCategories = () => {
    const catNames = Object.keys(dictionary);
    const handleSaveDictionary = () => {
      const legacy = {};
      for (const [cat, val] of Object.entries(dictionary)) { legacy[cat] = val.tags || []; }
      DatabaseService.saveDictionary?.(legacy) || DatabaseService.saveConfig?.({ ...config, customDictionary: dictionary });
      if (DatabaseService.saveDictionary) {
        DatabaseService.saveDictionary(legacy);
      }
      // Guardar full dictionary
      try {
        const { MMKV } = require('react-native-mmkv');
        const s = new MMKV();
        s.set('custom_dictionary_full', JSON.stringify(dictionary));
        s.set('custom_dictionary', JSON.stringify(legacy));
      } catch { /* silent */ }
      Alert.alert('✅ Categorías guardadas', `${catNames.length} categorías actualizadas.`);
    };

    return (
      <View>
        <SectionTitle>Diccionario de Categorías</SectionTitle>

        {catNames.map(cat => (
          <View key={cat} style={styles.catCardDB}>
            <View style={styles.catCardHeader}>
              <Text style={styles.catCardName}>{cat}</Text>
              <TouchableOpacity onPress={() => {
                const d = { ...dictionary };
                delete d[cat];
                setDictionary(d);
              }} activeOpacity={0.7}>
                <Icon name="trash-2" size={14} color={C.danger} />
              </TouchableOpacity>
            </View>
            <Text style={styles.catCardTags}>
              {(dictionary[cat]?.tags || []).join(', ') || 'Sin etiquetas'}
            </Text>
          </View>
        ))}

        <View style={styles.addCatRow}>
          <TextInput
            style={styles.addCatInput}
            placeholder="Nueva categoría..."
            placeholderTextColor={C.gray500}
            value={newCatName}
            onChangeText={setNewCatName}
          />
          <TouchableOpacity style={styles.addCatBtn}
            onPress={() => {
              if (!newCatName.trim()) return;
              setDictionary(d => ({ ...d, [newCatName.trim()]: { tags: [], subcategories: {} } }));
              setNewCatName('');
            }} activeOpacity={0.7}>
            <Icon name="plus" size={16} color="#FFF" />
          </TouchableOpacity>
        </View>

        <SaveBtn onPress={handleSaveDictionary} />
      </View>
    );
  };

  // ─── RENDER: Tab Import ──────────────────────────────────────────────────
  const renderImport = () => (
    <View>
      <SectionTitle>Opciones de Importación</SectionTitle>
      <View style={styles.infoBox}>
        <Icon name="info" size={16} color={C.blue} />
        <Text style={styles.infoTxt}>
          La importación de JSON se realiza desde la pestaña "Importar" del menú principal.
          Aquí puedes configurar el comportamiento por defecto de las importaciones.
        </Text>
      </View>
      <SettingCard label="Categoría por defecto" desc="Categoría asignada a productos sin categoría en el import">
        <View style={styles.row}>
          <Text style={styles.importDefaultCat}>{config.defaultImportCategory || 'Otros'}</Text>
        </View>
      </SettingCard>
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

  // ─── RENDER: Tab Notificaciones ──────────────────────────────────────────
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
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabBarScroll}
        contentContainerStyle={styles.tabBar}>
        {TABS.map(tab => (
          <TouchableOpacity
            key={tab.id}
            style={[styles.tab, activeTab === tab.id && styles.tabActive]}
            onPress={() => setActiveTab(tab.id)}
            activeOpacity={0.7}
          >
            <Icon name={tab.icon} size={13} color={activeTab === tab.id ? '#FFF' : C.gray500} />
            <Text style={[styles.tabTxt, activeTab === tab.id && styles.tabTxtActive]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Contenido */}
      <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 60 }}>
        {renderTab()}
      </ScrollView>
    </View>
  );
}

// ─── Estilos ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root:         { flex: 1, backgroundColor: C.bg },
  header:       { paddingHorizontal: 20, paddingTop: 52, paddingBottom: 12,
                  backgroundColor: C.white, borderBottomWidth: 1, borderBottomColor: C.border },
  headerTitle:  { fontSize: 22, fontWeight: '900', color: C.gray900 },
  headerSub:    { fontSize: 11, color: C.gray500, marginTop: 2 },

  tabBarScroll: { backgroundColor: C.white, borderBottomWidth: 1, borderBottomColor: C.border, maxHeight: 52 },
  tabBar:       { paddingHorizontal: 12, paddingVertical: 8, gap: 8, flexDirection: 'row', alignItems: 'center' },
  tab:          { flexDirection: 'row', alignItems: 'center', gap: 5,
                  paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: C.gray100 },
  tabActive:    { backgroundColor: C.gray900 },
  tabTxt:       { fontSize: 11, fontWeight: '700', color: C.gray500 },
  tabTxtActive: { color: '#FFF' },

  content:      { flex: 1, padding: 16 },
  sectionTitle: { fontSize: 13, fontWeight: '900', color: C.gray900, marginTop: 16, marginBottom: 12,
                  textTransform: 'uppercase', letterSpacing: 0.5 },

  settingCard:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
                  backgroundColor: C.white, borderRadius: 14, padding: 14, marginBottom: 8,
                  borderWidth: 1, borderColor: C.border },
  cardInfo:     { flex: 1, marginRight: 12 },
  cardLabel:    { fontSize: 13, fontWeight: '700', color: C.gray900 },
  cardDesc:     { fontSize: 10, color: C.gray500, marginTop: 2, lineHeight: 14 },

  numRow:       { flexDirection: 'row', alignItems: 'center', gap: 4 },
  numInput:     { backgroundColor: C.bg, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6,
                  fontSize: 14, borderWidth: 1, borderColor: C.border, textAlign: 'center', fontWeight: '700' },
  numUnit:      { fontSize: 11, color: C.gray500 },
  row:          { flexDirection: 'row', gap: 8, alignItems: 'center' },

  saveBtn:      { backgroundColor: C.gray900, flexDirection: 'row', justifyContent: 'center',
                  alignItems: 'center', gap: 8, padding: 16, borderRadius: 16,
                  marginTop: 20, marginBottom: 8 },
  saveBtnTxt:   { color: '#FFF', fontWeight: '900', fontSize: 14 },

  // Calendar
  calHint:      { fontSize: 11, color: C.gray500, lineHeight: 16, marginBottom: 12 },
  monthRow:     { flexDirection: 'row', alignItems: 'center', backgroundColor: C.white,
                  borderRadius: 12, padding: 10, marginBottom: 6, borderWidth: 1, borderColor: C.border },
  monthName:    { width: 80, fontSize: 12, fontWeight: '700', color: C.gray900 },
  monthChips:   { flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  monthChip:    { backgroundColor: C.primary + '18', borderRadius: 10,
                  paddingHorizontal: 8, paddingVertical: 3 },
  monthChipTxt: { fontSize: 10, fontWeight: '700', color: C.primary },
  monthEmpty:   { fontSize: 10, color: C.gray500, fontStyle: 'italic' },
  monthAddBtn:  { padding: 6 },

  modalOverlay: { flex: 1, backgroundColor: '#00000055', justifyContent: 'flex-end' },
  modalSheet:   { backgroundColor: C.white, borderTopLeftRadius: 24, borderTopRightRadius: 24,
                  padding: 24, maxHeight: '65%' },
  modalTitle:   { fontSize: 18, fontWeight: '900', color: C.gray900, marginBottom: 4 },
  modalHint:    { fontSize: 11, color: C.gray500, marginBottom: 14 },
  modalItem:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
                  paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: C.border },
  modalItemActive:    { backgroundColor: C.blue + '0D', paddingHorizontal: 10, borderRadius: 8, marginHorizontal: -10 },
  modalItemTxt:       { fontSize: 14, color: C.gray900, fontWeight: '600' },
  modalItemTxtActive: { color: C.blue, fontWeight: '900' },
  modalClose:   { backgroundColor: C.gray900, borderRadius: 14, padding: 14, alignItems: 'center', marginTop: 14 },
  modalCloseTxt:{ color: '#FFF', fontWeight: '900', fontSize: 14 },

  // Categories
  catCardDB:    { backgroundColor: C.white, borderRadius: 12, padding: 12, marginBottom: 8,
                  borderWidth: 1, borderColor: C.border },
  catCardHeader:{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  catCardName:  { fontSize: 13, fontWeight: '800', color: C.gray900 },
  catCardTags:  { fontSize: 10, color: C.gray500 },
  addCatRow:    { flexDirection: 'row', gap: 8, marginTop: 8 },
  addCatInput:  { flex: 1, backgroundColor: C.white, borderRadius: 12, paddingHorizontal: 12,
                  paddingVertical: 10, fontSize: 13, borderWidth: 1, borderColor: C.border },
  addCatBtn:    { backgroundColor: C.blue, width: 44, height: 44, borderRadius: 22,
                  justifyContent: 'center', alignItems: 'center' },

  // Import
  importDefaultCat: { fontSize: 14, fontWeight: '700', color: C.gray900 },
  toggleBtn:    { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20,
                  backgroundColor: C.gray100, borderWidth: 1, borderColor: C.border },
  toggleBtnOn:  { backgroundColor: C.success, borderColor: C.success },
  toggleTxt:    { fontSize: 12, fontWeight: '900', color: C.gray500 },
  toggleTxtOn:  { color: '#FFF' },

  // Info box
  infoBox:      { backgroundColor: C.blue + '0D', borderRadius: 14, padding: 14,
                  flexDirection: 'row', gap: 10, marginBottom: 14 },
  infoTxt:      { flex: 1, fontSize: 11, color: C.blue, lineHeight: 17 },

  // ── Auto-backup card (Sprint 10) ──────────────────────────────────────────
  autoBackupCard:   { backgroundColor: C.white, borderRadius: 16, padding: 16, marginBottom: 14,
                      borderWidth: 2, borderColor: C.border },
  autoBackupHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  autoBackupDot:    { width: 10, height: 10, borderRadius: 5 },
  autoBackupTitle:  { flex: 1, fontSize: 13, fontWeight: '900', color: C.gray900 },
  autoBackupBody:   { marginBottom: 12 },
  autoBackupRow:    { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  autoBackupOk:     { fontSize: 12, color: C.success, fontWeight: '700', flex: 1 },
  autoBackupWarn:   { fontSize: 12, color: C.warning, fontWeight: '700', flex: 1 },
  autoBackupMeta:   { flexDirection: 'row', gap: 16, marginTop: 4 },
  autoBackupMetaItem: { alignItems: 'center' },
  autoBackupMetaVal:  { fontSize: 16, fontWeight: '900', color: C.gray900 },
  autoBackupMetaLab:  { fontSize: 9, color: C.gray500, textTransform: 'uppercase', marginTop: 1 },
  forceBackupBtn:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
                      gap: 8, padding: 12, borderRadius: 12,
                      backgroundColor: C.blue + '12', borderWidth: 1, borderColor: C.blue + '30' },
  forceBackupTxt:   { fontSize: 13, fontWeight: '800', color: C.blue },

  // ── BBDD Tab styles ────────────────────────────────────────────────────────
  dbStatsCard:  { backgroundColor: C.white, borderRadius: 16, padding: 16, marginBottom: 14,
                  borderWidth: 1, borderColor: C.border },
  dbStatsTitle: { fontSize: 12, fontWeight: '800', color: C.gray900, marginBottom: 12,
                  textTransform: 'uppercase', letterSpacing: 0.5 },
  dbStatsGrid:  { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 10 },
  dbStatItem:   { alignItems: 'center', minWidth: 60 },
  dbStatVal:    { fontSize: 22, fontWeight: '900', color: C.gray900 },
  dbStatLab:    { fontSize: 9, color: C.gray500, marginTop: 2, textTransform: 'uppercase' },
  dbIngresoRow: { flexDirection: 'row', alignItems: 'center', gap: 6,
                  backgroundColor: C.success + '10', borderRadius: 10, padding: 8, marginTop: 4 },
  dbIngresoTxt: { fontSize: 11, color: C.gray900, flex: 1 },

  dbActionsRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  dbActionBtn:  { flex: 1, borderRadius: 16, padding: 16, alignItems: 'center', gap: 6 },
  dbActionTxt:  { color: '#FFF', fontSize: 13, fontWeight: '900' },
  dbActionSub:  { color: 'rgba(255,255,255,0.7)', fontSize: 9 },

  deploySteps:  { backgroundColor: C.white, borderRadius: 16, padding: 16,
                  borderWidth: 1, borderColor: C.border, marginBottom: 12 },
  deployStepsTitle: { fontSize: 12, fontWeight: '800', color: C.gray900, marginBottom: 12 },
  deployStep:   { flexDirection: 'row', gap: 10, marginBottom: 10, alignItems: 'flex-start' },
  deployStepNum:{ width: 22, height: 22, borderRadius: 11, backgroundColor: C.blue,
                  justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  deployStepNumTxt: { fontSize: 10, fontWeight: '900', color: '#FFF' },
  deployStepTxt:{ flex: 1, fontSize: 11, color: C.gray700, lineHeight: 16 },

  refreshStatsBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, padding: 10,
                     justifyContent: 'center' },
  refreshStatsTxt: { fontSize: 11, fontWeight: '700', color: C.blue },
});