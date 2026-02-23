import { MMKV } from 'react-native-mmkv';
import LogService from './LogService';

const DICTIONARY_KEY = 'custom_dictionary';

// Valores por defecto
const DEFAULT_DICTIONARY = {
  'Juguetes': ['tuc tuc', 'lego', 'playmobil', 'muñeca', 'juguete', 'aeropuerto', 'coche', 'pista', 'tren', 'barco', 'avión', 'peluche'],
  'Ropa': ['abrigo', 'chaqueta', 'parka', 'plumífero', 'gabardina', 'sfera', 'zara', 'bershka', 'h&m', 'mango', 'pull&bear', 'stradivarius', 'primark'],
  'Lotes': ['lote', 'pack', 'conjunto', 'set'],
  'Calzado': ['zapatos', 'zapatillas', 'botas', 'deportivas', 'tenis', 'sandalias'],
  'Entretenimiento': ['Videojuegos', 'Juego de mesa', 'Dados', 'cartas', 'Muñecos', 'Coleccionables', 'Figuras de acción', 'Puzzles', 'Rompecabezas', 'Drones', 'Vehículos RC'],
  'Otros': []
};

const CONFIG_KEY = 'app_user_config';

const DEFAULT_CONFIG = {
  daysInvisible: '60',
  viewsInvisible: '20',
  daysDesinterest: '45',
  daysCritical: '90'
};

let storage;
try {
  storage = new MMKV();
  console.log("[EAS_LOG] 🚀 MMKV Iniciado");
} catch (e) {
  console.error("[EAS_LOG] ❌ Fallo crítico MMKV:", e);
}

export class DatabaseService {
  static KEYS = {
    PRODUCTS: 'products',
    CONFIG: 'app_config'
  };


  /**
 * Recupera la configuración de alertas del usuario.
 * Si no existe, devuelve los valores por defecto.
 */
static getConfig() {
    try {
      const stored = storage.getString(CONFIG_KEY);
      return stored ? JSON.parse(stored) : DEFAULT_CONFIG;
    } catch (e) {
      LogService.add("❌ Error al recuperar configuración", "error");
      return DEFAULT_CONFIG;
    }
  }

/**
 * Guarda la nueva configuración en el almacenamiento persistente.
 */
static saveConfig(newConfig) {
    try {
      storage.set(CONFIG_KEY, JSON.stringify(newConfig));
      LogService.add("⚙️ Configuración de alertas actualizada", "info");
      return true;
    } catch (e) {
      LogService.add("❌ Error al guardar configuración: " + e.message, "error");
      return false;
    }
  }

  // --- GESTIÓN DEL DICCIONARIO PERSISTENTE ---
  
 static getDictionary() {
    try {
      const stored = storage.getString(DICTIONARY_KEY);
      return stored ? JSON.parse(stored) : DEFAULT_DICTIONARY;
    } catch (e) {
      LogService.add("❌ Error al recuperar diccionario", "error");
      return DEFAULT_DICTIONARY;
    }
  }

  // MÉTODO AÑADIDO Y ACTUALIZADO
  static saveDictionary(newDict) {
    try {
      storage.set(DICTIONARY_KEY, JSON.stringify(newDict));
      LogService.add("📚 Diccionario de categorías actualizado", "info");
      return true;
    } catch (e) {
      LogService.add("❌ Error al guardar diccionario: " + e.message, "error");
      return false;
    }
  }

  static addKeywordToDictionary(category, newKeyword) {
    try {
      const dict = this.getDictionary();
      if (!dict[category]) dict[category] = [];
      
      const keyword = newKeyword.toLowerCase().trim();
      if (!dict[category].includes(keyword)) {
        dict[category].push(keyword);
        storage.set(DICTIONARY_KEY, JSON.stringify(dict));
        LogService.add(`🧠 Diccionario: "${keyword}" -> ${category}`, "success");
        return true;
      }
      return false;
    } catch (e) {
      LogService.add("❌ Error actualizando diccionario", "error");
      return false;
    }
  }

  static detectCategory(text) {
    if (!text) return 'Otros';
    const dict = this.getDictionary();
    const cleanText = text.toLowerCase();
    for (const [category, keywords] of Object.entries(dict)) {
      if (keywords.some(k => cleanText.includes(k))) return category;
    }
    return 'Otros';
  }

  // --- IMPORTACIÓN Y SEO ---

 // ... dentro de la clase DatabaseService ...

static generateSEOTags(category, brand, title) {
  const tags = new Set();
  const dict = this.getDictionary(); // Obtenemos el diccionario actualizado
  
  // 1. Añadimos la categoría como etiqueta principal
  tags.add(category.toLowerCase());
  
  // 2. Añadimos la marca si no es genérica
  if (brand && brand.toLowerCase() !== 'genérico') {
    tags.add(brand.toLowerCase());
  }
  
  // 3. Añadimos palabras clave del título que coincidan con nuestro diccionario
  const titleWords = title.toLowerCase().split(' ');
  titleWords.forEach(word => {
    if (word.length > 3) {
      tags.add(word);
      
      // Si la palabra existe en alguna categoría del diccionario, reforzamos el SEO
      for (const [cat, keywords] of Object.entries(dict)) {
        if (keywords.includes(word)) {
          tags.add(cat.toLowerCase());
        }
      }
    }
  });

  // 4. Etiquetas fijas para mejorar visibilidad
  tags.add('importado');
  tags.add('vinted');

  return Array.from(tags).join(', ');
}

// ... dentro de la clase DatabaseService en DatabaseService.js ...

static async importFromVinted(newProducts) {
  try {
    const currentProducts = this.getAllProducts();
    const productMap = new Map();
    
    // 1. Cargamos lo que ya tenemos en el móvil. 
    // Forzamos el ID a String para evitar fallos de comparación.
    currentProducts.forEach(p => {
      if (p.id) productMap.set(String(p.id), p);
    });
    
    newProducts.forEach(p => {
      if (!p.id || String(p.id).includes('image')) return;
      const pId = String(p.id);
      
      // 2. BUSCAMOS EL PRODUCTO EXISTENTE
      const existing = productMap.get(pId);

      // 3. LÓGICA DE DETECCIÓN INICIAL (Solo si el producto es nuevo)
      const detectedCat = this.detectCategory(`${p.title} ${p.description}`);
      const initialSeoTags = this.generateSEOTags(detectedCat, p.brand, p.title);

      // 4. EL MERGE (Fusión): Prioridad total a lo guardado en el móvil
      productMap.set(pId, {
        ...p, // Datos del JSON (vistas, favoritos, etc.)
        
        // CAMPOS BLINDADOS: Si existen en el móvil, NO se tocan
        category: existing?.category || p.category || detectedCat,
        firstUploadDate: existing?.firstUploadDate || p.createdAt || new Date().toISOString(),
        seoTags: existing?.seoTags || initialSeoTags,
        isBundle: existing?.isBundle !== undefined ? existing.isBundle : false,
        
        // DATOS DE VENTA: Se mantienen si ya los habías editado
        soldPrice: existing?.soldPrice || p.soldPrice || null,
        soldDate: existing?.soldDate || p.soldAt || null,
        
        // Sincronizamos estados importantes
        status: p.status || 'active',
        lastSync: new Date().toISOString()
      });
    });

    const finalArray = Array.from(productMap.values());
    this.saveAllProducts(finalArray);
    LogService.add(`✅ Sincronización: ${finalArray.length} productos protegidos`, "success");
    return { success: true };
  } catch (e) {
    console.error("Error en import:", e);
    return { success: false, error: e.message };
  }
}

// NUEVO MÉTODO: Para actualizar los campos manuales desde la pantalla de detalle o ventas
static updateManualFields(productId, data) {
  try {
    const all = this.getAllProducts();
    const index = all.findIndex(p => p.id === productId);
    if (index !== -1) {
      all[index] = {
        ...all[index],
        soldPriceReal: data.soldPriceReal !== undefined ? data.soldPriceReal : all[index].soldPriceReal,
        isBundleSale: data.isBundleSale !== undefined ? data.isBundleSale : all[index].isBundleSale,
        firstUploadDate: data.firstUploadDate || all[index].firstUploadDate
      };
      this.saveAllProducts(all);
      return true;
    }
    return false;
  } catch (e) {
    return false;
  }
}

// NUEVO MÉTODO: Para actualizar los campos manuales desde la pantalla de detalle o ventas
static updateManualFields(productId, data) {
  try {
    const all = this.getAllProducts();
    const index = all.findIndex(p => p.id === productId);
    if (index !== -1) {
      all[index] = {
        ...all[index],
        soldPriceReal: data.soldPriceReal !== undefined ? data.soldPriceReal : all[index].soldPriceReal,
        isBundleSale: data.isBundleSale !== undefined ? data.isBundleSale : all[index].isBundleSale,
        firstUploadDate: data.firstUploadDate || all[index].firstUploadDate
      };
      this.saveAllProducts(all);
      return true;
    }
    return false;
  } catch (e) {
    return false;
  }
}

  // --- MÉTODOS BASE ---

 static getAllProducts() {
    try {
      const data = storage.getString(this.KEYS.PRODUCTS);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      return [];
    }
  }

  static saveAllProducts(products) {
    storage.set(this.KEYS.PRODUCTS, JSON.stringify(products));
    return true;
  }

  static async clearDatabase() {
    storage.set(this.KEYS.PRODUCTS, JSON.stringify([]));
    LogService.add("🔥 Base de datos borrada", "info");
    return true;
  }


// Método para obtener estadísticas rápidas de ventas
  static getStats() {
    try {
      const all = this.getAllProducts();
      const now = new Date();
      const firstDayMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      const soldThisMonth = all.filter(p => 
        p.status === 'sold' && 
        p.soldAt && 
        new Date(p.soldAt) >= firstDayMonth
      ).length;

      return { sold: soldThisMonth };
    } catch (e) {
      return { sold: 0 };
    }
  }

 static markAsRepublicated(productId) {
    try {
      const all = this.getAllProducts();
      const index = all.findIndex(p => p.id === productId);
      if (index !== -1) {
        // Al marcar como resubido, la fecha de subida real pasa a ser el momento actual
        all[index].firstUploadDate = new Date().toISOString();
        this.saveAllProducts(all);
        LogService.add(`🔄 Resubido: ${all[index].title || productId}`, "success");
        return true;
      }
      return false;
    } catch (e) {
      return false;
    }
  }

static updateProduct(updatedProduct) {
  try {
    const all = this.getAllProducts();
    // Aseguramos comparación de IDs como String
    const index = all.findIndex(p => String(p.id) === String(updatedProduct.id));
    
    if (index !== -1) {
      all[index] = {
        ...all[index],
        ...updatedProduct,
        // Aseguramos que los campos clave no se guarden como undefined
        category: updatedProduct.category || all[index].category,
        firstUploadDate: updatedProduct.firstUploadDate || all[index].firstUploadDate,
        seoTags: updatedProduct.seoTags || all[index].seoTags
      };
      this.saveAllProducts(all);
      return true;
    }
    return false;
  } catch (e) {
    console.error("Error al actualizar:", e);
    return false;
  }
}

static getAdvancedStats() {
  const all = this.getAllProducts().filter(p => p.status === 'sold');
  
  const stats = all.reduce((acc, p) => {
    const cat = p.category || 'Otros';
    if (!acc[cat]) acc[cat] = { count: 0, totalDiff: 0, totalDays: 0 };
    
    // Cálculo de tiempo (Diferencia entre subida y venta)
    const start = new Date(p.firstUploadDate || p.createdAt);
    const end = new Date(p.soldDate || p.soldAt);
    const days = Math.max(1, Math.round((end - start) / (1000 * 60 * 60 * 24)));
    
    // Cálculo de beneficio real
    const diff = Number(p.soldPrice || p.price) - Number(p.price);

    acc[cat].count++;
    acc[cat].totalDiff += diff;
    acc[cat].totalDays += days;
    
    return acc;
  }, {});

  return stats;
}

static saveProducts(products) {
    try {
      storage.set(this.KEYS.PRODUCTS, JSON.stringify(products));
      return true;
    } catch (e) {
      console.error("Error al guardar:", e);
      return false;
    }
  }

// Añadir esto a tu DatabaseService.js
static updatePriceWithHistory(productId, newPrice) {
  const products = this.getAllProducts();
  const index = products.findIndex(p => p.id === productId);
  
  if (index !== -1) {
    const product = products[index];
    // Inicializar el historial si no existe
    if (!product.priceHistory) product.priceHistory = [];
    
    // Guardar el precio anterior antes de cambiarlo
    product.priceHistory.push({
      price: product.price,
      date: new Date().toISOString()
    });
    
    product.price = newPrice;
    return this.saveProducts(products);
  }
  return false;
}

/**
 * Registra cambios de precio y actualiza la fecha de actividad.
 * Vital para saber si un producto está "estancado".
 */
static updateProductSmart(productId, updates) {
  const products = this.getAllProducts();
  const index = products.findIndex(p => String(p.id) === String(productId));
  
  if (index !== -1) {
    const oldProduct = products[index];
    const priceHistory = oldProduct.priceHistory || [];

    // Si el precio cambia, guardamos el rastro
    if (updates.price && Number(updates.price) !== Number(oldProduct.price)) {
      priceHistory.push({
        oldPrice: oldProduct.price,
        newPrice: updates.price,
        date: new Date().toISOString()
      });
    }

    products[index] = {
      ...oldProduct,
      ...updates,
      priceHistory,
      lastActivity: new Date().toISOString() // Marca de tiempo para algoritmo de estancamiento
    };
    
    return this.saveProducts(products);
  }
  return false;
}

/**
 * Detecta productos que llevan tiempo sin venderse ni editarse.
 * @param {number} daysThreshold - Días de inactividad (por defecto 45)
 */
static getStagnantProducts(daysThreshold = 45) {
  const all = this.getAllProducts().filter(p => p.status !== 'sold');
  const now = new Date();
  
  return all.filter(p => {
    const lastAction = new Date(p.lastActivity || p.firstUploadDate || p.createdAt);
    const diffDays = (now - lastAction) / (1000 * 60 * 60 * 24);
    return diffDays > daysThreshold;
  });
}

// Añadir a DatabaseService.js

/**
 * Genera alertas basadas en el inventario actual comparando 
 * el tiempo en stock vs la media de su categoría.
 */
static getSmartAlerts() {
  // 1. Intentar obtener los productos y la configuración
  const products = this.getAllProducts().filter(p => p.status !== 'sold');
  const stats = this.getAdvancedStats();
  
  // AQUÍ ESTABA EL ERROR: Necesitamos obtener la config guardada
  const config = this.getConfig() || {}; 
  
  const now = new Date();
  const currentMonth = now.getMonth();
  const alerts = [];

  // Extraer valores de la config con valores por defecto por si no existen
  const multiplier = parseFloat(config.staleMultiplier || 1.5);
  const criticalMonths = parseInt(config.criticalMonthThreshold || 6);
  const seasonalMap = config.seasonalMap || {};

  products.forEach(p => {
    const cat = p.category || 'Otros';
    const uploadDate = new Date(p.firstUploadDate || p.createdAt || now);
    const daysInStock = Math.floor((now - uploadDate) / (1000 * 60 * 60 * 24));
    
    // Regla de Estancamiento
    const catMedia = stats[cat] ? Math.round(stats[cat].totalDays / stats[cat].count) : 30;
    if (daysInStock > catMedia * multiplier) {
      alerts.push({
        type: 'stale',
        priority: daysInStock > (catMedia * multiplier * 2) ? 'high' : 'medium',
        title: p.title,
        message: `Estancado: lleva ${daysInStock}d.`,
        action: 'REVISAR PRECIO'
      });
    }

    // Regla de Estacionalidad (Configurada en Settings)
    if (seasonalMap[currentMonth] === cat) {
      alerts.push({
        type: 'seasonal',
        priority: 'high',
        title: `🔥 Mes de ${cat}`,
        message: `${p.title} es prioritario este mes según tu estrategia.`,
        action: 'REPUBLICAR / SUBIR'
      });
    }

    // Regla Crítica
    if (daysInStock > (criticalMonths * 30)) {
      alerts.push({
        type: 'critical',
        priority: 'high',
        title: `CRÍTICO: ${p.title}`,
        message: `Supera el límite de ${criticalMonths} meses.`,
        action: 'REPUBLICAR URGENTE'
      });
    }
  });

  return alerts.sort((a, b) => (a.priority === 'high' ? -1 : 1));
}

}