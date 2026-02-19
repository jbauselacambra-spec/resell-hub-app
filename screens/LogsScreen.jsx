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
  
  // Script restaurado con los selectores exactos de Vinted para visitas/favoritos
  const scriptConsola = `(function(){
  const items = document.querySelectorAll('[data-testid^="product-item-id-"][data-testid$="--container"], .new-item-box__container');
  
  const products = Array.from(items).map((container) => {
    const img = container.querySelector('img');
    if (!img) return null;

    const rawAlt = img.alt || ""; 
    const parts = rawAlt.split(', ');
    
    const vintedId = container.getAttribute('data-testid')?.replace('product-item-id-', '') || Math.random();
    
    // Selectores originales que sí capturaban los datos
    const visitsText = container.querySelector('[data-testid*="--description-title"]')?.innerText || "0 visitas";
    const favsText = container.querySelector('[data-testid*="--description-subtitle"]')?.innerText || "0 favoritos";
    
    const views = parseInt(visitsText.replace(/[^0-9]/g, '')) || 0;
    const favorites = parseInt(favsText.replace(/[^0-9]/g, '')) || 0;

    const statusText = container.querySelector('[data-testid*="--status-text"]')?.innerText || "";
    const isSold = statusText.toLowerCase().includes('vendido');

    let title = parts[0] || "Producto";
    let brand = "Genérico";
    let price = 0;

    parts.forEach(part => {
      if (part.toLowerCase().includes('marca:')) brand = part.replace(/marca: /i, '');
      if (part.includes('€')) {
        const val = part.replace(/[^0-9,.]/g, '').replace(',', '.');
        price = parseFloat(val);
      }
    });

    return {
      id: "vinted_" + vintedId,
      title: title.trim(),
      brand: brand.trim(),
      price: isNaN(price) ? 0 : price,
      description: title.trim(),
      images: [img.src],
      status: isSold ? 'sold' : 'available',
      views: views,
      favorites: favorites,
      soldDate: isSold ? new Date().toISOString().split('T')[0] : null,
      createdAt: new Date().toISOString()
    };
  }).filter(p => p !== null);

  const uniqueProducts = Array.from(new Map(products.map(p => [p.id, p])).values());
  console.log(JSON.stringify(uniqueProducts, null, 2));
  copy(JSON.stringify(uniqueProducts, null, 2));
  alert('✅ ' + uniqueProducts.length + ' productos copiados con estadísticas.');
})();`;

  useEffect(() => {
    const updateLogs = () => setLogs(LogService.getLogs());
    updateLogs();
    const i = setInterval(updateLogs, 2000);
    return () => clearInterval(i);
  }, []);

  const handleImport = async () => {
    if (!jsonInput.trim()) return Alert.alert("Aviso", "Pega el JSON primero");
    try {
      const data = JSON.parse(jsonInput);
      const result = await DatabaseService.importFromVinted(Array.isArray(data) ? data : [data]);
      if (result.success) {
        setJsonInput('');
        Alert.alert("Éxito", `Procesados: ${Array.isArray(data) ? data.length : 1} productos.`);
      }
    } catch (e) {
      Alert.alert("Error de Formato", "Asegúrate de copiar el bloque completo de la consola.");
    }
  };

  const handleClearDatabase = () => {
    Alert.alert(
      "🔥 Borrar Todo",
      "¿Eliminar todos los productos?",
      [
        { text: "No", style: "cancel" },
        { 
          text: "Sí, borrar", 
          style: "destructive", 
          onPress: async () => {
            await DatabaseService.clearDatabase();
            LogService.add("Base de datos reseteada", "info");
            setLogs(LogService.getLogs());
          } 
        }
      ]
    );
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.container}>
      <View style={styles.importBox}>
        <Text style={styles.sectionTitle}>EXTRACTOR VINTED</Text>
        <TouchableOpacity style={styles.scriptBtn} onPress={() => {
          Clipboard.setString(scriptConsola);
          Alert.alert("🚀 Script Copiado", "Pégalo en la consola de Vinted.");
        }}>
          <Text style={styles.scriptBtnText}>📋 COPIAR SCRIPT (CON ESTADÍSTICAS)</Text>
        </TouchableOpacity>
        
        <TextInput
          style={styles.input}
          placeholder="Pega el JSON aquí..."
          placeholderTextColor="#444"
          multiline
          value={jsonInput}
          onChangeText={setJsonInput}
          autoCorrect={false}
        />

        <TouchableOpacity style={styles.importBtn} onPress={handleImport}>
          <Text style={styles.importBtnText}>CARGAR PRODUCTOS</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.clearDbBtn} onPress={handleClearDatabase}>
          <Text style={styles.clearDbText}>RESETEAR BASE DE DATOS</Text>
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
  importBox: { backgroundColor: '#111', padding: 20, borderRadius: 20, marginBottom: 20, borderWidth: 1, borderColor: '#222' },
  sectionTitle: { color: '#666', fontSize: 10, fontWeight: 'bold', marginBottom: 10, letterSpacing: 1 },
  scriptBtn: { backgroundColor: '#222', padding: 12, borderRadius: 12, marginBottom: 12, alignItems: 'center' },
  scriptBtnText: { color: '#fff', fontSize: 11, fontWeight: 'bold' },
  input: { backgroundColor: '#000', color: '#00C851', borderRadius: 12, padding: 12, height: 100, textAlignVertical: 'top', fontSize: 12 },
  importBtn: { backgroundColor: '#00C851', padding: 15, borderRadius: 12, marginTop: 12, alignItems: 'center' },
  importBtnText: { color: '#000', fontWeight: 'bold' },
  clearDbBtn: { marginTop: 15, alignSelf: 'center' },
  clearDbText: { color: '#444', fontSize: 10, fontWeight: 'bold', textDecorationLine: 'underline' },
  logHeader: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 5, marginBottom: 10 },
  item: { paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#111' },
  time: { color: '#444', fontSize: 9 },
  msg: { fontSize: 12, fontWeight: '500' }
});