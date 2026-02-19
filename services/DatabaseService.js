import { MMKV } from 'react-native-mmkv';
import LogService from './LogService';

let storage;
try {
  storage = new MMKV();
  console.log("[EAS_LOG] 🚀 MMKV Iniciado");
  LogService.add("✅ Database: Conexión establecida", "success");
} catch (e) {
  console.error("[EAS_LOG] ❌ Fallo crítico MMKV:", e);
  LogService.add("⚠️ MMKV falló. Usando memoria temporal.", "error");
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

  // --- MÉTODOS DE APOYO ---

  static getAllProducts() {
    try {
      const data = storage.getString(this.KEYS.PRODUCTS);
      const products = data ? JSON.parse(data) : [];
      console.log(`[EAS_LOG] READ: ${products.length} productos cargados.`);
      return products;
    } catch (e) {
      console.error("[EAS_LOG] ERROR_READ:", e.message);
      LogService.add("❌ Error leyendo DB: " + e.message, "error");
      return [];
    }
  }

  static saveAllProducts(products) {
    try {
      // Limpieza de seguridad: quitar duplicados por ID antes de guardar físicamente
      const uniqueMap = new Map();
      products.forEach(p => { if(p.id) uniqueMap.set(String(p.id), p); });
      const cleanList = Array.from(uniqueMap.values());

      storage.set(this.KEYS.PRODUCTS, JSON.stringify(cleanList));
      console.log(`[EAS_LOG] WRITE: ${cleanList.length} productos guardados físicamente.`);
      return true;
    } catch (e) {
      console.error("[EAS_LOG] ERROR_WRITE:", e.message);
      LogService.add("❌ Error de escritura física: " + e.message, "error");
      return false;
    }
  }

  // --- GESTIÓN DE PRODUCTOS ---

  static saveProduct(product) {
    console.log("[EAS_LOG] Intentando guardar producto individual...");
    try {
      const products = this.getAllProducts();
      const newProduct = {
        ...product,
        id: product.id || `local_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        createdAt: product.createdAt || new Date().toISOString(),
        status: product.status || 'active'
      };

      products.push(newProduct);
      const success = this.saveAllProducts(products);
      
      if (success) {
        LogService.add(`✅ Producto guardado: ${newProduct.title || newProduct.id}`, "success");
        return newProduct;
      }
      throw new Error("No se pudo persistir en MMKV");
    } catch (e) {
      LogService.add("❌ Error guardando: " + e.message, "error");
      return null;
    }
  }

  static updateProduct(updatedProduct) {
    console.log(`[EAS_LOG] Actualizando producto: ${updatedProduct.id}`);
    try {
      const products = this.getAllProducts();
      const index = products.findIndex(p => p.id === updatedProduct.id);
      
      if (index !== -1) {
        products[index] = { ...products[index], ...updatedProduct };
        this.saveAllProducts(products);
        LogService.add(`✅ Actualizado: ${updatedProduct.id}`, "success");
        return true;
      }
      LogService.add(`⚠️ No se encontró ID para actualizar: ${updatedProduct.id}`, "info");
      return false;
    } catch (e) {
      LogService.add("❌ Error actualizando: " + e.message, "error");
      return false;
    }
  }

  static deleteProduct(id) {
    console.log(`[EAS_LOG] Eliminando producto: ${id}`);
    try {
      const products = this.getAllProducts();
      const filtered = products.filter(p => p.id !== id);
      const success = this.saveAllProducts(filtered);
      
      if(success) {
        LogService.add(`🗑️ Producto eliminado: ${id}`, "info");
        return true;
      }
      return false;
    } catch (e) {
      LogService.add("❌ Error eliminando: " + e.message, "error");
      return false;
    }
  }

  // --- IMPORTACIÓN Y VENTAS ---

  static markAsSold(id, soldPrice) {
    console.log(`[EAS_LOG] Marcando como vendido: ${id} por ${soldPrice}€`);
    try {
      const products = this.getAllProducts();
      const index = products.findIndex(p => p.id === id);
      if (index !== -1) {
        products[index] = {
          ...products[index],
          status: 'sold',
          soldPrice: parseFloat(soldPrice) || 0,
          soldAt: new Date().toISOString()
        };
        this.saveAllProducts(products);
        LogService.add(`💰 Vendido: ${products[index].title || id}`, "success");
        return true;
      }
      return false;
    } catch (e) {
      LogService.add("❌ Error en venta: " + e.message, "error");
      return false;
    }
  }

  static async importFromVinted(newProducts) {
    console.log("[EAS_LOG] >>> INICIO IMPORTACIÓN MASIVA");
    try {
      const currentProducts = this.getAllProducts();
      const productMap = new Map();
      
      // Mapear actuales
      currentProducts.forEach(p => productMap.set(String(p.id), p));
      
      let addedCount = 0;
      newProducts.forEach(p => {
        const pId = String(p.id);
        if (!productMap.has(pId)) addedCount++;
        
        productMap.set(pId, {
          ...p,
          price: Number(p.price) || 0,
          views: Number(p.views) || 0,
          favorites: Number(p.favorites) || 0,
          createdAt: p.createdAt || new Date().toISOString()
        });
      });

      const finalList = Array.from(productMap.values());
      const success = this.saveAllProducts(finalList);

      if (success) {
        console.log(`[EAS_LOG] >>> IMPORTACIÓN OK: ${addedCount} nuevos.`);
        LogService.add(`📥 Importación Vinted: ${addedCount} nuevos productos`, "success");
        return { success: true, count: addedCount };
      }
      throw new Error("Error al escribir en disco");
    } catch (e) {
      console.error("[EAS_LOG] ERROR_IMPORT:", e.message);
      LogService.add("❌ Fallo de importación: " + e.message, "error");
      return { success: false, error: e.message };
    }
  }

  // --- ESTADÍSTICAS ---

  static getStats() {
    try {
      const products = this.getAllProducts();
      const soldProducts = products.filter(p => p.status === 'sold');
      const revenue = soldProducts.reduce((sum, p) => sum + (parseFloat(p.soldPrice) || 0), 0);
      return { sold: soldProducts.length, revenue: revenue.toFixed(2) };
    } catch (e) {
      return { sold: 0, revenue: "0.00" };
    }
  }

  static getPerformanceStats() {
    try {
      const products = this.getAllProducts();
      const sold = products.filter(p => p.status === 'sold' && p.createdAt && p.soldAt);
      
      if (sold.length === 0) return null;

      const totalDays = sold.reduce((sum, p) => {
        const diff = Math.ceil((new Date(p.soldAt) - new Date(p.createdAt)) / (1000 * 60 * 60 * 24));
        return sum + Math.max(0, diff);
      }, 0);

      const avgDays = (totalDays / sold.length).toFixed(1);

      const catStats = {};
      sold.forEach(p => {
        const cat = p.category || 'Sin categoría';
        const diff = Math.ceil((new Date(p.soldAt) - new Date(p.createdAt)) / (1000 * 60 * 60 * 24));
        if (!catStats[cat]) catStats[cat] = { totalTime: 0, count: 0 };
        catStats[cat].totalTime += Math.max(0, diff);
        catStats[cat].count += 1;
      });

      const velocityData = Object.keys(catStats).map(cat => ({
        name: cat,
        avg: (catStats[cat].totalTime / catStats[cat].count).toFixed(1)
      })).sort((a, b) => a.avg - b.avg);

      return { avgDays, velocityData };
    } catch (e) {
      console.error("[EAS_LOG] ERROR_PERFORMANCE_STATS:", e);
      return null;
    }
  }

  static async clearDatabase() {
    try {
      storage.set(this.KEYS.PRODUCTS, JSON.stringify([]));
      console.log("[EAS_LOG] 🔥 BASE DE DATOS BORRADA");
      LogService.add("🔥 Base de datos reseteada", "info");
      return true;
    } catch (e) {
      console.error("[EAS_LOG] ERROR_CLEARING_DB:", e);
      return false;
    }
  }
}