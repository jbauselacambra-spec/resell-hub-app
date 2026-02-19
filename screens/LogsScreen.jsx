import React, { useState, useEffect } from 'react';
import { 
  View, Text, FlatList, StyleSheet, TouchableOpacity, 
  TextInput, Alert, Clipboard, KeyboardAvoidingView, Platform 
} from 'react-native';
// REVISA QUE ESTAS RUTAS SEAN LAS CORRECTAS EN TU PROYECTO
import LogService from '../services/LogService'; 
import { DatabaseService } from '../services/DatabaseService';

export default function LogsScreen() {
  const [logs, setLogs] = useState([]);
  const [jsonInput, setJsonInput] = useState('');
  
  const scriptConsola = `(function(){
    const items = document.querySelectorAll('[data-testid^="product-item-id-"]');
    const products = Array.from(items).map(c => ({
      id: "vinted_" + (c.getAttribute('data-testid')?.split('-').pop() || Math.random()),
      title: c.querySelector('img')?.alt?.split(',')[0] || "Producto",
      price: parseFloat(c.innerText.match(/(\d+[,.]\d+)/)?.[0]?.replace(',', '.') || 0),
      status: 'available',
      createdAt: new Date().toISOString()
    }));
    console.log(JSON.stringify(products));
    copy(JSON.stringify(products));
    alert('Copiados ' + products.length + ' productos');
  })();`;

  useEffect(() => {
    const updateLogs = () => setLogs(LogService.getLogs());
    updateLogs();
    const i = setInterval(updateLogs, 2000);
    return () => clearInterval(i);
  }, []);

  const handleImport = async () => {
    if (!jsonInput.trim()) return Alert.alert("Error", "Pega el JSON");
    try {
      const data = JSON.parse(jsonInput);
      const result = await DatabaseService.importFromVinted(Array.isArray(data) ? data : [data]);
      if (result.success) {
        setJsonInput('');
        Alert.alert("Éxito", `Importados: ${result.count}`);
      }
    } catch (e) {
      Alert.alert("Error", "JSON inválido");
    }
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
          multiline
          value={jsonInput}
          onChangeText={setJsonInput}
        />

        <TouchableOpacity style={styles.importBtn} onPress={handleImport}>
          <Text style={styles.importBtnText}>CARGAR PRODUCTOS</Text>
        </TouchableOpacity>
      </View>

      <View style={{flex: 1}}>
        <View style={styles.logHeader}>
          <Text style={styles.sectionTitle}>LOGS DEL SISTEMA</Text>
          <TouchableOpacity onPress={() => { LogService.clear(); setLogs([]); }}>
            <Text style={{color: '#FF4D4D', fontWeight: 'bold'}}>LIMPIAR</Text>
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
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000', padding: 15, paddingTop: 50 },
  importBox: { backgroundColor: '#111', padding: 20, borderRadius: 20, marginBottom: 20 },
  sectionTitle: { color: '#666', fontSize: 10, fontWeight: 'bold', marginBottom: 10, letterSpacing: 1 },
  scriptBtn: { backgroundColor: '#222', padding: 10, borderRadius: 10, marginBottom: 10, alignItems: 'center' },
  scriptBtnText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
  input: { backgroundColor: '#000', color: '#00C851', borderRadius: 10, padding: 10, height: 100, textAlignVertical: 'top' },
  importBtn: { backgroundColor: '#00C851', padding: 15, borderRadius: 10, marginTop: 10, alignItems: 'center' },
  importBtnText: { color: '#000', fontWeight: 'bold' },
  logHeader: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 5, marginBottom: 10 },
  item: { paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#111' },
  time: { color: '#444', fontSize: 9 },
  msg: { fontSize: 12, fontWeight: '500' }
});