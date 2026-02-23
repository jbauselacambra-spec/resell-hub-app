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
    daysDesinterest: '45', // <--- Ajuste de Falta de Interés
    daysCritical: '90'
  });

  const [dictionary, setDictionary] = useState({});
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newTag, setNewTag] = useState('');
  const [activeCategory, setActiveCategory] = useState(null);

  useEffect(() => {
    const savedConfig = DatabaseService.getConfig();
    const savedDict = DatabaseService.getDictionary();
    if (savedConfig) setConfig(savedConfig);
    if (savedDict) setDictionary(savedDict);
  }, []);

  const handleSaveAlerts = () => {
    const success = DatabaseService.saveConfig(config);
    if (success) Alert.alert("Éxito", "Tiempos de diagnóstico actualizados.");
  };

  // Lógica de Diccionario
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
    Alert.alert(
      "Eliminar Categoría",
      `¿Borrar "${category}" y todas sus etiquetas?`,
      [
        { text: "Cancelar", style: "cancel" },
        { text: "Eliminar", style: "destructive", onPress: () => {
          const updatedDict = { ...dictionary };
          delete updatedDict[category];
          saveUpdatedDict(updatedDict);
        }}
      ]
    );
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

      <ScrollView style={styles.content}>
        <Text style={styles.sectionTitle}>Umbrales de Diagnóstico</Text>
        
        {/* 1. Producto Invisible */}
        <View style={styles.settingCard}>
          <View style={styles.info}>
            <Text style={styles.label}>Producto Invisible</Text>
            <Text style={styles.desc}>Días transcurridos con menos de X vistas.</Text>
          </View>
          <View style={styles.inputRow}>
            <TextInput style={styles.input} keyboardType="numeric" value={config.daysInvisible} onChangeText={(v) => setConfig({...config, daysInvisible: v})}/>
            <Text style={styles.unit}>Días</Text>
            <TextInput style={[styles.input, {marginLeft: 10}]} keyboardType="numeric" value={config.viewsInvisible} onChangeText={(v) => setConfig({...config, viewsInvisible: v})}/>
            <Text style={styles.unit}>Vistas</Text>
          </View>
        </View>

        {/* 2. Falta de Interés (NUEVO BLOQUE AÑADIDO) */}
        <View style={styles.settingCard}>
          <View style={styles.info}>
            <Text style={styles.label}>Falta de Interés</Text>
            <Text style={styles.desc}>Días con vistas pero con 0 favoritos.</Text>
          </View>
          <View style={styles.inputRow}>
            <TextInput style={styles.input} keyboardType="numeric" value={config.daysDesinterest} onChangeText={(v) => setConfig({...config, daysDesinterest: v})}/>
            <Text style={styles.unit}>Días</Text>
          </View>
        </View>

        {/* 3. Estado Crítico */}
        <View style={styles.settingCard}>
          <View style={styles.info}>
            <Text style={styles.label}>Estado Crítico</Text>
            <Text style={styles.desc}>Días máximos recomendados antes de resubir.</Text>
          </View>
          <View style={styles.inputRow}>
            <TextInput style={styles.input} keyboardType="numeric" value={config.daysCritical} onChangeText={(v) => setConfig({...config, daysCritical: v})}/>
            <Text style={styles.unit}>Días</Text>
          </View>
        </View>

        <TouchableOpacity style={styles.saveBtn} onPress={handleSaveAlerts}>
          <Icon name="save" size={18} color="#FFF" />
          <Text style={styles.saveBtnText}>GUARDAR TIEMPOS</Text>
        </TouchableOpacity>

        {/* GESTIÓN DE CATEGORÍAS */}
        <Text style={[styles.sectionTitle, { marginTop: 30 }]}>Diccionario Inteligente</Text>
        
        <View style={styles.addCategoryBox}>
          <TextInput 
            style={styles.categoryInput}
            placeholder="Nueva categoría..."
            value={newCategoryName}
            onChangeText={setNewCategoryName}
          />
          <TouchableOpacity style={styles.addCategoryBtn} onPress={handleAddCategory}>
            <Icon name="plus" size={20} color="#FFF" />
          </TouchableOpacity>
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
                <TouchableOpacity style={styles.tagAddBtn} onPress={() => handleAddTag(cat)}><Text style={styles.tagAddBtnText}>Añadir</Text></TouchableOpacity>
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
  sectionTitle: { fontSize: 12, fontWeight: '900', color: '#BBB', letterSpacing: 1.5, marginBottom: 15, textTransform: 'uppercase' },
  settingCard: { backgroundColor: '#FFF', padding: 18, borderRadius: 22, marginBottom: 15, elevation: 1 },
  info: { marginBottom: 15 },
  label: { fontSize: 16, fontWeight: '800', color: '#1A1A2E' },
  desc: { fontSize: 12, color: '#999', marginTop: 4 },
  inputRow: { flexDirection: 'row', alignItems: 'center' },
  input: { backgroundColor: '#F8F9FA', width: 60, padding: 10, borderRadius: 12, textAlign: 'center', fontWeight: '900', color: '#1A1A2E', borderWidth: 1, borderColor: '#EEE' },
  unit: { marginLeft: 8, fontSize: 11, fontWeight: '700', color: '#666' },
  saveBtn: { backgroundColor: '#1A1A2E', flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10, padding: 15, borderRadius: 18 },
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
  tagInput: { flex: 1, paddingHorizontal: 10, fontWeight: '600' },
  tagAddBtn: { backgroundColor: '#1A1A2E', paddingHorizontal: 15, paddingVertical: 8, borderRadius: 10 },
  tagAddBtnText: { color: '#FFF', fontSize: 12, fontWeight: '900' }
});