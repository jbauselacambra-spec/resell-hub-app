import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, SafeAreaView, StyleSheet } from 'react-native';
import LogService from '../services/LogService';
import { Feather as Icon } from '@expo/vector-icons';

const DebugScreen = () => {
  const [logs, setLogs] = useState([]);

  useEffect(() => {
    setLogs([...LogService.logs]);
    return LogService.subscribe(newLogs => setLogs([...newLogs]));
  }, []);

  const renderItem = ({ item }) => (
    <View style={styles.logEntry}>
      <Text style={styles.logTime}>{item.time}</Text>
      <Text style={[styles.logText, styles[item.type]]}>{item.text}</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Logs del Sistema</Text>
        <TouchableOpacity onPress={() => LogService.clear()}>
          <Icon name="trash-2" size={20} color="#FF6B6B" />
        </TouchableOpacity>
      </View>
      
      <FlatList
        data={logs}
        renderItem={renderItem}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={<Text style={styles.empty}>No hay logs registrados todavía.</Text>}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#121212' }, // Estilo oscuro tipo terminal
  header: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    padding: 20, 
    borderBottomWidth: 1, 
    borderBottomColor: '#333' 
  },
  title: { color: '#FFF', fontSize: 18, fontWeight: 'bold' },
  list: { padding: 15 },
  logEntry: { marginBottom: 10, borderLeftWidth: 2, borderLeftColor: '#444', paddingLeft: 10 },
  logTime: { color: '#888', fontSize: 12, marginBottom: 2 },
  logText: { fontSize: 14, lineHeight: 20 },
  info: { color: '#EEE' },
  success: { color: '#4CAF50' },
  error: { color: '#FF5252' },
  empty: { color: '#666', textAlign: 'center', marginTop: 50 }
});

export default DebugScreen;