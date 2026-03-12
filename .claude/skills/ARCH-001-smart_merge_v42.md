Propósito: Implementar la lógica de los "7 Campos Sagrados".

Campos Blindados: firstUploadDate, category, title, brand, soldDateReal, soldPriceReal, isBundle.

Lógica de Fallback: Si un campo nuevo es null, intentar leer del campo legacy correspondiente (ej. soldPrice -> soldPriceReal).

Persistencia: Al finalizar el merge, disparar DatabaseService._triggerBackup() de forma obligatoria.

# Skill: ARCH-001 - Smart Merge & Image Recovery

**Problema Detectado:** Las imágenes en 'Vendidos' no cargan y las categorías no se guardan.

**Lógica de Corrección:**
1. **Image Recovery:** Al marcar como vendido, el objeto debe mantener la clave `localImageUri` y el `imageHash`. Si se pierde, el componente de detalle falla.
2. **Mapeo de Categorías:** - Al importar JSON, verificar si la categoría existe en el diccionario local.
   - Si la categoría es nueva, invocar `SettingsService.addCategory()` antes de guardar el producto.
3. **Blindaje:** Asegurar que `soldDateReal` no borre la referencia al path de la imagen original en el sistema de archivos de Expo.