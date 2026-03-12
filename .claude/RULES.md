# 📜 REGLAS MAESTRAS ResellHub v4.2

**Fuente de Verdad:** `@SYSTEM_DESIGN.md`

### 🚨 Reglas Críticas de Persistencia (Nuevas v4.2)
- **Regla 15:** Doble capa de persistencia (MMKV + FileSystem). Todo guardado debe activar `_triggerBackup()`.
- **Regla 3:** Campos PROTEGIDOS (Inmutables): `firstUploadDate`, `category`, `title`, `brand`, `soldDateReal`, `soldPriceReal`, `isBundle`.

### 💻 Reglas de Desarrollo
- **Regla 11:** Navegación canónica. El Tab "Importar" es obligatorio; los logs se mueven a una vista secundaria.
- **Regla 12:** React Rules of Hooks. Hooks siempre antes de cualquier `early return`.
- **Regla 13:** Contratos de API. Si cambia un servicio, actualizar todos los consumidores inmediatamente.