/**
 * DebugScreen.jsx — Logs del Sistema
 *
 * REFACTORIZADO para usar theme.js (ResellHub Design System v2)
 * - Visualización de logs del sistema
 * - Filtros por tipo (info, success, error)
 * - Botón para limpiar logs
 */

import React, { useState, useEffect } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, ScrollView,
} from 'react-native';
import LogService from '../services/LogService';
import { Feather as Icon } from '@expo/vector-icons';

// ── Importar Design System ───────────────────────────────────────────────────
import {
  DS, SPACE, RADIUS, SHADOW, TXT, BTN, BTN_TEXT,
  LAYOUT, FONT_SIZE, FONT_FAMILY,
} from '../theme';

const DebugScreen = () => {
  const [logs, setLogs] = useState([]);
  const [filter, setFilter] = useState('all'); // 'all' | 'info' | 'success' | 'error'

  useEffect(() => {
    setLogs([...LogService.logs]);
    return LogService.subscribe(newLogs => setLogs([...newLogs]));
  }, []);

  // Filtrar logs según el tipo seleccionado
  const filteredLogs = filter === 'all'
    ? logs
    : logs.filter(log => log.type === filter);

  // Contadores por tipo
  const counts = {
    all: logs.length,
    info: logs.filter(l => l.type === 'info').length,
    success: logs.filter(l => l.type === 'success').length,
    error: logs.filter(l => l.type === 'error').length,
  };

  const renderItem = ({ item }) => {
    // Color según tipo
    const typeColor = item.type === 'success'
      ? DS.success
      : item.type === 'error'
      ? DS.danger
      : DS.blue;

    const typeBg = item.type === 'success'
      ? DS.successLight
      : item.type === 'error'
      ? DS.dangerLight
      : DS.blueLight;

    const typeIcon = item.type === 'success'
      ? 'check-circle'
      : item.type === 'error'
      ? 'alert-circle'
      : 'info';

    return (
      <View style={[styles.logEntry, { borderLeftColor: typeColor }]}>
        <View style={styles.logHeader}>
          <View style={[styles.typeIcon, { backgroundColor: typeBg }]}>
            <Icon name={typeIcon} size={12} color={typeColor} />
          </View>
          <Text style={styles.logTime}>{item.time}</Text>
        </View>
        <Text style={[styles.logText, { color: typeColor }]}>{item.text}</Text>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* HEADER */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Logs del Sistema</Text>
          <Text style={styles.headerSub}>
            {filteredLogs.length} registro{filteredLogs.length !== 1 ? 's' : ''}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.clearBtn}
          onPress={() => {
            LogService.clear();
            setLogs([]);
          }}
        >
          <Icon name="trash-2" size={16} color={DS.danger} />
          <Text style={styles.clearBtnTxt}>Limpiar</Text>
        </TouchableOpacity>
      </View>

      {/* FILTERS */}
      <View style={styles.filterBar}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: SPACE[2] }}
        >
          {[
            { id: 'all', label: 'Todos', icon: 'list', color: DS.text },
            { id: 'info', label: 'Info', icon: 'info', color: DS.blue },
            { id: 'success', label: 'Success', icon: 'check-circle', color: DS.success },
            { id: 'error', label: 'Error', icon: 'alert-circle', color: DS.danger },
          ].map(f => (
            <TouchableOpacity
              key={f.id}
              style={[
                styles.filterChip,
                filter === f.id && {
                  backgroundColor: f.color,
                  borderColor: f.color,
                },
              ]}
              onPress={() => setFilter(f.id)}
            >
              <Icon
                name={f.icon}
                size={12}
                color={filter === f.id ? '#FFF' : f.color}
              />
              <Text
                style={[
                  styles.filterChipTxt,
                  filter === f.id && { color: '#FFF' },
                  filter !== f.id && { color: f.color },
                ]}
              >
                {f.label}
              </Text>
              {counts[f.id] > 0 && (
                <View
                  style={[
                    styles.filterBadge,
                    filter === f.id
                      ? { backgroundColor: '#FFF' }
                      : { backgroundColor: f.color + '20' },
                  ]}
                >
                  <Text
                    style={[
                      styles.filterBadgeTxt,
                      filter === f.id
                        ? { color: f.color }
                        : { color: f.color },
                    ]}
                  >
                    {counts[f.id]}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* LIST */}
      <FlatList
        data={filteredLogs}
        renderItem={renderItem}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Icon name="inbox" size={40} color={DS.border} />
            <Text style={styles.emptyText}>No hay logs registrados</Text>
            <Text style={styles.emptySub}>
              Los eventos del sistema aparecerán aquí
            </Text>
          </View>
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: DS.surface2 },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: LAYOUT.screenPadH,
    paddingTop: LAYOUT.headerPadT,
    paddingBottom: SPACE[3],
    backgroundColor: DS.white,
    borderBottomWidth: 1,
    borderBottomColor: DS.border,
  },
  headerTitle: { ...TXT.heading, fontSize: 22 },
  headerSub: { ...TXT.caption, marginTop: 2 },
  clearBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE[1] + 1,
    backgroundColor: DS.dangerLight,
    paddingHorizontal: SPACE[3],
    paddingVertical: SPACE[2],
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: DS.danger + '40',
  },
  clearBtnTxt: { fontSize: 12, fontWeight: '700', color: DS.danger },

  // Filter bar
  filterBar: {
    paddingHorizontal: LAYOUT.screenPadH,
    paddingVertical: SPACE[3],
    backgroundColor: DS.white,
    borderBottomWidth: 1,
    borderBottomColor: DS.border,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE[1] + 1,
    paddingHorizontal: SPACE[2] + 2,
    paddingVertical: SPACE[2] - 1,
    borderRadius: RADIUS.full,
    backgroundColor: DS.white,
    borderWidth: 1,
    borderColor: DS.border,
  },
  filterChipTxt: { fontSize: 12, fontWeight: '700' },
  filterBadge: {
    paddingHorizontal: SPACE[1] + 1,
    paddingVertical: 1,
    borderRadius: RADIUS.full,
    minWidth: 18,
    alignItems: 'center',
  },
  filterBadgeTxt: { fontSize: 9, fontWeight: '900' },

  // List
  list: { padding: SPACE[3], gap: SPACE[2] },
  logEntry: {
    backgroundColor: DS.white,
    borderRadius: RADIUS.md,
    padding: SPACE[3],
    borderLeftWidth: 3,
    ...SHADOW.sm,
  },
  logHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE[2],
    marginBottom: SPACE[1] + 1,
  },
  typeIcon: {
    width: 20,
    height: 20,
    borderRadius: RADIUS.sm - 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logTime: {
    fontSize: 10,
    fontWeight: '700',
    color: DS.text3,
    fontFamily: FONT_FAMILY.mono,
    letterSpacing: 0.3,
  },
  logText: {
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '500',
    color: DS.text,
  },

  // Empty state
  empty: {
    alignItems: 'center',
    paddingTop: 80,
    paddingHorizontal: 40,
  },
  emptyText: {
    ...TXT.heading,
    color: DS.text2,
    marginTop: SPACE[3],
    textAlign: 'center',
  },
  emptySub: {
    ...TXT.caption,
    color: DS.text3,
    textAlign: 'center',
    marginTop: SPACE[1],
  },
});

export default DebugScreen;