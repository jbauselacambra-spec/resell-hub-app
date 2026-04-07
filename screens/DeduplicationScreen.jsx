/**
 * DeduplicationScreen.jsx — Sprint 14
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
  Alert, ActivityIndicator, ScrollView, Platform,
} from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import { DatabaseService } from '../services/DatabaseService';
import LogService, { LOG_CTX } from '../services/LogService';

const DS = {
  bg:       '#F8F9FA', white:    '#FFFFFF', surface2: '#F0F2F5',
  border:   '#EAEDF0', primary:  '#FF6B35', primaryBg:'#FFF2EE',
  success:  '#00D9A3', successBg:'#E8FBF6', danger:   '#E63946',
  dangerBg: '#FFEBEC', blue:     '#004E89', blueBg:   '#EAF2FB',
  warning:  '#FFB800', warningBg:'#FFF8E0',
  text:     '#1A1A2E', textMed:  '#5C6070', textLow:  '#A0A5B5',
  mono:     Platform.OS === 'android' ? 'monospace' : 'Courier New',
};

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
                  backgroundColor: p.status === 'sold' ? DS.successBg : DS.blueBg,
                }]}>
                  <Text style={[styles.statusChipTxt, {
                    color: p.status === 'sold' ? DS.success : DS.blue,
                  }]}>
                    {p.status === 'sold' ? 'VENDIDO' : 'ACTIVO'}
                  </Text>
                </View>
                <Text style={[styles.priceText, { fontFamily: DS.mono }]}>
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
    } catch (e) {
      LogService.error('DeduplicationScreen.loadData', LOG_CTX.DB, e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const totalDuplicates = duplicateGroups.reduce(
    (sum, g) => sum + g.products.length - 1, 0
  );

  const handleKeepChange = (dupIds, newKeepId) => {
    const key = dupIds.join('|');
    setKeepMap(prev => ({ ...prev, [key]: newKeepId }));
  };

  const handleRemoveGroup = (dupIds, keepId) => {
    const removeIds = dupIds.filter(id => id !== keepId);
    Alert.alert(
      '¿Eliminar duplicados?',
      `Se eliminarán ${removeIds.length} producto${removeIds.length > 1 ? 's' : ''} y se conservará 1.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: () => {
            setProcessing(true);
            try {
              removeIds.forEach(id => DatabaseService.deleteProduct(id));
              LogService.add(
                `🗑️ Dedup: eliminados ${removeIds.length} duplicados, conservado ${keepId}`,
                'success',
              );
              loadData();
            } catch (e) {
              Alert.alert('Error', e.message);
            } finally {
              setProcessing(false);
            }
          },
        },
      ],
    );
  };

  const handleRemoveAllDuplicates = () => {
    if (duplicateGroups.length === 0) return;
    const allToRemove = [];
    duplicateGroups.forEach(g => {
      const key    = g.duplicates.join('|');
      const keepId = keepMap[key] || g.keep;
      g.duplicates.filter(id => id !== keepId).forEach(id => allToRemove.push(id));
    });

    Alert.alert(
      '¿Eliminar TODOS los duplicados?',
      `Se eliminarán ${allToRemove.length} productos duplicados de toda la base de datos.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: `Eliminar ${allToRemove.length}`,
          style: 'destructive',
          onPress: () => {
            setProcessing(true);
            try {
              allToRemove.forEach(id => DatabaseService.deleteProduct(id));
              LogService.add(
                `🗑️ Dedup masiva: ${allToRemove.length} duplicados eliminados`,
                'success',
              );
              loadData();
            } catch (e) {
              Alert.alert('Error', e.message);
            } finally {
              setProcessing(false);
            }
          },
        },
      ],
    );
  };

  const handleFixCorruptRepostOf = () => {
    if (corruptRepostOf.length === 0) return;
    Alert.alert(
      'Limpiar repostOf corruptos',
      `${corruptRepostOf.length} productos apuntan a productos que ya no existen. ¿Limpiar el enlace?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Limpiar',
          onPress: () => {
            setProcessing(true);
            try {
              const all = DatabaseService.getAllProducts();
              const allIds = new Set(all.map(p => String(p.id)));
              let fixed = 0;
              const updated = all.map(p => {
                if (p.repostOf && !allIds.has(String(p.repostOf))) {
                  const { repostOf, repostedAt, ...rest } = p;
                  fixed++;
                  return rest;
                }
                return p;
              });
              DatabaseService.saveAllProducts(updated);
              LogService.add(
                `✅ Limpiados ${fixed} repostOf corruptos`,
                'success',
              );
              loadData();
            } catch (e) {
              Alert.alert('Error', e.message);
            } finally {
              setProcessing(false);
            }
          },
        },
      ],
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator color={DS.primary} size="large"/>
        <Text style={styles.loadingTxt}>Analizando inventario...</Text>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Icon name="arrow-left" size={20} color={DS.text}/>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Deduplicar inventario</Text>
          <Text style={styles.headerSub}>Detecta y elimina productos repetidos</Text>
        </View>
      </View>

      {/* Resumen */}
      <View style={styles.summaryBar}>
        <View style={[styles.summaryChip, {
          backgroundColor: totalDuplicates > 0 ? DS.dangerBg : DS.successBg,
        }]}>
          <Icon
            name={totalDuplicates > 0 ? 'alert-circle' : 'check-circle'}
            size={14}
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
          <View style={[styles.summaryChip, { backgroundColor: DS.warningBg }]}>
            <Icon name="link" size={13} color={DS.warning}/>
            <Text style={[styles.summaryChipTxt, { color: DS.warning }]}>
              {corruptRepostOf.length} repostOf corruptos
            </Text>
          </View>
        )}
      </View>

      {processing && (
        <View style={styles.processingBar}>
          <ActivityIndicator color={DS.white} size="small"/>
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
  root:           { flex: 1, backgroundColor: DS.bg },
  loadingWrap:    { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  loadingTxt:     { fontSize: 14, color: DS.textMed },

  header:         { flexDirection: 'row', alignItems: 'center', gap: 10,
                    paddingHorizontal: 16, paddingTop: 52, paddingBottom: 14,
                    backgroundColor: DS.white, borderBottomWidth: 1, borderBottomColor: DS.border },
  backBtn:        { width: 40, height: 40, borderRadius: 20,
                    backgroundColor: DS.surface2, justifyContent: 'center', alignItems: 'center' },
  headerTitle:    { fontSize: 18, fontWeight: '900', color: DS.text },
  headerSub:      { fontSize: 11, color: DS.textLow, marginTop: 1 },

  summaryBar:     { flexDirection: 'row', gap: 8, padding: 12,
                    backgroundColor: DS.white, borderBottomWidth: 1, borderBottomColor: DS.border,
                    flexWrap: 'wrap' },
  summaryChip:    { flexDirection: 'row', alignItems: 'center', gap: 6,
                    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20 },
  summaryChipTxt: { fontSize: 12, fontWeight: '700' },

  processingBar:  { flexDirection: 'row', alignItems: 'center', gap: 8,
                    backgroundColor: DS.blue, padding: 10, justifyContent: 'center' },
  processingTxt:  { color: '#FFF', fontSize: 13, fontWeight: '700' },

  scroll:         { flex: 1 },
  scrollContent:  { padding: 16 },

  actionsRow:     { flexDirection: 'row', gap: 8, marginBottom: 16 },
  actionBtn:      { flex: 1, flexDirection: 'row', alignItems: 'center',
                    justifyContent: 'center', gap: 6, padding: 12, borderRadius: 14 },
  actionBtnTxt:   { color: '#FFF', fontWeight: '800', fontSize: 12 },

  emptyBox:       { alignItems: 'center', paddingVertical: 60, gap: 10 },
  emptyTitle:     { fontSize: 18, fontWeight: '900', color: DS.text },
  emptySub:       { fontSize: 13, color: DS.textMed, textAlign: 'center' },

  section:        { marginBottom: 20 },
  sectionTitle:   { fontSize: 10, fontWeight: '900', color: DS.textLow,
                    letterSpacing: 1.5, marginBottom: 6 },
  sectionDesc:    { fontSize: 12, color: DS.textMed, lineHeight: 17, marginBottom: 12 },

  groupCard:      { backgroundColor: DS.white, borderRadius: 16, padding: 14,
                    marginBottom: 12, borderWidth: 1, borderColor: DS.border,
                    elevation: 2 },
  groupTitle:     { fontSize: 14, fontWeight: '800', color: DS.text, marginBottom: 2 },
  groupSub:       { fontSize: 11, color: DS.textLow, marginBottom: 10 },

  productRow:     { flexDirection: 'row', alignItems: 'center', gap: 10,
                    paddingVertical: 10, paddingHorizontal: 8, borderRadius: 10,
                    backgroundColor: DS.surface2, marginBottom: 6 },
  productRowKeep: { backgroundColor: DS.blueBg, borderWidth: 1.5, borderColor: DS.blue+'50' },
  radioOuter:     { width: 20, height: 20, borderRadius: 10, borderWidth: 2,
                    borderColor: DS.textLow, justifyContent: 'center', alignItems: 'center' },
  radioOuterOn:   { borderColor: DS.blue },
  radioInner:     { width: 10, height: 10, borderRadius: 5, backgroundColor: DS.blue },
  productRowTop:  { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 3 },
  statusChip:     { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  statusChipTxt:  { fontSize: 9, fontWeight: '900' },
  priceText:      { fontSize: 13, fontWeight: '900', color: DS.text },
  productRowId:   { fontSize: 10, color: DS.textLow },
  productRowDate: { fontSize: 10, color: DS.textMed, marginTop: 1 },
  keepBadge:      { backgroundColor: DS.blue, paddingHorizontal: 6, paddingVertical: 3,
                    borderRadius: 8 },
  keepBadgeTxt:   { fontSize: 8, fontWeight: '900', color: '#FFF' },

  removeGroupBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
                    gap: 6, marginTop: 10, padding: 10, borderRadius: 10,
                    backgroundColor: DS.dangerBg, borderWidth: 1, borderColor: DS.danger+'30' },
  removeGroupBtnTxt: { fontSize: 13, fontWeight: '700', color: DS.danger },

  corruptCard:    { flexDirection: 'row', alignItems: 'center', gap: 10,
                    backgroundColor: DS.warningBg, borderRadius: 12, padding: 12,
                    marginBottom: 6 },
  corruptTitle:   { fontSize: 13, fontWeight: '700', color: DS.text },
  corruptSub:     { fontSize: 10, color: DS.textMed, marginTop: 2 },
});
