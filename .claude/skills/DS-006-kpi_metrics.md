# Skill: DS-006 - Métricas Canónicas (Sprint 9.1)
- **Cálculo**: 
  - `totalRecaudacion = items.filter(i => i.status === 'sold').reduce((a, b) => a + b.soldPriceReal, 0)`
  - `ahorroGenerado = (precioMercado - precioCompra)`.
- **Seguridad**: Aplicar `(value ?? 0).toFixed(2)` para prevenir errores de renderizado.