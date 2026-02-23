import React, { useState, useEffect } from 'react';
import { 
  View, Text, FlatList, StyleSheet, TouchableOpacity, 
  TextInput, Alert, Clipboard, KeyboardAvoidingView, Platform 
} from 'react-native';
import LogService from '../services/LogService'; 
import { DatabaseService } from '../services/DatabaseService';

export default function LogsScreen() {
  const [logs, setLogs] = useState([]);
  const [jsonInput, setJsonInput] = useState('');
  const [newKeyword, setNewKeyword] = useState('');
  const [selectedCat, setSelectedCat] = useState('Juguetes');
  const categories = ['Juguetes', 'Abrigo', 'Lotes', 'Calzado', 'Otros'];

  const scriptConsola = `(function(){
    const items = document.querySelectorAll('[data-testid^="product-item-id-"]');
    const products = Array.from(items).map((container) => {
      const img = container.querySelector('img');
      const idAttr = container.getAttribute('data-testid');
      if (!img || !idAttr || idAttr.includes('image')) return null;
      const vintedId = idAttr.replace('product-item-id-', '');
      const rawAlt = img.alt || ""; 
      const title = rawAlt.split(',')[0] || "Producto";
      const isSold = container.innerText.toLowerCase().includes('vendido');
      return {
        id: "vinted_" + vintedId,
        title: title.trim(),
        description: title.trim(),
        price: parseFloat(container.innerText.match(/(\\d+[,.]\\d+)/)?.[0].replace(',','.')) || 0,
        status: isSold ? 'sold' : 'available',
        images: [img.src],
        soldDate: isSold ? new Date().toISOString().split('T')[0] : null,
        createdAt: new Date().toISOString()
      };
    }).filter(p => p !== null);
    copy(JSON.stringify(products));
    alert('✅ JSON Copiado con éxito');
  })();`;

  useEffect(() => {
    const updateLogs = () => setLogs(LogService.getLogs());
    const i = setInterval(updateLogs, 2000);
    return () => clearInterval(i);
  }, []);

  const handleLearn = () => {
    if (!newKeyword.trim()) return;
    DatabaseService.addKeywordToDictionary(selectedCat, newKeyword);
    setNewKeyword('');
    Alert.alert("Éxito", `"${newKeyword}" ahora se asocia a ${selectedCat}`);
  };

  const handleClearDB = () => {
    Alert.alert("🔥 Borrar Todo", "¿Estás seguro?", [
      { text: "No" },
      { text: "Sí, borrar", style: "destructive", onPress: () => DatabaseService.clearDatabase() }
    ]);
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.container}>
      <View style={styles.importBox}>
        <Text style={styles.sectionTitle}>IMPORTADOR VINTED</Text>
        <TouchableOpacity style={styles.scriptBtn} onPress={() => {
          Clipboard.setString(scriptConsola);
          Alert.alert("Copiado", "Pégalo en la consola de Vinted");
        }}>
          <Text style={styles.scriptBtnText}>📋 COPIAR SCRIPT</Text>
        </TouchableOpacity>
        <TextInput
          style={styles.input}
          placeholder="Pega el JSON aquí..."
          placeholderTextColor="#444"
          multiline value={jsonInput}
          onChangeText={setJsonInput}
        />
        <TouchableOpacity style={styles.importBtn} onPress={() => DatabaseService.importFromVinted(JSON.parse(jsonInput))}>
          <Text style={styles.importBtnText}>CARGAR PRODUCTOS</Text>
        </TouchableOpacity>
        
        {/* SECCIÓN DE ENTRENAMIENTO */}
        <View style={styles.learnSection}>
          <Text style={styles.sectionTitle}>ENTRENAR IA</Text>
          <View style={styles.catRow}>
            {categories.map(c => (
              <TouchableOpacity key={c} onPress={() => setSelectedCat(c)} 
                style={[styles.miniBadge, selectedCat === c && {backgroundColor: '#00C851'}]}>
                <Text style={{fontSize: 9, color: selectedCat === c ? '#000' : '#666'}}>{c}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={{flexDirection: 'row', gap: 5, marginTop: 5}}>
            <TextInput style={[styles.input, {flex:1, height: 40}]} placeholder="Palabra clave..." 
              placeholderTextColor="#333" value={newKeyword} onChangeText={setNewKeyword}/>
            <TouchableOpacity style={styles.learnBtn} onPress={handleLearn}>
              <Text style={{fontWeight: 'bold', fontSize: 10}}>+ APRENDER</Text>
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity style={{marginTop: 15, alignSelf: 'center'}} onPress={handleClearDB}>
          <Text style={{color: '#444', fontSize: 10, textDecorationLine: 'underline'}}>RESETEAR BASE DE DATOS</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={logs}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <View style={styles.item}>
            <Text style={styles.time}>{item.timestamp}</Text>
            <Text style={[styles.msg, { color: item.type === 'error' ? '#FF4D4D' : item.type === 'success' ? '#00C851' : '#33b5e5' }]}>
              {item.message}
            </Text>
          </View>
        )}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000', padding: 15, paddingTop: 50 },
  importBox: { backgroundColor: '#111', padding: 20, borderRadius: 20, marginBottom: 20 },
  sectionTitle: { color: '#666', fontSize: 10, fontWeight: 'bold', marginBottom: 10 },
  scriptBtn: { backgroundColor: '#222', padding: 10, borderRadius: 10, marginBottom: 10, alignItems: 'center' },
  scriptBtnText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
  input: { backgroundColor: '#000', color: '#00C851', borderRadius: 10, padding: 10, height: 80, textAlignVertical: 'top' },
  importBtn: { backgroundColor: '#00C851', padding: 15, borderRadius: 10, marginTop: 10, alignItems: 'center' },
  importBtnText: { color: '#000', fontWeight: 'bold' },
  item: { paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#111' },
  time: { color: '#444', fontSize: 9 },
  msg: { fontSize: 12, fontWeight: '500' },
  learnSection: { marginTop: 20, borderTopWidth: 1, borderTopColor: '#222', paddingTop: 15 },
  catRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  miniBadge: { padding: 5, borderRadius: 5, backgroundColor: '#222' },
  learnBtn: { backgroundColor: '#33b5e5', paddingHorizontal: 15, borderRadius: 10, justifyContent: 'center' }
});