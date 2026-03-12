Propósito: Implementar la lógica de los "7 Campos Sagrados".

Campos Blindados: firstUploadDate, category, title, brand, soldDateReal, soldPriceReal, isBundle.

Lógica de Fallback: Si un campo nuevo es null, intentar leer del campo legacy correspondiente (ej. soldPrice -> soldPriceReal).

Persistencia: Al finalizar el merge, disparar DatabaseService._triggerBackup() de forma obligatoria.