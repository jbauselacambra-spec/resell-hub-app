import { MMKV } from 'react-native-mmkv';
import LogService from './LogService';

let storage;
try {
  storage = new MMKV();
  LogService.add("✅ MMKV conectado correctamente");
} catch (e) {
  LogService.add("⚠️ MMKV falló. Usando memoria temporal.");
  const backupStorage = new Map();
  storage = {
    getString: (key) => backupStorage.get(key),
    set: (key, value) => backupStorage.set(key, value),
    delete: (key) => backupStorage.delete(key),
    contains: (key) => backupStorage.has(key),
  };
}

export class DatabaseService {
  static KEYS = {
    PRODUCTS: 'products',
    STATS: 'stats'
  };

  static getAllProducts() {
    try {
      const data = storage.getString(this.KEYS.PRODUCTS);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      return [];
    }
  }

  static saveProduct(product) {
    try {
      const products = this.getAllProducts();
      const newProduct = {
        ...product,
        id: product.id || Date.now().toString(),
        createdAt: new Date().toISOString(),
        status: product.status || 'active'
      };

      products.push(newProduct);
      storage.set(this.KEYS.PRODUCTS, JSON.stringify(products));
      LogService.add(`✅ Producto guardado: ${newProduct.id}`);
      return newProduct;
    } catch (e) {
      LogService.add("❌ Error guardando: " + e.message);
      return null;
    }
  }

  // --- NUEVA FUNCIÓN: ACTUALIZAR ---
  static updateProduct(updatedProduct) {
    try {
      const products = this.getAllProducts();
      const index = products.findIndex(p => p.id === updatedProduct.id);
      
      if (index !== -1) {
        products[index] = { ...products[index], ...updatedProduct };
        storage.set(this.KEYS.PRODUCTS, JSON.stringify(products));
        LogService.add(`✅ Producto actualizado: ${updatedProduct.id}`);
        return true;
      }
      return false;
    } catch (e) {
      LogService.add("❌ Error actualizando: " + e.message);
      return false;
    }
  }

static markAsSold(id, soldPrice) {
  try {
    const products = this.getAllProducts();
    const index = products.findIndex(p => p.id === id);
    if (index !== -1) {
      products[index] = {
        ...products[index],
        status: 'sold', // Cambio de estado fundamental
        soldPrice: parseFloat(soldPrice) || 0,
        soldAt: new Date().toISOString()
      };
      storage.set(this.KEYS.PRODUCTS, JSON.stringify(products));
      return true;
    }
    return false;
  } catch (e) { return false; }
}

  // --- FUNCIÓN CORREGIDA: ELIMINAR ---
  static deleteProduct(id) {
    try {
      const products = this.getAllProducts();
      const filtered = products.filter(p => p.id !== id);
      storage.set(this.KEYS.PRODUCTS, JSON.stringify(filtered));
      LogService.add(`🗑️ Producto eliminado: ${id}`);
      return true;
    } catch (e) {
      LogService.add("❌ Error eliminando: " + e.message);
      return false;
    }
  }

  static getStats() {
    try {
      const products = this.getAllProducts();
      const soldProducts = products.filter(p => p.status === 'sold');
      const revenue = soldProducts.reduce((sum, p) => sum + (parseFloat(p.soldPrice) || 0), 0);
      return { sold: soldProducts.length, revenue: revenue.toFixed(2) };
    } catch (e) {
      return { sold: 0, revenue: 0 };
    }
  }
}