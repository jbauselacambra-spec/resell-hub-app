Misión: Recuperar las imágenes perdidas en los productos vendidos.

Lógica:

Al cambiar status a sold, se debe crear una copia del archivo de imagen en una carpeta permanente /assets/sold/.

Actualizar el campo localImageUri para que apunte a la nueva ruta inmutable.

Evitar que la limpieza de caché de Expo borre las fotos de productos ya vendidos.