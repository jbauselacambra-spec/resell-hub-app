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

let storage;
try {
  storage = new MMKV();
  console.log("[EAS_LOG] 🚀 MMKV Iniciado");
} catch (e) {
  console.error("[EAS_LOG] ❌ Fallo crítico MMKV:", e);
}

export class DatabaseService {
  static KEYS = { PRODUCTS: 'products' };

  // --- GESTIÓN DEL DICCIONARIO PERSISTENTE ---
  
  static getDictionary() {
    const stored = storage.getString(DICTIONARY_KEY);
    return stored ? JSON.parse(stored) : DEFAULT_DICTIONARY;
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
    currentProducts.forEach(p => productMap.set(String(p.id), p));
    
    newProducts.forEach(p => {
      if (!p.id || String(p.id).includes('image')) return;
      const pId = String(p.id);
      
      // BUSCAMOS SI EL PRODUCTO YA EXISTÍA EN NUESTRA BASE DE DATOS
      const existingProduct = productMap.get(pId);

      const detectedCat = this.detectCategory(`${p.title} ${p.description}`);
      const seoTags = this.generateSEOTags(detectedCat, p.brand, p.title);

      productMap.set(pId, {
        ...p,
        // --- LÓGICA DE PERSISTENCIA ---
        // Si ya existía, mantenemos su fecha de subida real. Si es nuevo, usamos la del JSON.
        firstUploadDate: existingProduct?.firstUploadDate || p.createdAt || new Date().toISOString(),
        
        // Mantenemos los campos manuales si ya habían sido rellenados
        soldPriceReal: existingProduct?.soldPriceReal || null,
        isBundleSale: existingProduct?.isBundleSale || false,
        
        // Datos que sí se actualizan del JSON (visitas, favoritos, etc)
        category: p.category || detectedCat,
        seoTags: seoTags,
        price: Number(p.price) || 0,
        status: p.status,
        views: p.views,
        favorites: p.favorites,
        createdAt: p.createdAt // Mantenemos esta como "Fecha de última importación"
      });
    });

    this.saveAllProducts(Array.from(productMap.values()));
    LogService.add("Importación inteligente finalizada (Fechas protegidas)", "success");
    return { success: true };
  } catch (e) {
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
    const data = storage.getString(this.KEYS.PRODUCTS);
    return data ? JSON.parse(data) : [];
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
    const index = all.findIndex(p => p.id === updatedProduct.id);
    if (index !== -1) {
      // Fusionamos los datos existentes con los nuevos para no perder campos persistentes
      all[index] = {
        ...all[index],
        ...updatedProduct,
        // Forzamos que la fecha sea válida
        firstUploadDate: updatedProduct.firstUploadDate || all[index].firstUploadDate || new Date().toISOString()
      };
      this.saveAllProducts(all);
      return true;
    }
    return false;
  } catch (e) {
    console.error("Error al actualizar producto:", e);
    return false;
  }
}

}