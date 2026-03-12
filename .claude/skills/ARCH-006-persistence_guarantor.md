Misión: Resolver el fallo de "Export BBDD" asegurando que el backup no sea solo un log, sino un archivo real.

Lógica:

Interceptar cada llamada a storage.set().

Validar que el objeto contenga las claves obligatorias: products, categories y settings.

Ejecutar FileSystem.writeAsStringAsync en el documentDirectory.

Verificación Circular: Leer el archivo recién creado para confirmar que el JSON es válido antes de dar el "OK" al usuario.