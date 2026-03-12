/**
 * SoldHistoryScreen.jsx — Sprint 9.1 FINAL
 *
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * [ORCHESTRATOR] Sprint 9.1 — Corrección definitiva Rules of Hooks
 *
 * [QA_ENGINEER] BUG CRÍTICO CORREGIDO — Root Cause Analysis:
 * ─────────────────────────────────────────────────────────────────
 *   ERROR:  "React has detected a change in the order of Hooks called"
 *           "Rendered more hooks than during the previous render"
 *
 *   CAUSA:  Línea 44 del fichero anterior:
 *             `if (!config) return null;`
 *           Esta línea estaba ANTES de los 3 useMemo (líneas 50, 68, 74).
 *           React exige que el número y orden de hooks sea IDÉNTICO en
 *           cada render. Si el primer render salía por el early return,
 *           ejecutaba 0 useMemo. El segundo render (con config ya cargada)
 *           ejecutaba 3 useMemo → crash: "more hooks than previous render".
 *
 *   FIX APLICADO:
 *     1. ELIMINADO el guard `if (!config) return null`
 *        → config se inicializa con `useState(() => DatabaseService.getConfig())`
 *          que usa un init síncrono. getConfig() NUNCA devuelve null
 *          (siempre retorna DEFAULT_CONFIG como fallback).
 *          El guard era innecesario Y causaba el crash.
 *     2. ttsLightning/ttsAnchor derivadas de config con fallback seguros
 *        → no necesitan guard; si config es {}, parseInt('7') = 7 ✓
 *     3. TODOS los hooks (useState, useEffect, useMemo) se declaran
 *        sin ningún return condicional entre ellos.
 *
 * [DATA_SCIENTIST] KPIs Sprint 9.1 (sin cambios respecto al diseño):
 *   • recaudacion   → suma soldPriceReal (ingresos reales, no diff de precios)
 *   • avgPrecio     → precio medio de venta por categoría
 *   • rotacion implícita en el filtro "Por Precio"
 *   ELIMINADO: beneficio/profit (soldPrice - price) → irrelevante en 2ª mano
 *
 * [ARCHITECT] Notas de implementación:
 *   • useMemo depende de soldProducts (loaded asíncronamente por useEffect)
 *   • El estado inicial de soldProducts=[] hace que kpis={ recaudacion:0, ... }
 *     → la UI muestra ceros hasta que llegan los datos, sin crash
 *   • filterCat y filterType se pueden cambiar antes de que carguen datos
 *     → sorted=[] muestra el ListEmptyComponent correctamente
 *
 * [LIBRARIAN] Contrato de datos recibidos de DatabaseService:
 *   productos.status === 'sold'
 *   productos.soldPriceReal (precio real) || soldPrice || price (fallback)
 *   productos.soldDateReal  (fecha real)  || soldDate  || soldAt (fallback)
 *   productos.firstUploadDate || createdAt (para calcular TTS)
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, Image,
  StyleSheet, Dimensions, ScrollView,
} from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import { DatabaseService } from '../services/DatabaseService';

const { width } = Dimensions.get('window');

export default function SoldHistoryScreen({ navigation }) {

  // ── [QA_ENGINEER] ZONA DE HOOKS — sin ningún return condicional entre ellos ──
  const [soldProducts, setSoldProducts] = useState([]);
  const [filterType,   setFilterType]   = useState('date'); // 'date' | 'precio' | 'tts'
  const [filterCat,    setFilterCat]    = useState(null);
  // [QA_ENGINEER] Init síncrono: getConfig() retorna DEFAULT_CONFIG si no hay nada guardado.
  // NUNCA retorna null → el guard `if (!config) return null` era incorrecto y crasheaba.
  const [config, setConfig] = useState(() => DatabaseService.getConfig());

  const loadData = () => {
    const all = DatabaseService.getAllProducts();
    setSoldProducts(all.filter(p => p && p.status === 'sold'));
    setConfig(DatabaseService.getConfig());
  };

  useEffect(() => {
    loadData();
    const unsub = navigation.addListener('focus', loadData);
    return unsub;
  }, [navigation]);

  // ── [QA_ENGINEER] useMemo SIEMPRE SE EJECUTA — sin return antes de aquí ──

  // [DATA_SCIENTIST] KPI: recaudacion = suma de ingresos reales.
  // No calculamos (soldPrice - price) porque en 2ª mano siempre se vende igual o más barato.
  const kpis = useMemo(() => {
    const recaudacion = soldProducts.reduce(
      (s, p) => s + Math.max(0, Number(p.soldPriceReal || p.soldPrice || p.price || 0)), 0,
    );
    const ttsList = soldProducts.map(p => {
      const start = p.firstUploadDate || p.createdAt;
      const end   = p.soldDateReal || p.soldDate || p.soldAt;
      if (!start || !end) return null;
      return Math.max(1, Math.round((new Date(end) - new Date(start)) / 86_400_000));
    }).filter(Boolean);
    const avgTTS    = ttsList.length ? Math.round(ttsList.reduce((a, b) => a + b, 0) / ttsList.length) : 0;
    const avgPrecio = soldProducts.length ? +(recaudacion / soldProducts.length).toFixed(2) : 0;
    return { recaudacion, avgTTS, avgPrecio, count: soldProducts.length };
  }, [soldProducts]);

  // Categorías únicas para el filtro horizontal
  const allCats = useMemo(() => {
    const set = new Set(soldProducts.map(p => p.category).filter(Boolean));
    return [...set].sort();
  }, [soldProducts]);

  // Lista ordenada y filtrada
  const sorted = useMemo(() => {
    let arr = filterCat ? soldProducts.filter(p => p.category === filterCat) : [...soldProducts];
    if (filterType === 'date') {
      arr.sort((a, b) =>
        new Date(b.soldDateReal || b.soldDate || b.soldAt || 0) -
        new Date(a.soldDateReal || a.soldDate || a.soldAt || 0),
      );
    } else if (filterType === 'precio') {
      // [DATA_SCIENTIST] Mayor precio de venta primero — muestra qué genera más caja
      arr.sort((a, b) =>
        Math.max(0, Number(b.soldPriceReal || b.soldPrice || b.price || 0)) -
        Math.max(0, Number(a.soldPriceReal || a.soldPrice || a.price || 0)),
      );
    } else if (filterType === 'tts') {
      arr.sort((a, b) => {
        const ttsOf = p => {
          const s = p.firstUploadDate || p.createdAt;
          const e = p.soldDateReal || p.soldDate || p.soldAt;
          return (s && e) ? Math.max(1, Math.round((new Date(e) - new Date(s)) / 86_400_000)) : 9999;
        };
        return ttsOf(a) - ttsOf(b);
      });
    }
    return arr;
  }, [soldProducts, filterType, filterCat]);

  // ── Fin zona de hooks — a partir de aquí la lógica de render es segura ──

  // Derivadas de config con fallback seguro (no necesitan guard)
  const ttsLightning = parseInt(config?.ttsLightning || 7);
  const ttsAnchor    = parseInt(config?.ttsAnchor    || 30);

  const avgTtsColor = kpis.avgTTS > 0 && kpis.avgTTS <= ttsLightning
    ? '#00D9A3'
    : kpis.avgTTS > 0 && kpis.avgTTS <= ttsAnchor ? '#FFB800'
    : '#E63946';

  // ── renderItem fuera del cuerpo principal para claridad ──────────────────────
  const renderItem = ({ item: p }) => {
    const soldAmt = Math.max(0, Number(p.soldPriceReal || p.soldPrice || p.price || 0));

    const soldDateStr = (() => {
      const d = p.soldDateReal || p.soldDate || p.soldAt;
      if (!d) return '—';
      return new Date(d).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
    })();

    const tts = (() => {
      const s = p.firstUploadDate || p.createdAt;
      const e = p.soldDateReal || p.soldDate || p.soldAt;
      if (!s || !e) return null;
      return Math.max(1, Math.round((new Date(e) - new Date(s)) / 86_400_000));
    })();

    const ttsColor = !tts         ? '#999'
      : tts <= ttsLightning       ? '#00D9A3'
      : tts <= ttsAnchor          ? '#FFB800'
      :                             '#E63946';
    const ttsEmoji = !tts ? '' : tts <= ttsLightning ? '⚡' : tts <= ttsAnchor ? '🟡' : '⚓';

    return (
      <View style={styles.card}>
        {p.thumbnail || p.image ? (
          <Image source={{ uri: p.thumbnail || p.image }} style={styles.thumbnail} />
        ) : (
          <View style={[styles.thumbnail, { backgroundColor: '#F0F2F5', justifyContent: 'center', alignItems: 'center' }]}>
            <Icon name="package" size={22} color="#CCC" />
          </View>
        )}
        <View style={{ flex: 1, gap: 3 }}>
          <Text style={styles.cardTitle} numberOfLines={2}>{p.title || 'Sin título'}</Text>
          {(p.category || p.subcategory) && (
            <Text style={styles.cardMeta}>
              {p.category}{p.subcategory ? ` › ${p.subcategory}` : ''}
              {p.brand ? ` · ${p.brand}` : ''}
            </Text>
          )}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <Text style={styles.cardPrice}>{soldAmt.toFixed(0)}€</Text>
            {tts !== null && (
              <View style={[styles.ttsChip, { backgroundColor: ttsColor + '15', borderColor: ttsColor + '44' }]}>
                <Text style={[styles.ttsChipTxt, { color: ttsColor }]}>{ttsEmoji} {tts}d</Text>
              </View>
            )}
            {p.isBundle && (
              <View style={styles.bundleChip}>
                <Text style={styles.bundleChipTxt}>📦 Lote</Text>
              </View>
            )}
          </View>
          <Text style={styles.cardDate}>{soldDateStr}</Text>
        </View>
      </View>
    );
  };

  // ── RENDER ────────────────────────────────────────────────────────────────────
  return (
    <View style={styles.container}>

      {/* ── HEADER ────────────────────────────────────────────────────────── */}
      <View style={styles.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={styles.headerTitle}>Historial de Ventas</Text>
          <TouchableOpacity
            style={styles.importBtn}
            onPress={() => navigation.navigate('VintedImport')}
          >
            <Icon name="download" size={13} color="#6C63FF" />
            <Text style={styles.importBtnTxt}>Importar</Text>
          </TouchableOpacity>
        </View>

        {/* ── KPI PANEL ── sin "Beneficio" — KPIs reales de 2ª mano ─────── */}
        <View style={styles.kpiPanel}>
          <View style={styles.kpiItem}>
            <Text style={styles.kpiVal}>{kpis.count}</Text>
            <Text style={styles.kpiLab}>Ventas</Text>
          </View>
          <View style={styles.kpiDivider} />
          <View style={styles.kpiItem}>
            <Text style={[styles.kpiVal, { color: '#004E89' }]}>{kpis.recaudacion.toFixed(0)}€</Text>
            <Text style={styles.kpiLab}>Recaudado</Text>
          </View>
          <View style={styles.kpiDivider} />
          <View style={styles.kpiItem}>
            <Text style={[styles.kpiVal, { color: '#5C6070' }]}>{kpis.avgPrecio}€</Text>
            <Text style={styles.kpiLab}>Precio medio</Text>
          </View>
          <View style={styles.kpiDivider} />
          <View style={styles.kpiItem}>
            <Text style={[styles.kpiVal, { color: avgTtsColor }]}>
              {kpis.avgTTS > 0 ? `${kpis.avgTTS}d` : '—'}
            </Text>
            <Text style={styles.kpiLab}>TTS Medio</Text>
          </View>
        </View>

        <Text style={styles.ttsLegend}>
          ⚡≤{ttsLightning}d · 🟡{ttsLightning + 1}–{ttsAnchor}d · ⚓&gt;{ttsAnchor}d (según Settings)
        </Text>
      </View>

      {/* ── FILTRO CATEGORÍA ──────────────────────────────────────────────── */}
      {allCats.length >= 2 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ paddingHorizontal: 16, marginBottom: 8, maxHeight: 44 }}
          contentContainerStyle={{ gap: 6, alignItems: 'center' }}
        >
          <TouchableOpacity
            style={[styles.catChip, !filterCat && { backgroundColor: '#FF6B35' }]}
            onPress={() => setFilterCat(null)}
          >
            <Text style={[styles.catChipTxt, !filterCat && { color: '#FFF' }]}>Todas</Text>
          </TouchableOpacity>
          {allCats.map(cat => (
            <TouchableOpacity
              key={cat}
              style={[styles.catChip, filterCat === cat && { backgroundColor: '#FF6B35' }]}
              onPress={() => setFilterCat(filterCat === cat ? null : cat)}
            >
              <Text style={[styles.catChipTxt, filterCat === cat && { color: '#FFF' }]}>{cat}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* ── FILTRO ORDEN ──────────────────────────────────────────────────── */}
      <View style={styles.filterBar}>
        {[
          { id: 'date',   label: '🗓 Por Fecha'    },
          { id: 'precio', label: '💰 Por Precio'   },
          { id: 'tts',    label: '⚡ Por Velocidad' },
        ].map(f => (
          <TouchableOpacity
            key={f.id}
            style={[styles.filterBtn, filterType === f.id && styles.filterBtnActive]}
            onPress={() => setFilterType(f.id)}
          >
            <Text style={[styles.filterText, filterType === f.id && styles.filterTextActive]}>
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ── LISTA ─────────────────────────────────────────────────────────── */}
      <FlatList
        data={sorted}
        renderItem={renderItem}
        keyExtractor={item => String(item.id)}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Icon name="shopping-bag" size={40} color="#DDD" />
            <Text style={styles.emptyText}>Sin ventas todavía.</Text>
            <Text style={styles.emptySub}>
              Marca productos como vendidos para ver tu historial.
            </Text>
          </View>
        }
      />
    </View>
  );
}

// ─── Estilos ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: '#F8F9FA' },
  header: {
    paddingHorizontal: 20, paddingTop: 56, paddingBottom: 16,
    backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#F0F0F0',
  },
  headerTitle: { fontSize: 22, fontWeight: '900', color: '#1A1A2E', marginBottom: 14 },

  importBtn:    { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#F0EFFE', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12 },
  importBtnTxt: { fontSize: 11, fontWeight: '800', color: '#6C63FF' },

  kpiPanel:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around' },
  kpiItem:    { alignItems: 'center' },
  kpiVal:     { fontSize: 18, fontWeight: '900', color: '#1A1A2E', fontFamily: 'monospace' },
  kpiLab:     { fontSize: 9, color: '#999', fontWeight: '700', marginTop: 2 },
  kpiDivider: { width: 1, height: 28, backgroundColor: '#F0F0F0' },

  ttsLegend: { fontSize: 9, color: '#BBB', textAlign: 'center', marginTop: 10, letterSpacing: 0.3 },

  catChip:    { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: '#F0F0F0', borderWidth: 1, borderColor: '#E0E0E0' },
  catChipTxt: { fontSize: 11, fontWeight: '700', color: '#666' },

  filterBar: {
    flexDirection: 'row', marginHorizontal: 16, marginVertical: 10,
    backgroundColor: '#F0F0F0', borderRadius: 14, padding: 3,
  },
  filterBtn:        { flex: 1, paddingVertical: 8, borderRadius: 12, alignItems: 'center' },
  filterBtnActive:  { backgroundColor: '#FFF', elevation: 2 },
  filterText:       { fontSize: 10, fontWeight: '700', color: '#999' },
  filterTextActive: { color: '#1A1A2E', fontWeight: '900' },

  list: { paddingHorizontal: 16, paddingBottom: 40 },
  card: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#FFF', borderRadius: 16, padding: 12,
    marginBottom: 10, elevation: 1,
  },
  thumbnail: { width: 64, height: 64, borderRadius: 12, backgroundColor: '#F0F2F5' },
  cardTitle: { fontSize: 13, fontWeight: '700', color: '#1A1A2E', lineHeight: 18 },
  cardMeta:  { fontSize: 10, color: '#A0A5B5', fontWeight: '600' },
  cardPrice: { fontSize: 16, fontWeight: '900', color: '#004E89', fontFamily: 'monospace' },
  cardDate:  { fontSize: 10, color: '#BBB', fontFamily: 'monospace' },

  ttsChip:      { borderWidth: 1, borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2 },
  ttsChipTxt:   { fontSize: 9, fontWeight: '900' },
  bundleChip:   { backgroundColor: '#FF6B3515', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2 },
  bundleChipTxt:{ fontSize: 9, fontWeight: '700', color: '#FF6B35' },

  empty:     { alignItems: 'center', paddingVertical: 60, gap: 10 },
  emptyText: { fontSize: 15, fontWeight: '700', color: '#BBB' },
  emptySub:  { fontSize: 12, color: '#CCC', textAlign: 'center' },
});