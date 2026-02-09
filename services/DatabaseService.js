import { MMKV } from 'react-native-mmkv';

/**
 * Servicio de base de datos local para estadísticas
 * Usa MMKV (más rápido que AsyncStorage)
 */

export const storage = new MMKV();

export class DatabaseService {
  static KEYS = {
    PRODUCTS: 'products',
    STATS: 'stats',
    SETTINGS: 'settings',
    SOLD_HISTORY: 'sold_history',
  };

  // ============== PRODUCTOS ==============

  /**
   * Guarda un nuevo producto
   */
  static saveProduct(product) {
    const products = this.getAllProducts();
    const newProduct = {
      ...product,
      id: product.id || Date.now(),
      processedDate: product.processedDate || new Date().toISOString(),
      status: product.status || 'active',
      views: product.views || 0,
      repostCount: product.repostCount || 0,
      createdAt: new Date().toISOString(),
    };

    products.push(newProduct);
    storage.set(this.KEYS.PRODUCTS, JSON.stringify(products));
    
    // Actualizar estadísticas
    this.updateStats();
    
    return newProduct;
  }

  /**
   * Obtiene todos los productos
   */
  static getAllProducts() {
    const data = storage.getString(this.KEYS.PRODUCTS);
    return data ? JSON.parse(data) : [];
  }

  /**
   * Obtiene producto por ID
   */
  static getProductById(id) {
    const products = this.getAllProducts();
    return products.find(p => p.id === id);
  }

  /**
   * Actualiza un producto
   */
  static updateProduct(id, updates) {
    const products = this.getAllProducts();
    const index = products.findIndex(p => p.id === id);
    
    if (index !== -1) {
      products[index] = {
        ...products[index],
        ...updates,
        updatedAt: new Date().toISOString(),
      };
      
      storage.set(this.KEYS.PRODUCTS, JSON.stringify(products));
      this.updateStats();
      
      return products[index];
    }
    
    return null;
  }

  /**
   * Marca producto como vendido
   */
  static markProductAsSold(id, salePrice) {
    const product = this.updateProduct(id, {
      status: 'sold',
      soldDate: new Date().toISOString(),
      salePrice: salePrice || 0,
    });

    if (product) {
      this.addToSoldHistory(product);
    }

    return product;
  }

  /**
   * Reprocesa un producto (para resubida)
   */
  static reprocessProduct(id) {
    return this.updateProduct(id, {
      repostCount: (this.getProductById(id)?.repostCount || 0) + 1,
      lastRepostDate: new Date().toISOString(),
      views: 0, // Reset views
    });
  }

  /**
   * Elimina un producto
   */
  static deleteProduct(id) {
    const products = this.getAllProducts();
    const filtered = products.filter(p => p.id !== id);
    storage.set(this.KEYS.PRODUCTS, JSON.stringify(filtered));
    this.updateStats();
  }

  // ============== ESTADÍSTICAS ==============

  /**
   * Actualiza las estadísticas generales
   */
  static updateStats() {
    const products = this.getAllProducts();
    
    const stats = {
      total: products.length,
      active: products.filter(p => p.status === 'active').length,
      needsRepost: products.filter(p => p.status === 'needs_repost').length,
      sold: products.filter(p => p.status === 'sold').length,
      totalRevenue: products
        .filter(p => p.status === 'sold')
        .reduce((sum, p) => sum + (p.salePrice || 0), 0),
      avgSaleTime: this.calculateAverageSaleTime(products),
      categoryBreakdown: this.getCategoryBreakdown(products),
      monthlyRevenue: this.getMonthlyRevenue(products),
      lastUpdated: new Date().toISOString(),
    };

    storage.set(this.KEYS.STATS, JSON.stringify(stats));
    return stats;
  }

  /**
   * Obtiene estadísticas
   */
  static getStats() {
    const data = storage.getString(this.KEYS.STATS);
    return data ? JSON.parse(data) : this.updateStats();
  }

  /**
   * Calcula tiempo promedio de venta
   */
  static calculateAverageSaleTime(products) {
    const soldProducts = products.filter(p => p.status === 'sold' && p.soldDate);
    
    if (soldProducts.length === 0) return 0;

    const totalDays = soldProducts.reduce((sum, product) => {
      const processed = new Date(product.processedDate);
      const sold = new Date(product.soldDate);
      const days = Math.floor((sold - processed) / (1000 * 60 * 60 * 24));
      return sum + days;
    }, 0);

    return Math.round(totalDays / soldProducts.length);
  }

  /**
   * Obtiene breakdown por categoría
   */
  static getCategoryBreakdown(products) {
    const breakdown = {};

    products.forEach(product => {
      const category = product.tags?.[0] || 'Sin categoría';
      
      if (!breakdown[category]) {
        breakdown[category] = {
          total: 0,
          sold: 0,
          active: 0,
          revenue: 0,
        };
      }

      breakdown[category].total++;
      
      if (product.status === 'sold') {
        breakdown[category].sold++;
        breakdown[category].revenue += product.salePrice || 0;
      } else if (product.status === 'active') {
        breakdown[category].active++;
      }
    });

    return breakdown;
  }

  /**
   * Obtiene ingresos mensuales (últimos 6 meses)
   */
  static getMonthlyRevenue(products) {
    const monthlyData = Array(6).fill(0);
    const now = new Date();

    products
      .filter(p => p.status === 'sold' && p.soldDate)
      .forEach(product => {
        const soldDate = new Date(product.soldDate);
        const monthsAgo = this.getMonthsDifference(soldDate, now);
        
        if (monthsAgo >= 0 && monthsAgo < 6) {
          monthlyData[5 - monthsAgo] += product.salePrice || 0;
        }
      });

    return monthlyData;
  }

  /**
   * Helper: diferencia en meses entre dos fechas
   */
  static getMonthsDifference(date1, date2) {
    return (
      date2.getMonth() -
      date1.getMonth() +
      12 * (date2.getFullYear() - date1.getFullYear())
    );
  }

  // ============== HISTORIAL DE VENTAS ==============

  /**
   * Añade producto al historial de vendidos
   */
  static addToSoldHistory(product) {
    const history = this.getSoldHistory();
    history.push({
      productId: product.id,
      title: product.title,
      brand: product.brand,
      category: product.tags?.[0],
      salePrice: product.salePrice,
      soldDate: product.soldDate,
      daysToSell: this.calculateDaysToSell(product),
    });
    
    storage.set(this.KEYS.SOLD_HISTORY, JSON.stringify(history));
  }

  /**
   * Obtiene historial de vendidos
   */
  static getSoldHistory() {
    const data = storage.getString(this.KEYS.SOLD_HISTORY);
    return data ? JSON.parse(data) : [];
  }

  /**
   * Filtra historial por fechas
   */
  static getSoldHistoryByDateRange(startDate, endDate) {
    const history = this.getSoldHistory();
    return history.filter(item => {
      const soldDate = new Date(item.soldDate);
      return soldDate >= startDate && soldDate <= endDate;
    });
  }

  /**
   * Calcula días hasta venta
   */
  static calculateDaysToSell(product) {
    if (!product.soldDate || !product.processedDate) return 0;
    
    const processed = new Date(product.processedDate);
    const sold = new Date(product.soldDate);
    return Math.floor((sold - processed) / (1000 * 60 * 60 * 24));
  }

  // ============== CONFIGURACIÓN ==============

  /**
   * Guarda configuración
   */
  static saveSettings(settings) {
    const current = this.getSettings();
    const updated = { ...current, ...settings };
    storage.set(this.KEYS.SETTINGS, JSON.stringify(updated));
    return updated;
  }

  /**
   * Obtiene configuración
   */
  static getSettings() {
    const data = storage.getString(this.KEYS.SETTINGS);
    return data ? JSON.parse(data) : {
      notifications: {
        repostAlert: true,
        repostThreshold: 60, // días
        lowViewsAlert: true,
        lowViewsThreshold: 7, // días
        weeklySummary: false,
      },
      folders: {
        uploadPath: '/storage/emulated/0/ResellHub/',
      },
    };
  }

  // ============== UTILIDADES ==============

  /**
   * Limpia toda la base de datos
   */
  static clearAll() {
    storage.clearAll();
  }

  /**
   * Exporta todos los datos (para backup)
   */
  static exportData() {
    return {
      products: this.getAllProducts(),
      stats: this.getStats(),
      soldHistory: this.getSoldHistory(),
      settings: this.getSettings(),
      exportDate: new Date().toISOString(),
    };
  }

  /**
   * Importa datos (desde backup)
   */
  static importData(data) {
    if (data.products) {
      storage.set(this.KEYS.PRODUCTS, JSON.stringify(data.products));
    }
    if (data.soldHistory) {
      storage.set(this.KEYS.SOLD_HISTORY, JSON.stringify(data.soldHistory));
    }
    if (data.settings) {
      storage.set(this.KEYS.SETTINGS, JSON.stringify(data.settings));
    }
    
    this.updateStats();
  }
}

// ============== EJEMPLO DE USO ==============

/*
// 1. Guardar nuevo producto
const product = DatabaseService.saveProduct({
  title: 'iPhone 13 Pro',
  brand: 'Apple',
  price: 650,
  images: ['path/to/image.jpg'],
  tags: ['Electrónica', 'Smartphone'],
});

// 2. Actualizar producto
DatabaseService.updateProduct(product.id, {
  views: 25,
  status: 'needs_repost',
});

// 3. Marcar como vendido
DatabaseService.markProductAsSold(product.id, 700);

// 4. Obtener estadísticas
const stats = DatabaseService.getStats();
console.log('Productos vendidos:', stats.sold);
console.log('Ingresos totales:', stats.totalRevenue);

// 5. Configurar notificaciones
DatabaseService.saveSettings({
  notifications: {
    repostAlert: true,
    repostThreshold: 30,
  },
});

// 6. Exportar datos
const backup = DatabaseService.exportData();
// Guardar backup en archivo JSON
*/
