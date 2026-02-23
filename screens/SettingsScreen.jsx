import React, { useState, useEffect } from 'react';
import { 
  View, Text, StyleSheet, ScrollView, TextInput, 
  TouchableOpacity, Alert 
} from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import { DatabaseService } from '../services/DatabaseService';

export default function SettingsScreen({ navigation }) {
  const [config, setConfig] = useState({
    daysInvisible: '60',
    viewsInvisible: '20',
    daysDesinterest: '45', // <--- Restaurado
    daysCritical: '90',    // <--- Restaurado
    staleMultiplier: '1.5',
    criticalMonthThreshold: '6',
    seasonalMap: {
      0: 'Juguetes', 1: 'Ropa', 2: 'Disfraces', 3: 'Otros',
      4: 'Otros', 5: 'Otros', 6: 'Otros', 7: 'Otros',
      8: 'Lotes', 9: 'Otros', 10: 'Juguetes', 11: 'Juguetes'
    }
  });

  const [dictionary, setDictionary] = useState({});
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newTag, setNewTag] = useState('');
  const [activeCategory, setActiveCategory] = useState(null);

  const meses = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];

  useEffect(() => {
    const savedConfig = DatabaseService.getConfig();
    const savedDict = DatabaseService.getDictionary();
    if (savedConfig) setConfig({ ...config, ...savedConfig });
    if (savedDict) setDictionary(savedDict);
  }, []);

  const handleSaveConfig = () => {
    const success = DatabaseService.saveConfig(config);
    if (success) Alert.alert("Éxito", "Estrategia y configuración guardadas.");
  };

  const updateSeasonalMonth = (index, value) => {
    const newMap = { ...config.seasonalMap };
    newMap[index] = value;
    setConfig({ ...config, seasonalMap: newMap });
  };

  // --- Lógica de Diccionario ---
  const handleAddCategory = () => {
    if (!newCategoryName.trim()) return;
    if (dictionary[newCategoryName]) {
      Alert.alert("Error", "Esta categoría ya existe.");
      return;
    }
    const updatedDict = { ...dictionary, [newCategoryName.trim()]: [] };
    saveUpdatedDict(updatedDict);
    setNewCategoryName('');
  };

  const handleAddTag = (category) => {
    if (!newTag.trim()) return;
    const updatedDict = { ...dictionary };
    if (!updatedDict[category].includes(newTag.toLowerCase())) {
      updatedDict[category].push(newTag.toLowerCase().trim());
      saveUpdatedDict(updatedDict);
      setNewTag('');
      setActiveCategory(null);
    }
  };

  const handleRemoveTag = (category, tag) => {
    const updatedDict = { ...dictionary };
    updatedDict[category] = updatedDict[category].filter(t => t !== tag);
    saveUpdatedDict(updatedDict);
  };

  const handleRemoveCategory = (category) => {
    Alert.alert("Eliminar", `¿Borrar "${category}"?`, [
      { text: "Cancelar", style: "cancel" },
      { text: "Eliminar", style: "destructive", onPress: () => {
        const updatedDict = { ...dictionary };
        delete updatedDict[category];
        saveUpdatedDict(updatedDict);
      }}
    ]);
  };

  const saveUpdatedDict = (newDict) => {
    setDictionary(newDict);
    DatabaseService.saveDictionary(newDict);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Icon name="arrow-left" size={24} color="#1A1A2E" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Configuración</Text>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.sectionTitle}>Umbrales de Diagnóstico</Text>
        
        {/* Producto Invisible */}
        <View style={styles.settingCard}>
          <View style={styles.info}>
            <Text style={styles.label}>Producto Invisible</Text>
            <Text style={styles.desc}>Días transcurridos con pocas vistas.</Text>
          </View>
          <View style={styles.inputRow}>
            <TextInput style={styles.input} keyboardType="numeric" value={config.daysInvisible} onChangeText={(v) => setConfig({...config, daysInvisible: v})}/>
            <Text style={styles.unit}>Días</Text>
            <TextInput style={[styles.input, {marginLeft: 10}]} keyboardType="numeric" value={config.viewsInvisible} onChangeText={(v) => setConfig({...config, viewsInvisible: v})}/>
            <Text style={styles.unit}>Vistas</Text>
          </View>
        </View>

        {/* Falta de Interés */}
        <View style={styles.settingCard}>
          <View style={styles.info}>
            <Text style={styles.label}>Falta de Interés</Text>
            <Text style={styles.desc}>Días con vistas pero 0 favoritos.</Text>
          </View>
          <View style={styles.inputRow}>
            <TextInput style={styles.input} keyboardType="numeric" value={config.daysDesinterest} onChangeText={(v) => setConfig({...config, daysDesinterest: v})}/>
            <Text style={styles.unit}>Días</Text>
          </View>
        </View>

        {/* Estado Crítico */}
        <View style={styles.settingCard}>
          <View style={styles.info}>
            <Text style={styles.label}>Estado Crítico</Text>
            <Text style={styles.desc}>Días totales para marcar como acción urgente.</Text>
          </View>
          <View style={styles.inputRow}>
            <TextInput style={styles.input} keyboardType="numeric" value={config.daysCritical} onChangeText={(v) => setConfig({...config, daysCritical: v})}/>
            <Text style={styles.unit}>Días</Text>
          </View>
        </View>

        <Text style={[styles.sectionTitle, { marginTop: 20 }]}>Estrategia Inteligente</Text>
        
        <View style={styles.settingCard}>
          <View style={styles.info}>
            <Text style={styles.label}>Sensibilidad (x Media)</Text>
            <Text style={styles.desc}>Multiplicador para alertar estancamiento.</Text>
          </View>
          <View style={styles.inputRow}>
            <TextInput style={styles.input} keyboardType="numeric" value={config.staleMultiplier} onChangeText={(v) => setConfig({...config, staleMultiplier: v})}/>
            <Text style={styles.unit}>x Media</Text>
          </View>
        </View>

        <View style={styles.settingCard}>
          <View style={styles.info}>
            <Text style={styles.label}>Máximo Histórico</Text>
            <Text style={styles.desc}>Meses antes de obligar a republicar.</Text>
          </View>
          <View style={styles.inputRow}>
            <TextInput style={styles.input} keyboardType="numeric" value={config.criticalMonthThreshold} onChangeText={(v) => setConfig({...config, criticalMonthThreshold: v})}/>
            <Text style={styles.unit}>Meses</Text>
          </View>
        </View>

        <Text style={[styles.sectionTitle, { marginTop: 20 }]}>Calendario de Ventas (Meses)</Text>
        <View style={styles.calendarCard}>
          {meses.map((mes, index) => (
            <View key={index} style={styles.monthRow}>
              <Text style={styles.monthLabel}>{mes}</Text>
              <TextInput 
                style={styles.monthInput}
                placeholder="Categoría..."
                value={config.seasonalMap?.[index] || 'Otros'}
                onChangeText={(v) => updateSeasonalMonth(index, v)}
              />
            </View>
          ))}
        </View>

        <TouchableOpacity style={styles.saveBtn} onPress={handleSaveConfig}>
          <Icon name="save" size={18} color="#FFF" />
          <Text style={styles.saveBtnText}>GUARDAR ESTRATEGIA</Text>
        </TouchableOpacity>

        <Text style={[styles.sectionTitle, { marginTop: 30 }]}>Diccionario Inteligente</Text>
        <View style={styles.addCategoryBox}>
          <TextInput style={styles.categoryInput} placeholder="Nueva categoría..." value={newCategoryName} onChangeText={setNewCategoryName}/>
          <TouchableOpacity style={styles.addCategoryBtn} onPress={handleAddCategory}><Icon name="plus" size={20} color="#FFF" /></TouchableOpacity>
        </View>

        {Object.keys(dictionary).map((cat) => (
          <View key={cat} style={styles.dictCard}>
            <View style={styles.dictHeader}>
              <Text style={styles.dictTitle}>{cat}</Text>
              <View style={{ flexDirection: 'row', gap: 15 }}>
                <TouchableOpacity onPress={() => setActiveCategory(activeCategory === cat ? null : cat)}>
                  <Icon name="plus-circle" size={20} color={activeCategory === cat ? "#FF6B35" : "#4EA8DE"} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleRemoveCategory(cat)}>
                  <Icon name="trash-2" size={20} color="#FF4D4D" />
                </TouchableOpacity>
              </View>
            </View>
            {activeCategory === cat && (
              <View style={styles.tagInputRow}>
                <TextInput style={styles.tagInput} placeholder="Añadir tag..." value={newTag} onChangeText={setNewTag} autoFocus onSubmitEditing={() => handleAddTag(cat)}/>
                <TouchableOpacity style={styles.tagAddBtn} onPress={() => handleAddTag(cat)}><Text style={styles.tagAddBtnText}>Add</Text></TouchableOpacity>
              </View>
            )}
            <View style={styles.tagCloud}>
              {dictionary[cat].map((tag) => (
                <View key={tag} style={styles.tag}>
                  <Text style={styles.tagText}>{tag}</Text>
                  <TouchableOpacity onPress={() => handleRemoveTag(cat, tag)}><Icon name="x" size={12} color="#999" /></TouchableOpacity>
                </View>
              ))}
            </View>
          </View>
        ))}
        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  header: { paddingHorizontal: 20, paddingTop: 60, paddingBottom: 20, flexDirection: 'row', alignItems: 'center', gap: 15, backgroundColor: '#FFF' },
  headerTitle: { fontSize: 22, fontWeight: '900', color: '#1A1A2E' },
  content: { padding: 20 },
  sectionTitle: { fontSize: 11, fontWeight: '900', color: '#BBB', letterSpacing: 1.5, marginBottom: 15, textTransform: 'uppercase' },
  settingCard: { backgroundColor: '#FFF', padding: 18, borderRadius: 22, marginBottom: 15, elevation: 1 },
  calendarCard: { backgroundColor: '#FFF', padding: 15, borderRadius: 22, marginBottom: 20, elevation: 1 },
  monthRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
  monthLabel: { flex: 1, fontSize: 14, fontWeight: '700', color: '#1A1A2E' },
  monthInput: { backgroundColor: '#F8F9FA', width: 140, padding: 8, borderRadius: 10, fontSize: 13, color: '#4EA8DE', fontWeight: 'bold', textAlign: 'right' },
  info: { marginBottom: 12 },
  label: { fontSize: 16, fontWeight: '800', color: '#1A1A2E' },
  desc: { fontSize: 11, color: '#999', marginTop: 4 },
  inputRow: { flexDirection: 'row', alignItems: 'center' },
  input: { backgroundColor: '#F8F9FA', width: 65, padding: 10, borderRadius: 12, textAlign: 'center', fontWeight: '900', color: '#1A1A2E', borderWidth: 1, borderColor: '#EEE' },
  unit: { marginLeft: 8, fontSize: 11, fontWeight: '700', color: '#666' },
  saveBtn: { backgroundColor: '#1A1A2E', flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10, padding: 18, borderRadius: 22 },
  saveBtnText: { color: '#FFF', fontWeight: '900', fontSize: 14 },
  addCategoryBox: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  categoryInput: { flex: 1, backgroundColor: '#FFF', padding: 15, borderRadius: 18, fontWeight: '700', color: '#1A1A2E' },
  addCategoryBtn: { backgroundColor: '#4EA8DE', width: 55, justifyContent: 'center', alignItems: 'center', borderRadius: 18 },
  dictCard: { backgroundColor: '#FFF', padding: 18, borderRadius: 22, marginBottom: 15 },
  dictHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  dictTitle: { fontSize: 17, fontWeight: '900', color: '#1A1A2E' },
  tagCloud: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tag: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F0F4F8', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, gap: 8 },
  tagText: { fontSize: 13, color: '#4EA8DE', fontWeight: '700' },
  tagInputRow: { flexDirection: 'row', gap: 10, marginBottom: 15, backgroundColor: '#F8F9FA', padding: 8, borderRadius: 15 },
  tagInput: { flex: 1, paddingHorizontal: 10 },
  tagAddBtn: { backgroundColor: '#1A1A2E', paddingHorizontal: 15, paddingVertical: 8, borderRadius: 10 },
  tagAddBtnText: { color: '#FFF', fontSize: 11, fontWeight: '900' }
});