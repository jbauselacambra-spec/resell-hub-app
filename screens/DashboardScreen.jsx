import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Feather';
import { DatabaseService } from '../services/DatabaseService';

const COLORS = {
  primary: '#FF6B35',
  secondary: '#1A1A2E',
  background: '#F8F9FA',
  card: '#FFFFFF',
  textMuted: '#666',
  success: '#00D9A3',
};

const DashboardScreen = () => {
  const insets = useSafeAreaInsets();
  const [stats, setStats] = useState({ sold: 0, revenue: '0.00' });

  useEffect(() => {
    setStats(DatabaseService.getStats());
  }, []);

 return (
  <View style={[styles.container, { paddingTop: insets.top || 40, flex: 1 }]}> 
    <View style={styles.header}>
      {/* Añadimos una prueba visual directa */}
      <Text style={{color: 'red', fontWeight: 'bold'}}>DEBUG: App Cargada</Text>
      <Text style={styles.headerTitle}>ResellHub <Text style={{color: COLORS.primary}}>v1.0</Text></Text>
    </View>
    {/* ... resto del código ... */}
  </View>
);
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { paddingHorizontal: 25, paddingVertical: 20 },
  headerTitle: { fontSize: 26, fontWeight: '800', color: COLORS.secondary },
  statsCard: { marginHorizontal: 25, backgroundColor: COLORS.card, borderRadius: 24, padding: 25, elevation: 8 },
  statsLabel: { color: COLORS.textMuted, fontSize: 12, fontWeight: 'bold' },
  statsValue: { fontSize: 44, fontWeight: '900', color: COLORS.primary, marginVertical: 8 },
  divider: { height: 1, backgroundColor: '#F0F0F0', marginVertical: 15 },
  statsSubtext: { marginLeft: 10, fontSize: 14, color: COLORS.textMuted },
});

export default DashboardScreen;