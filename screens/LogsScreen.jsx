import React, { useState, useEffect } from 'react';
import { 
  View, Text, StyleSheet, TouchableOpacity, 
  TextInput, Alert, KeyboardAvoidingView, Platform, ScrollView
} from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import LogService from '../services/LogService'; 
import { DatabaseService } from '../services/DatabaseService';
import { MMKV } from 'react-native-mmkv';

// Creamos una instancia fuera para que sea accesible en toda la pantalla
const backupStorage = new MMKV();

export default function LogsScreen() {
  const [logs, setLogs] = useState([]);
  const [jsonInput, setJsonInput] = useState('');

  useEffect(() => {
    setLogs(LogService.getLogs());
  }, []);

const handleImport = () => {
    try {
      if (!jsonInput.trim()) return;
      let data = JSON.parse(jsonInput);

      // CORRECCIÓN: Asegurar que cada producto tenga fechas para estadísticas
      const processedData = data.map(p => ({
        ...p,
        // Si no tiene fecha de creación, le ponemos la de ahora
        createdAt: p.createdAt || new Date().toISOString(),
        // Si está vendido pero no tiene fecha de venta, le ponemos ahora para que aparezca en stats
        soldAt: p.status === 'sold' && !p.soldAt ? new Date().toISOString() : p.soldAt,
        soldDate: p.status === 'sold' && !p.soldDate ? new Date().toISOString() : p.soldDate,
        // Asegurar que el precio sea un número para que sume en los KPIs
        price: Number(p.price) || 0,
        soldPrice: p.status === 'sold' ? (Number(p.soldPrice) || Number(p.price) || 0) : null
      }));

      const success = DatabaseService.saveProducts(processedData);
      if (success) {
        Alert.alert("Éxito", "Inventario sincronizado. Las estadísticas se han actualizado.");
        setJsonInput('');
        setLogs(LogService.getLogs());
      }
    } catch (e) {
      Alert.alert("Error", "El formato JSON no es válido.");
      LogService.add("Error de importación JSON", "error");
    }
  };

  const handleRecoverBackup = () => {
    try {
      const backupRaw = backupStorage.getString('emergency_backup');
      
      if (backupRaw) {
        // Limpiamos un poco el JSON para asegurar que sea compatible
        const parsed = JSON.parse(backupRaw);
        setJsonInput(JSON.stringify(parsed, null, 2)); // Lo ponemos bonito en el input
        Alert.alert("Copia encontrada", "Se ha cargado el respaldo completo con historial.");
      } else {
        Alert.alert("Sin copia", "No hay respaldos físicos guardados.");
      }
    } catch (e) {
      Alert.alert("Error", "No se pudo acceder al respaldo.");
    }
  };

  const handleResetDatabase = () => {
    Alert.alert(
      "⚠️ Acción Crítica",
      "Vas a borrar todo. Se guardará una copia física antes.",
      [
        { text: "Cancelar", style: "cancel" },
        { 
          text: "Resetear y Respaldar", 
          style: "destructive", 
          onPress: () => {
            try {
              // 1. Obtener datos (Ahora funcionará porque DatabaseService tiene static)
              const currentData = DatabaseService.getAllProducts() || [];
              
              // 2. Guardar backup
              backupStorage.set('emergency_backup', JSON.stringify(currentData));
              
              // 3. Limpiar base de datos
              DatabaseService.saveProducts([]);
              
              LogService.add("Reset completado. Backup físico OK.", "info");
              setLogs(LogService.getLogs());
              Alert.alert("Hecho", "Todo borrado.");
            } catch (error) {
              LogService.add("ERROR: Fallo en backup", "error");
            }
          } 
        }
      ]
    );
  };

  const copyScript = () => {
    Alert.alert("Script", "Copia el script de la consola para extraer tus productos.");
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerSubtitle}>SISTEMA Y MANTENIMIENTO</Text>
        <Text style={styles.headerTitle}>Consola de Control</Text>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Icon name="download" size={18} color="#4EA8DE" />
            <Text style={styles.cardTitle}>Importar Datos</Text>
          </View>
          
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <TouchableOpacity style={styles.scriptBtn} onPress={copyScript}>
              <Icon name="code" size={14} color="#FFF" />
              <Text style={styles.scriptBtnText}>Script</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.scriptBtn, { backgroundColor: '#FF6B35' }]} onPress={handleRecoverBackup}>
              <Icon name="rotate-ccw" size={14} color="#FFF" />
              <Text style={styles.scriptBtnText}>Recuperar Backup</Text>
            </TouchableOpacity>
          </View>

          <TextInput
            style={styles.input}
            placeholder="Pega el JSON aquí..."
            placeholderTextColor="#BBB"
            multiline
            value={jsonInput}
            onChangeText={setJsonInput}
          />

          <TouchableOpacity style={styles.importBtn} onPress={handleImport}>
            <Text style={styles.importBtnText}>Sincronizar Inventario</Text>
          </TouchableOpacity>
        </View>

        <View style={[styles.card, { borderColor: '#FF4D4D22', borderWidth: 1 }]}>
          <View style={styles.cardHeader}>
            <Icon name="database" size={18} color="#FF4D4D" />
            <Text style={[styles.cardTitle, { color: '#FF4D4D' }]}>Zona de Peligro</Text>
          </View>
          <Text style={styles.cardDesc}>Borra todo el contenido. Se creará una copia de seguridad interna antes de proceder.</Text>
          <TouchableOpacity style={styles.resetBtn} onPress={handleResetDatabase}>
            <Icon name="trash-2" size={14} color="#FF4D4D" />
            <Text style={styles.resetBtnText}>RESETEAR BASE DE DATOS</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionTitle}>Historial del Sistema</Text>
        <View style={styles.logsContainer}>
          {logs.map((item, index) => (
            <View key={index} style={styles.logItem}>
              <View style={[styles.logDot, { backgroundColor: item.type === 'error' ? '#FF4D4D' : '#00D9A3' }]} />
              <View style={{ flex: 1 }}>
                <Text style={styles.logTime}>{new Date().toLocaleTimeString()}</Text>
                <Text style={styles.logMessage} numberOfLines={2}>{item.message}</Text>
              </View>
            </View>
          ))}
        </View>
        <View style={{ height: 50 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  header: { paddingHorizontal: 25, paddingTop: 60, paddingBottom: 20 },
  headerSubtitle: { color: '#FF6B35', fontSize: 10, fontWeight: '900', letterSpacing: 2 },
  headerTitle: { fontSize: 26, fontWeight: '900', color: '#1A1A2E' },
  content: { paddingHorizontal: 20 },
  card: { backgroundColor: '#FFF', padding: 20, borderRadius: 25, marginBottom: 20, elevation: 2 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 15 },
  cardTitle: { fontSize: 16, fontWeight: '900', color: '#1A1A2E' },
  cardDesc: { fontSize: 12, color: '#999', marginBottom: 15, lineHeight: 18 },
  scriptBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#4EA8DE', padding: 12, borderRadius: 12, marginBottom: 15, alignSelf: 'flex-start' },
  scriptBtnText: { color: '#FFF', fontSize: 11, fontWeight: '800' },
  input: { backgroundColor: '#F8F9FA', borderRadius: 15, padding: 15, height: 120, textAlignVertical: 'top', color: '#1A1A2E', fontSize: 12, borderWidth: 1, borderColor: '#EEE' },
  importBtn: { backgroundColor: '#1A1A2E', padding: 18, borderRadius: 18, marginTop: 15, alignItems: 'center' },
  importBtnText: { color: '#FFF', fontWeight: '900', fontSize: 14 },
  resetBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 15, borderRadius: 15, borderWidth: 1, borderColor: '#FF4D4D' },
  resetBtnText: { color: '#FF4D4D', fontWeight: '900', fontSize: 12 },
  sectionTitle: { fontSize: 12, fontWeight: '900', color: '#BBB', letterSpacing: 1.5, marginBottom: 15, marginLeft: 5, textTransform: 'uppercase' },
  logsContainer: { backgroundColor: '#1A1A2E', borderRadius: 25, padding: 15, marginBottom: 20 },
  logItem: { flexDirection: 'row', gap: 12, marginBottom: 15, alignItems: 'flex-start' },
  logDot: { width: 6, height: 6, borderRadius: 3, marginTop: 6 },
  logTime: { color: '#555', fontSize: 9, fontWeight: 'bold' },
  logMessage: { color: '#EEE', fontSize: 11, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },
});