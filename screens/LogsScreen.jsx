import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  TextInput, Alert, KeyboardAvoidingView, Platform,
  ScrollView, FlatList, Modal,
} from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import LogService, { LOG_CTX } from '../services/LogService';
import { DatabaseService } from '../services/DatabaseService';
import { MMKV } from 'react-native-mmkv';

const backupStorage = new MMKV();

// ─── Constantes ────────────────────────────────────────────────────────────
const LEVEL_CONFIG = {
  debug:    { label: 'DEBUG',    color: '#888',    bg: '#88888818' },
  info:     { label: 'INFO',     color: '#4EA8DE', bg: '#4EA8DE18' },
  success:  { label: 'OK',       color: '#00D9A3', bg: '#00D9A318' },
  warn:     { label: 'WARN',     color: '#FFB800', bg: '#FFB80018' },
  error:    { label: 'ERROR',    color: '#E63946', bg: '#E6394618' },
  critical: { label: 'CRIT',     color: '#FF0000', bg: '#FF000018' },
};

const CTX_COLORS = {
  IMPORT: '#FF6B35',
  DB:     '#4EA8DE',
  UI:     '#00D9A3',
  NAV:    '#888',
  CAT:    '#FFB800',
  NOTIF:  '#6C63FF',
  SYSTEM: '#1A1A2E',
};

const C = {
  bg:      '#0D0D1A',
  surface: '#141428',
  card:    '#1A1A35',
  border:  '#252540',
  primary: '#FF6B35',
  blue:    '#4EA8DE',
  success: '#00D9A3',
  white:   '#FFFFFF',
  gray:    '#888888',
  gray2:   '#BBBBBB',
};

// ─── Componentes auxiliares ────────────────────────────────────────────────

const LevelBadge = ({ level }) => {
  const cfg = LEVEL_CONFIG[level] || LEVEL_CONFIG.info;
  return (
    <View style={[lb.badge, { backgroundColor: cfg.bg }]}>
      <Text style={[lb.txt, { color: cfg.color }]}>{cfg.label}</Text>
    </View>
  );
};
const lb = StyleSheet.create({
  badge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 },
  txt:   { fontSize: 9, fontWeight: '900', letterSpacing: 0.5 },
});

const CtxBadge = ({ context }) => (
  <View style={[cx.badge, { borderColor: CTX_COLORS[context] || '#555' }]}>
    <Text style={[cx.txt, { color: CTX_COLORS[context] || '#888' }]}>{context}</Text>
  </View>
);
const cx = StyleSheet.create({
  badge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, borderWidth: 1 },
  txt:   { fontSize: 9, fontWeight: '800' },
});

// ─── Pantalla principal ────────────────────────────────────────────────────

export default function LogsScreen() {
  const [logs, setLogs]               = useState([]);
  const [stats, setStats]             = useState({});
  const [jsonInput, setJsonInput]     = useState('');
  const [filterLevel, setFilterLevel] = useState(null);   // null = todos
  const [filterCtx, setFilterCtx]     = useState(null);
  const [searchText, setSearchText]   = useState('');
  const [expandedId, setExpandedId]   = useState(null);
  const [showImport, setShowImport]   = useState(false);
  const [importing, setImporting]     = useState(false);

  const refresh = useCallback(() => {
    const opts = {};
    if (filterLevel)    opts.level   = filterLevel;
    if (filterCtx)      opts.context = filterCtx;
    if (searchText)     opts.search  = searchText;
    setLogs(LogService.getLogs(opts));
    setStats(LogService.getStats());
  }, [filterLevel, filterCtx, searchText]);

  useEffect(() => { refresh(); }, [refresh]);

  // ── Importación inteligente ───────────────────────────────────────────────
  const handleImport = () => {
    if (!jsonInput.trim()) return;
    setImporting(true);
    try {
      const raw  = JSON.parse(jsonInput);
      const data = Array.isArray(raw) ? raw : [raw];

      // Normalizar datos antes de importar
      const normalized = data.map(p => ({
        ...p,
        createdAt:  p.createdAt  || new Date().toISOString(),
        soldAt:     p.status === 'sold' && !p.soldAt   ? new Date().toISOString() : p.soldAt,
        soldDate:   p.status === 'sold' && !p.soldDate ? new Date().toISOString() : p.soldDate,
        price:      Number(p.price) || 0,
        soldPrice:  p.status === 'sold' ? (Number(p.soldPrice) || Number(p.price) || 0) : null,
      }));

      const result = DatabaseService.importFromVinted(normalized);
      LogService.logImportResult(result);

      if (result.success) {
        const msg = [
          `✅ Importación completada`,
          `📦 Total: ${result.count}`,
          `🆕 Nuevos: ${result.created}`,
          `🔄 Actualizados: ${result.updated}`,
          `♻️ Resubidas detectadas: ${result.reposted}`,
          `💰 Cambios de precio: ${result.priceChanged}`,
        ].join('\n');
        Alert.alert('Importación Inteligente', msg);
        setJsonInput('');
        setShowImport(false);
      } else {
        Alert.alert('Error', result.error || 'Error desconocido');
      }
    } catch (e) {
      LogService.exception('Error parseando JSON', e, 'IMPORT');
      Alert.alert('JSON inválido', e.message);
    } finally {
      setImporting(false);
      refresh();
    }
  };

  const handleBackup = () => {
    try {
      const data = DatabaseService.getAllProducts();
      backupStorage.set('emergency_backup', JSON.stringify(data));
      LogService.success(`Backup manual: ${data.length} productos`, 'SYSTEM');
      Alert.alert('✅ Backup guardado', `${data.length} productos respaldados.`);
    } catch (e) {
      LogService.exception('Error en backup', e, 'SYSTEM');
    }
    refresh();
  };

  const handleRecover = () => {
    try {
      const raw = backupStorage.getString('emergency_backup');
      if (!raw) { Alert.alert('Sin backup', 'No hay respaldo disponible.'); return; }
      const parsed = JSON.parse(raw);
      setJsonInput(JSON.stringify(parsed));
      setShowImport(true);
      Alert.alert('Backup cargado', `${parsed.length} productos listos para restaurar.`);
    } catch (e) {
      LogService.exception('Error recuperando backup', e, 'SYSTEM');
    }
  };

  const handleReset = () => {
    Alert.alert('⚠️ Acción crítica', 'Se guardará un backup y se borrarán TODOS los datos.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Resetear', style: 'destructive', onPress: () => {
        try {
          const data = DatabaseService.getAllProducts();
          backupStorage.set('emergency_backup', JSON.stringify(data));
          DatabaseService.saveProducts([]);
          LogService.warn(`Reset completo. Backup: ${data.length} productos`, 'SYSTEM');
          Alert.alert('Hecho', 'Base de datos borrada. Backup disponible.');
        } catch (e) {
          LogService.exception('Error en reset', e, 'SYSTEM');
        }
        refresh();
      }},
    ]);
  };

  // ── Render log item ───────────────────────────────────────────────────────
  const renderLog = ({ item }) => {
    const isExpanded = expandedId === item.id;
    const lvlCfg = LEVEL_CONFIG[item.level] || LEVEL_CONFIG.info;

    return (
      <TouchableOpacity
        style={[styles.logRow, { borderLeftColor: lvlCfg.color }]}
        onPress={() => setExpandedId(isExpanded ? null : item.id)}
        activeOpacity={0.8}
      >
        <View style={styles.logHeader}>
          <View style={styles.logMeta}>
            <LevelBadge level={item.level} />
            <CtxBadge context={item.context} />
            <Text style={styles.logTime}>{item.tsDisplay}</Text>
            {item.caller ? <Text style={styles.logCaller}>{item.caller}</Text> : null}
          </View>
          <Icon
            name={isExpanded ? 'chevron-up' : 'chevron-down'}
            size={12}
            color={C.gray}
          />
        </View>
        <Text style={styles.logMsg} numberOfLines={isExpanded ? undefined : 2}>
          {item.message}
        </Text>
        {isExpanded && item.extra ? (
          <View style={styles.extraBox}>
            <Text style={styles.extraTxt}>{item.extra}</Text>
          </View>
        ) : null}
      </TouchableOpacity>
    );
  };

  // ── Stats bar ─────────────────────────────────────────────────────────────
  const renderStats = () => (
    <View style={styles.statsBar}>
      {Object.entries(LEVEL_CONFIG).map(([level, cfg]) => {
        const count = stats[level] || 0;
        if (!count) return null;
        return (
          <TouchableOpacity
            key={level}
            style={[styles.statChip, filterLevel === level && { backgroundColor: cfg.bg + 'AA', borderColor: cfg.color }]}
            onPress={() => setFilterLevel(filterLevel === level ? null : level)}
          >
            <Text style={[styles.statChipTxt, { color: cfg.color }]}>{count} {cfg.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );

  // ── Context filter ────────────────────────────────────────────────────────
  const renderCtxFilter = () => (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.ctxBar}>
      {[null, ...Object.values(LOG_CTX)].map(ctx => (
        <TouchableOpacity
          key={ctx || 'ALL'}
          style={[styles.ctxChip, filterCtx === ctx && styles.ctxChipActive]}
          onPress={() => setFilterCtx(ctx)}
        >
          <Text style={[styles.ctxChipTxt, filterCtx === ctx && { color: C.white }]}>
            {ctx || 'TODOS'}
          </Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerSub}>SISTEMA</Text>
          <Text style={styles.headerTitle}>Consola de Control</Text>
        </View>
        <View style={styles.headerBtns}>
          <TouchableOpacity style={styles.hBtn} onPress={() => setShowImport(true)}>
            <Icon name="download" size={16} color={C.primary} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.hBtn} onPress={refresh}>
            <Icon name="refresh-cw" size={16} color={C.blue} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.hBtn} onPress={() => {
            Alert.alert('Limpiar logs', '¿Borrar historial?', [
              { text: 'Cancelar', style: 'cancel' },
              { text: 'Limpiar', onPress: () => { LogService.clear(); refresh(); } },
            ]);
          }}>
            <Icon name="trash-2" size={16} color={C.gray} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Stats */}
      {renderStats()}

      {/* Búsqueda */}
      <View style={styles.searchRow}>
        <Icon name="search" size={14} color={C.gray} />
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar en logs..."
          placeholderTextColor={C.gray}
          value={searchText}
          onChangeText={setSearchText}
        />
        {searchText ? (
          <TouchableOpacity onPress={() => setSearchText('')}>
            <Icon name="x" size={14} color={C.gray} />
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Context filter */}
      {renderCtxFilter()}

      {/* Logs */}
      <FlatList
        data={logs}
        keyExtractor={item => item.id}
        renderItem={renderLog}
        style={styles.list}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Icon name="inbox" size={40} color={C.border} />
            <Text style={styles.emptyTxt}>Sin logs para los filtros actuales</Text>
          </View>
        }
      />

      {/* Acciones rápidas */}
      <View style={styles.actions}>
        <TouchableOpacity style={styles.actionBtn} onPress={handleBackup}>
          <Icon name="save" size={14} color={C.blue} />
          <Text style={[styles.actionTxt, { color: C.blue }]}>Backup</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn} onPress={handleRecover}>
          <Icon name="rotate-ccw" size={14} color={C.primary} />
          <Text style={[styles.actionTxt, { color: C.primary }]}>Restaurar</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.actionBtn, styles.actionDanger]} onPress={handleReset}>
          <Icon name="alert-triangle" size={14} color="#E63946" />
          <Text style={[styles.actionTxt, { color: '#E63946' }]}>Reset DB</Text>
        </TouchableOpacity>
      </View>

      {/* Modal de importación */}
      <Modal
        visible={showImport}
        animationType="slide"
        transparent
        onRequestClose={() => setShowImport(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Importar JSON de Vinted</Text>
              <TouchableOpacity onPress={() => setShowImport(false)}>
                <Icon name="x" size={22} color={C.gray} />
              </TouchableOpacity>
            </View>

            <View style={styles.infoBox}>
              <Icon name="info" size={14} color={C.blue} />
              <Text style={styles.infoTxt}>
                Importación inteligente: preserva categorías, fechas de subida, precios de venta y marcas de lote editados manualmente. Detecta resubidas automáticamente.
              </Text>
            </View>

            <TextInput
              style={styles.jsonInput}
              placeholder="Pega el JSON aquí..."
              placeholderTextColor={C.gray}
              multiline
              value={jsonInput}
              onChangeText={setJsonInput}
              autoCorrect={false}
              autoCapitalize="none"
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.importBtn}
                onPress={handleImport}
                disabled={importing || !jsonInput.trim()}
              >
                <Icon name="download" size={16} color={C.white} />
                <Text style={styles.importBtnTxt}>
                  {importing ? 'Procesando...' : 'IMPORTAR INVENTARIO'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

// ─── Estilos ───────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: C.bg },

  header:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', paddingHorizontal: 20, paddingTop: 60, paddingBottom: 16 },
  headerSub:    { fontSize: 10, fontWeight: '900', color: C.primary, letterSpacing: 2 },
  headerTitle:  { fontSize: 22, fontWeight: '900', color: C.white },
  headerBtns:   { flexDirection: 'row', gap: 10 },
  hBtn:         { width: 38, height: 38, backgroundColor: C.card, borderRadius: 12, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: C.border },

  statsBar:     { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 20, marginBottom: 12 },
  statChip:     { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10, backgroundColor: C.card, borderWidth: 1, borderColor: C.border },
  statChipTxt:  { fontSize: 10, fontWeight: '900' },

  searchRow:    { flexDirection: 'row', alignItems: 'center', marginHorizontal: 20, marginBottom: 10, backgroundColor: C.card, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: C.border, gap: 10 },
  searchInput:  { flex: 1, color: C.white, fontSize: 13 },

  ctxBar:       { paddingHorizontal: 20, marginBottom: 12, maxHeight: 36 },
  ctxChip:      { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, backgroundColor: C.card, borderWidth: 1, borderColor: C.border, marginRight: 8 },
  ctxChipActive:{ backgroundColor: '#1A1A2E', borderColor: C.white },
  ctxChipTxt:   { fontSize: 10, fontWeight: '800', color: C.gray },

  list:         { flex: 1 },
  listContent:  { paddingHorizontal: 12, paddingBottom: 20 },

  logRow:       { backgroundColor: C.card, borderRadius: 14, padding: 14, marginBottom: 6, borderLeftWidth: 3 },
  logHeader:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  logMeta:      { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap', flex: 1 },
  logTime:      { fontSize: 9, color: C.gray, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },
  logCaller:    { fontSize: 9, color: '#555', fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },
  logMsg:       { fontSize: 12, color: C.gray2, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', lineHeight: 17 },

  extraBox:     { marginTop: 10, backgroundColor: '#0A0A18', borderRadius: 10, padding: 12 },
  extraTxt:     { fontSize: 10, color: '#777', fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', lineHeight: 15 },

  empty:        { alignItems: 'center', paddingTop: 60, gap: 12 },
  emptyTxt:     { fontSize: 14, color: C.gray },

  actions:      { flexDirection: 'row', gap: 10, padding: 14, backgroundColor: C.surface, borderTopWidth: 1, borderTopColor: C.border },
  actionBtn:    { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: C.card, paddingVertical: 12, borderRadius: 14, borderWidth: 1, borderColor: C.border },
  actionDanger: { borderColor: '#E6394622' },
  actionTxt:    { fontSize: 11, fontWeight: '800' },

  // Modal importación
  modalOverlay: { flex: 1, backgroundColor: '#00000088', justifyContent: 'flex-end' },
  modalSheet:   { backgroundColor: C.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, maxHeight: '85%' },
  modalHeader:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle:   { fontSize: 18, fontWeight: '900', color: C.white },
  infoBox:      { flexDirection: 'row', gap: 10, backgroundColor: C.blue + '18', borderRadius: 14, padding: 14, marginBottom: 16 },
  infoTxt:      { flex: 1, fontSize: 12, color: C.blue, lineHeight: 18 },
  jsonInput:    { backgroundColor: C.bg, borderRadius: 16, padding: 16, height: 160, textAlignVertical: 'top', color: C.white, fontSize: 11, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', borderWidth: 1, borderColor: C.border },
  modalActions: { marginTop: 16 },
  importBtn:    { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10, backgroundColor: C.primary, padding: 18, borderRadius: 18 },
  importBtnTxt: { color: C.white, fontWeight: '900', fontSize: 15 },
});
