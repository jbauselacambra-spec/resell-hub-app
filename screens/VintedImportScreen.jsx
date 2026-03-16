/**
 * VintedImportScreen.jsx — Sprint 11
 *
 * [DATA_SCIENTIST] Sprint 11:
 * - handleConfirmE: usa _enrichedItems de matchHistoryToInventory()
 *   para guardar SaleRecords con categoría correcta en VintedSalesDB
 * - handleConfirmD: idem para Modo D
 * - autoRegisterCategories: registra categorías inferidas en el diccionario
 *
 * [QA_ENGINEER] Sin cambios en modos C, UI, estilos ni otros handlers.
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
  danger:    '#E63946',  dangerBg:  '#FFF0F1',  blue:      '#004E89',  blueBg:    '#EAF2FB',
  purple:    '#6C63FF',  purpleBg:  '#F0EFFE',
  text:      '#1A1A2E',  textMed:   '#5C6070',  textLow:   '#A0A5B5',
  mono:      Platform.OS === 'android' ? 'monospace' : 'Courier New',
};

// ─── Metadatos por tipo de contenido ─────────────────────────────────────────
const TYPE_META = {
  json_products:       { label: 'JSON escaparate (Inventario)',    mode: 'C', color: DS.primary, icon: 'package' },
  json_sales_current:  { label: 'JSON ventas año actual',          mode: 'D', color: DS.success, icon: 'trending-up' },
  json_sales_history:  { label: 'JSON historial completo',         mode: 'E', color: DS.blue,    icon: 'clock' },
  html_sales_current:  { label: 'HTML ventas (compatibilidad)',    mode: 'A', color: DS.warning,  icon: 'alert-circle' },
  html_sales_history:  { label: 'HTML historial (compatibilidad)', mode: 'B', color: DS.warning,  icon: 'alert-circle' },
  unknown:             { label: 'Formato desconocido',             mode: null, color: DS.danger,   icon: 'x-circle' },
};

// ─── Guía de modos ────────────────────────────────────────────────────────────
const GUIDE = [
  {
    mode: 'C',
    color: DS.primary,
    icon: 'package',
    title: 'Modo C — Escaparate',
    sub: 'Script: scriptEscaparate.js en tu página de perfil de Vinted',
    desc: 'Importa productos activos y vendidos al inventario. Fusión inteligente con Los 7 Campos Sagrados.',
  },
  {
    mode: 'D',
    color: DS.success,
    icon: 'trending-up',
    title: 'Modo D — Ventas año actual',
    sub: 'Script: scriptVentasActuales.js en /my-orders/sold',
    desc: 'Actualiza soldPriceReal y soldDateReal en los productos ya importados. Activa TTS y estadísticas.',
  },
  {
    mode: 'E',
    color: DS.blue,
    icon: 'clock',
    title: 'Modo E — Historial completo',
    sub: 'Script: scriptHistorialVentas.js en /balance',
    desc: 'Historial multi-año de ventas y compras. Cruza con inventario y alimenta estadísticas económicas.',
  },
];

// ─── Helper: auto-registro de categorías nuevas en diccionario ───────────────
function autoRegisterCategories(products) {
  try {
    const newCats = [...new Set(products.map(p => p.category).filter(c => c && c !== 'Otros'))];
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
      LogService.add(`📚 Auto-registradas ${newCats.length} categorías desde import`, 'info', LOG_CTX.IMPORT);
    }
  } catch (e) {
    LogService.error('autoRegisterCategories', LOG_CTX.IMPORT, e);
  }
}

// ─── PreviewCard — Modo A/B/D/E (VintedSaleItem) ─────────────────────────────
function SalePreviewCard({ item, checked, onToggle }) {
  const isVenta  = item.type !== 'compra';
  const amtColor = isVenta ? DS.success : DS.danger;
  const amt = typeof item.amount === 'number'
    ? (item.amount >= 0 ? '+' : '') + item.amount.toFixed(2) + ' €'
    : '—';

  return (
    <TouchableOpacity
      style={[styles.previewCard, checked && styles.previewCardChecked]}
      onPress={onToggle}
      activeOpacity={0.8}
    >
      <View style={[styles.previewCheck, checked && styles.previewCheckOn]}>
        {checked && <Icon name="check" size={12} color="#FFF" />}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.previewTitle} numberOfLines={1}>{item.title || item.orderId}</Text>
        <View style={styles.previewRow}>
          <View style={[styles.typeBadge, { backgroundColor: isVenta ? DS.successBg : DS.dangerBg }]}>
            <Text style={[styles.typeBadgeTxt, { color: isVenta ? DS.success : DS.danger }]}>
              {isVenta ? '↑ VENTA' : '↓ COMPRA'}
            </Text>
          </View>
          <Text style={[styles.previewAmt, { color: amtColor }]}>{amt}</Text>
          {item.soldDateReal && (
            <Text style={styles.previewDate}>
              {new Date(item.soldDateReal).toLocaleDateString('es-ES')}
            </Text>
          )}
          {!item.soldDateReal && item.type === 'venta' && (
            <View style={styles.noDateBadge}>
              <Text style={styles.noDateTxt}>Sin fecha</Text>
            </View>
          )}
        </View>
        {item.orderId && (
          <Text style={styles.previewOrder}>#{item.orderId}</Text>
        )}
      </View>
      {item.imageUrl ? (
        <Image source={{ uri: item.imageUrl }} style={styles.previewImg} />
      ) : null}
    </TouchableOpacity>
  );
}

// ─── PreviewCard — Modo C (InternalProduct) ───────────────────────────────────
function ProductPreviewCard({ product, checked, onToggle }) {
  const isSold = product.status === 'sold';
  return (
    <TouchableOpacity
      style={[styles.previewCard, checked && styles.previewCardChecked]}
      onPress={onToggle}
      activeOpacity={0.8}
    >
      <View style={[styles.previewCheck, checked && styles.previewCheckOn]}>
        {checked && <Icon name="check" size={12} color="#FFF" />}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.previewTitle} numberOfLines={1}>{product.title}</Text>
        <View style={styles.previewRow}>
          <View style={[styles.typeBadge, { backgroundColor: isSold ? DS.surface2 : DS.successBg }]}>
            <Text style={[styles.typeBadgeTxt, { color: isSold ? DS.textMed : DS.success }]}>
              {isSold ? 'VENDIDO' : 'ACTIVO'}
            </Text>
          </View>
          <Text style={[styles.previewAmt, { color: DS.primary }]}>
            {parseFloat(product.price || 0).toFixed(2)} €
          </Text>
          {product.brand ? <Text style={styles.previewDate}>{product.brand}</Text> : null}
        </View>
        <Text style={styles.previewOrder}>
          {product.views || 0} vistas · {product.favorites || 0} favs
        </Text>
      </View>
      {product.images?.[0] ? (
        <Image source={{ uri: product.images[0] }} style={styles.previewImg} />
      ) : null}
    </TouchableOpacity>
  );
}

// ─── Modal Confirmar Modo C ───────────────────────────────────────────────────
function ConfirmModalC({ visible, products, onConfirm, onClose }) {
  if (!visible) return null;
  const activos  = products.filter(p => p.status !== 'sold').length;
  const vendidos = products.length - activos;
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity style={styles.modalSheet} activeOpacity={1}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Importar Inventario</Text>
            <TouchableOpacity onPress={onClose}><Icon name="x" size={22} color={DS.textMed} /></TouchableOpacity>
          </View>
          <View style={[styles.infoBox, { backgroundColor: DS.primaryBg }]}>
            <Icon name="package" size={14} color={DS.primary} />
            <Text style={[styles.infoTxt, { color: DS.primary }]}>
              {products.length} productos · fusión inteligente activada
            </Text>
          </View>
          <View style={styles.modalSummaryRow}>
            <View style={[styles.modalSummaryChip, { backgroundColor: DS.successBg }]}>
              <Text style={[styles.modalSummaryVal, { color: DS.success }]}>{activos}</Text>
              <Text style={styles.modalSummaryLbl}>Activos</Text>
            </View>
            <View style={[styles.modalSummaryChip, { backgroundColor: DS.surface2 }]}>
              <Text style={[styles.modalSummaryVal, { color: DS.textMed }]}>{vendidos}</Text>
              <Text style={styles.modalSummaryLbl}>Vendidos</Text>
            </View>
          </View>
          <Text style={styles.modalDesc}>
            Los campos editados manualmente (categoría, título, fecha de subida) quedarán protegidos.
          </Text>
          <TouchableOpacity style={[styles.confirmBtn, { backgroundColor: DS.primary }]} onPress={onConfirm}>
            <Icon name="download" size={16} color="#FFF" />
            <Text style={styles.confirmBtnTxt}>IMPORTAR {products.length} PRODUCTOS</Text>
          </TouchableOpacity>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

// ─── Modal Confirmar Modo D ───────────────────────────────────────────────────
function ConfirmModalD({ visible, items, onConfirm, onClose }) {
  if (!visible) return null;
  const conFecha    = items.filter(i => i.soldDateReal).length;
  const sinFecha    = items.length - conFecha;
  const totalEuros  = items.reduce((s, i) => s + (i.soldPriceReal || 0), 0).toFixed(2);
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity style={styles.modalSheet} activeOpacity={1}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Actualizar Ventas</Text>
            <TouchableOpacity onPress={onClose}><Icon name="x" size={22} color={DS.textMed} /></TouchableOpacity>
          </View>
          <View style={[styles.infoBox, { backgroundColor: DS.successBg }]}>
            <Icon name="trending-up" size={14} color={DS.success} />
            <Text style={[styles.infoTxt, { color: DS.success }]}>
              {items.length} ventas · cruzará con inventario existente
            </Text>
          </View>
          <View style={styles.modalSummaryRow}>
            <View style={[styles.modalSummaryChip, { backgroundColor: DS.successBg }]}>
              <Text style={[styles.modalSummaryVal, { color: DS.success }]}>{conFecha}</Text>
              <Text style={styles.modalSummaryLbl}>Con fecha</Text>
            </View>
            <View style={[styles.modalSummaryChip, { backgroundColor: DS.warningBg }]}>
              <Text style={[styles.modalSummaryVal, { color: DS.warning }]}>{sinFecha}</Text>
              <Text style={styles.modalSummaryLbl}>Sin fecha</Text>
            </View>
            <View style={[styles.modalSummaryChip, { backgroundColor: DS.primaryBg }]}>
              <Text style={[styles.modalSummaryVal, { color: DS.primary }]}>{totalEuros}€</Text>
              <Text style={styles.modalSummaryLbl}>Facturado</Text>
            </View>
          </View>
          <Text style={styles.modalDesc}>
            Actualiza soldPriceReal y soldDateReal en los productos del inventario. No toca ningún campo permanente.
          </Text>
          <TouchableOpacity style={[styles.confirmBtn, { backgroundColor: DS.success }]} onPress={onConfirm}>
            <Icon name="check-circle" size={16} color="#FFF" />
            <Text style={styles.confirmBtnTxt}>ACTUALIZAR {items.length} VENTAS</Text>
          </TouchableOpacity>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

// ─── Modal Confirmar Modo E ───────────────────────────────────────────────────
function ConfirmModalE({ visible, items, onConfirm, onClose }) {
  if (!visible) return null;
  const ventas  = items.filter(i => i.type === 'venta');
  const compras = items.filter(i => i.type === 'compra');
  const totalV  = ventas.reduce((s, i)  => s + (i.soldPriceReal || Math.abs(i.amount) || 0), 0).toFixed(2);
  const totalC  = compras.reduce((s, i) => s + Math.abs(i.amount || 0), 0).toFixed(2);
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity style={styles.modalSheet} activeOpacity={1}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Importar Historial</Text>
            <TouchableOpacity onPress={onClose}><Icon name="x" size={22} color={DS.textMed} /></TouchableOpacity>
          </View>
          <View style={[styles.infoBox, { backgroundColor: DS.blueBg }]}>
            <Icon name="clock" size={14} color={DS.blue} />
            <Text style={[styles.infoTxt, { color: DS.blue }]}>
              {ventas.length} ventas · {compras.length} compras
            </Text>
          </View>
          <View style={styles.modalSummaryRow}>
            <View style={[styles.modalSummaryChip, { backgroundColor: DS.successBg }]}>
              <Text style={[styles.modalSummaryVal, { color: DS.success }]}>{totalV}€</Text>
              <Text style={styles.modalSummaryLbl}>Ingresos</Text>
            </View>
            <View style={[styles.modalSummaryChip, { backgroundColor: DS.dangerBg }]}>
              <Text style={[styles.modalSummaryVal, { color: DS.danger }]}>{totalC}€</Text>
              <Text style={styles.modalSummaryLbl}>Gastos</Text>
            </View>
            <View style={[styles.modalSummaryChip, { backgroundColor: DS.blueBg }]}>
              <Text style={[styles.modalSummaryVal, { color: DS.blue }]}>
                {(parseFloat(totalV) - parseFloat(totalC)).toFixed(2)}€
              </Text>
              <Text style={styles.modalSummaryLbl}>Balance</Text>
            </View>
          </View>
          <Text style={styles.modalDesc}>
            Guarda en estadísticas económicas Y cruza con el inventario para actualizar precios reales de venta.
          </Text>
          <TouchableOpacity
            style={[styles.confirmBtn, { backgroundColor: DS.blue, marginBottom: 10 }]}
            onPress={() => onConfirm('both')}
          >
            <Icon name="zap" size={16} color="#FFF" />
            <Text style={styles.confirmBtnTxt}>⚡ IMPORTAR TODO (Stats + Inventario)</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.confirmBtn, { backgroundColor: DS.surface2 }]}
            onPress={() => onConfirm('stats_only')}
          >
            <Icon name="bar-chart-2" size={16} color={DS.textMed} />
            <Text style={[styles.confirmBtnTxt, { color: DS.text }]}>Solo estadísticas económicas</Text>
          </TouchableOpacity>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

// ─── Pantalla principal ───────────────────────────────────────────────────────
export default function VintedImportScreen({ navigation }) {
  const [contentType,  setContentType]  = useState(null);
  const [parsedItems,  setParsedItems]  = useState([]);
  const [jsonProducts, setJsonProducts] = useState([]);
  const [checkedIds,   setCheckedIds]   = useState(new Set());
  const [importResult, setImportResult] = useState(null);
  const [showConfirm,  setShowConfirm]  = useState(false);
  const [loading,      setLoading]      = useState(false);
  const [fileName,     setFileName]     = useState(null);

  const fadeAnim = useRef(new Animated.Value(0)).current;

  const fadeIn = () => Animated.timing(fadeAnim, { toValue: 1, duration: 350, useNativeDriver: true }).start();

  const currentMode = contentType ? TYPE_META[contentType]?.mode : null;
  const hasResults  = parsedItems.length > 0 || jsonProducts.length > 0;

  // ─── Seleccionar archivo ────────────────────────────────────────────────
  const handlePickFile = useCallback(async () => {
    try {
      setLoading(true);
      const res = await DocumentPicker.getDocumentAsync({
        type: ['application/json', 'text/plain', 'text/*'],
        copyToCacheDirectory: true,
      });

      if (res.canceled || !res.assets?.length) { setLoading(false); return; }

      const asset = res.assets[0];
      setFileName(asset.name || 'archivo.json');

      const text = await FileSystem.readAsStringAsync(asset.uri);
      processText(text);
    } catch (e) {
      LogService.error('VintedImport.handlePickFile', LOG_CTX.IMPORT, e);
      Alert.alert('Error', 'No se pudo leer el archivo. Asegúrate de que es un JSON válido.');
    } finally {
      setLoading(false);
    }
  }, []);

  // ─── Procesar texto ─────────────────────────────────────────────────────
  const processText = useCallback((text) => {
    if (!text || !text.trim()) {
      Alert.alert('Contenido vacío', 'El archivo está vacío.');
      return;
    }
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
        // Preseleccionar solo ventas
        setCheckedIds(new Set(items.filter(i => i.type === 'venta').map(i => i.orderId)));
        fadeIn();
        return;
      }

      Alert.alert(
        'Formato no compatible',
        'Por favor adjunta un archivo JSON generado con los scripts de consola de Vinted.\n\nFormatos: escaparate, ventas actuales o historial.',
      );
    } catch (e) {
      LogService.error('VintedImport.processText', LOG_CTX.IMPORT, e);
      Alert.alert('Error al analizar', 'El contenido no parece ser un JSON válido de Vinted.');
    }
  }, []);

  // ─── Toggle selección ───────────────────────────────────────────────────
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

  // ─── Confirmar Modo C — Escaparate ─────────────────────────────────────
  const handleConfirmC = () => {
    setShowConfirm(false);
    const selected = jsonProducts.filter(p => checkedIds.has(String(p.id)));
    const result   = DatabaseService.importFromVinted(selected);

    // Auto-registrar categorías nuevas detectadas
    autoRegisterCategories(selected);

    logImportEvent('json_products', selected.length, result);
    setImportResult({ mode: 'C', ...result, total: selected.length });
    LogService.add(
      `Import C: +${result.created} nuevos, ${result.updated} actualizados`,
      'success',
    );
  };

  // ─── Confirmar Modo D — Ventas actuales ────────────────────────────────
  const handleConfirmD = () => {
    setShowConfirm(false);
    const selected = parsedItems.filter(
      i => checkedIds.has(i.orderId) && i.type !== 'compra',
    );

    // matchHistoryToInventory devuelve _enrichedItems con categorías
    const matchRes = matchHistoryToInventory(selected);

    // [Sprint 11] Guardar SaleRecords con categoría correcta
    if (matchRes._enrichedItems.length > 0) {
      const records = matchRes._enrichedItems.map(item => mapToSaleRecord(item));
      VintedSalesDB.saveRecords(records);

      // Auto-registrar categorías nuevas en el diccionario
      autoRegisterCategories(matchRes._enrichedItems);
    }

    logImportEvent('json_sales_current', selected.length, matchRes);
    setImportResult({ mode: 'D', ...matchRes, total: selected.length });
    LogService.add(
      `Import D: ${matchRes.matched} matches · ${matchRes.created} nuevos · ${matchRes._enrichedItems.length} stats`,
      'success',
    );
  };

  // ─── Confirmar Modo E — Historial multi-año ────────────────────────────
  const handleConfirmE = (dest) => {
    setShowConfirm(false);
    const selected = parsedItems.filter(i => checkedIds.has(i.orderId));
    let statsRes   = { inserted: 0, duplicates: 0 };
    let matchRes   = { matched: 0, created: 0, _enrichedItems: [] };

    if (dest === 'both') {
      // Paso 1: match con inventario (devuelve _enrichedItems con categorías)
      matchRes = matchHistoryToInventory(selected.filter(i => i.type === 'venta'));

      // Paso 2: guardar SaleRecords usando items enriquecidos con categoría correcta
      const itemsToSave = matchRes._enrichedItems.length > 0
        ? matchRes._enrichedItems
        : selected.filter(i => i.type === 'venta');

      const records = itemsToSave.map(item => mapToSaleRecord(item));
      // Añadir también las compras (sin match de inventario)
      const compraRecords = selected
        .filter(i => i.type === 'compra')
        .map(item => mapToSaleRecord(item));

      statsRes = VintedSalesDB.saveRecords([...records, ...compraRecords]);

      // Auto-registrar categorías nuevas
      autoRegisterCategories(matchRes._enrichedItems);

    } else if (dest === 'stats_only') {
      // Solo guardar en estadísticas, sin match de inventario
      const records = selected.map(item => mapToSaleRecord(item));
      statsRes = VintedSalesDB.saveRecords(records);
    }

    logImportEvent('json_sales_history', selected.length, { dest, statsRes, matchRes });
    setImportResult({
      mode:          'E',
      dest,
      statsInserted: statsRes.inserted,
      statsDup:      statsRes.duplicates,
      matched:       matchRes.matched,
      created:       matchRes.created,
      total:         selected.length,
    });
    LogService.add(
      `Import E (${dest}): ${matchRes.matched} matches · +${statsRes.inserted} stats`,
      'success',
    );
  };

  // ─── Reset ──────────────────────────────────────────────────────────────
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
  const totalItems = currentMode === 'C' ? jsonProducts.length : parsedItems.length;

  // ─── Render ─────────────────────────────────────────────────────────────
  return (
    <View style={styles.root}>

      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Importar desde Vinted</Text>
          <Text style={styles.headerSub}>Adjunta un JSON generado con los scripts de consola</Text>
        </View>
        <TouchableOpacity
          style={styles.logsBtn}
          onPress={() => navigation.navigate('Logs')}
        >
          <Icon name="terminal" size={14} color={DS.textMed} />
          <Text style={styles.logsBtnTxt}>Logs</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>

        {/* Resultado de importación */}
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

        {/* Drop Zone + Guía */}
        {!hasResults && !importResult && (
          <>
            <TouchableOpacity
              style={styles.dropZone}
              onPress={handlePickFile}
              activeOpacity={0.75}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color={DS.primary} size="large" />
              ) : (
                <>
                  <View style={styles.dropIcon}>
                    <Icon name="upload-cloud" size={32} color={DS.primary} />
                  </View>
                  <Text style={styles.dropTitle}>Adjuntar archivo JSON</Text>
                  <Text style={styles.dropSub}>Toca para seleccionar desde tu dispositivo</Text>
                  <View style={styles.dropBadge}>
                    <Text style={styles.dropBadgeTxt}>.json · .txt</Text>
                  </View>
                </>
              )}
            </TouchableOpacity>

            {/* Guía de modos */}
            <Text style={styles.guideTitle}>Modos de importación disponibles</Text>
            {GUIDE.map(g => (
              <View key={g.mode} style={styles.guideCard}>
                <View style={[styles.guideIcon, { backgroundColor: g.color + '20' }]}>
                  <Icon name={g.icon} size={18} color={g.color} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.guideCardTitle}>{g.title}</Text>
                  <Text style={styles.guideCardSub}>{g.sub}</Text>
                  <Text style={styles.guideCardDesc}>{g.desc}</Text>
                </View>
              </View>
            ))}
          </>
        )}

        {/* Badge de tipo detectado */}
        {hasResults && typeMeta && (
          <Animated.View style={[styles.typeBadgeRow, { opacity: fadeAnim }]}>
            <View style={[styles.typeChip, { backgroundColor: typeMeta.color + '20' }]}>
              <Icon name={typeMeta.icon} size={13} color={typeMeta.color} />
              <Text style={[styles.typeChipTxt, { color: typeMeta.color }]}>
                {typeMeta.label}
              </Text>
            </View>
            {fileName && (
              <Text style={styles.fileNameTxt} numberOfLines={1}>{fileName}</Text>
            )}
            <Text style={[styles.typeChipTxt, { color: DS.textLow, marginLeft: 4 }]}>
              · {totalItems} items
            </Text>
          </Animated.View>
        )}

        {/* Quick stats para Modo E */}
        {currentMode === 'E' && parsedItems.length > 0 && (
          <Animated.View style={[styles.quickStats, { opacity: fadeAnim }]}>
            {(() => {
              const ventas  = parsedItems.filter(i => i.type === 'venta');
              const compras = parsedItems.filter(i => i.type === 'compra');
              const totalV  = ventas.reduce((s, i) => s + (i.soldPriceReal || 0), 0).toFixed(2);
              const totalC  = compras.reduce((s, i) => s + Math.abs(i.amount || 0), 0).toFixed(2);
              return (
                <>
                  <View style={styles.quickStatItem}>
                    <Text style={[styles.quickStatVal, { color: DS.success }]}>{ventas.length}</Text>
                    <Text style={styles.quickStatLbl}>ventas</Text>
                  </View>
                  <View style={styles.quickStatDivider} />
                  <View style={styles.quickStatItem}>
                    <Text style={[styles.quickStatVal, { color: DS.danger }]}>{compras.length}</Text>
                    <Text style={styles.quickStatLbl}>compras</Text>
                  </View>
                  <View style={styles.quickStatDivider} />
                  <View style={styles.quickStatItem}>
                    <Text style={[styles.quickStatVal, { color: DS.primary }]}>{totalV}€</Text>
                    <Text style={styles.quickStatLbl}>facturado</Text>
                  </View>
                  <View style={styles.quickStatDivider} />
                  <View style={styles.quickStatItem}>
                    <Text style={[styles.quickStatVal, { color: DS.text }]}>
                      {(parseFloat(totalV) - parseFloat(totalC)).toFixed(2)}€
                    </Text>
                    <Text style={styles.quickStatLbl}>balance</Text>
                  </View>
                </>
              );
            })()}
          </Animated.View>
        )}

        {/* Barra de selección */}
        {hasResults && (
          <Animated.View style={[styles.selectionBar, { opacity: fadeAnim }]}>
            <TouchableOpacity onPress={toggleAll} style={styles.selAllBtn}>
              <Icon
                name={checkedIds.size === totalItems ? 'check-square' : 'square'}
                size={16}
                color={DS.primary}
              />
              <Text style={styles.selAllTxt}>Seleccionar todo</Text>
            </TouchableOpacity>
            <Text style={styles.selCount}>
              {checkedIds.size}/{totalItems} seleccionados
            </Text>
          </Animated.View>
        )}

        {/* Lista de preview */}
        {currentMode === 'C' && jsonProducts.map(p => (
          <ProductPreviewCard
            key={String(p.id)}
            product={p}
            checked={checkedIds.has(String(p.id))}
            onToggle={() => toggleId(String(p.id))}
          />
        ))}

        {(currentMode === 'D' || currentMode === 'E') && parsedItems.map(item => (
          <SalePreviewCard
            key={item.orderId}
            item={item}
            checked={checkedIds.has(item.orderId)}
            onToggle={() => toggleId(item.orderId)}
          />
        ))}

        {/* Botón importar */}
        {hasResults && checkedIds.size > 0 && !importResult && (
          <Animated.View style={{ opacity: fadeAnim }}>
            <TouchableOpacity
              style={styles.importBtn}
              onPress={() => setShowConfirm(true)}
              activeOpacity={0.85}
            >
              <Icon name="download" size={18} color="#FFF" />
              <Text style={styles.importBtnTxt}>
                IMPORTAR {checkedIds.size} {currentMode === 'C' ? 'PRODUCTOS' : 'REGISTROS'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.cancelBtn} onPress={handleReset}>
              <Text style={styles.cancelBtnTxt}>Cancelar</Text>
            </TouchableOpacity>
          </Animated.View>
        )}

      </ScrollView>

      {/* Modales */}
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

  // Drop Zone
  dropZone:         { borderWidth: 2, borderColor: DS.primary + '40', borderStyle: 'dashed',
                      borderRadius: 20, padding: 32, alignItems: 'center', justifyContent: 'center',
                      backgroundColor: DS.primaryBg, marginBottom: 24, minHeight: 180 },
  dropIcon:         { width: 64, height: 64, borderRadius: 32, backgroundColor: DS.white,
                      alignItems: 'center', justifyContent: 'center',
                      shadowColor: DS.primary, shadowOpacity: 0.15, shadowRadius: 8, elevation: 3,
                      marginBottom: 12 },
  dropTitle:        { fontSize: 17, fontWeight: '700', color: DS.text, marginBottom: 4 },
  dropSub:          { fontSize: 13, color: DS.textMed, marginBottom: 10 },
  dropBadge:        { paddingHorizontal: 12, paddingVertical: 4,
                      backgroundColor: DS.white, borderRadius: 20, borderWidth: 1, borderColor: DS.border },
  dropBadgeTxt:     { fontSize: 11, color: DS.textLow, fontFamily: DS.mono },

  // Guía
  guideTitle:       { fontSize: 13, fontWeight: '700', color: DS.textLow,
                      letterSpacing: 0.5, marginBottom: 10 },
  guideCard:        { flexDirection: 'row', alignItems: 'flex-start', gap: 12,
                      backgroundColor: DS.white, borderRadius: 16, padding: 14,
                      marginBottom: 10, borderWidth: 1, borderColor: DS.border },
  guideIcon:        { width: 40, height: 40, borderRadius: 12,
                      alignItems: 'center', justifyContent: 'center' },
  guideCardTitle:   { fontSize: 14, fontWeight: '800', color: DS.text, marginBottom: 2 },
  guideCardSub:     { fontSize: 10, color: DS.textLow, marginBottom: 4, fontFamily: DS.mono },
  guideCardDesc:    { fontSize: 12, color: DS.textMed, lineHeight: 17 },

  // Tipo detectado
  typeBadgeRow:     { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 },
  typeChip:         { flexDirection: 'row', alignItems: 'center', gap: 5,
                      paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  typeChipTxt:      { fontSize: 11, fontWeight: '700' },
  fileNameTxt:      { fontSize: 11, color: DS.textLow, flex: 1, fontFamily: DS.mono },

  // Quick stats
  quickStats:       { flexDirection: 'row', backgroundColor: DS.white, borderRadius: 16,
                      borderWidth: 1, borderColor: DS.border, padding: 14, marginBottom: 14,
                      justifyContent: 'space-around', alignItems: 'center' },
  quickStatItem:    { alignItems: 'center' },
  quickStatVal:     { fontSize: 18, fontWeight: '900', fontFamily: DS.mono },
  quickStatLbl:     { fontSize: 10, color: DS.textLow, marginTop: 2 },
  quickStatDivider: { width: 1, height: 30, backgroundColor: DS.border },

  // Barra selección
  selectionBar:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
                      paddingVertical: 10, marginBottom: 8 },
  selAllBtn:        { flexDirection: 'row', alignItems: 'center', gap: 6 },
  selAllTxt:        { fontSize: 13, fontWeight: '700', color: DS.primary },
  selCount:         { fontSize: 12, color: DS.textMed },

  // Preview cards
  previewCard:      { flexDirection: 'row', alignItems: 'center', gap: 10,
                      backgroundColor: DS.white, borderRadius: 16, padding: 12, marginBottom: 8,
                      borderWidth: 1, borderColor: DS.border },
  previewCardChecked: { borderColor: DS.primary, borderWidth: 2 },
  previewCheck:     { width: 22, height: 22, borderRadius: 11,
                      borderWidth: 2, borderColor: DS.border,
                      alignItems: 'center', justifyContent: 'center' },
  previewCheckOn:   { backgroundColor: DS.primary, borderColor: DS.primary },
  previewTitle:     { fontSize: 13, fontWeight: '700', color: DS.text, marginBottom: 5 },
  previewRow:       { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  typeBadge:        { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 },
  typeBadgeTxt:     { fontSize: 9, fontWeight: '900' },
  previewAmt:       { fontSize: 13, fontWeight: '800', fontFamily: DS.mono },
  previewDate:      { fontSize: 10, color: DS.textLow },
  previewOrder:     { fontSize: 10, color: DS.textLow, marginTop: 3, fontFamily: DS.mono },
  noDateBadge:      { paddingHorizontal: 6, paddingVertical: 2,
                      backgroundColor: DS.warningBg, borderRadius: 8 },
  noDateTxt:        { fontSize: 9, fontWeight: '900', color: DS.warning },
  previewImg:       { width: 46, height: 46, borderRadius: 10, backgroundColor: DS.surface2 },

  // Botón importar
  importBtn:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
                      gap: 8, backgroundColor: DS.primary, borderRadius: 16, padding: 16, marginTop: 8 },
  importBtnTxt:     { fontSize: 15, fontWeight: '800', color: '#FFF', letterSpacing: 0.5 },
  cancelBtn:        { alignItems: 'center', padding: 14 },
  cancelBtnTxt:     { fontSize: 14, color: DS.textMed },

  // Resultado
  resultBanner:     { flexDirection: 'row', alignItems: 'center', gap: 10,
                      padding: 14, borderRadius: 16, borderWidth: 1, marginBottom: 20 },
  resultTitle:      { fontSize: 14, fontWeight: '700', color: DS.text },
  resultSub:        { fontSize: 12, color: DS.textMed, marginTop: 2 },
  resultResetBtn:   { paddingHorizontal: 12, paddingVertical: 6,
                      backgroundColor: DS.surface2, borderRadius: 8 },
  resultResetTxt:   { fontSize: 12, fontWeight: '700', color: DS.text },

  // Modales
  modalOverlay:     { flex: 1, backgroundColor: '#00000055', justifyContent: 'flex-end' },
  modalSheet:       { backgroundColor: DS.white, borderTopLeftRadius: 24, borderTopRightRadius: 24,
                      padding: 20, paddingBottom: 40 },
  modalHeader:      { flexDirection: 'row', justifyContent: 'space-between',
                      alignItems: 'center', marginBottom: 16 },
  modalTitle:       { fontSize: 18, fontWeight: '800', color: DS.text },
  infoBox:          { flexDirection: 'row', alignItems: 'center', gap: 8,
                      padding: 10, borderRadius: 12, marginBottom: 12 },
  infoTxt:          { fontSize: 13, fontWeight: '600', flex: 1 },
  modalDesc:        { fontSize: 13, color: DS.textMed, lineHeight: 19, marginBottom: 16 },
  modalSummaryRow:  { flexDirection: 'row', gap: 8, marginBottom: 14 },
  modalSummaryChip: { flex: 1, alignItems: 'center', padding: 10, borderRadius: 12 },
  modalSummaryVal:  { fontSize: 20, fontWeight: '900', fontFamily: DS.mono },
  modalSummaryLbl:  { fontSize: 10, color: DS.textMed, marginTop: 2, textAlign: 'center' },
  confirmBtn:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
                      gap: 8, borderRadius: 14, padding: 15, marginBottom: 4 },
  confirmBtnTxt:    { fontSize: 14, fontWeight: '800', color: '#FFF', letterSpacing: 0.3 },
});