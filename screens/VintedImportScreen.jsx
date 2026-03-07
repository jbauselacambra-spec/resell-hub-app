/**
 * VintedImportScreen.jsx — Sprint 6 (fix completo)
 *
 * Gestiona los 3 flujos de importación desde Vinted:
 *
 *  MODO A  'html_sales_current'  → HTML "Mis pedidos / Año actual"
 *    · Extrae orderId + title + soldPriceReal + status + imageUrl
 *    · soldDateReal NO viene en el HTML → modal de fecha antes de confirmar
 *    · Puede actualizar campos permanentes de productos YA existentes en BD
 *
 *  MODO B  'html_sales_history'  → HTML "Historial de transacciones"
 *    · Extrae orderId + type + title + amount + date(ISO)
 *    · Ventas → SaleRecord en VintedSalesDB (estadísticas económicas)
 *    · No vincula directamente a productos del inventario
 *
 *  MODO C  'json_products'       → JSON del script de consola del escaparate
 *    · Array completo de InternalProduct
 *    · Pasa directamente a DatabaseService.importFromVinted()
 *    · Preview de productos con título, precio, estado, marca
 */

import React, { useState, useCallback, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  StyleSheet, Dimensions, Alert, Image, Modal,
  Clipboard, Platform, ActivityIndicator, Animated,
} from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import { DatabaseService } from '../services/DatabaseService';
import {
  detectContentType,
  parseVintedContent,
  parseJsonSalesCurrent,
  parseJsonSalesHistory,
  mapToInventoryProduct,
  mapToSaleRecord,
  VintedSalesDB,
  logImportEvent,
} from '../services/VintedParserService';
import LogService, { LOG_CTX } from '../services/LogService';

const { width } = Dimensions.get('window');

// ─── Design System Light ──────────────────────────────────────────────────────
const DS = {
  bg:        '#F8F9FA',  white:     '#FFFFFF',  surface2:  '#F0F2F5',
  border:    '#EAEDF0',  primary:   '#FF6B35',  primaryBg: '#FFF2EE',
  success:   '#00D9A3',  successBg: '#E8FBF6',  warning:   '#FFB800',  warningBg: '#FFF8E7',
  danger:    '#E63946',  blue:      '#004E89',  blueBg:    '#EAF2FB',
  purple:    '#6C63FF',  purpleBg:  '#F0EFFE',
  text:      '#1A1A2E',  textMed:   '#5C6070',  textLow:   '#A0A5B5',
  mono:      Platform.OS === 'android' ? 'monospace' : 'Courier New',
};

// ─── Meta por tipo detectado ───────────────────────────────────────────────────
const TYPE_META = {
  html_sales_current:  { label: 'Ventas año actual (HTML)', color: DS.success,  icon: 'trending-up',   mode: 'A' },
  html_sales_history:  { label: 'Historial (HTML)',         color: DS.blue,     icon: 'clock',         mode: 'B' },
  html_generic:        { label: 'HTML Vinted',              color: DS.warning,  icon: 'code',          mode: 'B' },
  json_products:       { label: 'JSON escaparate',          color: DS.primary,  icon: 'package',       mode: 'C' },
  json_sales_current:  { label: 'JSON ventas año actual',   color: DS.success,  icon: 'trending-up',   mode: 'D' },
  json_sales_history:  { label: 'JSON historial completo',  color: DS.blue,     icon: 'bar-chart-2',   mode: 'E' },
  url_product:         { label: 'URL producto',             color: DS.textLow,  icon: 'external-link', mode: null },
  url_inbox:           { label: 'URL pedido',               color: DS.textLow,  icon: 'inbox',         mode: null },
  unknown:             { label: 'Contenido no reconocido',  color: DS.textLow,  icon: 'help-circle',   mode: null },
};

// ─── Guía de pasos ─────────────────────────────────────────────────────────────
const GUIDE = [
  {
    mode: 'D', color: DS.success, icon: 'trending-up', title: 'JSON Ventas año actual',
    steps: ['Vinted → Mis pedidos (ventas) en PC', 'F12 → Consola → Pega scriptVentasActuales.js', 'JSON copiado al portapapeles automáticamente', 'Pega aquí → actualiza precios de venta reales'],
    note: '⚠️ No incluye fecha de venta — la introducirás manualmente.',
  },
  {
    mode: 'E', color: DS.blue, icon: 'bar-chart-2', title: 'JSON Historial completo',
    steps: ['Vinted → Perfil → Saldo y pagos (PC)', 'F12 → Consola → Pega scriptHistorialVentas.js', 'JSON copiado al portapapeles automáticamente', 'Pega aquí → estadísticas económicas de todos los años'],
    note: '✅ Incluye fecha y compras. Ideal para el balance económico completo.',
  },
  {
    mode: 'C', color: DS.primary, icon: 'code', title: 'JSON del script de consola',
    steps: ['Abre tu escaparate en Vinted en el navegador del PC', 'Abre DevTools (F12) → Consola', 'Pega y ejecuta el script → copia el JSON generado', 'Pega aquí → importa el inventario completo'],
    note: '✅ El formato más completo. Incluye id, precio, vistas, favoritos, imagen.',
  },
];

// ─── PreviewCard Modo A/B (VintedSaleItem) ────────────────────────────────────
function SalePreviewCard({ item, checked, onToggle, showDateWarning }) {
  const isVenta = item.type === 'venta';
  const amountColor = isVenta ? DS.success : DS.danger;
  const amount = typeof item.amount === 'number' ? item.amount : 0;

  return (
    <TouchableOpacity
      style={[styles.previewCard, checked && styles.previewCardChecked]}
      onPress={onToggle}
      activeOpacity={0.8}
    >
      <View style={styles.pcCheck}>
        <View style={[styles.checkbox, checked && styles.checkboxActive]}>
          {checked && <Icon name="check" size={11} color="#FFF"/>}
        </View>
      </View>

      {item.imageUrl
        ? <Image source={{uri: item.imageUrl}} style={styles.pcThumb} resizeMode="cover"/>
        : <View style={[styles.pcThumb, styles.pcThumbEmpty]}>
            <Icon name={isVenta ? 'package' : 'shopping-cart'} size={20} color={DS.textLow}/>
          </View>
      }

      <View style={styles.pcContent}>
        <View style={styles.pcTopRow}>
          <View style={[styles.typeBadge, {backgroundColor: isVenta ? DS.successBg : DS.blueBg}]}>
            <Text style={[styles.typeBadgeTxt, {color: isVenta ? DS.success : DS.blue}]}>
              {isVenta ? '↑ VENTA' : '↓ COMPRA'}
            </Text>
          </View>
          {item.status === 'completada' && (
            <View style={styles.statusDot}>
              <Icon name="check-circle" size={11} color={DS.success}/>
              <Text style={styles.statusTxt}>Completada</Text>
            </View>
          )}
        </View>

        <Text style={styles.pcTitle} numberOfLines={2}>{item.title}</Text>

        <View style={styles.pcBottomRow}>
          <Text style={[styles.pcAmount, {color: amountColor}]}>
            {isVenta ? '+' : ''}{amount.toFixed(2)}€
          </Text>
          {item.date
            ? <Text style={styles.pcDate}>
                {new Date(item.date).toLocaleDateString('es-ES', {day:'2-digit', month:'short', year:'numeric'})}
              </Text>
            : showDateWarning && (
                <View style={styles.noDateBadge}>
                  <Icon name="calendar" size={9} color={DS.warning}/>
                  <Text style={styles.noDateTxt}>Sin fecha</Text>
                </View>
              )
          }
          <Text style={styles.pcOrderId}>#{item.orderId}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ─── PreviewCard Modo C (InternalProduct del JSON) ────────────────────────────
function ProductPreviewCard({ product, checked, onToggle }) {
  const isSold = product.status === 'sold';

  return (
    <TouchableOpacity
      style={[styles.previewCard, checked && styles.previewCardChecked]}
      onPress={onToggle}
      activeOpacity={0.8}
    >
      <View style={styles.pcCheck}>
        <View style={[styles.checkbox, checked && styles.checkboxActive]}>
          {checked && <Icon name="check" size={11} color="#FFF"/>}
        </View>
      </View>

      {product.images?.[0]
        ? <Image source={{uri: product.images[0]}} style={styles.pcThumb} resizeMode="cover"/>
        : <View style={[styles.pcThumb, styles.pcThumbEmpty]}>
            <Icon name="package" size={20} color={DS.textLow}/>
          </View>
      }

      <View style={styles.pcContent}>
        <View style={styles.pcTopRow}>
          <View style={[styles.typeBadge, {backgroundColor: isSold ? DS.surface2 : DS.successBg}]}>
            <Text style={[styles.typeBadgeTxt, {color: isSold ? DS.textMed : DS.success}]}>
              {isSold ? 'VENDIDO' : 'ACTIVO'}
            </Text>
          </View>
          {product.brand && product.brand !== 'Genérico' && (
            <Text style={styles.pcBrand}>{product.brand}</Text>
          )}
        </View>
        <Text style={styles.pcTitle} numberOfLines={2}>{product.title}</Text>
        <View style={styles.pcBottomRow}>
          <Text style={[styles.pcAmount, {color: DS.primary}]}>{(product.price || 0).toFixed(2)}€</Text>
          {product.views > 0 && (
            <Text style={styles.pcDate}>
              <Icon name="eye" size={9} color={DS.textLow}/> {product.views}
            </Text>
          )}
          {product.favorites > 0 && (
            <Text style={styles.pcDate}>
              <Icon name="heart" size={9} color={DS.textLow}/> {product.favorites}
            </Text>
          )}
          <Text style={styles.pcOrderId}>#{(product.id || '').toString().replace('vinted_', '')}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ─── Modal fecha venta (Modo A) ────────────────────────────────────────────────
// Formato A no incluye fecha → pedimos confirmación antes de guardar
function DateConfirmModal({ visible, onClose, onConfirm, itemCount }) {
  const [dateStr, setDateStr] = useState('');
  const today = new Date().toLocaleDateString('es-ES', {day:'2-digit', month:'2-digit', year:'numeric'});

  // Parsea "dd/mm/yyyy" → ISO
  const parseDate = (s) => {
    const m = s.trim().match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
    if (!m) return null;
    const d = parseInt(m[1]), mo = parseInt(m[2]), y = parseInt(m[3]);
    if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
    return new Date(y, mo - 1, d, 12, 0, 0).toISOString();
  };

  const handleConfirm = () => {
    const iso = parseDate(dateStr);
    if (!iso) {
      Alert.alert('Fecha inválida', 'Usa el formato DD/MM/AAAA, por ejemplo: 15/02/2026');
      return;
    }
    onConfirm(iso);
    setDateStr('');
  };

  const handleSkip = () => {
    onConfirm(null);   // null = guardar sin fecha, el usuario la edita en la app
    setDateStr('');
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.dateModal}>
          <View style={[styles.dateModalHdr, {backgroundColor: DS.warningBg}]}>
            <Icon name="calendar" size={20} color={DS.warning}/>
            <View style={{flex:1}}>
              <Text style={styles.dateModalTitle}>Fecha de venta no disponible</Text>
              <Text style={styles.dateModalSub}>
                El formato "Mis pedidos" no incluye la fecha. Introdúcela o sáltala.
              </Text>
            </View>
          </View>

          <View style={styles.dateModalBody}>
            <Text style={styles.dateModalLbl}>FECHA DE VENTA (DD/MM/AAAA)</Text>
            <TextInput
              style={styles.dateModalInput}
              value={dateStr}
              onChangeText={setDateStr}
              placeholder={`ej: ${today}`}
              placeholderTextColor={DS.textLow}
              keyboardType="numeric"
              maxLength={10}
              autoFocus
            />
            <Text style={styles.dateModalHint}>
              Afecta a {itemCount} item{itemCount !== 1 ? 's' : ''} seleccionado{itemCount !== 1 ? 's' : ''}
            </Text>
          </View>

          <View style={styles.dateModalFoot}>
            <TouchableOpacity style={styles.dateModalSkip} onPress={handleSkip}>
              <Text style={styles.dateModalSkipTxt}>Saltar (editar después)</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.dateModalConfirm, !dateStr && {backgroundColor: DS.textLow}]}
              onPress={handleConfirm}
              disabled={!dateStr}
            >
              <Icon name="check" size={15} color="#FFF"/>
              <Text style={styles.dateModalConfirmTxt}>Aplicar fecha</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ─── ConfirmModal (Modos A, B, C) ─────────────────────────────────────────────
function ConfirmModal({ visible, onClose, mode, parsedItems, jsonProducts, checkedIds,
                        onConfirmSalesCurrent, onConfirmSalesHistory, onConfirmJson }) {
  // Modo A/B: VintedSaleItem[]
  const selItems    = (parsedItems || []).filter(i => checkedIds.has(i.orderId));
  const ventas      = selItems.filter(i => i.type === 'venta');
  const compras     = selItems.filter(i => i.type === 'compra');
  const totalV      = ventas.reduce((s, i) => s + Math.abs(i.amount || 0), 0);
  const totalC      = compras.reduce((s, i) => s + Math.abs(i.amount || 0), 0);

  // Modo C: InternalProduct[]
  const selProducts = (jsonProducts || []).filter(p => checkedIds.has(String(p.id)));
  const activeProds = selProducts.filter(p => p.status !== 'sold');
  const soldProds   = selProducts.filter(p => p.status === 'sold');

  if (mode === 'C') {
    return (
      <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={onClose}>
          <TouchableOpacity activeOpacity={1} style={styles.confirmSheet}>
            <View style={styles.handle}/>
            <View style={styles.confirmHdr}>
              <Icon name="package" size={22} color={DS.primary}/>
              <Text style={styles.confirmTitle}>Importar inventario</Text>
              <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                <Icon name="x" size={16} color={DS.textMed}/>
              </TouchableOpacity>
            </View>

            <View style={styles.summaryRow}>
              <View style={[styles.summaryCard, {backgroundColor: DS.successBg}]}>
                <Text style={styles.summaryLbl}>ACTIVOS</Text>
                <Text style={[styles.summaryVal, {color: DS.success}]}>{activeProds.length}</Text>
              </View>
              <View style={[styles.summaryCard, {backgroundColor: DS.surface2}]}>
                <Text style={styles.summaryLbl}>VENDIDOS</Text>
                <Text style={[styles.summaryVal, {color: DS.textMed}]}>{soldProds.length}</Text>
              </View>
              <View style={[styles.summaryCard, {backgroundColor: DS.primaryBg}]}>
                <Text style={styles.summaryLbl}>TOTAL</Text>
                <Text style={[styles.summaryVal, {color: DS.primary}]}>{selProducts.length}</Text>
              </View>
            </View>

            <View style={styles.importInfoBox}>
              <Icon name="info" size={14} color={DS.blue}/>
              <Text style={styles.importInfoTxt}>
                El merge inteligente preserva tus datos manuales (categoría, fecha subida, precio venta real).
              </Text>
            </View>

            <TouchableOpacity style={styles.importBothBtn} onPress={onConfirmJson}>
              <Icon name="upload" size={16} color="#FFF"/>
              <Text style={styles.importBothTxt}>IMPORTAR {selProducts.length} PRODUCTOS</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    );
  }

  // Modo A
  if (mode === 'A') {
    return (
      <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={onClose}>
          <TouchableOpacity activeOpacity={1} style={styles.confirmSheet}>
            <View style={styles.handle}/>
            <View style={styles.confirmHdr}>
              <Icon name="trending-up" size={22} color={DS.success}/>
              <Text style={styles.confirmTitle}>Ventas año actual</Text>
              <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                <Icon name="x" size={16} color={DS.textMed}/>
              </TouchableOpacity>
            </View>

            <View style={styles.summaryRow}>
              <View style={[styles.summaryCard, {backgroundColor: DS.successBg}]}>
                <Text style={styles.summaryLbl}>VENTAS</Text>
                <Text style={[styles.summaryVal, {color: DS.success}]}>{selItems.length}</Text>
                <Text style={[styles.summaryAmt, {color: DS.success}]}>+{totalV.toFixed(2)}€</Text>
              </View>
              <View style={[styles.summaryCard, {backgroundColor: DS.warningBg, borderWidth:1, borderColor: DS.warning+'30'}]}>
                <Text style={styles.summaryLbl}>SIN FECHA</Text>
                <Text style={[styles.summaryVal, {color: DS.warning}]}>
                  {selItems.filter(i => !i.date).length}
                </Text>
                <Text style={[styles.summaryAmt, {color: DS.warning}]}>a editar</Text>
              </View>
            </View>

            <View style={[styles.importInfoBox, {backgroundColor: DS.warningBg, borderColor: DS.warning+'30'}]}>
              <Icon name="alert-triangle" size={14} color={DS.warning}/>
              <Text style={[styles.importInfoTxt, {color: '#8B6914'}]}>
                Este formato no incluye fecha de venta. Podrás introducirla ahora o editarla después en cada producto.
              </Text>
            </View>

            <TouchableOpacity style={[styles.importOptBtn]} onPress={() => onConfirmSalesCurrent('update_permanent')}>
              <View style={[styles.importOptIcon, {backgroundColor: DS.successBg}]}>
                <Icon name="refresh-cw" size={18} color={DS.success}/>
              </View>
              <View style={{flex:1}}>
                <Text style={styles.importOptTitle}>Actualizar datos permanentes</Text>
                <Text style={styles.importOptSub}>
                  Actualiza soldPriceReal en productos existentes que coincidan
                </Text>
              </View>
              <Icon name="chevron-right" size={16} color={DS.textLow}/>
            </TouchableOpacity>

            <TouchableOpacity style={styles.importOptBtn} onPress={() => onConfirmSalesCurrent('add_new')}>
              <View style={[styles.importOptIcon, {backgroundColor: DS.primaryBg}]}>
                <Icon name="plus-circle" size={18} color={DS.primary}/>
              </View>
              <View style={{flex:1}}>
                <Text style={styles.importOptTitle}>Añadir como nuevos vendidos</Text>
                <Text style={styles.importOptSub}>
                  Crea entradas nuevas en el historial de ventas
                </Text>
              </View>
              <Icon name="chevron-right" size={16} color={DS.textLow}/>
            </TouchableOpacity>

            <TouchableOpacity style={styles.importBothBtn} onPress={() => onConfirmSalesCurrent('both')}>
              <Icon name="zap" size={16} color="#FFF"/>
              <Text style={styles.importBothTxt}>ACTUALIZAR + AÑADIR NUEVOS</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    );
  }

  // Modo B
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} style={styles.confirmSheet}>
          <View style={styles.handle}/>
          <View style={styles.confirmHdr}>
            <Icon name="clock" size={22} color={DS.blue}/>
            <Text style={styles.confirmTitle}>Historial transacciones</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Icon name="x" size={16} color={DS.textMed}/>
            </TouchableOpacity>
          </View>

          <View style={styles.summaryRow}>
            <View style={[styles.summaryCard, {backgroundColor: DS.successBg}]}>
              <Text style={styles.summaryLbl}>VENTAS</Text>
              <Text style={[styles.summaryVal, {color: DS.success}]}>{ventas.length}</Text>
              <Text style={[styles.summaryAmt, {color: DS.success}]}>+{totalV.toFixed(2)}€</Text>
            </View>
            <View style={[styles.summaryCard, {backgroundColor: DS.blueBg}]}>
              <Text style={styles.summaryLbl}>COMPRAS</Text>
              <Text style={[styles.summaryVal, {color: DS.blue}]}>{compras.length}</Text>
              <Text style={[styles.summaryAmt, {color: DS.blue}]}>-{totalC.toFixed(2)}€</Text>
            </View>
            <View style={[styles.summaryCard, {backgroundColor: DS.primaryBg}]}>
              <Text style={styles.summaryLbl}>BALANCE</Text>
              <Text style={[styles.summaryVal, {color: DS.primary}]}>{selItems.length}</Text>
              <Text style={[styles.summaryAmt, {color: DS.primary}]}>
                {(totalV - totalC) >= 0 ? '+' : ''}{(totalV - totalC).toFixed(2)}€
              </Text>
            </View>
          </View>

          <TouchableOpacity style={styles.importOptBtn} onPress={() => onConfirmSalesHistory('stats')}>
            <View style={[styles.importOptIcon, {backgroundColor: DS.purpleBg}]}>
              <Icon name="bar-chart-2" size={18} color={DS.purple}/>
            </View>
            <View style={{flex:1}}>
              <Text style={styles.importOptTitle}>Guardar en Estadísticas Económicas</Text>
              <Text style={styles.importOptSub}>
                {selItems.length} registros → balance, análisis por mes
              </Text>
            </View>
            <Icon name="chevron-right" size={16} color={DS.textLow}/>
          </TouchableOpacity>

          {ventas.length > 0 && (
            <TouchableOpacity style={styles.importOptBtn} onPress={() => onConfirmSalesHistory('inventory')}>
              <View style={[styles.importOptIcon, {backgroundColor: DS.successBg}]}>
                <Icon name="package" size={18} color={DS.success}/>
              </View>
              <View style={{flex:1}}>
                <Text style={styles.importOptTitle}>Añadir al Inventario de Vendidos</Text>
                <Text style={styles.importOptSub}>
                  {ventas.length} venta{ventas.length > 1 ? 's' : ''} → aparecen en Historial de Ventas
                </Text>
              </View>
              <Icon name="chevron-right" size={16} color={DS.textLow}/>
            </TouchableOpacity>
          )}

          <TouchableOpacity style={styles.importBothBtn} onPress={() => onConfirmSalesHistory('both')}>
            <Icon name="zap" size={16} color="#FFF"/>
            <Text style={styles.importBothTxt}>IMPORTAR TODO (Inventario + Stats)</Text>
          </TouchableOpacity>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

// ─── Pantalla principal ───────────────────────────────────────────────────────
export default function VintedImportScreen({ navigation }) {
  // Estado compartido
  const [pastedText,    setPastedText]    = useState('');
  const [contentType,   setContentType]   = useState(null);
  const [loading,       setLoading]       = useState(false);
  const [manualMode,    setManualMode]    = useState(false);
  const [importResult,  setImportResult]  = useState(null);
  const [showConfirm,   setShowConfirm]   = useState(false);
  const [showDateModal, setShowDateModal] = useState(false);
  const [pendingAction, setPendingAction] = useState(null); // acción pendiente de fecha

  // Modo A/B: VintedSaleItem[]
  const [parsedItems, setParsedItems]     = useState([]);
  // Modo C: InternalProduct[]
  const [jsonProducts, setJsonProducts]   = useState([]);
  // IDs seleccionados (orderId para A/B, id para C)
  const [checkedIds,  setCheckedIds]      = useState(new Set());

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const fadeIn   = () => Animated.timing(fadeAnim, {toValue:1, duration:300, useNativeDriver:true}).start();

  const currentMode = contentType ? (TYPE_META[contentType]?.mode || null) : null;

  // ── Pegar desde portapapeles ─────────────────────────────────────────────
  const handlePaste = useCallback(async () => {
    setLoading(true);
    try {
      let text = '';
      if (Clipboard && typeof Clipboard.getString === 'function') {
        text = await Clipboard.getString();
      } else {
        setManualMode(true);
        setLoading(false);
        return;
      }
      if (!text.trim()) {
        Alert.alert('Portapapeles vacío', 'No hay contenido. Copia primero desde Vinted.');
        setLoading(false);
        return;
      }
      processText(text);
    } catch (e) {
      LogService.error('VintedImport paste', LOG_CTX.UI, e);
      setManualMode(true);
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Procesar texto → detectar tipo y parsear ─────────────────────────────
  const processText = useCallback((text) => {
    if (!text || !text.trim()) {
      Alert.alert('Contenido vacío', 'No hay nada que analizar.');
      return;
    }

    const result = parseVintedContent(text);
    const { type, items, products } = result;

    setContentType(type);
    setPastedText(text);
    fadeAnim.setValue(0);

    if (type === 'unknown') {
      setParsedItems([]); setJsonProducts([]); setCheckedIds(new Set());
      return;
    }

    if (type === 'url_product' || type === 'url_inbox') {
      Alert.alert('URL detectada', 'ResellHub analiza HTML copiado de Vinted, no URLs directas.\n\nUsa el script de consola para el inventario.');
      setParsedItems([]); setJsonProducts([]); setCheckedIds(new Set());
      return;
    }

    if (type === 'json_products' && products && products.length > 0) {
      setJsonProducts(products);
      setParsedItems([]);
      setCheckedIds(new Set(products.map(p => String(p.id))));
      fadeIn();
      LogService.success(`VintedImport JSON: ${products.length} productos`, LOG_CTX.IMPORT);
      return;
    }

    if (items && items.length > 0) {
      setParsedItems(items);
      setJsonProducts([]);
      setCheckedIds(new Set(items.map(i => i.orderId)));
      fadeIn();
      LogService.success(`VintedImport HTML: ${items.length} items (${type})`, LOG_CTX.IMPORT);
      return;
    }

    // Parseó pero vacío
    setParsedItems([]); setJsonProducts([]);
    Alert.alert('Sin resultados', 'Se detectó el formato pero no se encontraron items.\nAsegúrate de copiar el HTML completo de la lista.');
  }, []);

  // ── Toggle selección ─────────────────────────────────────────────────────
  const allIds  = currentMode === 'C'
    ? jsonProducts.map(p => String(p.id))
    : parsedItems.map(i => i.orderId);
  const totalCount = allIds.length;

  const toggleCheck = (id) => setCheckedIds(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });
  const toggleAll = () =>
    setCheckedIds(checkedIds.size === totalCount ? new Set() : new Set(allIds));

  // ── Confirmar Modo C: JSON productos ────────────────────────────────────
  const handleConfirmJson = () => {
    const selected = jsonProducts.filter(p => checkedIds.has(String(p.id)));
    if (!selected.length) return;
    const result = DatabaseService.importFromVinted(selected);
    logImportEvent('json_products', selected.length, { result });
    setShowConfirm(false);
    setImportResult({
      mode: 'C', inserted: result.created || 0,
      updated: result.updated || 0, total: selected.length,
    });
    LogService.success(`Import JSON: ${selected.length} productos`, LOG_CTX.IMPORT);
  };

  // ── Confirmar Modo A: "Mis pedidos" — necesita fecha ────────────────────
  const handleConfirmSalesCurrent = (action) => {
    setShowConfirm(false);
    const selected = parsedItems.filter(i => checkedIds.has(i.orderId));
    const hasNoDate = selected.some(i => !i.date);

    if (hasNoDate) {
      setPendingAction({ action, selected });
      setShowDateModal(true);
    } else {
      executeSalesCurrent(action, selected, null);
    }
  };

  const onDateConfirmed = (isoDate) => {
    setShowDateModal(false);
    if (!pendingAction) return;
    executeSalesCurrent(pendingAction.action, pendingAction.selected, isoDate);
    setPendingAction(null);
  };

  const executeSalesCurrent = (action, selected, soldDateReal) => {
    // Enriquecer items con la fecha confirmada
    const enriched = selected.map(i => ({
      ...i,
      soldDateReal: i.soldDateReal || soldDateReal,
      date:         i.date         || soldDateReal,
    }));

    let inserted = 0, updated = 0;

    if (action === 'update_permanent' || action === 'both') {
      // Actualizar productos existentes que coincidan por title o por orderId
      const allProducts = DatabaseService.getAllProducts();
      enriched.forEach(item => {
        const match = allProducts.find(p =>
          String(p.id).includes(item.orderId) ||
          (p.title && item.title && p.title.toLowerCase().trim() === item.title.toLowerCase().trim())
        );
        if (match) {
          const updated_ = {
            ...match,
            soldPriceReal: item.soldPriceReal || match.soldPriceReal,
            soldDateReal:  item.soldDateReal  || match.soldDateReal,
            status:        'sold',
          };
          if (DatabaseService.updateProduct(updated_)) updated++;
        }
      });
    }

    if (action === 'add_new' || action === 'both') {
      const products = enriched.filter(i => i.type === 'venta').map(mapToInventoryProduct);
      const result   = DatabaseService.importFromVinted(products);
      inserted = result.created || 0;
    }

    logImportEvent('html_current', selected.length, { action, inserted, updated });
    setImportResult({ mode: 'A', action, inserted, updated, total: selected.length });
    LogService.success(`Import Modo A (${action}): +${inserted} nuevos, ${updated} actualizados`, LOG_CTX.IMPORT);
  };

  // ── Confirmar Modo B: historial transacciones ───────────────────────────
  const handleConfirmSalesHistory = (dest) => {
    setShowConfirm(false);
    const selected = parsedItems.filter(i => checkedIds.has(i.orderId));
    let statResult = {inserted:0, duplicates:0};
    let invResult  = {created:0, updated:0};

    if (dest === 'stats' || dest === 'both') {
      const records = selected.map(mapToSaleRecord);
      statResult = VintedSalesDB.saveRecords(records);
    }
    if ((dest === 'inventory' || dest === 'both') && selected.some(i => i.type === 'venta')) {
      const ventas   = selected.filter(i => i.type === 'venta').map(mapToInventoryProduct);
      invResult = DatabaseService.importFromVinted(ventas);
    }

    logImportEvent('html_history', selected.length, { dest, statResult, invResult });
    setImportResult({
      mode: 'B', dest,
      statsInserted: statResult.inserted, statsDup: statResult.duplicates,
      invInserted: invResult.created || 0, total: selected.length,
    });
  };

  // ── Reset ───────────────────────────────────────────────────────────────
  const handleReset = () => {
    setPastedText(''); setContentType(null);
    setParsedItems([]); setJsonProducts([]);
    setCheckedIds(new Set()); setImportResult(null);
    setManualMode(false); setPendingAction(null);
    fadeAnim.setValue(0);
  };

  const typeMeta = contentType ? (TYPE_META[contentType] || TYPE_META.unknown) : null;
  const hasResults = (parsedItems.length > 0 || jsonProducts.length > 0) && !importResult;

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      {/* Modal fecha para Modo A */}
      <DateConfirmModal
        visible={showDateModal}
        onClose={() => { setShowDateModal(false); setPendingAction(null); }}
        onConfirm={onDateConfirmed}
        itemCount={pendingAction?.selected?.length || 0}
      />

      {/* Modal confirmación */}
      <ConfirmModal
        visible={showConfirm}
        onClose={() => setShowConfirm(false)}
        mode={currentMode === 'D' ? 'A' : currentMode === 'E' ? 'B' : currentMode}
        parsedItems={parsedItems}
        jsonProducts={jsonProducts}
        checkedIds={checkedIds}
        onConfirmSalesCurrent={handleConfirmSalesCurrent}
        onConfirmSalesHistory={handleConfirmSalesHistory}
        onConfirmJson={handleConfirmJson}
      />

      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Icon name="arrow-left" size={20} color={DS.text}/>
          </TouchableOpacity>
          <View style={{flex:1}}>
            <Text style={styles.headerTitle}>Importar desde Vinted</Text>
            <Text style={styles.headerSub}>Análisis offline · 3 formatos soportados</Text>
          </View>
        </View>

        {/* Banner resultado */}
        {importResult && (
          <View style={[styles.resultBanner, {
            backgroundColor: importResult.mode === 'C' ? DS.primaryBg :
                             (importResult.mode === 'A' || importResult.mode === 'D') ? DS.successBg :
                             (importResult.mode === 'B' || importResult.mode === 'E') ? DS.blueBg : DS.purpleBg,
            borderColor: importResult.mode === 'C' ? DS.primary+'40' :
                         (importResult.mode === 'A' || importResult.mode === 'D') ? DS.success+'40' :
                         (importResult.mode === 'B' || importResult.mode === 'E') ? DS.blue+'40' : DS.purple+'40',
          }]}>
            <Icon name="check-circle" size={20}
              color={importResult.mode==='C'?DS.primary:
                    (importResult.mode==='A'||importResult.mode==='D')?DS.success:
                    (importResult.mode==='B'||importResult.mode==='E')?DS.blue:DS.purple}/>
            <View style={{flex:1}}>
              {importResult.mode === 'C' && (
                <>
                  <Text style={styles.resultTitle}>¡Inventario importado!</Text>
                  <Text style={styles.resultSub}>
                    {importResult.inserted} nuevos · {importResult.updated} actualizados de {importResult.total}
                  </Text>
                </>
              )}
              {importResult.mode === 'A' && (
                <>
                  <Text style={styles.resultTitle}>¡Ventas procesadas!</Text>
                  <Text style={styles.resultSub}>
                    {importResult.inserted} nuevos · {importResult.updated} actualizados de {importResult.total}
                  </Text>
                </>
              )}
              {(importResult.mode === 'D') && (
                <Text style={styles.resultBodyText}>
                  {importResult.updated} ventas actualizadas · {importResult.created} añadidas al inventario
                </Text>
              )}
              {(importResult.mode === 'E') && (
                <>
                  <Text style={styles.resultTitle}>¡Historial importado!</Text>
                  <Text style={styles.resultSub}>
                    Stats: +{importResult.statsInserted} ({importResult.statsDup} dup) ·
                    Inventario: +{importResult.invInserted}
                  </Text>
                </>
              )}
            </View>
            <TouchableOpacity style={styles.resultResetBtn} onPress={handleReset}>
              <Text style={styles.resultResetTxt}>NUEVA</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Guía de formatos (solo cuando no hay resultados) */}
        {!hasResults && !importResult && (
          <View style={styles.guideSection}>
            {GUIDE.map((g, gi) => (
              <View key={gi} style={[styles.guideCard, {borderLeftColor: g.color}]}>
                <View style={styles.guideCardHdr}>
                  <View style={[styles.guideCardIcon, {backgroundColor: g.color+'18'}]}>
                    <Icon name={g.icon} size={16} color={g.color}/>
                  </View>
                  <View style={[styles.guideModeChip, {backgroundColor: g.color}]}>
                    <Text style={styles.guideModeChipTxt}>MODO {g.mode}</Text>
                  </View>
                  <Text style={styles.guideCardTitle}>{g.title}</Text>
                </View>
                {g.steps.map((s, si) => (
                  <View key={si} style={styles.guideStep}>
                    <Text style={[styles.guideStepNum, {color: g.color}]}>{si+1}</Text>
                    <Text style={styles.guideStepTxt}>{s}</Text>
                  </View>
                ))}
                <View style={[styles.guideNote, {backgroundColor: g.color+'0E'}]}>
                  <Text style={[styles.guideNoteTxt, {color: g.color === DS.warning ? '#8B6914' : g.color}]}>
                    {g.note}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Botón principal pegar */}
        {!hasResults && !importResult && (
          <TouchableOpacity style={styles.pasteBtn} onPress={handlePaste} disabled={loading}>
            {loading
              ? <ActivityIndicator color="#FFF" size="small"/>
              : <><Icon name="clipboard" size={20} color="#FFF"/>
                  <Text style={styles.pasteBtnTxt}>PEGAR DESDE VINTED</Text></>
            }
          </TouchableOpacity>
        )}

        {/* Textarea manual */}
        {(!hasResults && !importResult) && (
          <View style={styles.manualCard}>
            <View style={styles.manualHdr}>
              <Icon name="edit-3" size={14} color={DS.textMed}/>
              <Text style={styles.manualHdrTxt}>O pega el contenido aquí directamente:</Text>
            </View>
            <TextInput
              style={styles.manualInput}
              value={pastedText}
              onChangeText={setPastedText}
              multiline
              numberOfLines={5}
              placeholder="Pega HTML de Vinted o JSON del script de consola..."
              placeholderTextColor={DS.textLow}
              textAlignVertical="top"
            />
            <TouchableOpacity
              style={[styles.analyzeBtn, !pastedText.trim() && {backgroundColor: DS.textLow}]}
              onPress={() => processText(pastedText)}
              disabled={!pastedText.trim()}
            >
              <Icon name="search" size={15} color="#FFF"/>
              <Text style={styles.analyzeBtnTxt}>ANALIZAR CONTENIDO</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Badge tipo detectado */}
        {typeMeta && contentType !== 'unknown' && (
          <View style={[styles.typeBadgeBar, {backgroundColor: typeMeta.color+'12', borderColor: typeMeta.color+'30'}]}>
            <Icon name={typeMeta.icon} size={14} color={typeMeta.color}/>
            <Text style={[styles.typeBadgeBarTxt, {color: typeMeta.color}]}>{typeMeta.label}</Text>
            <Text style={styles.typeBadgeCount}>
              {currentMode === 'C' ? jsonProducts.length : parsedItems.length} items
            </Text>
          </View>
        )}
        {contentType === 'unknown' && pastedText.length > 10 && (
          <View style={[styles.typeBadgeBar, {backgroundColor:'#FFF3CD', borderColor: DS.warning+'40'}]}>
            <Icon name="alert-triangle" size={14} color={DS.warning}/>
            <Text style={[styles.typeBadgeBarTxt, {color: DS.warning}]}>Formato no reconocido</Text>
            <Text style={styles.typeBadgeCount}>Prueba con HTML de Vinted o JSON del script</Text>
          </View>
        )}

        {/* Lista preview */}
        {hasResults && (
          <Animated.View style={{opacity: fadeAnim}}>
            {/* Aviso Modo A sin fecha */}
            {(currentMode === 'A' || currentMode === 'D') && parsedItems.some(i => !i.date) && (
              <View style={styles.warnBar}>
                <Icon name="alert-triangle" size={14} color={DS.warning}/>
                <Text style={styles.warnBarTxt}>
                  Este formato no incluye fecha de venta. La introducirás al confirmar.
                </Text>
              </View>
            )}

            {/* Barra de selección */}
            <View style={styles.selectionBar}>
              <TouchableOpacity style={styles.selAllBtn} onPress={toggleAll}>
                <Icon name={checkedIds.size === totalCount ? 'check-square' : 'square'} size={16} color={DS.primary}/>
                <Text style={styles.selAllTxt}>
                  {checkedIds.size === totalCount ? 'Deseleccionar todo' : 'Seleccionar todo'}
                </Text>
              </TouchableOpacity>
              <Text style={styles.selCount}>{checkedIds.size}/{totalCount}</Text>
            </View>

            {/* Modo A/B: SalePreviewCard */}
            {currentMode !== 'C' && parsedItems.map(item => (
              <SalePreviewCard
                key={item.orderId}
                item={item}
                checked={checkedIds.has(item.orderId)}
                onToggle={() => toggleCheck(item.orderId)}
                showDateWarning={contentType === 'html_sales_current'}
              />
            ))}

            {/* Modo C: ProductPreviewCard */}
            {currentMode === 'C' && jsonProducts.map(product => (
              <ProductPreviewCard
                key={String(product.id)}
                product={product}
                checked={checkedIds.has(String(product.id))}
                onToggle={() => toggleCheck(String(product.id))}
              />
            ))}

            {/* Botón confirmar */}
            {checkedIds.size > 0 && (
              <TouchableOpacity style={styles.confirmBtn} onPress={() => setShowConfirm(true)}>
                <Icon name="upload" size={18} color="#FFF"/>
                <Text style={styles.confirmBtnTxt}>
                  IMPORTAR {checkedIds.size} ITEM{checkedIds.size > 1 ? 'S' : ''}
                </Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity style={styles.resetBtn} onPress={handleReset}>
              <Icon name="refresh-cw" size={14} color={DS.textMed}/>
              <Text style={styles.resetBtnTxt}>Limpiar y empezar de nuevo</Text>
            </TouchableOpacity>
          </Animated.View>
        )}

        <View style={{height:80}}/>
      </ScrollView>
    </View>
  );
}

// ─── Estilos ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container:     { flex:1, backgroundColor:DS.bg },

  header:        { flexDirection:'row', alignItems:'center', gap:12, paddingHorizontal:20, paddingTop:56, paddingBottom:20, backgroundColor:DS.white, borderBottomWidth:1, borderBottomColor:DS.border },
  backBtn:       { width:40, height:40, borderRadius:20, backgroundColor:DS.bg, justifyContent:'center', alignItems:'center' },
  headerTitle:   { fontSize:20, fontWeight:'900', color:DS.text },
  headerSub:     { fontSize:11, color:DS.textMed, marginTop:2 },

  resultBanner:  { flexDirection:'row', alignItems:'center', gap:12, margin:16, borderRadius:16, padding:14, borderWidth:1 },
  resultTitle:   { fontSize:14, fontWeight:'900', color:DS.text },
  resultSub:     { fontSize:11, color:DS.textMed, marginTop:2 },
  resultResetBtn:{ backgroundColor:'rgba(0,0,0,0.08)', paddingHorizontal:12, paddingVertical:6, borderRadius:12 },
  resultResetTxt:{ fontSize:10, fontWeight:'900', color:DS.textMed },

  guideSection:  { padding:16, gap:12 },
  guideCard:     { backgroundColor:DS.white, borderRadius:16, padding:16, borderLeftWidth:3, elevation:1 },
  guideCardHdr:  { flexDirection:'row', alignItems:'center', gap:8, marginBottom:12 },
  guideCardIcon: { width:32, height:32, borderRadius:10, justifyContent:'center', alignItems:'center' },
  guideModeChip: { paddingHorizontal:8, paddingVertical:3, borderRadius:8 },
  guideModeChipTxt:{ fontSize:9, fontWeight:'900', color:'#FFF', letterSpacing:0.5 },
  guideCardTitle:{ fontSize:14, fontWeight:'900', color:DS.text, flex:1 },
  guideStep:     { flexDirection:'row', alignItems:'flex-start', gap:10, marginBottom:6 },
  guideStepNum:  { fontSize:12, fontWeight:'900', width:16, marginTop:1 },
  guideStepTxt:  { flex:1, fontSize:12, color:DS.textMed, lineHeight:17 },
  guideNote:     { borderRadius:10, padding:10, marginTop:8 },
  guideNoteTxt:  { fontSize:11, lineHeight:16, fontWeight:'600' },

  pasteBtn:      { flexDirection:'row', alignItems:'center', justifyContent:'center', gap:10, backgroundColor:DS.primary, marginHorizontal:16, marginBottom:8, padding:18, borderRadius:20, elevation:4 },
  pasteBtnTxt:   { color:'#FFF', fontWeight:'900', fontSize:15, letterSpacing:0.5 },

  manualCard:    { margin:16, backgroundColor:DS.white, borderRadius:16, padding:16, elevation:1 },
  manualHdr:     { flexDirection:'row', alignItems:'center', gap:6, marginBottom:10 },
  manualHdrTxt:  { fontSize:12, color:DS.textMed, fontWeight:'700' },
  manualInput:   { backgroundColor:DS.bg, borderRadius:12, padding:12, minHeight:110, fontSize:12, color:DS.text, borderWidth:1, borderColor:DS.border, fontFamily:DS.mono },
  analyzeBtn:    { flexDirection:'row', alignItems:'center', justifyContent:'center', gap:8, backgroundColor:DS.blue, borderRadius:14, padding:14, marginTop:10 },
  analyzeBtnTxt: { color:'#FFF', fontWeight:'900', fontSize:13 },

  typeBadgeBar:  { flexDirection:'row', alignItems:'center', gap:8, marginHorizontal:16, marginBottom:8, borderRadius:12, padding:12, borderWidth:1 },
  typeBadgeBarTxt:{ fontSize:12, fontWeight:'800', flex:1 },
  typeBadgeCount: { fontSize:11, color:DS.textMed },

  warnBar:       { flexDirection:'row', alignItems:'flex-start', gap:8, backgroundColor:DS.warningBg, marginHorizontal:16, marginBottom:8, borderRadius:12, padding:12, borderWidth:1, borderColor:DS.warning+'30' },
  warnBarTxt:    { flex:1, fontSize:12, color:'#8B6914', lineHeight:17 },

  selectionBar:  { flexDirection:'row', alignItems:'center', justifyContent:'space-between', paddingHorizontal:16, paddingVertical:10 },
  selAllBtn:     { flexDirection:'row', alignItems:'center', gap:6 },
  selAllTxt:     { fontSize:12, fontWeight:'800', color:DS.primary },
  selCount:      { fontSize:11, color:DS.textMed, fontWeight:'700' },

  previewCard:      { flexDirection:'row', alignItems:'flex-start', gap:10, backgroundColor:DS.white, marginHorizontal:16, marginBottom:8, borderRadius:16, padding:12, elevation:1, borderWidth:1, borderColor:DS.border },
  previewCardChecked:{ borderColor:DS.primary+'50', backgroundColor:'#FFFCFA' },
  pcCheck:       { paddingTop:2 },
  checkbox:      { width:20, height:20, borderRadius:6, borderWidth:2, borderColor:DS.border, justifyContent:'center', alignItems:'center' },
  checkboxActive:{ backgroundColor:DS.primary, borderColor:DS.primary },
  pcThumb:       { width:60, height:60, borderRadius:12, backgroundColor:DS.bg },
  pcThumbEmpty:  { justifyContent:'center', alignItems:'center' },
  pcContent:     { flex:1 },
  pcTopRow:      { flexDirection:'row', alignItems:'center', gap:6, marginBottom:4, flexWrap:'wrap' },
  typeBadge:     { paddingHorizontal:7, paddingVertical:3, borderRadius:8 },
  typeBadgeTxt:  { fontSize:9, fontWeight:'900', letterSpacing:0.5 },
  statusDot:     { flexDirection:'row', alignItems:'center', gap:3 },
  statusTxt:     { fontSize:9, color:DS.success, fontWeight:'700' },
  noDateBadge:   { flexDirection:'row', alignItems:'center', gap:3, backgroundColor:DS.warningBg, paddingHorizontal:6, paddingVertical:2, borderRadius:6 },
  noDateTxt:     { fontSize:9, color:DS.warning, fontWeight:'800' },
  pcBrand:       { fontSize:9, color:DS.textMed, fontWeight:'700', backgroundColor:DS.bg, paddingHorizontal:6, paddingVertical:2, borderRadius:6 },
  pcTitle:       { fontSize:13, fontWeight:'700', color:DS.text, lineHeight:18, marginBottom:6 },
  pcBottomRow:   { flexDirection:'row', alignItems:'center', gap:8, flexWrap:'wrap' },
  pcAmount:      { fontSize:14, fontWeight:'900', fontFamily:DS.mono },
  pcDate:        { fontSize:10, color:DS.textMed },
  pcOrderId:     { fontSize:9, color:DS.textLow, marginLeft:'auto', fontFamily:DS.mono },

  confirmBtn:    { flexDirection:'row', alignItems:'center', justifyContent:'center', gap:10, backgroundColor:DS.primary, marginHorizontal:16, marginTop:8, padding:18, borderRadius:20, elevation:4 },
  confirmBtnTxt: { color:'#FFF', fontWeight:'900', fontSize:15, letterSpacing:0.5 },
  resetBtn:      { flexDirection:'row', alignItems:'center', justifyContent:'center', gap:6, padding:16 },
  resetBtnTxt:   { fontSize:12, color:DS.textMed, fontWeight:'700' },

  // Modales compartidos
  modalOverlay:  { flex:1, backgroundColor:'#00000060', justifyContent:'flex-end' },
  confirmSheet:  { backgroundColor:DS.white, borderTopLeftRadius:28, borderTopRightRadius:28, paddingBottom:34 },
  handle:        { width:40, height:4, backgroundColor:DS.border, borderRadius:2, alignSelf:'center', marginTop:12, marginBottom:16 },
  confirmHdr:    { flexDirection:'row', alignItems:'center', gap:12, paddingHorizontal:20, marginBottom:20 },
  confirmTitle:  { flex:1, fontSize:18, fontWeight:'900', color:DS.text },
  closeBtn:      { width:30, height:30, borderRadius:15, backgroundColor:DS.bg, justifyContent:'center', alignItems:'center' },
  summaryRow:    { flexDirection:'row', gap:10, paddingHorizontal:20, marginBottom:16 },
  summaryCard:   { flex:1, borderRadius:16, padding:12, alignItems:'center', gap:2 },
  summaryLbl:    { fontSize:8, fontWeight:'900', color:DS.textLow, letterSpacing:1 },
  summaryVal:    { fontSize:22, fontWeight:'900' },
  summaryAmt:    { fontSize:11, fontWeight:'800' },
  importInfoBox: { flexDirection:'row', alignItems:'flex-start', gap:10, backgroundColor:DS.blueBg, borderRadius:12, padding:12, marginHorizontal:20, marginBottom:12, borderWidth:1, borderColor:DS.blue+'20' },
  importInfoTxt: { flex:1, fontSize:12, color:DS.blue, lineHeight:17 },
  importOptBtn:  { flexDirection:'row', alignItems:'center', gap:14, paddingHorizontal:20, paddingVertical:16, borderTopWidth:1, borderTopColor:DS.bg },
  importOptIcon: { width:44, height:44, borderRadius:14, justifyContent:'center', alignItems:'center' },
  importOptTitle:{ fontSize:14, fontWeight:'800', color:DS.text },
  importOptSub:  { fontSize:11, color:DS.textMed, marginTop:2 },
  importBothBtn: { flexDirection:'row', alignItems:'center', justifyContent:'center', gap:10, backgroundColor:DS.text, marginHorizontal:20, marginTop:16, padding:16, borderRadius:18 },
  importBothTxt: { color:'#FFF', fontWeight:'900', fontSize:14 },

  // Modal fecha (Modo A)
  dateModal:     { backgroundColor:DS.white, borderRadius:24, marginHorizontal:20, overflow:'hidden', elevation:16, justifyContent:'center', alignSelf:'center', width:'90%' },
  dateModalHdr:  { flexDirection:'row', alignItems:'flex-start', gap:12, padding:18, borderBottomWidth:1, borderBottomColor:DS.border },
  dateModalTitle:{ fontSize:15, fontWeight:'900', color:DS.text },
  dateModalSub:  { fontSize:11, color:DS.textMed, marginTop:3, lineHeight:16 },
  dateModalBody: { padding:20 },
  dateModalLbl:  { fontSize:9, fontWeight:'900', color:DS.textLow, letterSpacing:1.5, marginBottom:10 },
  dateModalInput:{ backgroundColor:DS.bg, borderRadius:14, padding:14, fontSize:22, fontWeight:'900', color:DS.text, textAlign:'center', borderWidth:2, borderColor:DS.warning+'60', fontFamily:DS.mono },
  dateModalHint: { fontSize:11, color:DS.textMed, marginTop:8, textAlign:'center' },
  dateModalFoot: { flexDirection:'row', gap:10, padding:16, borderTopWidth:1, borderTopColor:DS.border },
  dateModalSkip: { flex:1, paddingVertical:12, alignItems:'center', borderRadius:14, borderWidth:1, borderColor:DS.border },
  dateModalSkipTxt:{ fontSize:12, fontWeight:'700', color:DS.textMed },
  dateModalConfirm:{ flex:2, flexDirection:'row', justifyContent:'center', alignItems:'center', gap:8, backgroundColor:DS.warning, paddingVertical:12, borderRadius:14 },
  dateModalConfirmTxt:{ fontSize:13, fontWeight:'900', color:'#FFF' },
});