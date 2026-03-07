/**
 * LogsScreen.jsx — Sprint 8 fix
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
  TextInput, Alert, Platform, FlatList,
} from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import LogService, { LOG_CTX } from '../services/LogService';
import { DatabaseService } from '../services/DatabaseService';
import { MMKV } from 'react-native-mmkv';

// Mismo id que usa el código original del proyecto (resellhub_v4.1.mdc → SECURITY_OFFICER)
const backupStorage = new MMKV({ id: 'backup-storage' });

// ─── Paleta ───────────────────────────────────────────────────────────────────
const LEVEL_CONFIG = {
  debug:    { label: 'DEBUG',  color: '#888',    bg: '#88888818' },
  info:     { label: 'INFO',   color: '#4EA8DE', bg: '#4EA8DE18' },
  success:  { label: 'OK',     color: '#00D9A3', bg: '#00D9A318' },
  warn:     { label: 'WARN',   color: '#FFB800', bg: '#FFB80018' },
  warning:  { label: 'WARN',   color: '#FFB800', bg: '#FFB80018' },
  error:    { label: 'ERROR',  color: '#E63946', bg: '#E6394618' },
  critical: { label: 'CRIT',   color: '#FF0000', bg: '#FF000018' },
};

const CTX_COLORS = {
  IMPORT: '#FF6B35', import: '#FF6B35',
  DB:     '#4EA8DE', db:     '#4EA8DE',
  UI:     '#00D9A3', ui:     '#00D9A3',
  NAV:    '#888',    nav:    '#888',
  CAT:    '#FFB800', cat:    '#FFB800',
  NOTIF:  '#6C63FF', notif:  '#6C63FF',
  SYSTEM: '#1A1A2E', system: '#1A1A2E',
};

const C = {
  bg:      '#F8F9FA',
  surface: '#FFFFFF',
  border:  '#EAEDF0',
  primary: '#FF6B35',
  blue:    '#004E89',
  success: '#00D9A3',
  danger:  '#E63946',
  gray:    '#5C6070',
  gray2:   '#A0A5B5',
  surface2:'#F0F2F5',
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
  badge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 },
  txt:   { fontSize: 9, fontWeight: '900', letterSpacing: 0.5 },
});

const CtxBadge = ({ context }) => {
  if (!context) return null;
  const col = CTX_COLORS[context] || '#888';
  return (
    <View style={[cx.badge, { borderColor: col }]}>
      <Text style={[cx.txt, { color: col }]}>{String(context).toUpperCase()}</Text>
    </View>
  );
};
const cx = StyleSheet.create({
  badge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, borderWidth: 1 },
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
    const lvlCfg     = LEVEL_CONFIG[item.level] || LEVEL_CONFIG.info;

    return (
      <TouchableOpacity
        style={[styles.logRow, { borderLeftColor: lvlCfg.color }]}
        onPress={() => setExpandedId(isExpanded ? null : item.id)}
        activeOpacity={0.8}
      >
        <View style={styles.logHeader}>
          <View style={styles.logMeta}>
            <LevelBadge level={item.level}/>
            <CtxBadge context={item.context}/>
            <Text style={styles.logTime}>
              {item.tsDisplay
                ? item.tsDisplay
                : item.timestamp
                  ? new Date(item.timestamp).toLocaleTimeString('es-ES')
                  : ''}
            </Text>
            {item.caller ? <Text style={styles.logCaller}>{item.caller}</Text> : null}
          </View>
          <Icon name={isExpanded ? 'chevron-up' : 'chevron-down'} size={12} color={C.gray2}/>
        </View>
        <Text style={styles.logMsg} numberOfLines={isExpanded ? undefined : 2}>
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
              filterLevel === level && { backgroundColor: cfg.bg + 'CC', borderColor: cfg.color }]}
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
            filterCtx === ctx && { borderColor: CTX_COLORS[ctx] }]}
          onPress={() => setFilterCtx(filterCtx === ctx ? null : ctx)}
        >
          <Text style={[styles.ctxTxt,
            filterCtx === ctx && { color: CTX_COLORS[ctx] }]}>
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
            <Icon name="chevron-left" size={22} color={C.gray}/>
          </TouchableOpacity>
        )}
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Logs del Sistema</Text>
          <Text style={styles.headerSub}>{stats.total || logs.length} entradas</Text>
        </View>
        <TouchableOpacity onPress={refresh} style={styles.refreshBtn}>
          <Icon name="refresh-cw" size={16} color={C.primary}/>
        </TouchableOpacity>
      </View>

      {renderStats()}

      {/* Búsqueda */}
      <View style={styles.searchBar}>
        <Icon name="search" size={14} color={C.gray2}/>
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar logs..."
          placeholderTextColor={C.gray2}
          value={searchText}
          onChangeText={setSearchText}
          autoCorrect={false}
        />
        {searchText ? (
          <TouchableOpacity onPress={() => setSearchText('')}>
            <Icon name="x" size={14} color={C.gray2}/>
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
            <Icon name="inbox" size={40} color={C.border}/>
            <Text style={styles.emptyTxt}>Sin logs para los filtros actuales</Text>
          </View>
        }
      />

      {/* Acciones — sin botón importar (Sprint 8) */}
      <View style={styles.actions}>
        <TouchableOpacity style={styles.actionBtn} onPress={handleBackup}>
          <Icon name="save" size={14} color={C.blue}/>
          <Text style={[styles.actionTxt, { color: C.blue }]}>Backup</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn} onPress={handleRecover}>
          <Icon name="rotate-ccw" size={14} color={C.primary}/>
          <Text style={[styles.actionTxt, { color: C.primary }]}>Restaurar</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.actionBtn, styles.actionDanger]} onPress={handleReset}>
          <Icon name="alert-triangle" size={14} color={C.danger}/>
          <Text style={[styles.actionTxt, { color: C.danger }]}>Reset DB</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Estilos ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root:          { flex: 1, backgroundColor: C.bg },

  header:        { flexDirection: 'row', alignItems: 'center', gap: 8,
                   paddingHorizontal: 16, paddingTop: 52, paddingBottom: 12,
                   backgroundColor: C.surface, borderBottomWidth: 1, borderBottomColor: C.border },
  backBtn:       { padding: 6, marginRight: 2 },
  headerTitle:   { fontSize: 18, fontWeight: '700', color: '#1A1A2E' },
  headerSub:     { fontSize: 12, color: C.gray2, marginTop: 1 },
  refreshBtn:    { padding: 8, borderRadius: 8, backgroundColor: C.surface2 },

  statsBar:      { flexDirection: 'row', flexWrap: 'wrap', gap: 6,
                   paddingHorizontal: 12, paddingVertical: 8,
                   backgroundColor: C.surface, borderBottomWidth: 1, borderBottomColor: C.border },
  statChip:      { flexDirection: 'row', alignItems: 'center', gap: 4,
                   paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10,
                   backgroundColor: C.surface2, borderWidth: 1, borderColor: 'transparent' },
  statCount:     { fontSize: 13, fontWeight: '800' },
  statLabel:     { fontSize: 10, fontWeight: '600' },

  searchBar:     { flexDirection: 'row', alignItems: 'center', gap: 8,
                   marginHorizontal: 12, marginVertical: 8,
                   paddingHorizontal: 12, paddingVertical: 8,
                   backgroundColor: C.surface, borderRadius: 10,
                   borderWidth: 1, borderColor: C.border },
  searchInput:   { flex: 1, fontSize: 13, color: '#1A1A2E', padding: 0 },

  ctxFilterRow:  { flexDirection: 'row', flexWrap: 'wrap', gap: 6,
                   paddingHorizontal: 12, paddingBottom: 8 },
  ctxBtn:        { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6,
                   backgroundColor: C.surface2, borderWidth: 1, borderColor: C.border },
  ctxTxt:        { fontSize: 9, fontWeight: '700', color: C.gray },

  list:          { flex: 1 },
  listContent:   { padding: 12, paddingBottom: 20 },

  logRow:        { backgroundColor: C.surface, borderRadius: 8, padding: 10,
                   marginBottom: 6, borderLeftWidth: 3,
                   borderWidth: 1, borderColor: C.border },
  logHeader:     { flexDirection: 'row', justifyContent: 'space-between',
                   alignItems: 'center', marginBottom: 5 },
  logMeta:       { flexDirection: 'row', alignItems: 'center', gap: 5,
                   flex: 1, flexWrap: 'wrap' },
  logTime:       { fontSize: 10, color: C.gray2 },
  logCaller:     { fontSize: 9, color: C.gray2, fontStyle: 'italic' },
  logMsg:        { fontSize: 12, color: '#1A1A2E', lineHeight: 17 },
  extraBox:      { backgroundColor: C.surface2, borderRadius: 4, padding: 6, marginTop: 5 },
  extraTxt:      { fontSize: 10, color: C.gray,
                   fontFamily: Platform.OS === 'android' ? 'monospace' : 'Courier New' },

  empty:         { alignItems: 'center', paddingTop: 60, gap: 10 },
  emptyTxt:      { fontSize: 14, color: C.gray2 },

  actions:       { flexDirection: 'row', gap: 8, padding: 12,
                   backgroundColor: C.surface,
                   borderTopWidth: 1, borderTopColor: C.border },
  actionBtn:     { flex: 1, flexDirection: 'row', alignItems: 'center',
                   justifyContent: 'center', gap: 5,
                   paddingVertical: 10, borderRadius: 8, backgroundColor: C.surface2 },
  actionDanger:  { backgroundColor: '#FFF0F0' },
  actionTxt:     { fontSize: 12, fontWeight: '700' },
});