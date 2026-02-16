import * as FileSystem from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import LogService from './LogService';

/**
 * Servicio para procesar imágenes de productos
 * - Fix: Uso de sintaxis compatible con las últimas versiones de Expo.
 * - Anti-Hash: Redimensión y recorte de 2px para generar un nuevo MD5.
 */
export class ImageProcessingService {
  static UPLOAD_DIR = `${FileSystem.documentDirectory}uploads/`;
  static PROCESSED_DIR = `${FileSystem.documentDirectory}processed/`;

  /**
   * Inicializa los directorios necesarios en el dispositivo
   */
  static async initialize() {
    try {
      const uploadDirInfo = await FileSystem.getInfoAsync(this.UPLOAD_DIR);
      if (!uploadDirInfo.exists) {
        await FileSystem.makeDirectoryAsync(this.UPLOAD_DIR, { intermediates: true });
      }

      const processedDirInfo = await FileSystem.getInfoAsync(this.PROCESSED_DIR);
      if (!processedDirInfo.exists) {
        await FileSystem.makeDirectoryAsync(this.PROCESSED_DIR, { intermediates: true });
      }
      LogService.add("📂 Directorios de archivos listos");
    } catch (error) {
      LogService.add("❌ Error directorios: " + error.message);
    }
  }

  /**
   * Toma foto con cámara
   * Fix: Usa 'images' como string para evitar errores de versión en MediaType
   */
  static async takePicture() {
    try {
      LogService.add("📸 Iniciando cámara...");
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      
      if (status !== 'granted') {
        LogService.add("❌ Permiso de cámara denegado");
        return null;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: 'images', // Sintaxis universal compatible
        quality: 0.8,
        allowsEditing: false,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        LogService.add("📸 Foto capturada correctamente");
        return result.assets[0];
      }
      return null;
    } catch (error) {
      LogService.add("❌ Error cámara: " + error.message);
      return null;
    }
  }

  /**
   * Procesa una imagen individual (Anti-Hash)
   * Fix: Acceso directo a ImageManipulator para evitar errores de 'undefined'
   */
  static async processImage(uri) {
    try {
      LogService.add("⚙️ Procesando Anti-Hash...");
      
      // Verificación de seguridad de la librería
      if (!ImageManipulator || !ImageManipulator.manipulateAsync) {
        throw new Error("Librería ImageManipulator no disponible");
      }

      // Proceso de manipulación: 
      // 1. Redimensionar a 1000px de ancho.
      // 2. Recortar 2px desde el origen (1,1) para cambiar el hash del archivo.
      const result = await ImageManipulator.manipulateAsync(
        uri,
        [
          { resize: { width: 1000 } },
          { crop: { originX: 1, originY: 1, width: 998, height: 998 } }
        ],
        { 
          compress: 0.8, 
          format: ImageManipulator.SaveFormat.JPEG 
        }
      );

      LogService.add("✅ Imagen procesada y lista");
      return result.uri;
    } catch (error) {
      LogService.add("❌ Error en proceso: " + error.message);
      // Retornamos la URI original si el proceso falla para no romper la app
      return uri; 
    }
  }

  /**
   * Selecciona imagen desde la galería
   */
  static async pickImageFromGallery() {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (status !== 'granted') {
        LogService.add("❌ Permiso de galería denegado");
        return null;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: 'images',
        allowsMultipleSelection: false,
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        return result.assets[0];
      }
      return null;
    } catch (error) {
      LogService.add("❌ Error galería: " + error.message);
      return null;
    }
  }

  /**
   * Placeholder para futura integración con IA (GPT-4 Vision / Gemini)
   */
  static async analyzeProductWithAI(uri) {
    LogService.add("🤖 Iniciando análisis por IA...");
    return {
      title: 'Producto Detectado',
      brand: 'Marca',
      price: '20.00',
      description: 'Generado automáticamente'
    };
  }
}