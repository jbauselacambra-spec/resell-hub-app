import React, { useState, useEffect, useMemo } from 'react';
import { 
  View, Text, FlatList, TouchableOpacity, Image, 
  StyleSheet, Dimensions, Alert, ScrollView 
} from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import { DatabaseService } from '../services/DatabaseService';

const { width } = Dimensions.get('window');

export default function ProductsScreen({ navigation }) {
  const [products, setProducts] = useState([]);
  const [filter, setFilter] = useState('all'); 
  // --- NUEVO ESTADO PARA CONFIGURACIÓN ---
  const [userConfig, setUserConfig] = useState(null);

  const loadData = () => {
    try {
      const data = DatabaseService.getAllProducts() || [];
      // Cargar la configuración desde el servicio
      const config = DatabaseService.getConfig();
      setProducts(data.filter(p => p && p.status !== 'sold'));
      setUserConfig(config);
    } catch (error) {
      console.error("Error al cargar inventario:", error);
    }
  };

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', loadData);
    loadData();
    return unsubscribe;
  }, [navigation]);

  // --- LÓGICA DE CONSEJOS ESTACIONALES ---
  const seasonalAdvice = useMemo(() => {
    const month = new Date().getMonth();
    const advices = {
      0: "Enero: Liquidación de Juguetes. Publica Abrigos.",
      1: "Febrero: Carnaval y San Valentín. Mueve Disfraces.",
      2: "Marzo: Primavera. Republica Calzado Deportivo.",
      3: "Abril: Entretiempo. Ropa ligera y Accesorios.",
      4: "Mayo: Preparación Verano. Bañadores y Sandalias.",
      5: "Junio: Temporada Alta de Verano.",
      6: "Julio: Rebajas. Ajusta precios de stock viejo.",
      7: "Agosto: Vuelta al cole. Mochilas y Calzado infantil.",
      8: "Septiembre: Otoño. Chaquetas y Entretenimiento.",
      9: "Octubre: Halloween y Ropa de lluvia.",
      10: "Noviembre: Black Friday. Lotes y Regalos.",
      11: "Diciembre: Navidad. Juguetes y Coleccionables."
    };
    return advices[month];
  }, []);

  // --- LÓGICA DE DIAGNÓSTICO ACTUALIZADA CON USERCONFIG ---
  const getDiagnostic = (item, daysOld) => {
    if (!userConfig) return null;

    const views = item.views || 0;
    const favs = item.favorites || 0;

    // Usamos los valores configurados por el usuario
    const limitInvisible = parseInt(userConfig.daysInvisible || 60);
    const limitDesinterest = parseInt(userConfig.daysDesinterest || 45);
    const limitCritical = parseInt(userConfig.daysCritical || 90);
    const viewsLimit = parseInt(userConfig.viewsInvisible || 20);

    if (daysOld >= limitInvisible && views < viewsLimit) 
      return { type: 'INVISIBLE', msg: `Bajas vistas (<${viewsLimit})`, color: '#888' };
    
    if (daysOld >= limitDesinterest && favs === 0 && views > (viewsLimit + 10)) 
      return { type: 'DESINTERÉS', msg: 'Revisar Precio/Desc.', color: '#FF6B35' };
    
    if (daysOld >= 30 && favs > 8) 
      return { type: 'CASI LISTO', msg: 'Haz oferta ahora', color: '#00D9A3' };
    
    if (daysOld >= limitCritical) 
      return { type: 'CRÍTICO', msg: 'Republicar Urgente', color: '#FF4D4D' };
      
    return null;
  };

  const processedData = useMemo(() => {
    const now = new Date();
    const stats = DatabaseService.getStats();

    const items = products.map(item => {
      const uploadDate = new Date(item.firstUploadDate || item.createdAt);
      const daysOld = Math.floor((now - uploadDate) / (1000 * 60 * 60 * 24));
      
      const diagnostic = getDiagnostic(item, daysOld);
      
      return { 
        ...item, 
        daysOld, 
        diagnostic,
        isHot: (item.views > 50 || item.favorites > 10) && daysOld < 30,
        isCritical: daysOld >= (parseInt(userConfig?.daysCritical) || 90),
        isCold: daysOld >= (parseInt(userConfig?.daysDesinterest) || 45) && daysOld < (parseInt(userConfig?.daysCritical) || 90)
      };
    });

    const counts = {
      invisible: items.filter(i => i.diagnostic?.type === 'INVISIBLE').length,
      lowInterest: items.filter(i => i.diagnostic?.type === 'DESINTERÉS').length,
      hot: items.filter(i => i.diagnostic?.type === 'CASI LISTO').length,
      toRepublicate: items.filter(i => i.isCold || i.isCritical).length
    };

    return { items, counts, monthlySales: stats.sold };
  }, [products, userConfig]); // Añadido userConfig a las dependencias

  const filteredProducts = useMemo(() => {
    if (filter === 'hot') return processedData.items.filter(p => p.isHot);
    if (filter === 'republish') return processedData.items.filter(p => p.isCold || p.isCritical);
    return processedData.items;
  }, [processedData.items, filter]);

  const handleMarkRepublicated = (id) => {
    Alert.alert(
      "Confirmar Resubida",
      "¿Has resubido este artículo? Se reseteará su antigüedad.",
      [
        { text: "No", style: "cancel" },
        { text: "Sí", onPress: () => { DatabaseService.markAsRepublicated(id); loadData(); } }
      ]
    );
  };

  const renderItem = ({ item }) => (
    <TouchableOpacity 
      style={[
        styles.card, 
        item.diagnostic ? { borderColor: item.diagnostic.color, borderWidth: 1.5 } : (item.isCritical && styles.cardCritical)
      ]} 
      onPress={() => navigation.navigate('ProductDetail', { product: item })}
    >
      <Image source={{ uri: item.images[0] }} style={styles.cardImage} />
      
      <View style={styles.cardPriceTag}>
        <Text style={styles.cardPriceText}>{item.price}€</Text>
      </View>

      <View style={styles.badgeContainer}>
        {item.diagnostic ? (
          <View style={[styles.tempBadge, { backgroundColor: item.diagnostic.color }]}>
            <Text style={styles.tempText}>{item.diagnostic.type}</Text>
          </View>
        ) : item.isHot && (
          <View style={[styles.tempBadge, { backgroundColor: '#FF4D4D' }]}>
            <Icon name="zap" size={10} color="#FFF" />
            <Text style={styles.tempText}>HOT</Text>
          </View>
        )}
      </View>

      <View style={styles.cardInfo}>
        <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
        
        {item.diagnostic ? (
          <View style={styles.diagnosticBox}>
            <Icon name="info" size={10} color={item.diagnostic.color} />
            <Text style={[styles.diagnosticText, { color: item.diagnostic.color }]}>
              {item.diagnostic.msg}
            </Text>
          </View>
        ) : (
          <Text style={[styles.timeText, item.isCold ? {color: '#33b5e5'} : {color: '#666'}]}>
            🗓 {item.daysOld} días en stock {item.isCold ? '❄️' : ''}
          </Text>
        )}
        
        <View style={styles.statsRow}>
          <View style={styles.statItem}><Icon name="eye" size={12} color="#666" /><Text style={styles.statText}>{item.views || 0}</Text></View>
          <View style={styles.statItem}><Icon name="heart" size={12} color="#666" /><Text style={styles.statText}>{item.favorites || 0}</Text></View>
        </View>

        {(item.isCold || item.isCritical) && (
          <TouchableOpacity 
            style={[styles.doneBtn, item.isCritical && {backgroundColor: '#FF4D4D'}]} 
            onPress={() => handleMarkRepublicated(item.id)}
          >
            <Icon name="refresh-cw" size={10} color="#FFF" style={{marginRight: 5}} />
            <Text style={styles.doneBtnText}>REPUBLICAR</Text>
          </TouchableOpacity>
        )}
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerSubtitle}>ESTRATEGIA DE STOCK</Text>
          <Text style={styles.headerTitle}>Mi Inventario</Text>
        </View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.diagScroll}>
        {processedData.counts.invisible > 0 && (
          <TouchableOpacity style={[styles.summaryCard, { borderColor: '#888' }]} onPress={() => setFilter('republish')}>
            <Text style={styles.summaryNum}>{processedData.counts.invisible}</Text>
            <Text style={styles.summaryLab}>Invisibles</Text>
          </TouchableOpacity>
        )}
        {processedData.counts.lowInterest > 0 && (
          <TouchableOpacity style={[styles.summaryCard, { borderColor: '#FF6B35' }]} onPress={() => setFilter('republish')}>
            <Text style={styles.summaryNum}>{processedData.counts.lowInterest}</Text>
            <Text style={styles.summaryLab}>Sin Interés</Text>
          </TouchableOpacity>
        )}
        {processedData.counts.hot > 0 && (
          <TouchableOpacity style={[styles.summaryCard, { borderColor: '#00D9A3' }]} onPress={() => setFilter('hot')}>
            <Text style={styles.summaryNum}>{processedData.counts.hot}</Text>
            <Text style={styles.summaryLab}>Casi Listos</Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      <View style={styles.recomPanel}>
        <View style={styles.recomIcon}><Icon name="trending-up" size={20} color="#FF6B35" /></View>
        <View style={{ flex: 1 }}>
          <View style={{flexDirection: 'row', justifyContent: 'space-between'}}>
             <Text style={styles.recomTitle}>Estado del Mes</Text>
             {processedData.counts.toRepublicate > 0 && (
               <TouchableOpacity onPress={() => setFilter('republish')}>
                  <Text style={{fontSize: 10, color: '#33b5e5', fontWeight: 'bold'}}>VER CRÍTICOS</Text>
               </TouchableOpacity>
             )}
          </View>
          <Text style={styles.recomDesc}>{seasonalAdvice} {"\n"}Tienes {processedData.counts.toRepublicate} artículos estancados.</Text>
        </View>
      </View>

      <View style={styles.filterBar}>
        <TouchableOpacity style={[styles.filterTab, filter === 'all' && styles.filterTabActive]} onPress={() => setFilter('all')}>
          <Text style={[styles.filterTabText, filter === 'all' && styles.filterTextActive]}>Todos</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.filterTab, filter === 'hot' && styles.filterTabActiveHot]} onPress={() => setFilter('hot')}>
          <Icon name="zap" size={12} color={filter === 'hot' ? '#FFF' : '#FF4D4D'} />
          <Text style={[styles.filterTabText, filter === 'hot' && styles.filterTextActive]}>Hot</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.filterTab, filter === 'republish' && styles.filterTabActiveCold]} onPress={() => setFilter('republish')}>
          <Icon name="alert-circle" size={12} color={filter === 'republish' ? '#FFF' : '#33b5e5'} />
          <Text style={[styles.filterTabText, filter === 'republish' && styles.filterTextActive]}>Estancados</Text>
        </TouchableOpacity>
      </View>

      <FlatList 
        data={filteredProducts} 
        renderItem={renderItem} 
        keyExtractor={item => String(item.id)} 
        numColumns={2} 
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={<View style={styles.emptyContainer}><Text style={styles.emptyText}>No hay productos aquí.</Text></View>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  header: { paddingHorizontal: 25, paddingTop: 60, paddingBottom: 15 },
  headerSubtitle: { color: '#FF6B35', fontSize: 10, fontWeight: '900', letterSpacing: 2 },
  headerTitle: { fontSize: 28, fontWeight: '900', color: '#1A1A2E' },
  diagScroll: { flexDirection: 'row', paddingLeft: 20, marginBottom: 15, maxHeight: 75 },
  summaryCard: { backgroundColor: '#FFF', padding: 10, borderRadius: 15, marginRight: 10, borderWidth: 2, alignItems: 'center', minWidth: 90, justifyContent: 'center', elevation: 2 },
  summaryNum: { fontSize: 16, fontWeight: '900', color: '#1A1A2E' },
  summaryLab: { fontSize: 9, fontWeight: '700', color: '#666' },
  recomPanel: { flexDirection: 'row', backgroundColor: '#FFF', marginHorizontal: 20, padding: 15, borderRadius: 20, alignItems: 'center', gap: 15, marginBottom: 20, elevation: 2 },
  recomIcon: { width: 40, height: 40, backgroundColor: '#FFF2EE', borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  recomTitle: { fontSize: 14, fontWeight: '900', color: '#1A1A2E' },
  recomDesc: { fontSize: 11, color: '#666', marginTop: 4, lineHeight: 16 },
  filterBar: { flexDirection: 'row', paddingHorizontal: 20, marginBottom: 15, gap: 10 },
  filterTab: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 15, paddingVertical: 10, borderRadius: 25, backgroundColor: '#EEE' },
  filterTabActive: { backgroundColor: '#1A1A2E' },
  filterTabActiveHot: { backgroundColor: '#FF4D4D' },
  filterTabActiveCold: { backgroundColor: '#33b5e5' },
  filterTabText: { fontSize: 11, fontWeight: '800', color: '#666' },
  filterTextActive: { color: '#FFF' },
  listContent: { paddingHorizontal: 15, paddingBottom: 100 },
  card: { width: (width / 2) - 22, margin: 7, backgroundColor: '#FFF', borderRadius: 22, overflow: 'hidden', elevation: 3 },
  cardCritical: { borderColor: '#FF4D4D44', borderWidth: 2 },
  cardImage: { width: '100%', height: 160 },
  cardPriceTag: { position: 'absolute', top: 10, left: 10, backgroundColor: '#00D9A3', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  cardPriceText: { color: '#FFF', fontWeight: '900', fontSize: 12 },
  badgeContainer: { position: 'absolute', top: 10, right: 10, gap: 5 },
  tempBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, gap: 4 },
  tempText: { color: '#FFF', fontSize: 9, fontWeight: '900' },
  cardInfo: { padding: 12 },
  cardTitle: { fontSize: 13, fontWeight: '800', color: '#1A1A2E' },
  timeText: { fontSize: 10, fontWeight: '800', marginVertical: 4 },
  diagnosticBox: { flexDirection: 'row', alignItems: 'center', gap: 4, marginVertical: 4, backgroundColor: '#F8F9FA', padding: 4, borderRadius: 6 },
  diagnosticText: { fontSize: 9, fontWeight: '800', flex: 1 },
  statsRow: { flexDirection: 'row', gap: 12, marginTop: 4, borderTopWidth: 1, borderTopColor: '#F0F0F0', paddingTop: 8, paddingBottom: 8 },
  statItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statText: { fontSize: 11, fontWeight: '700', color: '#444' },
  doneBtn: { backgroundColor: '#1A1A2E', paddingVertical: 8, borderRadius: 10, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', marginTop: 5 },
  doneBtnText: { color: '#FFF', fontSize: 9, fontWeight: '900' },
  emptyContainer: { marginTop: 50, alignItems: 'center', width: width - 40 },
  emptyText: { color: '#999', fontSize: 14, fontWeight: '600' }
});