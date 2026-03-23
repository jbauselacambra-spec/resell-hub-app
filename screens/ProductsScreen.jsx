/**
 * ProductsScreen.jsx — Sprint 11
 *
 * [UI_SPECIALIST] Sprint 11:
 * - Filtro de 2 niveles: Categoría → Subcategoría
 *   Fila 1: chips de categoría (igual que antes)
 *   Fila 2: chips de subcategoría (aparece al seleccionar cat con subs)
 * - +filterSub state
 * - filtered useMemo añade filterSub
 * - Reset sub al cambiar cat, reset todo al pulsar "Todas"
 *
 * [QA_ENGINEER] Sprint 11:
 * - filterSub SIEMPRE se resetea al cambiar filterCat (no stranded state)
 * - Fila 2 solo aparece si hay >= 2 subcats distintas en la selección actual
 * - Los 7 Campos Sagrados intactos: filtros son solo lectura
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Image, Alert, ScrollView, Platform,
} from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import { DatabaseService } from '../services/DatabaseService';
import LogService, { LOG_CTX } from '../services/LogService';

const MONTH_NAMES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
                     'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

// ─── Design System Light canónico ─────────────────────────────────────────────
const DS = {
  bg:       '#F8F9FA',
  white:    '#FFFFFF',
  border:   '#EAEDF0',
  primary:  '#FF6B35',
  success:  '#00D9A3',
  warning:  '#FFB800',
  danger:   '#E63946',
  blue:     '#004E89',
  blueBg:   '#EAF2FB',
  text:     '#1A1A2E',
  textMed:  '#5C6070',
  textLow:  '#A0A5B5',
  mono:     Platform.OS === 'android' ? 'monospace' : 'Courier New',
};

export default function ProductsScreen({ navigation }) {
  // ── HOOKS — antes de cualquier early return (Regla 12) ─────────────────────
  const [products,   setProducts]   = useState([]);
  const [filter,     setFilter]     = useState('all');
  const [filterCat,  setFilterCat]  = useState(null);
  const [filterSub,  setFilterSub]  = useState(null);   // ← Sprint 11
  const [config,     setConfig]     = useState(() => DatabaseService.getConfig());

  const loadData = () => {
    try {
      const enriched = DatabaseService.getActiveProductsWithDiagnostic();
      setProducts(enriched);
      setConfig(DatabaseService.getConfig());
      LogService.debug(`ProductsScreen: ${enriched.length} productos cargados`, LOG_CTX.UI);
    } catch (e) {
      LogService.error('ProductsScreen.loadData', LOG_CTX.DB, e.message);
    }
  };

  useEffect(() => {
    loadData();
    const unsub = navigation.addListener('focus', loadData);
    return unsub;
  }, [navigation]);

  const currentMonth = new Date().getMonth();

  // Resumen de diagnósticos para chips superiores
  const counts = useMemo(() => ({
    critical:    products.filter(p => p.severity?.type === 'CRÍTICO').length,
    invisible:   products.filter(p => p.severity?.type === 'INVISIBLE').length,
    desinterest: products.filter(p => p.severity?.type === 'DESINTERÉS').length,
    opportunity: products.filter(p => p.severity?.type === 'CASI LISTO').length,
    stagnant:    products.filter(p => p.isCold || p.isCritical).length,
  }), [products]);

  // ── Sprint 11: filtered incluye filterSub ──────────────────────────────────
  const filtered = useMemo(() => {
    let arr = products;
    if (filter === 'hot')           arr = arr.filter(p => p.isHot);
    else if (filter === 'stagnant') arr = arr.filter(p => p.isCold || p.isCritical);
    else if (filter === 'critical') arr = arr.filter(p => p.severity?.type === 'CRÍTICO');
    if (filterCat) arr = arr.filter(p => p.category === filterCat);
    if (filterSub) arr = arr.filter(p => p.subcategory === filterSub);
    return arr;
  }, [products, filter, filterCat, filterSub]);

  const handleRepublish = (id) => {
    Alert.alert('Confirmar Resubida', '¿Has resubido este artículo? Se reseteará la antigüedad.', [
      { text: 'No', style: 'cancel' },
      { text: 'Sí', onPress: () => { DatabaseService.markAsRepublicated(id); loadData(); } },
    ]);
  };

  const renderItem = ({ item }) => {
    const sev = item.severity;
    const borderColor = sev ? sev.color : (item.isHot ? '#E63946' : 'transparent');

    return (
      <TouchableOpacity
        style={[styles.card, { borderColor, borderWidth: sev || item.isHot ? 2 : 0 }]}
        onPress={() => {
          LogService.info(`ProductsScreen → ProductDetail: ${item.title}`, LOG_CTX.NAV);
          navigation.navigate('ProductDetail', { product: item });
        }}
      >
        <Image source={{ uri: item.images?.[0] }} style={styles.cardImage} />

        {/* Price badge */}
        <View style={styles.priceBadge}>
          <Text style={styles.priceText}>{item.price}€</Text>
        </View>

        {/* Severity / hot badge */}
        <View style={styles.topRight}>
          {sev ? (
            <View style={[styles.sevBadge, { backgroundColor: sev.color }]}>
              <Text style={styles.sevText}>{sev.type}</Text>
            </View>
          ) : item.isHot ? (
            <View style={[styles.sevBadge, { backgroundColor: '#E63946' }]}>
              <Icon name="zap" size={9} color="#FFF" />
              <Text style={styles.sevText}>HOT</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.cardInfo}>
          <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
          {(item.category || item.brand) ? (
            <Text style={styles.cardCat} numberOfLines={1}>
              {item.category || ''}{item.subcategory ? ` › ${item.subcategory}` : ''}{item.brand ? ` · ${item.brand}` : ''}
            </Text>
          ) : null}

          {sev ? (
            <View style={[styles.diagBox, { backgroundColor: sev.color + '15' }]}>
              <Icon name={sev.icon} size={10} color={sev.color} />
              <Text style={[styles.diagText, { color: sev.color }]}>{sev.msg}</Text>
            </View>
          ) : (
            <Text style={[styles.daysText, item.isCold ? { color: '#4EA8DE' } : { color: '#999' }]}>
              🗓 {item.daysOld}d en stock {item.isCold ? '❄️' : ''}
            </Text>
          )}

          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Icon name="eye"   size={11} color="#999" />
              <Text style={styles.statText}>{item.views || 0}</Text>
            </View>
            <View style={styles.statItem}>
              <Icon name="heart" size={11} color="#999" />
              <Text style={styles.statText}>{item.favorites || 0}</Text>
            </View>
          </View>

          {(item.isCold || item.isCritical) && (
            <TouchableOpacity
              style={[styles.republishBtn, item.isCritical && { backgroundColor: '#E63946' }]}
              onPress={() => handleRepublish(item.id)}
            >
              <Icon name="refresh-cw" size={9} color="#FFF" />
              <Text style={styles.republishText}>REPUBLICAR</Text>
            </TouchableOpacity>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={styles.headerTitle}>Mi Inventario</Text>
          <Text style={styles.headerSub}>ESTRATEGIA DE STOCK</Text>
        </View>
      </View>

      {/* ── Sprint 11: Chips Categoría + Subcategoría en 2 niveles ──────────── */}
      {(() => {
        const cats = [...new Set(products.map(p => p.category).filter(Boolean))].sort();
        if (cats.length < 2) return null;

        // Subcategorías disponibles para la categoría seleccionada
        const availSubs = filterCat
          ? [...new Set(
              products
                .filter(p => p.category === filterCat && p.subcategory)
                .map(p => p.subcategory)
            )].sort()
          : [];

        return (
          <View style={{ marginBottom: 4 }}>
            {/* Fila 1: categorías */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{ paddingLeft: 20, marginBottom: 2 }}
              contentContainerStyle={{ gap: 6, paddingRight: 20 }}
            >
              <TouchableOpacity
                style={[styles.catChipOuter, !filterCat && { backgroundColor: DS.primary }]}
                onPress={() => { setFilterCat(null); setFilterSub(null); }}
              >
                <Text style={[styles.catChipOuterTxt, !filterCat && { color: '#FFF' }]}>
                  Todas
                </Text>
              </TouchableOpacity>
              {cats.map(cat => (
                <TouchableOpacity
                  key={cat}
                  style={[styles.catChipOuter, filterCat === cat && { backgroundColor: DS.primary }]}
                  onPress={() => {
                    if (filterCat === cat) { setFilterCat(null); setFilterSub(null); }
                    else { setFilterCat(cat); setFilterSub(null); }
                  }}
                >
                  <Text style={[styles.catChipOuterTxt, filterCat === cat && { color: '#FFF' }]}>
                    {cat}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Fila 2: subcategorías (solo si hay cat seleccionada y tiene >= 2 subs) */}
            {filterCat && availSubs.length >= 2 && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={{ paddingLeft: 28, marginBottom: 2 }}
                contentContainerStyle={{ gap: 5, paddingRight: 20 }}
              >
                <TouchableOpacity
                  style={[styles.subChip, !filterSub && { backgroundColor: DS.blue }]}
                  onPress={() => setFilterSub(null)}
                >
                  <Text style={[styles.subChipTxt, !filterSub && { color: '#FFF' }]}>
                    Todas las subs
                  </Text>
                </TouchableOpacity>
                {availSubs.map(sub => (
                  <TouchableOpacity
                    key={sub}
                    style={[styles.subChip, filterSub === sub && { backgroundColor: DS.blue }]}
                    onPress={() => setFilterSub(filterSub === sub ? null : sub)}
                  >
                    <Text style={[styles.subChipTxt, filterSub === sub && { color: '#FFF' }]}>
                      › {sub}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
          </View>
        );
      })()}

      {/* Diagnosis chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.chipScroll}
        contentContainerStyle={{ paddingHorizontal: 20, gap: 8 }}
      >
        {counts.critical > 0 && (
          <TouchableOpacity style={[styles.chip, { borderColor: '#E63946' }]} onPress={() => setFilter('critical')}>
            <Text style={styles.chipNum}>{counts.critical}</Text>
            <Text style={styles.chipLab}>Críticos</Text>
          </TouchableOpacity>
        )}
        {counts.invisible > 0 && (
          <TouchableOpacity style={[styles.chip, { borderColor: '#888' }]} onPress={() => setFilter('stagnant')}>
            <Text style={styles.chipNum}>{counts.invisible}</Text>
            <Text style={styles.chipLab}>Invisibles</Text>
          </TouchableOpacity>
        )}
        {counts.desinterest > 0 && (
          <TouchableOpacity style={[styles.chip, { borderColor: '#FF6B35' }]} onPress={() => setFilter('stagnant')}>
            <Text style={styles.chipNum}>{counts.desinterest}</Text>
            <Text style={styles.chipLab}>Sin interés</Text>
          </TouchableOpacity>
        )}
        {counts.opportunity > 0 && (
          <TouchableOpacity style={[styles.chip, { borderColor: '#00D9A3' }]} onPress={() => setFilter('hot')}>
            <Text style={styles.chipNum}>{counts.opportunity}</Text>
            <Text style={styles.chipLab}>Casi listos</Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      {/* Seasonal advice panel */}
      <View style={styles.advicePanel}>
        <View style={styles.adviceIcon}>
          <Icon name="trending-up" size={18} color="#FF6B35" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.adviceTitle}>Estado del mes</Text>
          <Text style={styles.adviceText}>
            {(() => {
              const seasonalCats = Array.isArray(config?.seasonalMap?.[currentMonth])
                ? config.seasonalMap[currentMonth]
                : (config?.seasonalMap?.[currentMonth] ? [config.seasonalMap[currentMonth]] : []);
              // Sprint 11: mostrar solo nombres cortos (sin el "Cat › " prefix)
              const labels = seasonalCats.map(s => s.includes(' › ') ? s.split(' › ')[1] : s);
              const catsText = labels.length > 0
                ? `${MONTH_NAMES[currentMonth]}: temporada de ${labels.join(' y ')}.`
                : `${MONTH_NAMES[currentMonth]}: sin categorías estacionales configuradas.`;
              const stagnantText = counts.stagnant > 0
                ? ` Tienes ${counts.stagnant} artículos estancados.`
                : ' ¡Todo bajo control!';
              return catsText + stagnantText;
            })()}
          </Text>
        </View>
      </View>

      {/* Filter bar */}
      <View style={styles.filterBar}>
        {[
          { id: 'all',      label: 'Todos',         count: products.length },
          { id: 'stagnant', label: '❄️ Estancados',  count: counts.stagnant, color: '#4EA8DE' },
          { id: 'hot',      label: '⚡ Hot',          count: counts.opportunity + products.filter(p => p.isHot).length, color: '#E63946' },
        ].map(f => (
          <TouchableOpacity
            key={f.id}
            style={[styles.filterBtn, filter === f.id && { backgroundColor: f.color || '#1A1A2E' }]}
            onPress={() => setFilter(f.id)}
          >
            <Text style={[styles.filterText, filter === f.id && { color: '#FFF' }]}>
              {f.label} {f.count > 0 ? `(${f.count})` : ''}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={filtered}
        renderItem={renderItem}
        keyExtractor={item => String(item.id)}
        numColumns={2}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Icon name="inbox" size={40} color="#DDD" />
            <Text style={styles.emptyText}>No hay productos en esta vista.</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: '#F8F9FA' },
  header:      { paddingHorizontal: 25, paddingTop: 60, paddingBottom: 16 },
  headerSub:   { fontSize: 9, fontWeight: '900', color: '#FF6B35', letterSpacing: 2 },
  headerTitle: { fontSize: 28, fontWeight: '900', color: '#1A1A2E' },

  chipScroll: { maxHeight: 72, marginBottom: 12 },
  chip: {
    backgroundColor: '#FFF', borderWidth: 2, borderRadius: 16,
    paddingHorizontal: 14, paddingVertical: 8,
    alignItems: 'center', minWidth: 80,
  },
  chipNum: { fontSize: 16, fontWeight: '900', color: '#1A1A2E' },
  chipLab: { fontSize: 8, fontWeight: '700', color: '#666' },

  advicePanel: {
    flexDirection: 'row', gap: 12, alignItems: 'center',
    backgroundColor: '#FFF', marginHorizontal: 20, padding: 14,
    borderRadius: 16, marginBottom: 12,
    elevation: 2, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, shadowOffset: { width: 0, height: 2 },
  },
  adviceIcon:  { width: 40, height: 40, borderRadius: 20, backgroundColor: '#FFF2EE', justifyContent: 'center', alignItems: 'center' },
  adviceTitle: { fontSize: 11, fontWeight: '900', color: '#1A1A2E', marginBottom: 2 },
  adviceText:  { fontSize: 11, color: '#666', lineHeight: 16 },

  filterBar:  { flexDirection: 'row', gap: 8, paddingHorizontal: 20, marginBottom: 12 },
  filterBtn:  { flex: 1, paddingVertical: 8, borderRadius: 10, backgroundColor: '#FFF', alignItems: 'center', borderWidth: 1, borderColor: '#E0E0E0' },
  filterText: { fontSize: 11, fontWeight: '700', color: '#666' },

  list: { paddingHorizontal: 16, paddingBottom: 120 },

  card: {
    flex: 1, margin: 4, backgroundColor: '#FFF', borderRadius: 16, overflow: 'hidden',
    elevation: 2, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 },
  },
  cardImage:   { width: '100%', aspectRatio: 1, backgroundColor: '#F0F0F0' },
  priceBadge:  { position: 'absolute', top: 8, left: 8, backgroundColor: '#FF6B35', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  priceText:   { color: '#FFF', fontWeight: '900', fontSize: 12 },
  topRight:    { position: 'absolute', top: 8, right: 8 },
  sevBadge:    { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 10 },
  sevText:     { color: '#FFF', fontWeight: '900', fontSize: 8 },
  cardInfo:    { padding: 10, gap: 4 },
  cardTitle:   { fontSize: 12, fontWeight: '700', color: '#1A1A2E', lineHeight: 16 },
  cardCat:     { fontSize: 10, color: '#666', fontWeight: '500' },
  diagBox:     { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 6, paddingVertical: 3, borderRadius: 6 },
  diagText:    { fontSize: 9, fontWeight: '700' },
  daysText:    { fontSize: 10, color: '#999' },
  statsRow:    { flexDirection: 'row', gap: 10 },
  statItem:    { flexDirection: 'row', alignItems: 'center', gap: 3 },
  statText:    { fontSize: 10, color: '#999' },
  republishBtn:{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, backgroundColor: '#FF6B35', borderRadius: 8, paddingVertical: 5, marginTop: 2 },
  republishText:{ color: '#FFF', fontSize: 9, fontWeight: '900' },
  empty:       { alignItems: 'center', paddingTop: 60 },
  emptyText:   { fontSize: 16, fontWeight: '700', color: '#999', marginTop: 12 },

  // ── Sprint 11: chips 2 niveles ─────────────────────────────────────────
  catChipOuter: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    backgroundColor: '#F0F0F0',
    marginVertical: 4,
  },
  catChipOuterTxt: {
    fontSize: 11,
    fontWeight: '700',
    color: '#666',
  },
  subChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 16,
    backgroundColor: DS.blueBg,
    marginVertical: 3,
    borderWidth: 1,
    borderColor: DS.blue + '30',
  },
  subChipTxt: {
    fontSize: 10,
    fontWeight: '700',
    color: DS.blue,
  },
});