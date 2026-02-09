import * as FileSystem from 'expo-file-system';
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

/**
 * Servicio para procesar imágenes de productos
 * - Conversión WEBP -> JPEG
 * - Recorte de 1px por cada lado
 * - Análisis con IA (integración futura)
 */

export class ImageProcessingService {
  static UPLOAD_DIR = `${FileSystem.documentDirectory}uploads/`;
  static PROCESSED_DIR = `${FileSystem.documentDirectory}processed/`;

  /**
   * Inicializa los directorios necesarios
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
    } catch (error) {
      console.error('Error initializing directories:', error);
    }
  }

  /**
   * Escanea el directorio de uploads en busca de nuevas carpetas
   */
  static async scanForNewProducts() {
    try {
      const contents = await FileSystem.readDirectoryAsync(this.UPLOAD_DIR);
      const folders = [];

      for (const item of contents) {
        const itemPath = `${this.UPLOAD_DIR}${item}`;
        const info = await FileSystem.getInfoAsync(itemPath);
        
        if (info.isDirectory) {
          folders.push(item);
        }
      }

      return folders;
    } catch (error) {
      console.error('Error scanning for products:', error);
      return [];
    }
  }

  /**
   * Procesa todas las imágenes de una carpeta de producto
   */
  static async processProductFolder(folderName) {
    try {
      const folderPath = `${this.UPLOAD_DIR}${folderName}/`;
      const images = await FileSystem.readDirectoryAsync(folderPath);
      
      const processedImages = [];

      for (const imageName of images) {
        const imagePath = `${folderPath}${imageName}`;
        const info = await FileSystem.getInfoAsync(imagePath);

        // Solo procesar archivos de imagen
        if (info.isDirectory) continue;
        
        const extension = imageName.split('.').pop().toLowerCase();
        if (!['jpg', 'jpeg', 'png', 'webp'].includes(extension)) continue;

        const processedImage = await this.processImage(imagePath, folderName);
        if (processedImage) {
          processedImages.push(processedImage);
        }
      }

      return {
        folderName,
        images: processedImages,
        processedDate: new Date().toISOString(),
      };
    } catch (error) {
      console.error('Error processing product folder:', error);
      return null;
    }
  }

  /**
   * Procesa una imagen individual
   * - Convierte a JPEG si es necesario
   * - Recorta 1px de cada lado
   */
  static async processImage(imagePath, productFolder) {
    try {
      // 1. Leer info de la imagen
      const imageInfo = await FileSystem.getInfoAsync(imagePath);
      if (!imageInfo.exists) return null;

      // 2. Manipular imagen: crop 1px + conversión a JPEG
      const manipResult = await ImageManipulator.manipulateAsync(
        imagePath,
        [
          {
            crop: {
              originX: 1,
              originY: 1,
              width: 1000, // Ajustar según dimensiones reales
              height: 1000,
            },
          },
        ],
        {
          compress: 0.95,
          format: ImageManipulator.SaveFormat.JPEG,
        }
      );

      // 3. Guardar en directorio processed
      const fileName = `${productFolder}_${Date.now()}.jpg`;
      const destPath = `${this.PROCESSED_DIR}${fileName}`;
      
      await FileSystem.moveAsync({
        from: manipResult.uri,
        to: destPath,
      });

      return {
        originalPath: imagePath,
        processedPath: destPath,
        fileName,
        processedAt: new Date().toISOString(),
      };
    } catch (error) {
      console.error('Error processing image:', error);
      return null;
    }
  }

  /**
   * Extrae metadatos de imagen usando IA (placeholder)
   * En producción: integrar con OpenAI GPT-4 Vision API
   */
  static async analyzeProductWithAI(imagePaths) {
    // TODO: Integrar con API de IA
    // Por ahora retornamos datos mock
    
    return {
      title: 'Producto Detectado',
      brand: 'Marca',
      description: 'Descripción automática del producto',
      tags: ['categoría1', 'categoría2'],
      estimatedPrice: 50,
      condition: 'Buen estado',
      confidence: 0.85,
    };
  }

  /**
   * Selecciona imagen desde galería
   */
  static async pickImageFromGallery() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (status !== 'granted') {
      throw new Error('Se necesitan permisos para acceder a la galería');
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 1,
    });

    if (!result.canceled) {
      return result.assets;
    }

    return [];
  }

  /**
   * Toma foto con cámara
   */
  static async takePicture() {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    
    if (status !== 'granted') {
      throw new Error('Se necesitan permisos para acceder a la cámara');
    }

    const result = await ImagePicker.launchCameraAsync({
      quality: 1,
      allowsEditing: true,
      aspect: [1, 1],
    });

    if (!result.canceled) {
      return result.assets[0];
    }

    return null;
  }
}

// ============== EJEMPLO DE USO ==============

/*
// 1. Inicializar servicio
await ImageProcessingService.initialize();

// 2. Escanear nuevos productos
const newFolders = await ImageProcessingService.scanForNewProducts();

// 3. Procesar carpeta
for (const folder of newFolders) {
  const result = await ImageProcessingService.processProductFolder(folder);
  
  // 4. Analizar con IA
  const aiData = await ImageProcessingService.analyzeProductWithAI(
    result.images.map(img => img.processedPath)
  );
  
  // 5. Guardar en base de datos
  // await saveProduct({ ...result, ...aiData });
}
*/
