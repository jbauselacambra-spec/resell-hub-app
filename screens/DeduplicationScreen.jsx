/**
 * DeduplicationScreen.jsx — Sprint 14
 *
 * REFACTORIZADO para usar theme.js (ResellHub Design System v2)
 * 
 * [DEBUGGER] Pantalla para detectar y eliminar duplicados del inventario.
 * Accesible desde Settings → BBDD → "Buscar duplicados".
 *
 * Detecta:
 *  - Productos con mismo título normalizado (activos o vendidos)
 *  - repostOf apuntando a un producto que no existe en el inventario (corrupto)
 *
 * Reglas de deduplicación:
 *  - En un grupo de duplicados, se conserva el producto con firstUploadDate más antigua.
 *  - Si hay un vendido y un activo con mismo título, se conserva el vendido.
 *  - El usuario puede cambiar manualmente qué conservar antes de confirmar.
 *
 * [QA_ENGINEER] Los 7 Campos Sagrados: nunca se tocan en el producto conservado.
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Alert, ActivityIndicator, ScrollView,
} from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import { DatabaseService } from '../services/DatabaseService';
import LogService, { LOG_CTX } from '../services/LogService';

// ── Importar Design System ───────────────────────────────────────────────────
import {
  DS, SPACE, RADIUS, SHADOW, TXT, BTN, BTN_TEXT, CARD,
  LAYOUT, FONT_SIZE, FONT_FAMILY,
} from '../theme';

// ─── Normalización de título ──────────────────────────────────────────────────
function normTitle(s) {
  return (s || '')
    .toLowerCase()
    .replace(/[^\wáéíóúüñ\s]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// ─── Detectar grupos de duplicados ───────────────────────────────────────────
function findDuplicateGroups(products) {
  const SKIP_TITLES = new Set(['producto sin título', 'sin título', '']);
  const groups = {};

  products.forEach(p => {
    const key = normTitle(p.title);
    if (SKIP_TITLES.has(key)) return;
    if (!groups[key]) groups[key] = [];
    groups[key].push(p);
  });

  return Object.values(groups)
    .filter(g => g.length > 1)
    .map(group => {
      // Determinar cuál conservar:
      // 1. Preferir vendido sobre activo
      // 2. Entre iguales, preferir firstUploadDate más antigua
      const sorted = [...group].sort((a, b) => {
        const aS = a.status === 'sold' ? 0 : 1;
        const bS = b.status === 'sold' ? 0 : 1;
        if (aS !== bS) return aS - bS;
        const aD = a.firstUploadDate || a.createdAt || '';
        const bD = b.firstUploadDate || b.createdAt || '';
        return aD.localeCompare(bD);
      });
      return {
        title:      sorted[0].title,
        keep:       sorted[0].id,
        duplicates: sorted.map(p => p.id),
        products:   sorted,
      };
    });
}

// ─── Detectar repostOf corruptos ─────────────────────────────────────────────
function findCorruptRepostOf(products) {
  const allIds = new Set(products.map(p => String(p.id)));
  return products.filter(p => {
    const ref = p.repostOf;
    return ref && !allIds.has(String(ref));
  });
}

// ─── Componente de grupo duplicado ───────────────────────────────────────────
function DuplicateGroup({ group, onKeepChange, onRemove }) {
  const [keepId, setKeepId] = useState(group.keep);

  const handleKeepChange = (id) => {
    setKeepId(id);
    onKeepChange(group.duplicates, id);
  };

  const toRemove = group.products.filter(p => p.id !== keepId);

  return (
    <View style={styles.groupCard}>
      <Text style={styles.groupTitle} numberOfLines={2}>{group.title}</Text>
      <Text style={styles.groupSub}>{group.products.length} entradas — conservar 1</Text>

      {group.products.map(p => {
        const isKeep   = p.id === keepId;
        const dateStr  = p.firstUploadDate
          ? new Date(p.firstUploadDate).toLocaleDateString('es-ES')
          : '—';
        const soldStr  = p.soldDateReal
          ? new Date(p.soldDateReal).toLocaleDateString('es-ES')
          : null;
        const price    = p.soldPriceReal || p.price || 0;

        return (
          <TouchableOpacity
            key={p.id}
            style={[styles.productRow, isKeep && styles.productRowKeep]}
            onPress={() => handleKeepChange(p.id)}
            activeOpacity={0.7}
          >
            <View style={[styles.radioOuter, isKeep && styles.radioOuterOn]}>
              {isKeep && <View style={styles.radioInner}/>}
            </View>
            <View style={{ flex: 1 }}>
              <View style={styles.productRowTop}>
                <View style={[styles.statusChip, {
                  backgroundColor: p.status === 'sold' ? DS.successLight : DS.blueLight,
                }]}>
                  <Text style={[styles.statusChipTxt, {
                    color: p.status === 'sold' ? DS.success : DS.blue,
                  }]}>
                    {p.status === 'sold' ? 'VENDIDO' : 'ACTIVO'}
                  </Text>
                </View>
                <Text style={[styles.priceText, { fontFamily: FONT_FAMILY.mono }]}>
                  {price}€
                </Text>
              </View>
              <Text style={styles.productRowId} numberOfLines={1}>
                ID: {p.id}
              </Text>
              <Text style={styles.productRowDate}>
                Subida: {dateStr}{soldStr ? ` · Vendido: ${soldStr}` : ''}
              </Text>
            </View>
            {isKeep && (
              <View style={styles.keepBadge}>
                <Text style={styles.keepBadgeTxt}>CONSERVAR</Text>
              </View>
            )}
          </TouchableOpacity>
        );
      })}

      <TouchableOpacity
        style={styles.removeGroupBtn}
        onPress={() => onRemove(group.duplicates, keepId)}
        activeOpacity={0.8}
      >
        <Icon name="trash-2" size={14} color={DS.danger}/>
        <Text style={styles.removeGroupBtnTxt}>
          Eliminar {toRemove.length} duplicado{toRemove.length > 1 ? 's' : ''}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Pantalla principal ───────────────────────────────────────────────────────
export default function DeduplicationScreen({ navigation }) {
  const [loading,        setLoading]        = useState(true);
  const [duplicateGroups,setDuplicateGroups]= useState([]);
  const [corruptRepostOf,setCorruptRepostOf]= useState([]);
  const [keepMap,        setKeepMap]        = useState({});  // groupKey → keepId
  const [processing,     setProcessing]     = useState(false);

  const loadData = () => {
    setLoading(true);
    try {
      const all    = DatabaseService.getAllProducts();
      const groups = findDuplicateGroups(all);
      const corrupt= findCorruptRepostOf(all);
      setDuplicateGroups(groups);
      setCorruptRepostOf(corrupt);

      // Inicializar keepMap con la selección por defecto
      const initialKeep = {};
      groups.forEach(g => { initialKeep[g.duplicates.join('|')] = g.keep; });
      setKeepMap(initialKeep);
      LogService.debug(`Deduplication: ${groups.length} grupos, ${corrupt.length} corruptos`, LOG_CTX.UI);
    } catch (e) {
      LogService.error('Deduplication.loadData', LOG_CTX.DB, e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleKeepChange = (duplicateIds, keepId) => {
    const key = duplicateIds.join('|');
    setKeepMap(prev => ({ ...prev, [key]: keepId }));
  };

  const handleRemoveGroup = (duplicateIds, keepId) => {
    const toDelete = duplicateIds.filter(id => id !== keepId);
    Alert.alert(
      'Eliminar duplicados',
      `¿Eliminar ${toDelete.length} producto${toDelete.length > 1 ? 's' : ''} duplicado${toDelete.length > 1 ? 's' : ''}?\n\nSe conservará el producto con ID ${keepId}.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: () => {
            setProcessing(true);
            try {
              toDelete.forEach(id => DatabaseService.deleteProduct(id));
              LogService.add(`🗑️ Dedup: eliminados ${toDelete.length} duplicados`, 'success');
              loadData();
            } catch (e) {
              LogService.error('Deduplication.handleRemoveGroup', LOG_CTX.DB, e.message);
              Alert.alert('Error', 'No se pudieron eliminar los duplicados.');
            } finally {
              setProcessing(false);
            }
          },
        },
      ],
    );
  };

  const handleRemoveAllDuplicates = () => {
    let totalToRemove = 0;
    duplicateGroups.forEach(g => {
      const keep = keepMap[g.duplicates.join('|')] || g.keep;
      totalToRemove += g.duplicates.filter(id => id !== keep).length;
    });

    Alert.alert(
      'Eliminar todos los duplicados',
      `Se eliminarán ${totalToRemove} productos duplicados.\n\n¿Continuar?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: () => {
            setProcessing(true);
            try {
              duplicateGroups.forEach(g => {
                const keep = keepMap[g.duplicates.join('|')] || g.keep;
                const toDelete = g.duplicates.filter(id => id !== keep);
                toDelete.forEach(id => DatabaseService.deleteProduct(id));
              });
              LogService.add(`🗑️ Dedup: eliminados ${totalToRemove} duplicados masivamente`, 'success');
              loadData();
            } catch (e) {
              LogService.error('Deduplication.handleRemoveAllDuplicates', LOG_CTX.DB, e.message);
              Alert.alert('Error', 'No se pudieron eliminar todos los duplicados.');
            } finally {
              setProcessing(false);
            }
          },
        },
      ],
    );
  };

  const handleFixCorruptRepostOf = () => {
    Alert.alert(
      'Limpiar repostOf corruptos',
      `Se limpiará el campo repostOf de ${corruptRepostOf.length} productos.\n\n¿Continuar?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Limpiar',
          onPress: () => {
            setProcessing(true);
            try {
              corruptRepostOf.forEach(p => {
                DatabaseService.updateProduct(p.id, { repostOf: null });
              });
              LogService.add(`🔗 Dedup: limpiados ${corruptRepostOf.length} repostOf corruptos`, 'success');
              loadData();
            } catch (e) {
              LogService.error('Deduplication.handleFixCorruptRepostOf', LOG_CTX.DB, e.message);
              Alert.alert('Error', 'No se pudieron limpiar los enlaces corruptos.');
            } finally {
              setProcessing(false);
            }
          },
        },
      ],
    );
  };

  const totalDuplicates = useMemo(() => {
    return duplicateGroups.reduce((acc, g) => {
      const keep = keepMap[g.duplicates.join('|')] || g.keep;
      return acc + g.duplicates.filter(id => id !== keep).length;
    }, 0);
  }, [duplicateGroups, keepMap]);

  if (loading) {
    return (
      <View style={styles.root}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Icon name="arrow-left" size={18} color={DS.text}/>
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>Deduplicación</Text>
            <Text style={styles.headerSub}>Limpieza de inventario</Text>
          </View>
        </View>
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={DS.brand}/>
          <Text style={styles.loadingTxt}>Analizando inventario...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Icon name="arrow-left" size={18} color={DS.text}/>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Deduplicación</Text>
          <Text style={styles.headerSub}>Limpieza de inventario</Text>
        </View>
      </View>

      {/* SUMMARY BAR */}
      <View style={styles.summaryBar}>
        <View style={[styles.summaryChip, {
          backgroundColor: totalDuplicates > 0 ? DS.dangerLight : DS.successLight,
        }]}>
          <Icon
            name={totalDuplicates > 0 ? 'copy' : 'check-circle'}
            size={13}
            color={totalDuplicates > 0 ? DS.danger : DS.success}
          />
          <Text style={[styles.summaryChipTxt, {
            color: totalDuplicates > 0 ? DS.danger : DS.success,
          }]}>
            {totalDuplicates > 0
              ? `${totalDuplicates} duplicados en ${duplicateGroups.length} grupos`
              : 'Sin duplicados de título'}
          </Text>
        </View>
        {corruptRepostOf.length > 0 && (
          <View style={[styles.summaryChip, { backgroundColor: DS.warningLight }]}>
            <Icon name="link" size={13} color={DS.warning}/>
            <Text style={[styles.summaryChipTxt, { color: DS.warning }]}>
              {corruptRepostOf.length} repostOf corruptos
            </Text>
          </View>
        )}
      </View>

      {processing && (
        <View style={styles.processingBar}>
          <ActivityIndicator color="#FFF" size="small"/>
          <Text style={styles.processingTxt}>Procesando...</Text>
        </View>
      )}

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>

        {/* Botones de acción masiva */}
        {(totalDuplicates > 0 || corruptRepostOf.length > 0) && (
          <View style={styles.actionsRow}>
            {totalDuplicates > 0 && (
              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: DS.danger }]}
                onPress={handleRemoveAllDuplicates}
                activeOpacity={0.8}
              >
                <Icon name="trash-2" size={15} color="#FFF"/>
                <Text style={styles.actionBtnTxt}>
                  Eliminar todos ({totalDuplicates})
                </Text>
              </TouchableOpacity>
            )}
            {corruptRepostOf.length > 0 && (
              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: DS.warning }]}
                onPress={handleFixCorruptRepostOf}
                activeOpacity={0.8}
              >
                <Icon name="tool" size={15} color="#FFF"/>
                <Text style={styles.actionBtnTxt}>
                  Limpiar repostOf ({corruptRepostOf.length})
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Estado limpio */}
        {totalDuplicates === 0 && corruptRepostOf.length === 0 && (
          <View style={styles.emptyBox}>
            <Icon name="check-circle" size={48} color={DS.success}/>
            <Text style={styles.emptyTitle}>¡Inventario limpio!</Text>
            <Text style={styles.emptySub}>
              No se detectaron duplicados ni enlaces corruptos.
            </Text>
          </View>
        )}

        {/* repostOf corruptos */}
        {corruptRepostOf.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>🔗 REPOSTOF CORRUPTOS</Text>
            <Text style={styles.sectionDesc}>
              Estos productos tienen un enlace "resubida de" apuntando a un producto
              que ya no existe en el inventario. El enlace no afecta a las ventas,
              pero ensucia las estadísticas de resubidas.
            </Text>
            {corruptRepostOf.map(p => (
              <View key={p.id} style={styles.corruptCard}>
                <Icon name="alert-triangle" size={14} color={DS.warning}/>
                <View style={{ flex: 1 }}>
                  <Text style={styles.corruptTitle} numberOfLines={1}>{p.title}</Text>
                  <Text style={styles.corruptSub}>
                    repostOf: {p.repostOf} (no existe)
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Grupos duplicados */}
        {duplicateGroups.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>📋 GRUPOS DUPLICADOS</Text>
            <Text style={styles.sectionDesc}>
              Productos con el mismo título. Selecciona cuál conservar en cada grupo.
              Por defecto se conserva el más antiguo o el vendido.
            </Text>
            {duplicateGroups.map(group => (
              <DuplicateGroup
                key={group.duplicates.join('|')}
                group={group}
                onKeepChange={handleKeepChange}
                onRemove={handleRemoveGroup}
              />
            ))}
          </View>
        )}

        <View style={{ height: 40 }}/>
      </ScrollView>
    </View>
  );
}

// ─── Estilos ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root:           { flex: 1, backgroundColor: DS.surface2 },
  loadingWrap:    { flex: 1, justifyContent: 'center', alignItems: 'center', gap: SPACE[3] },
  loadingTxt:     { ...TXT.body, color: DS.text2 },

  header:         { flexDirection: 'row', alignItems: 'center', gap: SPACE[2] + 2,
                    paddingHorizontal: LAYOUT.screenPadH, paddingTop: LAYOUT.headerPadT, paddingBottom: SPACE[3] + 2,
                    backgroundColor: DS.white, borderBottomWidth: 1, borderBottomColor: DS.border },
  backBtn:        { width: 40, height: 40, borderRadius: RADIUS.full,
                    backgroundColor: DS.surface3, justifyContent: 'center', alignItems: 'center' },
  headerTitle:    { ...TXT.heading },
  headerSub:      { ...TXT.caption, marginTop: 1 },

  summaryBar:     { flexDirection: 'row', gap: SPACE[2], padding: SPACE[3],
                    backgroundColor: DS.white, borderBottomWidth: 1, borderBottomColor: DS.border,
                    flexWrap: 'wrap' },
  summaryChip:    { flexDirection: 'row', alignItems: 'center', gap: SPACE[1] + 2,
                    paddingHorizontal: SPACE[2] + 2, paddingVertical: SPACE[1] + 2, borderRadius: RADIUS.full },
  summaryChipTxt: { fontSize: 12, fontWeight: '700' },

  processingBar:  { flexDirection: 'row', alignItems: 'center', gap: SPACE[2],
                    backgroundColor: DS.blue, padding: SPACE[2] + 2, justifyContent: 'center' },
  processingTxt:  { color: '#FFF', fontSize: 13, fontWeight: '700' },

  scroll:         { flex: 1 },
  scrollContent:  { padding: LAYOUT.screenPadH },

  actionsRow:     { flexDirection: 'row', gap: SPACE[2], marginBottom: SPACE[4] },
  actionBtn:      { flex: 1, flexDirection: 'row', alignItems: 'center',
                    justifyContent: 'center', gap: SPACE[1] + 2, padding: SPACE[3], borderRadius: RADIUS.lg },
  actionBtnTxt:   { color: '#FFF', fontWeight: '800', fontSize: 12 },

  emptyBox:       { alignItems: 'center', paddingVertical: 60, gap: SPACE[2] + 2 },
  emptyTitle:     { ...TXT.heading, color: DS.text },
  emptySub:       { ...TXT.caption, color: DS.text2, textAlign: 'center' },

  section:        { marginBottom: SPACE[5] },
  sectionTitle:   { ...TXT.label, marginBottom: SPACE[1] + 2 },
  sectionDesc:    { ...TXT.caption, lineHeight: 17, marginBottom: SPACE[3] },

  groupCard:      { ...CARD.default, marginBottom: SPACE[3], ...SHADOW.sm },
  groupTitle:     { ...TXT.title, marginBottom: 2 },
  groupSub:       { ...TXT.caption, color: DS.text3, marginBottom: SPACE[2] + 2 },

  productRow:     { flexDirection: 'row', alignItems: 'center', gap: SPACE[2] + 2,
                    paddingVertical: SPACE[2] + 2, paddingHorizontal: SPACE[2],
                    borderRadius: RADIUS.md, backgroundColor: DS.surface2, marginBottom: SPACE[1] + 2 },
  productRowKeep: { backgroundColor: DS.blueLight, borderWidth: 1.5, borderColor: DS.blue + '50' },
  radioOuter:     { width: 20, height: 20, borderRadius: 10, borderWidth: 2,
                    borderColor: DS.text3, justifyContent: 'center', alignItems: 'center' },
  radioOuterOn:   { borderColor: DS.blue },
  radioInner:     { width: 10, height: 10, borderRadius: 5, backgroundColor: DS.blue },
  productRowTop:  { flexDirection: 'row', alignItems: 'center', gap: SPACE[1] + 2, marginBottom: 3 },
  statusChip:     { paddingHorizontal: SPACE[1] + 2, paddingVertical: 2, borderRadius: RADIUS.sm - 2 },
  statusChipTxt:  { fontSize: 9, fontWeight: '900' },
  priceText:      { fontSize: 13, fontWeight: '900', color: DS.text },
  productRowId:   { fontSize: 10, color: DS.text3 },
  productRowDate: { fontSize: 10, color: DS.text2, marginTop: 1 },
  keepBadge:      { backgroundColor: DS.blue, paddingHorizontal: SPACE[1] + 2, paddingVertical: 3,
                    borderRadius: RADIUS.sm },
  keepBadgeTxt:   { fontSize: 8, fontWeight: '900', color: '#FFF' },

  removeGroupBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
                    gap: SPACE[1] + 2, marginTop: SPACE[2] + 2, padding: SPACE[2] + 2, borderRadius: RADIUS.md,
                    backgroundColor: DS.dangerLight, borderWidth: 1, borderColor: DS.danger + '30' },
  removeGroupBtnTxt: { fontSize: 13, fontWeight: '700', color: DS.danger },

  corruptCard:    { flexDirection: 'row', alignItems: 'center', gap: SPACE[2] + 2,
                    backgroundColor: DS.warningLight, borderRadius: RADIUS.md, padding: SPACE[3],
                    marginBottom: SPACE[1] + 2 },
  corruptTitle:   { fontSize: 13, fontWeight: '700', color: DS.text },
  corruptSub:     { fontSize: 10, color: DS.text2, marginTop: 2 },
});