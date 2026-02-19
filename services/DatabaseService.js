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

// Añade esto a tu clase DatabaseService en DatabaseService.js

static getPerformanceStats() {
  try {
    const products = this.getAllProducts();
    const sold = products.filter(p => p.status === 'sold');
    
    if (sold.length === 0) return null;

    // Cálculo de días promedio totales
    const totalDays = sold.reduce((sum, p) => {
      const start = new Date(p.createdAt);
      const end = new Date(p.soldAt);
      const diff = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
      return sum + diff;
    }, 0);

    const avgDays = (totalDays / sold.length).toFixed(1);

    // Velocidad por categoría
    const catStats = {};
    sold.forEach(p => {
      const diff = Math.ceil((new Date(p.soldAt) - new Date(p.createdAt)) / (1000 * 60 * 60 * 24));
      if (!catStats[p.category]) catStats[p.category] = { totalTime: 0, count: 0 };
      catStats[p.category].totalTime += diff;
      catStats[p.category].count += 1;
    });

    const velocityData = Object.keys(catStats).map(cat => ({
      name: cat,
      avg: (catStats[cat].totalTime / catStats[cat].count).toFixed(1)
    })).sort((a, b) => a.avg - b.avg); // De más rápido a más lento

    return { avgDays, velocityData };
  } catch (e) {
    return null;
  }
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