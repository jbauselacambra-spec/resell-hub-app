import React, { useState } from 'react';
import { View, Text, TextInput, ScrollView, TouchableOpacity, Image, StyleSheet, Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import LogService from '../services/LogService';

export default function ProductsScreen({ navigation }) {
  const [form, setForm] = useState({ title: '', description: '', price: '', category: '' });
  const [images, setImages] = useState([]);

  const pickImage = async (fromCamera = false) => {
    LogService.info(`Accediendo a ${fromCamera ? 'cámara' : 'galería'}`);
    
    const permission = fromCamera 
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      LogService.error("Permiso denegado");
      return;
    }

    const result = fromCamera 
      ? await ImagePicker.launchCameraAsync({ quality: 0.7 })
      : await ImagePicker.launchImageLibraryAsync({ 
          allowsMultipleSelection: true, 
          selectionLimit: 5, 
          quality: 0.7 
        });

    if (!result.canceled) {
      const uris = result.assets.map(a => a.uri);
      setImages([...images, ...uris]);
      LogService.success(`Imágenes añadidas: ${uris.length}`);
    }
  };

  const handlePublish = () => {
    // 1. Lógica SEO
    const keywords = form.title.toLowerCase().split(' ').filter(w => w.length > 2);
    const tags = [...new Set([...keywords, form.category])].join(', ');
    
    const newProduct = {
      ...form,
      images,
      tags,
      id: Date.now().toString()
    };

    LogService.success(`Producto publicado: ${form.title}`);
    
    // 2. Navegar al detalle pasando el objeto product
    navigation.navigate('ProductDetail', { product: newProduct });

    navigation.navigate('Home');
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Nuevo Producto</Text>
      
      <View style={styles.photoRow}>
        <TouchableOpacity style={styles.btnPhoto} onPress={() => pickImage(true)}>
          <Text>Cámara</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.btnPhoto} onPress={() => pickImage(false)}>
          <Text>Galería</Text>
        </TouchableOpacity>
      </View>

      <ScrollView horizontal style={{ marginBottom: 20 }}>
        {images.map((uri, i) => (
          <Image key={i} source={{ uri }} style={styles.preview} />
        ))}
      </ScrollView>

      <TextInput placeholder="Título" style={styles.input} onChangeText={t => setForm({...form, title: t})} />
      <TextInput placeholder="Descripción" multiline style={[styles.input, {height: 60}]} onChangeText={t => setForm({...form, description: t})} />
      <TextInput placeholder="Precio (€)" keyboardType="numeric" style={styles.input} onChangeText={t => setForm({...form, price: t})} />
      <TextInput placeholder="Categoría (SEO)" style={styles.input} onChangeText={t => setForm({...form, category: t})} />

      <TouchableOpacity style={styles.btnSubmit} onPress={handlePublish}>
        <Text style={styles.btnText}>Publicar</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#fff' },
  title: { fontSize: 22, fontWeight: 'bold', marginBottom: 20 },
  photoRow: { flexDirection: 'row', gap: 10, marginBottom: 15 },
  btnPhoto: { flex: 1, backgroundColor: '#eee', padding: 15, borderRadius: 10, alignItems: 'center' },
  preview: { width: 80, height: 80, borderRadius: 10, marginRight: 10 },
  input: { borderBottomWidth: 1, borderColor: '#ddd', marginBottom: 15, padding: 10 },
  btnSubmit: { backgroundColor: '#FF6B35', padding: 18, borderRadius: 12, alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: 'bold' }
});