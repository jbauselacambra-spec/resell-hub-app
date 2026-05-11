/**
 * VintedImportScreen.jsx — Sprint 11 + Theme Integration
 *
 * [DATA_SCIENTIST] Sprint 11:
 * - handleConfirmE: usa _enrichedItems de matchHistoryToInventory()
 *   para guardar SaleRecords con categoría correcta en VintedSalesDB
 * - handleConfirmD: idem para Modo D
 * - autoRegisterCategories: registra categorías inferidas en el diccionario
 *
 * [DESIGN] Integrado con theme.js:
 * - Usa DS, SPACE, RADIUS, SHADOW, TXT, BTN del design system
 * - Tipografía consistente con DM Sans
 * - Colores semánticos unificados
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
import { DS, SPACE, RADIUS, SHADOW, TXT, BTN, BTN_TEXT, FONT_SIZE, FONT_FAMILY, fmtPrice } from '../theme';

const { width } = Dimensions.get('window');

// ─── Metadatos por tipo de contenido ─────────────────────────────────────────
const TYPE_META = {
  json_products:       { label: 'JSON escaparate (Inventario)',    mode: 'C', color: DS.brand, icon: 'package' },
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
    color: DS.brand,
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
        {checked && <Icon name="check" size={12} color={DS.white} />}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.previewTitle} numberOfLines={1}>{item.title || item.orderId}</Text>
        <View style={styles.previewRow}>
          <View style={[styles.typeBadge, { backgroundColor: isVenta ? DS.successDim : DS.dangerDim }]}>
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

// ─── PreviewCard — Modo C (VintedProduct) ────────────────────────────────────
function ProductPreviewCard({ item, checked, onToggle }) {
  const statusColor = item.status === 'sold' ? DS.success : DS.blue;
  const statusLabel = item.status === 'sold' ? 'Vendido' : 'Activo';

  return (
    <TouchableOpacity
      style={[styles.previewCard, checked && styles.previewCardChecked]}
      onPress={onToggle}
      activeOpacity={0.8}
    >
      <View style={[styles.previewCheck, checked && styles.previewCheckOn]}>
        {checked && <Icon name="check" size={12} color={DS.white} />}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.previewTitle} numberOfLines={1}>{item.title}</Text>
        <View style={styles.previewRow}>
          <View style={[styles.typeBadge, { backgroundColor: statusColor + '1A' }]}>
            <Text style={[styles.typeBadgeTxt, { color: statusColor }]}>{statusLabel}</Text>
          </View>
          {item.price && (
            <Text style={[styles.previewAmt, { color: DS.brand }]}>{fmtPrice(item.price)}</Text>
          )}
          {item.category && (
            <Text style={styles.previewCat}>{item.category}</Text>
          )}
        </View>
        {item.productId && (
          <Text style={styles.previewOrder}>ID: {item.productId}</Text>
        )}
      </View>
      {item.imageUrl ? (
        <Image source={{ uri: item.imageUrl }} style={styles.previewImg} />
      ) : null}
    </TouchableOpacity>
  );
}

// ─── Modal C: confirmar importación inventario ────────────────────────────────
function ConfirmModalC({ visible, products, onConfirm, onClose }) {
  const activos  = products.filter(p => p.status === 'active').length;
  const vendidos = products.filter(p => p.status === 'sold').length;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose} />
        <View style={styles.modalSheet}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Confirmar importación</Text>
            <TouchableOpacity onPress={onClose}>
              <Icon name="x" size={24} color={DS.text2} />
            </TouchableOpacity>
          </View>

          <View style={[styles.infoBox, { backgroundColor: DS.brandLight, borderColor: DS.brand, borderWidth: 1 }]}>
            <Icon name="package" size={18} color={DS.brand} />
            <Text style={[styles.infoTxt, { color: DS.brand }]}>
              Modo C — Importación de inventario
            </Text>
          </View>

          <Text style={styles.modalDesc}>
            Se importarán {products.length} productos al inventario.{'\n'}
            • Activos: {activos}{'\n'}
            • Vendidos: {vendidos}{'\n\n'}
            Los productos existentes se fusionarán con Los 7 Campos Sagrados.
          </Text>

          <View style={styles.modalSummaryRow}>
            <View style={[styles.modalSummaryChip, { backgroundColor: DS.blueDim }]}>
              <Text style={[styles.modalSummaryVal, { color: DS.blue }]}>{activos}</Text>
              <Text style={styles.modalSummaryLbl}>Activos</Text>
            </View>
            <View style={[styles.modalSummaryChip, { backgroundColor: DS.successDim }]}>
              <Text style={[styles.modalSummaryVal, { color: DS.success }]}>{vendidos}</Text>
              <Text style={styles.modalSummaryLbl}>Vendidos</Text>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.confirmBtn, { backgroundColor: DS.brand }]}
            onPress={onConfirm}
            activeOpacity={0.85}
          >
            <Icon name="download" size={18} color={DS.white} />
            <Text style={styles.confirmBtnTxt}>Importar {products.length} productos</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ─── Modal D: confirmar actualización ventas ──────────────────────────────────
function ConfirmModalD({ visible, items, onConfirm, onClose }) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose} />
        <View style={styles.modalSheet}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Confirmar actualización</Text>
            <TouchableOpacity onPress={onClose}>
              <Icon name="x" size={24} color={DS.text2} />
            </TouchableOpacity>
          </View>

          <View style={[styles.infoBox, { backgroundColor: DS.successLight, borderColor: DS.success, borderWidth: 1 }]}>
            <Icon name="trending-up" size={18} color={DS.success} />
            <Text style={[styles.infoTxt, { color: DS.success }]}>
              Modo D — Actualización de ventas
            </Text>
          </View>

          <Text style={styles.modalDesc}>
            Se actualizarán los productos vendidos en el inventario con los precios y fechas reales de venta.{'\n\n'}
            Total de ventas: {items.length}
          </Text>

          <View style={styles.modalSummaryRow}>
            <View style={[styles.modalSummaryChip, { backgroundColor: DS.successDim }]}>
              <Text style={[styles.modalSummaryVal, { color: DS.success }]}>{items.length}</Text>
              <Text style={styles.modalSummaryLbl}>Ventas</Text>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.confirmBtn, { backgroundColor: DS.success }]}
            onPress={onConfirm}
            activeOpacity={0.85}
          >
            <Icon name="refresh-cw" size={18} color={DS.white} />
            <Text style={styles.confirmBtnTxt}>Actualizar {items.length} ventas</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ─── Modal E: confirmar importación historial ─────────────────────────────────
function ConfirmModalE({ visible, items, onConfirm, onClose }) {
  const ventas  = items.filter(i => i.type !== 'compra').length;
  const compras = items.filter(i => i.type === 'compra').length;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose} />
        <View style={styles.modalSheet}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Confirmar importación</Text>
            <TouchableOpacity onPress={onClose}>
              <Icon name="x" size={24} color={DS.text2} />
            </TouchableOpacity>
          </View>

          <View style={[styles.infoBox, { backgroundColor: DS.blueLight, borderColor: DS.blue, borderWidth: 1 }]}>
            <Icon name="clock" size={18} color={DS.blue} />
            <Text style={[styles.infoTxt, { color: DS.blue }]}>
              Modo E — Historial completo
            </Text>
          </View>

          <Text style={styles.modalDesc}>
            Se importarán {items.length} registros del historial de ventas y compras.{'\n'}
            • Ventas: {ventas}{'\n'}
            • Compras: {compras}{'\n\n'}
            Se cruzará con el inventario y se alimentarán las estadísticas económicas.
          </Text>

          <View style={styles.modalSummaryRow}>
            <View style={[styles.modalSummaryChip, { backgroundColor: DS.successDim }]}>
              <Text style={[styles.modalSummaryVal, { color: DS.success }]}>{ventas}</Text>
              <Text style={styles.modalSummaryLbl}>Ventas</Text>
            </View>
            <View style={[styles.modalSummaryChip, { backgroundColor: DS.dangerDim }]}>
              <Text style={[styles.modalSummaryVal, { color: DS.danger }]}>{compras}</Text>
              <Text style={styles.modalSummaryLbl}>Compras</Text>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.confirmBtn, { backgroundColor: DS.blue }]}
            onPress={onConfirm}
            activeOpacity={0.85}
          >
            <Icon name="download" size={18} color={DS.white} />
            <Text style={styles.confirmBtnTxt}>Importar {items.length} registros</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ─── COMPONENTE PRINCIPAL ─────────────────────────────────────────────────────
export default function VintedImportScreen({ navigation }) {
  const [fileMeta, setFileMeta] = useState(null);
  const [contentType, setContentType] = useState(null);
  const [currentMode, setCurrentMode] = useState(null);

  // Modo C
  const [jsonProducts, setJsonProducts] = useState([]);
  // Modos A/B/D/E
  const [parsedItems, setParsedItems] = useState([]);

  const [checkedIds, setCheckedIds] = useState(new Set());
  const [showConfirm, setShowConfirm] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;

  // ─── Handlers ─────────────────────────────────────────────────────────────
  const handlePickFile = useCallback(async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true });
      if (res.canceled) return;
      const f = res.assets?.[0];
      if (!f) return;

      setLoading(true);
      const { uri, name, size } = f;
      const localUri = uri.startsWith('file://') ? uri : `file://${uri}`;
      const content = await FileSystem.readAsStringAsync(localUri, { encoding: FileSystem.EncodingType.UTF8 });

      const detected = detectContentType(content);
      setFileMeta({ name, size, uri: localUri });
      setContentType(detected);

      const meta = TYPE_META[detected] || TYPE_META.unknown;
      setCurrentMode(meta.mode);

      if (detected === 'json_products') {
        const prods = parseJsonProducts(content);
        setJsonProducts(prods);
        setCheckedIds(new Set(prods.map(p => String(p.id))));
        Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
      } else if (['json_sales_current','json_sales_history'].includes(detected)) {
        const items = detected === 'json_sales_current'
          ? parseJsonSalesCurrent(content)
          : parseJsonSalesHistory(content);
        setParsedItems(items);
        setCheckedIds(new Set(items.map(i => i.orderId)));
        Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
      }

      setLoading(false);
    } catch (e) {
      console.error('[VintedImport] handlePickFile error:', e);
      setLoading(false);
      Alert.alert('Error', 'No se pudo leer el archivo.');
    }
  }, [fadeAnim]);

  const handleToggle = useCallback((id) => {
    setCheckedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    if (currentMode === 'C') {
      setCheckedIds(new Set(jsonProducts.map(p => String(p.id))));
    } else {
      setCheckedIds(new Set(parsedItems.map(i => i.orderId)));
    }
  }, [currentMode, jsonProducts, parsedItems]);

  const handleDeselectAll = useCallback(() => {
    setCheckedIds(new Set());
  }, []);

  const handleImport = useCallback(() => {
    if (checkedIds.size === 0) {
      Alert.alert('Sin selección', 'Selecciona al menos un elemento.');
      return;
    }
    setShowConfirm(true);
  }, [checkedIds]);

  const handleConfirmC = useCallback(() => {
    const selected = jsonProducts.filter(p => checkedIds.has(String(p.id)));
    const db = DatabaseService.getInventory();
    const ids = db.map(x => x.id);
    const maxId = ids.length > 0 ? Math.max(...ids) : 0;
    let nextId = maxId + 1;

    const fusionResults = { nuevos: 0, fusionados: 0 };
    selected.forEach(prod => {
      const exists = db.find(x => x.productId === prod.productId);
      if (exists) {
        const updated = { ...exists };
        const sacred = ['listPrice', 'purchasePrice', 'purchaseDate', 'cost', 'category', 'subcategory', 'tags'];
        sacred.forEach(k => {
          if (prod[k] != null && prod[k] !== '') updated[k] = prod[k];
        });
        updated.title    = prod.title    || updated.title;
        updated.imageUrl = prod.imageUrl || updated.imageUrl;
        updated.status   = prod.status   || updated.status;
        if (prod.soldPrice && !updated.soldPriceReal) updated.soldPrice = prod.soldPrice;
        if (prod.soldDate  && !updated.soldDateReal)  updated.soldDate  = prod.soldDate;
        const idx = db.findIndex(x => x.id === exists.id);
        db[idx] = updated;
        fusionResults.fusionados++;
      } else {
        const newProd = { ...prod, id: nextId++ };
        db.push(newProd);
        fusionResults.nuevos++;
      }
    });
    DatabaseService.saveInventory(db);
    autoRegisterCategories(selected);
    logImportEvent('C', { total: selected.length, ...fusionResults });

    setShowConfirm(false);
    setImportResult({ mode: 'C', nuevos: fusionResults.nuevos, fusionados: fusionResults.fusionados });
    Animated.timing(fadeAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start();
  }, [jsonProducts, checkedIds, fadeAnim]);

  const handleConfirmD = useCallback(async () => {
    const selected = parsedItems.filter(i => checkedIds.has(i.orderId));
    const db = DatabaseService.getInventory();
    let updated = 0;

    const result = await matchHistoryToInventory(selected, db);
    const enriched = result._enrichedItems;

    enriched.forEach(sale => {
      const prod = db.find(p => p.productId === sale.productId);
      if (prod && sale.soldPriceReal && sale.soldDateReal) {
        prod.soldPriceReal = sale.soldPriceReal;
        prod.soldDateReal  = sale.soldDateReal;
        if (!prod.soldPrice) prod.soldPrice = sale.soldPriceReal;
        if (!prod.soldDate)  prod.soldDate  = sale.soldDateReal;
        updated++;
      }
    });

    DatabaseService.saveInventory(db);
    await VintedSalesDB.bulkInsert(enriched);
    logImportEvent('D', { total: selected.length, matched: result.matched });

    setShowConfirm(false);
    setImportResult({ mode: 'D', updated });
    Animated.timing(fadeAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start();
  }, [parsedItems, checkedIds, fadeAnim]);

  const handleConfirmE = useCallback(async () => {
    const selected = parsedItems.filter(i => checkedIds.has(i.orderId));
    const db = DatabaseService.getInventory();

    const result = await matchHistoryToInventory(selected, db);
    const enriched = result._enrichedItems;

    await VintedSalesDB.bulkInsert(enriched);
    logImportEvent('E', { total: selected.length, matched: result.matched, unmatched: result.unmatched });

    setShowConfirm(false);
    setImportResult({ mode: 'E', total: selected.length });
    Animated.timing(fadeAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start();
  }, [parsedItems, checkedIds, fadeAnim]);

  const handleReset = useCallback(() => {
    setFileMeta(null);
    setContentType(null);
    setCurrentMode(null);
    setJsonProducts([]);
    setParsedItems([]);
    setCheckedIds(new Set());
    setImportResult(null);
    fadeAnim.setValue(0);
  }, [fadeAnim]);

 const handleViewLogs = () => navigation.navigate('Logs');

  // ─── Render ───────────────────────────────────────────────────────────────
  const meta = TYPE_META[contentType] || TYPE_META.unknown;

  return (
    <View style={styles.root}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Importar desde Vinted</Text>
          <Text style={styles.headerSub}>Sprint 11 — Parser JSON multi-modo</Text>
        </View>
        <TouchableOpacity style={styles.logsBtn} onPress={handleViewLogs}>
          <Icon name="list" size={14} color={DS.text2} />
          <Text style={styles.logsBtnTxt}>Logs</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {/* Drop Zone */}
        {!fileMeta && !loading && (
          <TouchableOpacity style={styles.dropZone} onPress={handlePickFile} activeOpacity={0.8}>
            <View style={styles.dropIcon}>
              <Icon name="upload" size={28} color={DS.brand} />
            </View>
            <Text style={styles.dropTitle}>Selecciona tu archivo JSON</Text>
            <Text style={styles.dropSub}>Toca aquí para elegir un archivo</Text>
            <View style={styles.dropBadge}>
              <Text style={styles.dropBadgeTxt}>.json</Text>
            </View>
          </TouchableOpacity>
        )}

        {loading && (
          <View style={[styles.dropZone, { minHeight: 120 }]}>
            <ActivityIndicator size="large" color={DS.brand} />
            <Text style={[styles.dropSub, { marginTop: 12 }]}>Analizando archivo...</Text>
          </View>
        )}

        {/* Guía */}
        {!fileMeta && !loading && (
          <>
            <Text style={styles.guideTitle}>GUÍA DE MODOS</Text>
            {GUIDE.map((g, i) => (
              <View key={i} style={styles.guideCard}>
                <View style={[styles.guideIcon, { backgroundColor: g.color + '1A' }]}>
                  <Icon name={g.icon} size={20} color={g.color} />
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

        {/* Resultado de importación */}
        {importResult && (
          <View
            style={[
              styles.resultBanner,
              {
                backgroundColor: DS.successLight,
                borderColor: DS.success,
              }
            ]}
          >
            <Icon name="check-circle" size={24} color={DS.success} />
            <View style={{ flex: 1 }}>
              <Text style={styles.resultTitle}>Importación completada</Text>
              {importResult.mode === 'C' && (
                <Text style={styles.resultSub}>
                  {importResult.nuevos} nuevos · {importResult.fusionados} fusionados
                </Text>
              )}
              {importResult.mode === 'D' && (
                <Text style={styles.resultSub}>{importResult.updated} productos actualizados</Text>
              )}
              {importResult.mode === 'E' && (
                <Text style={styles.resultSub}>{importResult.total} registros guardados</Text>
              )}
            </View>
            <TouchableOpacity style={styles.resultResetBtn} onPress={handleReset}>
              <Text style={styles.resultResetTxt}>Nuevo</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Tipo detectado */}
        {fileMeta && !importResult && (
          <View style={styles.typeBadgeRow}>
            <View style={[styles.typeChip, { backgroundColor: meta.color + '1A' }]}>
              <Icon name={meta.icon} size={14} color={meta.color} />
              <Text style={[styles.typeChipTxt, { color: meta.color }]}>{meta.label}</Text>
            </View>
            <Text style={styles.fileNameTxt} numberOfLines={1}>{fileMeta.name}</Text>
          </View>
        )}

        {/* Quick stats */}
        {fileMeta && !importResult && currentMode === 'C' && jsonProducts.length > 0 && (
          <View style={styles.quickStats}>
            <View style={styles.quickStatItem}>
              <Text style={[styles.quickStatVal, { color: DS.blue }]}>
                {jsonProducts.filter(p => p.status === 'active').length}
              </Text>
              <Text style={styles.quickStatLbl}>Activos</Text>
            </View>
            <View style={styles.quickStatDivider} />
            <View style={styles.quickStatItem}>
              <Text style={[styles.quickStatVal, { color: DS.success }]}>
                {jsonProducts.filter(p => p.status === 'sold').length}
              </Text>
              <Text style={styles.quickStatLbl}>Vendidos</Text>
            </View>
            <View style={styles.quickStatDivider} />
            <View style={styles.quickStatItem}>
              <Text style={[styles.quickStatVal, { color: DS.text }]}>{jsonProducts.length}</Text>
              <Text style={styles.quickStatLbl}>Total</Text>
            </View>
          </View>
        )}

        {fileMeta && !importResult && ['D','E'].includes(currentMode) && parsedItems.length > 0 && (
          <View style={styles.quickStats}>
            <View style={styles.quickStatItem}>
              <Text style={[styles.quickStatVal, { color: DS.success }]}>
                {parsedItems.filter(i => i.type !== 'compra').length}
              </Text>
              <Text style={styles.quickStatLbl}>Ventas</Text>
            </View>
            <View style={styles.quickStatDivider} />
            <View style={styles.quickStatItem}>
              <Text style={[styles.quickStatVal, { color: DS.danger }]}>
                {parsedItems.filter(i => i.type === 'compra').length}
              </Text>
              <Text style={styles.quickStatLbl}>Compras</Text>
            </View>
            <View style={styles.quickStatDivider} />
            <View style={styles.quickStatItem}>
              <Text style={[styles.quickStatVal, { color: DS.text }]}>{parsedItems.length}</Text>
              <Text style={styles.quickStatLbl}>Total</Text>
            </View>
          </View>
        )}

        {/* Barra de selección */}
        {fileMeta && !importResult && (currentMode === 'C' ? jsonProducts.length : parsedItems.length) > 0 && (
          <View style={styles.selectionBar}>
            <TouchableOpacity style={styles.selAllBtn} onPress={handleSelectAll}>
              <Icon name="check-square" size={16} color={DS.brand} />
              <Text style={styles.selAllTxt}>Seleccionar todo</Text>
            </TouchableOpacity>
            <Text style={styles.selCount}>
              {checkedIds.size}/{currentMode === 'C' ? jsonProducts.length : parsedItems.length}
            </Text>
            {checkedIds.size > 0 && (
              <TouchableOpacity onPress={handleDeselectAll}>
                <Icon name="x" size={16} color={DS.text2} />
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Preview Cards — Modo C */}
        {currentMode === 'C' && jsonProducts.length > 0 && !importResult && (
          <Animated.View style={{ opacity: fadeAnim }}>
            {jsonProducts.map(p => (
              <ProductPreviewCard
                key={p.id}
                item={p}
                checked={checkedIds.has(String(p.id))}
                onToggle={() => handleToggle(String(p.id))}
              />
            ))}
          </Animated.View>
        )}

        {/* Preview Cards — Modos A/B/D/E */}
        {['D','E'].includes(currentMode) && parsedItems.length > 0 && !importResult && (
          <Animated.View style={{ opacity: fadeAnim }}>
            {parsedItems.map(item => (
              <SalePreviewCard
                key={item.orderId}
                item={item}
                checked={checkedIds.has(item.orderId)}
                onToggle={() => handleToggle(item.orderId)}
              />
            ))}
          </Animated.View>
        )}

        {/* Botón Importar */}
        {fileMeta && !importResult && checkedIds.size > 0 && (
          <Animated.View style={{ opacity: fadeAnim }}>
            <TouchableOpacity
              style={styles.importBtn}
              onPress={handleImport}
              activeOpacity={0.85}
            >
              <Icon name="download" size={18} color={DS.white} />
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
  root: {
    flex: 1,
    backgroundColor: DS.surface2,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACE[4],
    paddingTop: 52,
    paddingBottom: SPACE[3],
    backgroundColor: DS.surface,
    borderBottomWidth: 1,
    borderBottomColor: DS.border,
  },
  headerTitle: {
    ...TXT.heading,
  },
  headerSub: {
    fontSize: FONT_SIZE.sm,
    color: DS.text3,
    marginTop: 2,
  },
  logsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: SPACE[2],
    paddingVertical: 6,
    borderRadius: RADIUS.sm,
    backgroundColor: DS.surface3,
  },
  logsBtnTxt: {
    fontSize: FONT_SIZE.sm,
    color: DS.text2,
    fontWeight: '500',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: SPACE[4],
    paddingBottom: 40,
  },

  // Drop Zone
  dropZone: {
    borderWidth: 2,
    borderColor: DS.brand + '40',
    borderStyle: 'dashed',
    borderRadius: RADIUS.xl,
    padding: SPACE[8],
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: DS.brandLight,
    marginBottom: SPACE[6],
    minHeight: 180,
  },
  dropIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: DS.white,
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOW.md,
    marginBottom: SPACE[3],
  },
  dropTitle: {
    ...TXT.subheading,
    marginBottom: 4,
  },
  dropSub: {
    fontSize: FONT_SIZE.sm,
    color: DS.text2,
    marginBottom: SPACE[2],
  },
  dropBadge: {
    paddingHorizontal: SPACE[3],
    paddingVertical: 4,
    backgroundColor: DS.white,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: DS.border,
  },
  dropBadgeTxt: {
    fontSize: FONT_SIZE.xs,
    color: DS.text3,
    fontFamily: FONT_FAMILY.mono,
  },

  // Guía
  guideTitle: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '700',
    color: DS.text3,
    letterSpacing: 0.5,
    marginBottom: SPACE[2],
  },
  guideCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACE[3],
    backgroundColor: DS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACE[3] + 2,
    marginBottom: SPACE[2],
    borderWidth: 1,
    borderColor: DS.border,
  },
  guideIcon: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  guideCardTitle: {
    fontSize: FONT_SIZE.base,
    fontWeight: '800',
    color: DS.text,
    marginBottom: 2,
  },
  guideCardSub: {
    fontSize: FONT_SIZE.xs,
    color: DS.text3,
    marginBottom: 4,
    fontFamily: FONT_FAMILY.mono,
  },
  guideCardDesc: {
    fontSize: FONT_SIZE.sm,
    color: DS.text2,
    lineHeight: 17,
  },

  // Tipo detectado
  typeBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: SPACE[3],
  },
  typeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: SPACE[2],
    paddingVertical: 5,
    borderRadius: RADIUS.full,
  },
  typeChipTxt: {
    fontSize: FONT_SIZE.xs,
    fontWeight: '700',
  },
  fileNameTxt: {
    fontSize: FONT_SIZE.xs,
    color: DS.text3,
    flex: 1,
    fontFamily: FONT_FAMILY.mono,
  },

  // Quick stats
  quickStats: {
    flexDirection: 'row',
    backgroundColor: DS.surface,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: DS.border,
    padding: SPACE[3] + 2,
    marginBottom: SPACE[3] + 2,
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  quickStatItem: {
    alignItems: 'center',
  },
  quickStatVal: {
    fontSize: FONT_SIZE.lg,
    fontWeight: '900',
    fontFamily: FONT_FAMILY.mono,
  },
  quickStatLbl: {
    fontSize: FONT_SIZE.xs,
    color: DS.text3,
    marginTop: 2,
  },
  quickStatDivider: {
    width: 1,
    height: 30,
    backgroundColor: DS.border,
  },

  // Barra selección
  selectionBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACE[2],
    marginBottom: SPACE[2],
  },
  selAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  selAllTxt: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '700',
    color: DS.brand,
  },
  selCount: {
    fontSize: FONT_SIZE.sm,
    color: DS.text2,
  },

  // Preview cards
  previewCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE[2],
    backgroundColor: DS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACE[3],
    marginBottom: SPACE[2],
    borderWidth: 1,
    borderColor: DS.border,
  },
  previewCardChecked: {
    borderColor: DS.brand,
    borderWidth: 2,
  },
  previewCheck: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: DS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewCheckOn: {
    backgroundColor: DS.brand,
    borderColor: DS.brand,
  },
  previewTitle: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '700',
    color: DS.text,
    marginBottom: 5,
  },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  typeBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: RADIUS.sm,
  },
  typeBadgeTxt: {
    fontSize: 9,
    fontWeight: '900',
  },
  previewAmt: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '800',
    fontFamily: FONT_FAMILY.mono,
  },
  previewDate: {
    fontSize: FONT_SIZE.xs,
    color: DS.text3,
  },
  previewOrder: {
    fontSize: FONT_SIZE.xs,
    color: DS.text3,
    marginTop: 3,
    fontFamily: FONT_FAMILY.mono,
  },
  previewCat: {
    fontSize: FONT_SIZE.xs,
    color: DS.text2,
  },
  noDateBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    backgroundColor: DS.warningDim,
    borderRadius: RADIUS.sm,
  },
  noDateTxt: {
    fontSize: 9,
    fontWeight: '900',
    color: DS.warning,
  },
  previewImg: {
    width: 46,
    height: 46,
    borderRadius: RADIUS.sm + 2,
    backgroundColor: DS.surface3,
  },

  // Botón importar
  importBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACE[2],
    backgroundColor: DS.brand,
    borderRadius: RADIUS.lg,
    padding: SPACE[4],
    marginTop: SPACE[2],
  },
  importBtnTxt: {
    fontSize: FONT_SIZE.md,
    fontWeight: '800',
    color: DS.white,
    letterSpacing: 0.5,
  },
  cancelBtn: {
    alignItems: 'center',
    padding: SPACE[3] + 2,
  },
  cancelBtnTxt: {
    fontSize: FONT_SIZE.base,
    color: DS.text2,
  },

  // Resultado
  resultBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE[2],
    padding: SPACE[3] + 2,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    marginBottom: SPACE[5],
  },
  resultTitle: {
    fontSize: FONT_SIZE.base,
    fontWeight: '700',
    color: DS.text,
  },
  resultSub: {
    fontSize: FONT_SIZE.sm,
    color: DS.text2,
    marginTop: 2,
  },
  resultResetBtn: {
    paddingHorizontal: SPACE[3],
    paddingVertical: 6,
    backgroundColor: DS.surface3,
    borderRadius: RADIUS.sm,
  },
  resultResetTxt: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '700',
    color: DS.text,
  },

  // Modales
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: DS.surface,
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    padding: SPACE[5],
    paddingBottom: 40,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACE[4],
  },
  modalTitle: {
    ...TXT.heading,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE[2],
    padding: SPACE[2],
    borderRadius: RADIUS.md,
    marginBottom: SPACE[3],
  },
  infoTxt: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '600',
    flex: 1,
  },
  modalDesc: {
    fontSize: FONT_SIZE.sm,
    color: DS.text2,
    lineHeight: 19,
    marginBottom: SPACE[4],
  },
  modalSummaryRow: {
    flexDirection: 'row',
    gap: SPACE[2],
    marginBottom: SPACE[3] + 2,
  },
  modalSummaryChip: {
    flex: 1,
    alignItems: 'center',
    padding: SPACE[2],
    borderRadius: RADIUS.md,
  },
  modalSummaryVal: {
    fontSize: FONT_SIZE.xl,
    fontWeight: '900',
    fontFamily: FONT_FAMILY.mono,
  },
  modalSummaryLbl: {
    fontSize: FONT_SIZE.xs,
    color: DS.text2,
    marginTop: 2,
    textAlign: 'center',
  },
  confirmBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACE[2],
    borderRadius: RADIUS.md + 2,
    padding: SPACE[4] - 1,
    marginBottom: 4,
  },
  confirmBtnTxt: {
    fontSize: FONT_SIZE.base,
    fontWeight: '800',
    color: DS.white,
    letterSpacing: 0.3,
  },
});