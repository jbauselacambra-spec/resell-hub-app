# Skill: DS-006 - Métricas Canónicas (Sprint 9.1)
- **Cálculo**: 
  - `totalRecaudacion = items.filter(i => i.status === 'sold').reduce((a, b) => a + b.soldPriceReal, 0)`
  - `ahorroGenerado = (precioMercado - precioCompra)`.
- **Seguridad**: Aplicar `(value ?? 0).toFixed(2)` para prevenir errores de renderizado.

# Skill: DS-006 - KPIs & Safety Render

- **Guard de Detalle:** En la vista de detalle de vendidos, si `soldPriceReal` es null, usar `soldPrice` (legacy) como fallback + `?? 0`.
- **Categorías Settings:** Validar que al guardar una categoría no sea un string vacío, lo cual bloquea la exportación del JSON.