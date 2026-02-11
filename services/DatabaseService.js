import { MMKV } from 'react-native-mmkv';

// --- CONFIGURACIÓN SEGURA DE MMKV ---
// Esto evita que la app explote si se abre en un entorno no compatible
let storage;

try {
  storage = new MMKV();
  console.log("✅ MMKV cargado correctamente");
} catch (error) {
  console.log("⚠️ MMKV no disponible (Modo Fallback activo):", error);
  // Creamos una "base de datos falsa" en memoria para que la app no se cierre
  storage = {
    getString: () => null,
    set: () => {},
    delete: () => {},
    getAllKeys: () => [],
    clearAll: () => {}
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
      console.log("Error leyendo DB:", e);
      return [];
    }
  }

  static saveProduct(product) {
    try {
      const products = this.getAllProducts();
      
      // Aseguramos que el producto tenga ID y fecha
      const newProduct = {
        ...product,
        id: product.id || Date.now().toString(),
        createdAt: new Date().toISOString(),
        status: product.status || 'active'
      };

      products.push(newProduct);
      storage.set(this.KEYS.PRODUCTS, JSON.stringify(products));
      return newProduct;
    } catch (e) {
      console.error("Error guardando producto:", e);
      return product;
    }
  }

  static markProductAsSold(productId, price) {
    try {
      const products = this.getAllProducts();
      const updatedProducts = products.map(p => {
        if (p.id === productId) {
          return { 
            ...p, 
            status: 'sold', 
            soldPrice: price, 
            soldDate: new Date().toISOString() 
          };
        }
        return p;
      });
      
      storage.set(this.KEYS.PRODUCTS, JSON.stringify(updatedProducts));
      
      // Actualizar estadísticas de ventas
      this.updateStats(price);
      
      return updatedProducts;
    } catch (e) {
      console.error("Error marcando como vendido:", e);
    }
  }

  static updateStats(newSaleAmount) {
    try {
      const currentStatsStr = storage.getString(this.KEYS.STATS);
      const currentStats = currentStatsStr ? JSON.parse(currentStatsStr) : { revenue: 0, soldCount: 0 };
      
      const newStats = {
        revenue: (currentStats.revenue || 0) + parseFloat(newSaleAmount),
        soldCount: (currentStats.soldCount || 0) + 1
      };
      
      storage.set(this.KEYS.STATS, JSON.stringify(newStats));
    } catch (e) {
      console.error("Error actualizando stats:", e);
    }
  }

  static getStats() {
    try {
      // Calculamos las stats en tiempo real para asegurar precisión
      const products = this.getAllProducts();
      const soldProducts = products.filter(p => p.status === 'sold');
      const revenue = soldProducts.reduce((sum, p) => sum + (parseFloat(p.soldPrice) || parseFloat(p.price) || 0), 0);
      
      return {
        sold: soldProducts.length,
        revenue: revenue.toFixed(2)
      };
    } catch (e) {
      return { sold: 0, revenue: 0 };
    }
  }
}