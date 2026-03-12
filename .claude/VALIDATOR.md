# 🏁 Script de Validación de Integridad del Sistema

Para validar el sistema, Claude debe verificar los siguientes puntos:

- [ ] **Referencia Cruzada**: ¿Todos los agentes en `/agents` tienen el encabezado de "Contexto Crítico v4.2"?
- [ ] **Mapeo de Skills**: ¿Cada skill mencionada en los agentes existe como archivo `.md` en `/skills`?
- [ ] **Campos Sagrados**: ¿El `ARCH-001-smart_merge.md` incluye los 7 campos inmutables de `@SYSTEM_DESIGN.md`?
- [ ] **Persistencia**: ¿La skill `ARCH-005-backup_system.md` hace referencia explícita a `_triggerBackup()`?
- [ ] **KPI Safety**: ¿La skill `DS-006-kpi_metrics.md` obliga al uso de `?? 0` antes de `.toFixed()`?
- [ ] **Navegación**: ¿El `UI_SPECIALIST.md` tiene como prioridad el Tab "Importar"?