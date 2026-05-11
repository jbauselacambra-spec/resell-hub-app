/**
 * LogsScreen.jsx — Sprint 8 fix
 *
 * REFACTORIZADO para usar theme.js (ResellHub Design System v2)
 * 
 * FIXES:
 * ─ handleBackup/handleRecover/handleReset: usan backupStorage (MMKV id:'backup-storage')
 *   igual que el LogsScreen original del proyecto. Eliminados métodos inexistentes
 *   DatabaseService.backupData/recoverData/resetAll que causaban ERROR [ui].
 * ─ Eliminado modal de importación JSON (Sprint 8) — vive en VintedImportScreen.
 * ─ Accesible como Stack.Screen desde App.jsx (botón back en header si navigation disponible).
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  TextInput, Alert, FlatList,
} from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import LogService, { LOG_CTX } from '../services/LogService';
import { DatabaseService } from '../services/DatabaseService';
import { MMKV } from 'react-native-mmkv';

// ── Importar Design System ───────────────────────────────────────────────────
import {
  DS, SPACE, RADIUS, SHADOW, TXT, BTN, BTN_TEXT, CARD,
  LAYOUT, FONT_SIZE, FONT_FAMILY,
} from '../theme';

// Mismo id que usa el código original del proyecto (resellhub_v4.1.mdc → SECURITY_OFFICER)
const backupStorage = new MMKV({ id: 'backup-storage' });

// ─── Configuración de niveles ────────────────────────────────────────────────
const LEVEL_CONFIG = {
  debug:    { label: 'DEBUG',  color: DS.text3,   bg: DS.surface3  },
  info:     { label: 'INFO',   color: DS.blue,    bg: DS.blueLight },
  success:  { label: 'OK',     color: DS.success, bg: DS.successLight },
  warn:     { label: 'WARN',   color: DS.warning, bg: DS.warningLight },
  warning:  { label: 'WARN',   color: DS.warning, bg: DS.warningLight },
  error:    { label: 'ERROR',  color: DS.danger,  bg: DS.dangerLight },
  critical: { label: 'CRIT',   color: DS.danger,  bg: DS.dangerLight },
};

const CTX_COLORS = {
  IMPORT: DS.brand,   import: DS.brand,
  DB:     DS.blue,    db:     DS.blue,
  UI:     DS.success, ui:     DS.success,
  NAV:    DS.text3,   nav:    DS.text3,
  CAT:    DS.warning, cat:    DS.warning,
  NOTIF:  DS.purple,  notif:  DS.purple,
  SYSTEM: DS.text,    system: DS.text,
};

// ─── Badges ───────────────────────────────────────────────────────────────────
const LevelBadge = ({ level }) => {
  const cfg = LEVEL_CONFIG[level] || LEVEL_CONFIG.info;
  return (
    <View style={[lb.badge, { backgroundColor: cfg.bg }]}>
      <Text style={[lb.txt, { color: cfg.color }]}>{cfg.label}</Text>
    </View>
  );
};
const lb = StyleSheet.create({
  badge: { paddingHorizontal: SPACE[2], paddingVertical: 2, borderRadius: RADIUS.sm - 2 },
  txt:   { fontSize: 9, fontWeight: '900', letterSpacing: 0.5 },
});

const CtxBadge = ({ context }) => {
  if (!context) return null;
  const col = CTX_COLORS[context] || DS.text3;
  return (
    <View style={[cx.badge, { borderColor: col }]}>
      <Text style={[cx.txt, { color: col }]}>{String(context).toUpperCase()}</Text>
    </View>
  );
};
const cx = StyleSheet.create({
  badge: { paddingHorizontal: SPACE[1] + 2, paddingVertical: 2, borderRadius: RADIUS.sm - 2, borderWidth: 1 },
  txt:   { fontSize: 9, fontWeight: '800' },
});

// ─── Pantalla ─────────────────────────────────────────────────────────────────
export default function LogsScreen({ navigation }) {
  const [logs,        setLogs]        = useState([]);
  const [stats,       setStats]       = useState({});
  const [filterLevel, setFilterLevel] = useState(null);
  const [filterCtx,   setFilterCtx]   = useState(null);
  const [searchText,  setSearchText]  = useState('');
  const [expandedId,  setExpandedId]  = useState(null);

  const refresh = useCallback(() => {
    try {
      const opts = {};
      if (filterLevel) opts.level   = filterLevel;
      if (filterCtx)   opts.context = filterCtx;
      if (searchText)  opts.search  = searchText;
      // getLogs puede llamarse getAll en algunas versiones — safe fallback
      const fetched = LogService.getLogs
        ? LogService.getLogs(opts)
        : (LogService.getAll?.() || []);
      setLogs(Array.isArray(fetched) ? fetched : []);
      setStats(LogService.getStats?.() || {});
    } catch (e) {
      console.warn('LogsScreen.refresh:', e.message);
    }
  }, [filterLevel, filterCtx, searchText]);

  useEffect(() => { refresh(); }, [refresh]);

  // ── Backup ────────────────────────────────────────────────────────────────
  // Usa backupStorage.set directamente — igual que LogsScreen original del proyecto
  const handleBackup = () => {
    try {
      const data = DatabaseService.getAllProducts();
      backupStorage.set('emergency_backup', JSON.stringify(data));
      LogService.add?.(`💾 Backup manual: ${data.length} productos`, 'success');
      Alert.alert('✅ Backup guardado', `${data.length} productos respaldados.`);
    } catch (e) {
      LogService.add?.('❌ Error en backup: ' + e.message, 'error');
      Alert.alert('Error en backup', e.message);
    }
    refresh();
  };

  // ── Restaurar ─────────────────────────────────────────────────────────────
  // Lee de backupStorage y confirma antes de sobreescribir
  const handleRecover = () => {
    try {
      const raw = backupStorage.getString('emergency_backup');
      if (!raw) {
        Alert.alert('Sin backup', 'No hay respaldo disponible. Haz un Backup primero.');
        return;
      }
      const parsed = JSON.parse(raw);
      Alert.alert(
        'Restaurar backup',
        `¿Restaurar ${parsed.length} productos desde el backup?\nEsto sobrescribirá los datos actuales.`,
        [
          { text: 'Cancelar', style: 'cancel' },
          {
            text: 'Restaurar', style: 'destructive',
            onPress: () => {
              try {
                DatabaseService.saveProducts(parsed);
                LogService.add?.(`♻️ Restaurado: ${parsed.length} productos`, 'success');
                Alert.alert('✅ Restaurado', `${parsed.length} productos recuperados.`);
              } catch (e2) { Alert.alert('Error', e2.message); }
              refresh();
            },
          },
        ],
      );
    } catch (e) {
      Alert.alert('Error leyendo backup', e.message);
    }
  };

  // ── Reset ─────────────────────────────────────────────────────────────────
  // Guarda backup automático y borra via saveProducts([]) — igual que el original
  const handleReset = () => {
    Alert.alert(
      '⚠️ Acción crítica',
      'Se guardará un backup y se borrarán TODOS los datos del inventario.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Resetear', style: 'destructive',
          onPress: () => {
            try {
              const data = DatabaseService.getAllProducts();
              backupStorage.set('emergency_backup', JSON.stringify(data));
              DatabaseService.saveProducts([]);
              LogService.add?.(`🔥 Reset completo. Backup: ${data.length} productos`, 'warn');
              Alert.alert('Hecho', `DB borrada. Backup de ${data.length} items disponible.`);
            } catch (e) {
              LogService.add?.('❌ Error en reset: ' + e.message, 'error');
              Alert.alert('Error', e.message);
            }
            refresh();
          },
        },
      ],
    );
  };

  // ── Renderizado de log ─────────────────────────────────────────────────────
  const renderLog = ({ item }) => {
    const isExpanded = expandedId === item.id;
    const cfg = LEVEL_CONFIG[item.level] || LEVEL_CONFIG.info;

    return (
      <TouchableOpacity
        style={[styles.logRow, { borderLeftColor: cfg.color }]}
        onPress={() => setExpandedId(isExpanded ? null : item.id)}
        activeOpacity={0.7}
      >
        <View style={styles.logHeader}>
          <View style={styles.logMeta}>
            <Text style={styles.logTime}>{item.time}</Text>
            <LevelBadge level={item.level}/>
            <CtxBadge context={item.context}/>
            {item.caller && (
              <Text style={styles.logCaller}>{item.caller}</Text>
            )}
          </View>
        </View>
        <Text style={styles.logMsg}>
          {item.message}
        </Text>
        {isExpanded && (item.extra || item.data) ? (
          <View style={styles.extraBox}>
            <Text style={styles.extraTxt}>
              {item.extra || (typeof item.data === 'string'
                ? item.data
                : JSON.stringify(item.data, null, 2))}
            </Text>
          </View>
        ) : null}
      </TouchableOpacity>
    );
  };

  // ── Stats bar ──────────────────────────────────────────────────────────────
  const renderStats = () => (
    <View style={styles.statsBar}>
      {['error', 'warn', 'success', 'info', 'debug'].map(level => {
        const cfg   = LEVEL_CONFIG[level];
        const count = stats[level] || stats[level === 'warn' ? 'warning' : level] || 0;
        if (!count) return null;
        return (
          <TouchableOpacity
            key={level}
            style={[styles.statChip,
              filterLevel === level && { backgroundColor: cfg.bg, borderColor: cfg.color }]}
            onPress={() => setFilterLevel(filterLevel === level ? null : level)}
          >
            <Text style={[styles.statCount, { color: cfg.color }]}>{count}</Text>
            <Text style={[styles.statLabel, { color: cfg.color }]}>{cfg.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );

  // ── Filtros de contexto ────────────────────────────────────────────────────
  const renderCtxFilter = () => (
    <View style={styles.ctxFilterRow}>
      {['IMPORT', 'DB', 'UI', 'NAV', 'SYSTEM'].map(ctx => (
        <TouchableOpacity
          key={ctx}
          style={[styles.ctxBtn,
            filterCtx === ctx && { borderColor: CTX_COLORS[ctx], backgroundColor: CTX_COLORS[ctx] + '15' }]}
          onPress={() => setFilterCtx(filterCtx === ctx ? null : ctx)}
        >
          <Text style={[styles.ctxTxt,
            filterCtx === ctx && { color: CTX_COLORS[ctx], fontWeight: '800' }]}>
            {ctx}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  return (
    <View style={styles.root}>
      {/* Header */}
      <View style={styles.header}>
        {navigation?.goBack && (
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Icon name="arrow-left" size={20} color={DS.text}/>
          </TouchableOpacity>
        )}
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Logs del Sistema</Text>
          <Text style={styles.headerSub}>{stats.total || logs.length} entradas</Text>
        </View>
        <TouchableOpacity onPress={refresh} style={styles.refreshBtn}>
          <Icon name="refresh-cw" size={16} color={DS.brand}/>
        </TouchableOpacity>
      </View>

      {renderStats()}

      {/* Búsqueda */}
      <View style={styles.searchBar}>
        <Icon name="search" size={14} color={DS.text3}/>
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar logs..."
          placeholderTextColor={DS.text3}
          value={searchText}
          onChangeText={setSearchText}
          autoCorrect={false}
        />
        {searchText ? (
          <TouchableOpacity onPress={() => setSearchText('')}>
            <Icon name="x" size={14} color={DS.text3}/>
          </TouchableOpacity>
        ) : null}
      </View>

      {renderCtxFilter()}

      {/* Lista de logs */}
      <FlatList
        data={logs}
        keyExtractor={item => item.id || String(Date.now() + Math.random())}
        renderItem={renderLog}
        style={styles.list}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Icon name="inbox" size={40} color={DS.border}/>
            <Text style={styles.emptyTxt}>Sin logs para los filtros actuales</Text>
          </View>
        }
      />

      {/* Acciones — sin botón importar (Sprint 8) */}
      <View style={styles.actions}>
        <TouchableOpacity style={styles.actionBtn} onPress={handleBackup}>
          <Icon name="save" size={14} color={DS.blue}/>
          <Text style={[styles.actionTxt, { color: DS.blue }]}>Backup</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn} onPress={handleRecover}>
          <Icon name="rotate-ccw" size={14} color={DS.brand}/>
          <Text style={[styles.actionTxt, { color: DS.brand }]}>Restaurar</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.actionBtn, styles.actionDanger]} onPress={handleReset}>
          <Icon name="alert-triangle" size={14} color={DS.danger}/>
          <Text style={[styles.actionTxt, { color: DS.danger }]}>Reset DB</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Estilos ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root:          { flex: 1, backgroundColor: DS.surface2 },

  header:        { flexDirection: 'row', alignItems: 'center', gap: SPACE[2],
                   paddingHorizontal: LAYOUT.screenPadH, paddingTop: LAYOUT.headerPadT, paddingBottom: SPACE[3],
                   backgroundColor: DS.white, borderBottomWidth: 1, borderBottomColor: DS.border },
  backBtn:       { width: 36, height: 36, borderRadius: RADIUS.lg, backgroundColor: DS.surface3,
                   justifyContent: 'center', alignItems: 'center' },
  headerTitle:   { ...TXT.heading },
  headerSub:     { ...TXT.caption, marginTop: 1 },
  refreshBtn:    { padding: SPACE[2], borderRadius: RADIUS.md, backgroundColor: DS.brandLight },

  statsBar:      { flexDirection: 'row', flexWrap: 'wrap', gap: SPACE[1] + 2,
                   paddingHorizontal: SPACE[3], paddingVertical: SPACE[2],
                   backgroundColor: DS.white, borderBottomWidth: 1, borderBottomColor: DS.border },
  statChip:      { flexDirection: 'row', alignItems: 'center', gap: SPACE[1],
                   paddingHorizontal: SPACE[2], paddingVertical: SPACE[1], borderRadius: RADIUS.full,
                   backgroundColor: DS.surface2, borderWidth: 1, borderColor: 'transparent' },
  statCount:     { fontSize: 13, fontWeight: '800' },
  statLabel:     { fontSize: 10, fontWeight: '600' },

  searchBar:     { flexDirection: 'row', alignItems: 'center', gap: SPACE[2],
                   marginHorizontal: SPACE[3], marginVertical: SPACE[2],
                   paddingHorizontal: SPACE[3], paddingVertical: SPACE[2],
                   backgroundColor: DS.white, borderRadius: RADIUS.md,
                   borderWidth: 1, borderColor: DS.border },
  searchInput:   { flex: 1, fontSize: 13, color: DS.text, padding: 0 },

  ctxFilterRow:  { flexDirection: 'row', flexWrap: 'wrap', gap: SPACE[1] + 2,
                   paddingHorizontal: SPACE[3], paddingBottom: SPACE[2] },
  ctxBtn:        { paddingHorizontal: SPACE[2], paddingVertical: 3, borderRadius: RADIUS.sm - 2,
                   backgroundColor: DS.surface2, borderWidth: 1, borderColor: DS.border },
  ctxTxt:        { fontSize: 9, fontWeight: '700', color: DS.text2 },

  list:          { flex: 1 },
  listContent:   { padding: SPACE[3], paddingBottom: SPACE[5] },

  logRow:        { backgroundColor: DS.white, borderRadius: RADIUS.md, padding: SPACE[2] + 2,
                   marginBottom: SPACE[1] + 2, borderLeftWidth: 3,
                   borderWidth: 1, borderColor: DS.border },
  logHeader:     { flexDirection: 'row', justifyContent: 'space-between',
                   alignItems: 'center', marginBottom: SPACE[1] + 1 },
  logMeta:       { flexDirection: 'row', alignItems: 'center', gap: SPACE[1] + 1,
                   flex: 1, flexWrap: 'wrap' },
  logTime:       { fontSize: 10, color: DS.text3, fontFamily: FONT_FAMILY.mono },
  logCaller:     { fontSize: 9, color: DS.text3, fontStyle: 'italic' },
  logMsg:        { fontSize: 12, color: DS.text, lineHeight: 17 },
  extraBox:      { backgroundColor: DS.surface2, borderRadius: RADIUS.sm - 2, padding: SPACE[1] + 2, marginTop: SPACE[1] + 1 },
  extraTxt:      { fontSize: 10, color: DS.text2, fontFamily: FONT_FAMILY.mono },

  empty:         { alignItems: 'center', paddingTop: 60, gap: SPACE[2] + 2 },
  emptyTxt:      { ...TXT.body, color: DS.text3 },

  actions:       { flexDirection: 'row', gap: SPACE[2], padding: SPACE[3],
                   backgroundColor: DS.white,
                   borderTopWidth: 1, borderTopColor: DS.border },
  actionBtn:     { flex: 1, flexDirection: 'row', alignItems: 'center',
                   justifyContent: 'center', gap: SPACE[1] + 1,
                   paddingVertical: SPACE[2] + 2, borderRadius: RADIUS.md, backgroundColor: DS.surface2 },
  actionDanger:  { backgroundColor: DS.dangerLight },
  actionTxt:     { fontSize: 12, fontWeight: '700' },
});