import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity } from 'react-native';
import LogService from '../services/LogService';

export default function LogsScreen() {
  const [logs, setLogs] = useState([]);

  useEffect(() => {
    const i = setInterval(() => setLogs(LogService.getLogs()), 1500);
    return () => clearInterval(i);
  }, []);

  return (
    <View style={styles.container}>
      <TouchableOpacity onPress={() => LogService.clear()} style={styles.clearBtn}>
        <Text style={{color: 'white'}}>Limpiar Logs</Text>
      </TouchableOpacity>
      <FlatList
        data={logs}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <View style={styles.item}>
            <Text style={styles.time}>{item.timestamp}</Text>
            <Text style={[styles.msg, { color: item.type === 'error' ? 'red' : item.type === 'success' ? '#00C851' : '#33b5e5' }]}>
              {item.message}
            </Text>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000', padding: 10 },
  clearBtn: { backgroundColor: '#333', padding: 10, borderRadius: 5, marginBottom: 10, alignItems: 'center' },
  item: { paddingVertical: 5, borderBottomWidth: 0.5, borderBottomColor: '#222' },
  time: { color: '#666', fontSize: 10 },
  msg: { fontSize: 12, fontFamily: 'monospace' }
});