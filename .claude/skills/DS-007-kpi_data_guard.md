Misión: Implementar la Regla 14 (Guards) para evitar crashes en el Dashboard.

Lógica:

Envoltorio funcional para cálculos de KPIs: (value ?? 0).

Formateo seguro: Si el resultado es NaN o undefined, devolver siempre "0.00".

Inyectar fallback de campos legacy: Si soldPriceReal no existe, intentar leer soldPrice.