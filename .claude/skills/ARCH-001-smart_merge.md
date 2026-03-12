Propósito: Gestión de colisiones y duplicados durante la sincronización de inventario.

Detección: Utilizar title_normalized y brand_normalized como clave única de producto.

Lógica de Fusión:

Si el hash de imagen es distinto pero el título y la marca coinciden → Es una resubida.

Si la imagen coincide exactamente → Es un duplicado.

Estrategia de Datos: Preservar siempre el firstUploadDate original.

Actualización: Incrementar republishCount y actualizar el imageHash.

Restricción: Prohibido sobrescribir la fecha de la primera subida bajo cualquier circunstancia.