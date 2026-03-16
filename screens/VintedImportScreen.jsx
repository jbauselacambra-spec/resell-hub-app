/**
 * VintedImportScreen.jsx — Sprint 8 · FIX Hotfix 5b
 *
 * [DEBUGGER] ROOT CAUSE SyntaxError línea 365:
 *   El snippet de auto-registro de categorías fue insertado en el
 *   cuerpo del módulo (nivel raíz), fuera de cualquier función.
 *   Además contenía backticks escapados (\`) que son inválidos
 *   en código JS real (son artefactos de haber sido generados
 *   dentro de un template string de documentación).
 *
 * [ARCHITECT] FIX:
 *   - Eliminar el bloque suelto del módulo (líneas 363-367)
 *   - Integrar la lógica de auto-registro correctamente
 *     DENTRO de handleConfirmC(), tras importFromVinted()
 *   - Usar backticks normales (`) en el template literal
 *
 * [QA_ENGINEER] Sin otros cambios. Todos los modos C/D/E intactos.
 */

import React, { useState, useCallback, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, Dimensions, Alert, Image, Modal,
  Platform, ActivityIndicator, Animated,
} from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { DatabaseService } from '../services/DatabaseService';
import {
  detectContentType,
  parseJsonProducts,
  parseJsonSalesCurrent,
  parseJsonSalesHistory,
  mapToSaleRecord,
  VintedSalesDB,
  logImportEvent,
  matchHistoryToInventory,
} from '../services/VintedParserService';
import LogService, { LOG_CTX } from '../services/LogService';

const { width } = Dimensions.get('window');

// ─── Design System ────────────────────────────────────────────────────────────
const DS = {
  bg:        '#F8F9FA',  white:     '#FFFFFF',  surface2:  '#F0F2F5',
  border:    '#EAEDF0',  primary:   '#FF6B35',  primaryBg: '#FFF2EE',
  success:   '#00D9A3',  successBg: '#E8FBF6',  warning:   '#FFB800',  warningBg: '#FFF8E7',
  danger:    '#E63946',  blue:      '#004E89',  blueBg:    '#EAF2FB',
  purple:    '#6C63FF',  purpleBg:  '#F0EFFE',
  text:      '#1A1A2E',  textMed:   '#5C6070',  textLow:   '#A0A5B5',
  mono:      Platform.OS === 'android' ? 'monospace' : 'Courier New',
};

// ─── Meta por tipo detectado ──────────────────────────────────────────────────
const TYPE_META = {
  json_products:       { label: 'JSON escaparate',              color: DS.primary, icon: 'package',       mode: 'C' },
  json_sales_current:  { label: 'JSON ventas año actual',       color: DS.success, icon: 'trending-up',   mode: 'D' },
  json_sales_history:  { label: 'JSON historial completo',      color: DS.blue,    icon: 'bar-chart-2',   mode: 'E' },
  html_sales_current:  { label: 'HTML ventas (no soportado)',   color: DS.textLow, icon: 'alert-circle',  mode: null },
  html_sales_history:  { label: 'HTML historial (no soportado)',color: DS.textLow, icon: 'alert-circle',  mode: null },
  unknown:             { label: 'Formato no reconocido',        color: DS.textLow, icon: 'help-circle',   mode: null },
};

// ─── Guía de modos ────────────────────────────────────────────────────────────
const GUIDE = [
  {
    mode: 'C', color: DS.primary, icon: 'package', title: 'Escaparate (Inventario)',
    steps: [
      'Abre Vinted en el navegador del PC',
      'F12 → Consola → pega scriptEscaparate.js',
      'Copia el JSON o guárdalo como .json',
      'Adjunta aquí → importa inventario completo',
    ],
    note: '✅ El más completo. Incluye id, precio, vistas, favoritos.',
  },
  {
    mode: 'D', color: DS.success, icon: 'trending-up', title: 'Ventas año actual',
    steps: [
      'Vinted → Mis pedidos (ventas) en PC',
      'F12 → Consola → pega scriptVentasActuales.js',
      'Guarda el JSON generado',
      'Adjunta aquí → actualiza precios de venta reales',
    ],
    note: '⚠️ Sin fecha de venta — se actualiza desde el historial.',
  },
  {
    mode: 'E', color: DS.blue, icon: 'bar-chart-2', title: 'Historial completo (multi-año)',
    steps: [
      'Vinted → Perfil → Saldo y pagos (PC)',
      'F12 → Consola → pega scriptHistorialVentas.js',
      'Repite para cada año (2025, 2024, 2023…)',
      'Adjunta cada JSON → match automático con inventario',
    ],
    note: '✅ Incluye fecha real de venta. Activa TTS y estadísticas.',
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Auto-registra categorías de productos importados en el diccionario local.
 * Solo añade las que no existan — nunca sobreescribe.
 */
function autoRegisterCategories(products) {
  const newCats = [...new Set(products.map(p => p.category).filter(Boolean))];
  if (!newCats.length) return;

  const existingDict = DatabaseService.getFullDictionary() || {};
  let changed = false;

  newCats.forEach(cat => {
    if (!existingDict[cat]) {
      existingDict[cat] = { tags: [], subcategories: {} };
      changed = true;
    }
  });

  if (changed) {
    DatabaseService.saveFullDictionary(existingDict);
    const legacyUpdate = {};
    Object.entries(existingDict).forEach(([c, v]) => {
      legacyUpdate[c] = v.tags || [];
    });
    DatabaseService.saveDictionary(legacyUpdate);
    LogService.add(`📚 Auto-registradas ${newCats.length} categorías desde import JSON`, 'info');
  }
}

// ─── PreviewCard ──────────────────────────────────────────────────────────────
function PreviewCard({ item, checked, onToggle }) {
  const isVenta  = item.type !== 'compra';
  const amtColor = isVenta ? DS.success : DS.danger;
  const amt = typeof item.amount === 'number'
    ? (item.amount >= 0 ? '+' : '') + item.amount.toFixed(2) + ' €'
    : item.price != null ? item.price.toFixed(2) + ' €' : '—';

  return (
    <TouchableOpacity
      style={[styles.previewCard, checked && { borderColor: DS.primary, borderWidth: 2 }]}
      onPress={onToggle}
      activeOpacity={0.8}
    >
      <View style={[styles.previewCheck, checked && { backgroundColor: DS.primary }]}>
        {checked && <Icon name="check" size={12} color="#FFF" />}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.previewTitle} numberOfLines={1}>{item.title || item.id}</Text>
        <View style={styles.previewRow}>
          <Text style={[styles.previewAmt, { color: amtColor }]}>{amt}</Text>
          {item.soldDateReal && (
            <Text style={styles.previewDate}>
              {new Date(item.soldDateReal).toLocaleDateString('es-ES')}
            </Text>
          )}
          {item.orderId && <Text style={styles.previewOrder}>#{item.orderId}</Text>}
        </View>
      </View>
      {item.imageUrl ? (
        <Image source={{ uri: item.imageUrl }} style={styles.previewImg} />
      ) : null}
    </TouchableOpacity>
  );
}

// ─── Modal Modo C ─────────────────────────────────────────────────────────────
function ConfirmModalC({ visible, products, onConfirm, onClose }) {
  if (!visible) return null;
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity style={styles.modalSheet} activeOpacity={1}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Importar Inventario</Text>
            <TouchableOpacity onPress={onClose}>
              <Icon name="x" size={22} color={DS.textMed}/>
            </TouchableOpacity>
          </View>
          <View style={[styles.infoBox, { backgroundColor: DS.primaryBg }]}>
            <Icon name="package" size={14} color={DS.primary}/>
            <Text style={[styles.infoTxt, { color: DS.primary }]}>
              {products.length} productos detectados · Fusión inteligente activada
            </Text>
          </View>
          <Text style={styles.modalDesc}>
            Se importarán al inventario. Los campos editados manualmente (categoría, título,
            fecha de subida) quedarán protegidos.
          </Text>
          <TouchableOpacity
            style={[styles.confirmBtn, { backgroundColor: DS.primary }]}
            onPress={() => onConfirm()}
          >
            <Icon name="upload-cloud" size={16} color="#FFF"/>
            <Text style={styles.confirmBtnTxt}>IMPORTAR INVENTARIO</Text>
          </TouchableOpacity>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

// ─── Modal Modo D ─────────────────────────────────────────────────────────────
function ConfirmModalD({ visible, items, onConfirm, onClose }) {
  if (!visible) return null;
  const ventas = items.filter(i => i.type !== 'compra');
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity style={styles.modalSheet} activeOpacity={1}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Ventas Año Actual</Text>
            <TouchableOpacity onPress={onClose}>
              <Icon name="x" size={22} color={DS.textMed}/>
            </TouchableOpacity>
          </View>
          <View style={[styles.infoBox, { backgroundColor: DS.successBg }]}>
            <Icon name="trending-up" size={14} color={DS.success}/>
            <Text style={[styles.infoTxt, { color: DS.success }]}>
              {ventas.length} ventas detectadas (compras ignoradas automáticamente)
            </Text>
          </View>
          <Text style={styles.modalDesc}>
            Se actualizará el precio de venta real (soldPriceReal) de los productos existentes
            que coincidan por título. Los productos sin match se añadirán como nuevos vendidos.
          </Text>
          <TouchableOpacity
            style={[styles.confirmBtn, { backgroundColor: DS.success }]}
            onPress={() => onConfirm('both')}
          >
            <Icon name="zap" size={16} color="#FFF"/>
            <Text style={styles.confirmBtnTxt}>ACTUALIZAR VENTAS ({ventas.length})</Text>
          </TouchableOpacity>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

// ─── Modal Modo E ─────────────────────────────────────────────────────────────
function ConfirmModalE({ visible, items, onConfirm, onClose }) {
  if (!visible) return null;
  const ventas   = items.filter(i => i.type === 'venta');
  const compras  = items.filter(i => i.type === 'compra');
  const totalEur = ventas.reduce((s, i) => s + Math.abs(i.amount || 0), 0);
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity style={styles.modalSheet} activeOpacity={1}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Historial Completo</Text>
            <TouchableOpacity onPress={onClose}>
              <Icon name="x" size={22} color={DS.textMed}/>
            </TouchableOpacity>
          </View>
          <View style={styles.modalSummaryRow}>
            <View style={[styles.modalSummaryChip, { backgroundColor: DS.successBg }]}>
              <Text style={[styles.modalSummaryVal, { color: DS.success }]}>{ventas.length}</Text>
              <Text style={styles.modalSummaryLbl}>ventas</Text>
            </View>
            <View style={[styles.modalSummaryChip, { backgroundColor: '#FFF0F0' }]}>
              <Text style={[styles.modalSummaryVal, { color: DS.danger }]}>{compras.length}</Text>
              <Text style={styles.modalSummaryLbl}>compras (ignoradas)</Text>
            </View>
            <View style={[styles.modalSummaryChip, { backgroundColor: DS.blueBg }]}>
              <Text style={[styles.modalSummaryVal, { color: DS.blue }]}>{totalEur.toFixed(0)}€</Text>
              <Text style={styles.modalSummaryLbl}>facturado</Text>
            </View>
          </View>
          <Text style={styles.modalDesc}>
            Las ventas se matchearán con tu inventario por título. Si hay coincidencia se
            actualizan soldPriceReal y soldDateReal. Las estadísticas de TTS y categorías
            se recalcularán automáticamente.
          </Text>
          <TouchableOpacity
            style={[styles.confirmBtn, { backgroundColor: DS.blue }]}
            onPress={() => onConfirm('both')}
          >
            <Icon name="layers" size={16} color="#FFF"/>
            <Text style={styles.confirmBtnTxt}>
              IMPORTAR HISTORIAL + MATCH ({ventas.length} ventas)
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.confirmBtn, { backgroundColor: DS.surface2, marginTop: 8 }]}
            onPress={() => onConfirm('stats_only')}
          >
            <Icon name="bar-chart-2" size={16} color={DS.blue}/>
            <Text style={[styles.confirmBtnTxt, { color: DS.blue }]}>
              SOLO ESTADÍSTICAS ECONÓMICAS
            </Text>
          </TouchableOpacity>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

// ─── Pantalla principal ───────────────────────────────────────────────────────
export default function VintedImportScreen({ navigation }) {
  const [loading,      setLoading]      = useState(false);
  const [contentType,  setContentType]  = useState(null);
  const [parsedItems,  setParsedItems]  = useState([]);    // modos D/E
  const [jsonProducts, setJsonProducts] = useState([]);    // modo C
  const [checkedIds,   setCheckedIds]   = useState(new Set());
  const [importResult, setImportResult] = useState(null);
  const [showConfirm,  setShowConfirm]  = useState(false);
  const [fileName,     setFileName]     = useState(null);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const fadeIn   = () =>
    Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start();

  const currentMode = contentType ? (TYPE_META[contentType]?.mode || null) : null;

  // ─── Seleccionar archivo ──────────────────────────────────────────────────
  const handlePickFile = useCallback(async () => {
    try {
      setLoading(true);
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/json', 'text/plain', '*/*'],
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets?.length) { setLoading(false); return; }
      const asset = result.assets[0];
      setFileName(asset.name);
      const text = await FileSystem.readAsStringAsync(asset.uri);
      processText(text);
    } catch (e) {
      LogService.error('VintedImport.pickFile', LOG_CTX.IMPORT, e);
      Alert.alert('Error', 'No se pudo leer el archivo. Asegúrate de que es un JSON válido.');
    } finally {
      setLoading(false);
    }
  }, []);

  // ─── Procesar texto ───────────────────────────────────────────────────────
  const processText = useCallback((text) => {
    if (!text || !text.trim()) { Alert.alert('Contenido vacío', 'El archivo está vacío.'); return; }
    try {
      const type = detectContentType(text);
      setContentType(type);

      if (type === 'json_products') {
        const prods = parseJsonProducts(text);
        setJsonProducts(prods);
        setCheckedIds(new Set(prods.map(p => String(p.id))));
        fadeIn();
        return;
      }
      if (type === 'json_sales_current') {
        const raw   = parseJsonSalesCurrent(text);
        const items = raw.filter(i => i.type !== 'compra');
        setParsedItems(items);
        setCheckedIds(new Set(items.map(i => i.orderId)));
        fadeIn();
        return;
      }
      if (type === 'json_sales_history') {
        const items = parseJsonSalesHistory(text);
        setParsedItems(items);
        setCheckedIds(new Set(items.filter(i => i.type === 'venta').map(i => i.orderId)));
        fadeIn();
        return;
      }
      Alert.alert(
        'Formato no compatible',
        'Por favor adjunta un archivo JSON generado con los scripts de consola de Vinted.\n\nFormatos HTML ya no están soportados.',
      );
    } catch (e) {
      LogService.error('VintedImport.processText', LOG_CTX.IMPORT, e);
      Alert.alert('Error al analizar', 'El contenido no parece ser un JSON válido de Vinted.');
    }
  }, []);

  // ─── Toggle selección ─────────────────────────────────────────────────────
  const toggleId = (id) => {
    setCheckedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };
  const toggleAll = () => {
    const allIds = currentMode === 'C'
      ? jsonProducts.map(p => String(p.id))
      : parsedItems.map(i => i.orderId);
    setCheckedIds(prev =>
      prev.size === allIds.length ? new Set() : new Set(allIds),
    );
  };

  // ─── Confirmar Modo C (escaparate) ───────────────────────────────────────
  // FIX: auto-registro de categorías integrado correctamente aquí
  const handleConfirmC = () => {
    setShowConfirm(false);
    const selected = jsonProducts.filter(p => checkedIds.has(String(p.id)));
    const result   = DatabaseService.importFromVinted(selected);

    // Auto-registrar categorías nuevas en el diccionario
    autoRegisterCategories(selected);

    logImportEvent('json_products', selected.length, result);
    setImportResult({ mode: 'C', ...result, total: selected.length });
    LogService.add(
      `Import C: +${result.created} nuevos, ${result.updated} actualizados`,
      'success',
    );
  };

  // ─── Confirmar Modo D (ventas actuales) ───────────────────────────────────
  const handleConfirmD = () => {
    setShowConfirm(false);
    const selected = parsedItems.filter(
      i => checkedIds.has(i.orderId) && i.type !== 'compra',
    );
    const matchRes = matchHistoryToInventory(selected);
    logImportEvent('json_sales_current', selected.length, matchRes);
    setImportResult({ mode: 'D', ...matchRes, total: selected.length });
    LogService.add(
      `Import D: ${matchRes.matched} productos actualizados con precio real`,
      'success',
    );
  };

  // ─── Confirmar Modo E (historial multi-año) ───────────────────────────────
  const handleConfirmE = (dest) => {
    setShowConfirm(false);
    const selected  = parsedItems.filter(i => checkedIds.has(i.orderId));
    let statsRes    = { inserted: 0, duplicates: 0 };
    let matchRes    = { matched: 0, created: 0 };

    if (dest === 'stats_only' || dest === 'both') {
      const records = selected.filter(i => i.type === 'venta').map(mapToSaleRecord);
      statsRes = VintedSalesDB.saveRecords(records);
    }
    if (dest === 'both') {
      matchRes = matchHistoryToInventory(selected.filter(i => i.type === 'venta'));
    }

    logImportEvent('json_sales_history', selected.length, { dest, statsRes, matchRes });
    setImportResult({
      mode: 'E', dest,
      statsInserted: statsRes.inserted,
      statsDup:      statsRes.duplicates,
      matched:       matchRes.matched,
      created:       matchRes.created,
      total:         selected.length,
    });
    LogService.add(
      `Import E: ${matchRes.matched} matches · ${statsRes.inserted} registros stats`,
      'success',
    );
  };

  // ─── Reset ────────────────────────────────────────────────────────────────
  const handleReset = () => {
    setContentType(null);
    setParsedItems([]);
    setJsonProducts([]);
    setCheckedIds(new Set());
    setImportResult(null);
    setFileName(null);
    fadeAnim.setValue(0);
  };

  const typeMeta   = contentType ? TYPE_META[contentType] : null;
  const hasResults = (currentMode === 'C' && jsonProducts.length > 0) ||
                     (['D', 'E'].includes(currentMode) && parsedItems.length > 0);
  const selectedCnt = checkedIds.size;
  const totalItems  = currentMode === 'C' ? jsonProducts.length : parsedItems.length;

  return (
    <View style={styles.root}>

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Importar de Vinted</Text>
          <Text style={styles.headerSub}>Adjunta un JSON generado con los scripts</Text>
        </View>
        <TouchableOpacity
          style={styles.logsBtn}
          onPress={() => navigation.navigate('Logs')}
        >
          <Icon name="terminal" size={16} color={DS.textMed}/>
          <Text style={styles.logsBtnTxt}>Logs</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >

        {/* ── Banner resultado ─────────────────────────────────────────── */}
        {importResult && (
          <Animated.View style={[styles.resultBanner, {
            backgroundColor: importResult.mode === 'C' ? DS.primaryBg
                           : importResult.mode === 'D' ? DS.successBg : DS.blueBg,
            borderColor:     importResult.mode === 'C' ? DS.primary + '40'
                           : importResult.mode === 'D' ? DS.success + '40' : DS.blue + '40',
            opacity: fadeAnim,
          }]}>
            <Icon
              name="check-circle"
              size={20}
              color={importResult.mode === 'C' ? DS.primary
                   : importResult.mode === 'D' ? DS.success : DS.blue}
            />
            <View style={{ flex: 1 }}>
              {importResult.mode === 'C' && (
                <>
                  <Text style={styles.resultTitle}>¡Inventario importado!</Text>
                  <Text style={styles.resultSub}>
                    {importResult.created} nuevos · {importResult.updated} actualizados de {importResult.total}
                  </Text>
                </>
              )}
              {importResult.mode === 'D' && (
                <>
                  <Text style={styles.resultTitle}>¡Ventas actualizadas!</Text>
                  <Text style={styles.resultSub}>
                    {importResult.matched} productos con precio real · {importResult.created} nuevos
                  </Text>
                </>
              )}
              {importResult.mode === 'E' && (
                <>
                  <Text style={styles.resultTitle}>¡Historial importado!</Text>
                  <Text style={styles.resultSub}>
                    {importResult.matched} matches · +{importResult.statsInserted} stats ({importResult.statsDup} dup)
                  </Text>
                </>
              )}
            </View>
            <TouchableOpacity style={styles.resultResetBtn} onPress={handleReset}>
              <Text style={styles.resultResetTxt}>NUEVA</Text>
            </TouchableOpacity>
          </Animated.View>
        )}

        {/* ── Drop zone + Guía ─────────────────────────────────────────── */}
        {!hasResults && !importResult && (
          <>
            <TouchableOpacity
              style={styles.dropZone}
              onPress={handlePickFile}
              activeOpacity={0.75}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color={DS.primary} size="large"/>
              ) : (
                <>
                  <View style={styles.dropZoneIcon}>
                    <Icon name="upload-cloud" size={36} color={DS.primary}/>
                  </View>
                  <Text style={styles.dropZoneTitle}>Adjuntar archivo JSON</Text>
                  <Text style={styles.dropZoneSub}>
                    Toca para seleccionar el archivo desde tu dispositivo
                  </Text>
                  <View style={[styles.dropZoneChip, { backgroundColor: DS.primaryBg }]}>
                    <Icon name="file-text" size={12} color={DS.primary}/>
                    <Text style={[styles.dropZoneChipTxt, { color: DS.primary }]}>.json · .txt</Text>
                  </View>
                </>
              )}
            </TouchableOpacity>

            <Text style={styles.guideTitle}>¿Qué puedo importar?</Text>
            {GUIDE.map((g, gi) => (
              <View key={gi} style={[styles.guideCard, { borderLeftColor: g.color }]}>
                <View style={styles.guideCardHdr}>
                  <View style={[styles.guideCardIcon, { backgroundColor: g.color + '18' }]}>
                    <Icon name={g.icon} size={15} color={g.color}/>
                  </View>
                  <View style={[styles.guideModeChip, { backgroundColor: g.color }]}>
                    <Text style={styles.guideModeChipTxt}>MODO {g.mode}</Text>
                  </View>
                  <Text style={styles.guideCardTitle}>{g.title}</Text>
                </View>
                {g.steps.map((s, si) => (
                  <View key={si} style={styles.guideStep}>
                    <Text style={[styles.guideStepNum, { color: g.color }]}>{si + 1}</Text>
                    <Text style={styles.guideStepTxt}>{s}</Text>
                  </View>
                ))}
                <View style={[styles.guideNote, { backgroundColor: g.color + '10' }]}>
                  <Text style={[styles.guideNoteTxt, { color: g.color === DS.warning ? '#8B6914' : g.color }]}>
                    {g.note}
                  </Text>
                </View>
              </View>
            ))}
          </>
        )}

        {/* ── Resultados del análisis ───────────────────────────────────── */}
        {hasResults && !importResult && (
          <Animated.View style={{ opacity: fadeAnim }}>

            {/* Badge tipo */}
            {typeMeta && (
              <View style={[styles.typeBadgeBar, {
                backgroundColor: typeMeta.color + '12',
                borderColor:     typeMeta.color + '30',
              }]}>
                <Icon name={typeMeta.icon} size={14} color={typeMeta.color}/>
                <Text style={[styles.typeBadgeBarTxt, { color: typeMeta.color }]}>
                  {typeMeta.label}
                </Text>
                {fileName ? (
                  <Text style={styles.fileNameTxt} numberOfLines={1}> · {fileName}</Text>
                ) : null}
                <View style={[styles.cntBadge, { backgroundColor: typeMeta.color }]}>
                  <Text style={styles.cntBadgeTxt}>{totalItems}</Text>
                </View>
              </View>
            )}

            {/* Quick stats modo E */}
            {currentMode === 'E' && (
              <View style={styles.quickStatsRow}>
                <View style={[styles.quickStatChip, { backgroundColor: DS.successBg }]}>
                  <Text style={[styles.quickStatVal, { color: DS.success }]}>
                    {parsedItems.filter(i => i.type === 'venta').length}
                  </Text>
                  <Text style={styles.quickStatLbl}>ventas</Text>
                </View>
                <View style={[styles.quickStatChip, { backgroundColor: '#FFF0F0' }]}>
                  <Text style={[styles.quickStatVal, { color: DS.danger }]}>
                    {parsedItems.filter(i => i.type === 'compra').length}
                  </Text>
                  <Text style={styles.quickStatLbl}>compras</Text>
                </View>
                <View style={[styles.quickStatChip, { backgroundColor: DS.blueBg }]}>
                  <Text style={[styles.quickStatVal, { color: DS.blue }]}>
                    {parsedItems
                      .filter(i => i.type === 'venta')
                      .reduce((s, i) => s + Math.abs(i.amount || 0), 0)
                      .toFixed(0)} €
                  </Text>
                  <Text style={styles.quickStatLbl}>facturado</Text>
                </View>
              </View>
            )}

            {/* Seleccionar todos */}
            <View style={styles.selRow}>
              <TouchableOpacity style={styles.selAllBtn} onPress={toggleAll}>
                <Icon
                  name={selectedCnt === totalItems ? 'check-square' : 'square'}
                  size={16}
                  color={DS.primary}
                />
                <Text style={styles.selAllTxt}>
                  {selectedCnt === totalItems ? 'Deseleccionar todo' : 'Seleccionar todo'}
                </Text>
              </TouchableOpacity>
              <Text style={styles.selCount}>{selectedCnt} seleccionados</Text>
            </View>

            {/* Lista Modo C */}
            {currentMode === 'C' && jsonProducts.map(p => (
              <TouchableOpacity
                key={String(p.id)}
                style={[
                  styles.previewCard,
                  checkedIds.has(String(p.id)) && { borderColor: DS.primary, borderWidth: 2 },
                ]}
                onPress={() => toggleId(String(p.id))}
                activeOpacity={0.8}
              >
                <View style={[
                  styles.previewCheck,
                  checkedIds.has(String(p.id)) && { backgroundColor: DS.primary },
                ]}>
                  {checkedIds.has(String(p.id)) && <Icon name="check" size={12} color="#FFF"/>}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.previewTitle} numberOfLines={1}>{p.title}</Text>
                  <View style={styles.previewRow}>
                    <Text style={[styles.previewAmt, { color: DS.primary }]}>
                      {(p.price || 0).toFixed(2)} €
                    </Text>
                    {p.brand ? <Text style={styles.previewBrand}>{p.brand}</Text> : null}
                    {p.status === 'sold' ? (
                      <View style={styles.soldChip}>
                        <Text style={styles.soldChipTxt}>VENDIDO</Text>
                      </View>
                    ) : null}
                  </View>
                </View>
                {p.images?.[0] ? (
                  <Image source={{ uri: p.images[0] }} style={styles.previewImg}/>
                ) : null}
              </TouchableOpacity>
            ))}

            {/* Lista Modos D/E */}
            {['D', 'E'].includes(currentMode) && parsedItems.map(item => (
              <PreviewCard
                key={item.orderId}
                item={item}
                checked={checkedIds.has(item.orderId)}
                onToggle={() => toggleId(item.orderId)}
              />
            ))}

            {/* Botón importar */}
            <TouchableOpacity
              style={[styles.importBtn, selectedCnt === 0 && { backgroundColor: DS.textLow }]}
              onPress={() => setShowConfirm(true)}
              disabled={selectedCnt === 0}
            >
              <Icon name="upload-cloud" size={18} color="#FFF"/>
              <Text style={styles.importBtnTxt}>
                IMPORTAR {selectedCnt} {currentMode === 'C' ? 'PRODUCTOS' : 'REGISTROS'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.cancelBtn} onPress={handleReset}>
              <Text style={styles.cancelBtnTxt}>Cancelar</Text>
            </TouchableOpacity>

          </Animated.View>
        )}

      </ScrollView>

      {/* ── Modales ──────────────────────────────────────────────────────── */}
      <ConfirmModalC
        visible={showConfirm && currentMode === 'C'}
        products={jsonProducts.filter(p => checkedIds.has(String(p.id)))}
        onConfirm={handleConfirmC}
        onClose={() => setShowConfirm(false)}
      />
      <ConfirmModalD
        visible={showConfirm && currentMode === 'D'}
        items={parsedItems.filter(i => checkedIds.has(i.orderId))}
        onConfirm={handleConfirmD}
        onClose={() => setShowConfirm(false)}
      />
      <ConfirmModalE
        visible={showConfirm && currentMode === 'E'}
        items={parsedItems.filter(i => checkedIds.has(i.orderId))}
        onConfirm={handleConfirmE}
        onClose={() => setShowConfirm(false)}
      />
    </View>
  );
}

// ─── Estilos ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root:             { flex: 1, backgroundColor: DS.bg },
  header:           { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
                      paddingHorizontal: 16, paddingTop: 52, paddingBottom: 12,
                      backgroundColor: DS.white, borderBottomWidth: 1, borderBottomColor: DS.border },
  headerTitle:      { fontSize: 20, fontWeight: '700', color: DS.text },
  headerSub:        { fontSize: 12, color: DS.textLow, marginTop: 2 },
  logsBtn:          { flexDirection: 'row', alignItems: 'center', gap: 4,
                      paddingHorizontal: 10, paddingVertical: 6,
                      borderRadius: 8, backgroundColor: DS.surface2 },
  logsBtnTxt:       { fontSize: 12, color: DS.textMed, fontWeight: '500' },
  scroll:           { flex: 1 },
  scrollContent:    { padding: 16, paddingBottom: 40 },

  // Drop zone
  dropZone:         { borderWidth: 2, borderColor: DS.primary + '40', borderStyle: 'dashed',
                      borderRadius: 16, padding: 32, alignItems: 'center', marginBottom: 24,
                      backgroundColor: DS.primaryBg + '80' },
  dropZoneIcon:     { width: 72, height: 72, borderRadius: 36, backgroundColor: DS.primaryBg,
                      alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  dropZoneTitle:    { fontSize: 17, fontWeight: '700', color: DS.text, marginBottom: 6 },
  dropZoneSub:      { fontSize: 13, color: DS.textMed, textAlign: 'center', marginBottom: 12 },
  dropZoneChip:     { flexDirection: 'row', alignItems: 'center', gap: 4,
                      paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  dropZoneChipTxt:  { fontSize: 12, fontWeight: '600' },

  // Guía
  guideTitle:       { fontSize: 13, fontWeight: '700', color: DS.textMed,
                      textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 },
  guideCard:        { backgroundColor: DS.white, borderRadius: 12, padding: 14,
                      borderLeftWidth: 3, marginBottom: 10,
                      shadowColor: '#000', shadowOpacity: 0.04,
                      shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  guideCardHdr:     { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  guideCardIcon:    { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  guideModeChip:    { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 },
  guideModeChipTxt: { fontSize: 10, fontWeight: '800', color: '#FFF', letterSpacing: 0.5 },
  guideCardTitle:   { fontSize: 13, fontWeight: '700', color: DS.text, flex: 1 },
  guideStep:        { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 5 },
  guideStepNum:     { fontSize: 12, fontWeight: '800', width: 18 },
  guideStepTxt:     { fontSize: 12, color: DS.textMed, flex: 1 },
  guideNote:        { padding: 8, borderRadius: 6, marginTop: 6 },
  guideNoteTxt:     { fontSize: 11, fontWeight: '600' },

  // Badge tipo
  typeBadgeBar:     { flexDirection: 'row', alignItems: 'center', gap: 6, padding: 10,
                      borderRadius: 10, borderWidth: 1, marginBottom: 12 },
  typeBadgeBarTxt:  { fontSize: 13, fontWeight: '600', flex: 1 },
  fileNameTxt:      { fontSize: 11, color: DS.textLow, flex: 1 },
  cntBadge:         { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  cntBadgeTxt:      { fontSize: 11, fontWeight: '800', color: '#FFF' },

  // Quick stats
  quickStatsRow:    { flexDirection: 'row', gap: 8, marginBottom: 12 },
  quickStatChip:    { flex: 1, alignItems: 'center', padding: 10, borderRadius: 10 },
  quickStatVal:     { fontSize: 20, fontWeight: '800' },
  quickStatLbl:     { fontSize: 10, color: DS.textMed, marginTop: 2 },

  // Selección
  selRow:           { flexDirection: 'row', justifyContent: 'space-between',
                      alignItems: 'center', marginBottom: 8 },
  selAllBtn:        { flexDirection: 'row', alignItems: 'center', gap: 6 },
  selAllTxt:        { fontSize: 13, color: DS.primary, fontWeight: '600' },
  selCount:         { fontSize: 12, color: DS.textLow },

  // Preview cards
  previewCard:      { flexDirection: 'row', alignItems: 'center', gap: 10,
                      backgroundColor: DS.white, borderRadius: 10, padding: 12,
                      marginBottom: 6, borderWidth: 1, borderColor: DS.border,
                      shadowColor: '#000', shadowOpacity: 0.03, elevation: 1 },
  previewCheck:     { width: 22, height: 22, borderRadius: 6, borderWidth: 1.5,
                      borderColor: DS.border, alignItems: 'center', justifyContent: 'center' },
  previewTitle:     { fontSize: 13, fontWeight: '600', color: DS.text, marginBottom: 3 },
  previewRow:       { flexDirection: 'row', alignItems: 'center', gap: 8 },
  previewAmt:       { fontSize: 13, fontWeight: '700' },
  previewDate:      { fontSize: 11, color: DS.textLow },
  previewOrder:     { fontSize: 11, color: DS.textLow },
  previewBrand:     { fontSize: 11, color: DS.textMed },
  previewImg:       { width: 40, height: 40, borderRadius: 6, backgroundColor: DS.surface2 },
  soldChip:         { backgroundColor: DS.successBg, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  soldChipTxt:      { fontSize: 9, fontWeight: '800', color: DS.success },

  // Botones acción
  importBtn:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
                      gap: 8, backgroundColor: DS.primary, borderRadius: 12,
                      padding: 16, marginTop: 16 },
  importBtnTxt:     { fontSize: 15, fontWeight: '800', color: '#FFF', letterSpacing: 0.5 },
  cancelBtn:        { alignItems: 'center', padding: 14 },
  cancelBtnTxt:     { fontSize: 14, color: DS.textMed },

  // Resultado
  resultBanner:     { flexDirection: 'row', alignItems: 'center', gap: 10,
                      padding: 14, borderRadius: 12, borderWidth: 1, marginBottom: 20 },
  resultTitle:      { fontSize: 14, fontWeight: '700', color: DS.text },
  resultSub:        { fontSize: 12, color: DS.textMed, marginTop: 2 },
  resultResetBtn:   { paddingHorizontal: 12, paddingVertical: 6,
                      backgroundColor: DS.surface2, borderRadius: 8 },
  resultResetTxt:   { fontSize: 12, fontWeight: '700', color: DS.text },

  // Modal
  modalOverlay:     { flex: 1, backgroundColor: '#00000055', justifyContent: 'flex-end' },
  modalSheet:       { backgroundColor: DS.white, borderTopLeftRadius: 20, borderTopRightRadius: 20,
                      padding: 20, paddingBottom: 36 },
  modalHeader:      { flexDirection: 'row', justifyContent: 'space-between',
                      alignItems: 'center', marginBottom: 16 },
  modalTitle:       { fontSize: 18, fontWeight: '800', color: DS.text },
  infoBox:          { flexDirection: 'row', alignItems: 'center', gap: 8,
                      padding: 10, borderRadius: 8, marginBottom: 12 },
  infoTxt:          { fontSize: 13, fontWeight: '600', flex: 1 },
  modalDesc:        { fontSize: 13, color: DS.textMed, lineHeight: 19, marginBottom: 16 },
  modalSummaryRow:  { flexDirection: 'row', gap: 8, marginBottom: 14 },
  modalSummaryChip: { flex: 1, alignItems: 'center', padding: 10, borderRadius: 10 },
  modalSummaryVal:  { fontSize: 22, fontWeight: '800' },
  modalSummaryLbl:  { fontSize: 10, color: DS.textMed, marginTop: 2, textAlign: 'center' },
  confirmBtn:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
                      gap: 8, borderRadius: 12, padding: 15 },
  confirmBtnTxt:    { fontSize: 14, fontWeight: '800', color: '#FFF', letterSpacing: 0.3 },
});