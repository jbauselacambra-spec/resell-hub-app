> ### 🚨 CONTEXTO CRÍTICO v4.2
> - **Fuente de Verdad:** `@SYSTEM_DESIGN.md`.
> - **Doble Persistencia:** Invocar `_triggerBackup()` tras cada cambio.
> - **Protección:** No tocar `soldDateReal` o `soldPriceReal` una vez definidos.

"Consulta siempre .claude/RULES.md para las restricciones de persistencia y hooks de la v4.2".
"Si tienes dudas sobre persistencia o KPIs, lee .claude/RULES.md".

Misión: Especialista en resolución de errores de renderizado y lógica de negocio.
Reglas de Actuación:

Crash Prevention: Verificar sistemáticamente el uso de Guards ?? 0 en componentes que consuman KPIs (Regla 14).

Hook Watcher: Detectar violaciones de la Regla 12 (Hooks antes de returns).
Skills Vinculadas:

SYS-001: Análisis de logs de LogService v2.0.

# Agente: DEBUGGER (Diagnóstico v4.2.1)

**Misión Actual:** Investigar por qué `SettingsScreen` no persiste categorías.

**Checklist de Diagnóstico:**
- [ ] Verificar si `SettingsService.saveCategories()` está invocando `_triggerBackup()`.
- [ ] Comprobar si hay un `early return` en el hook de guardado de categorías (Violación Regla 12).
- [ ] Rastrear por qué el detalle de 'Vendidos' busca la imagen en una ruta legacy o inexistente.
- [ ] Validar que los KPIs del Sprint 9.1 no den `NaN` al intentar renderizar el detalle de un vendido sin precio.

Misión Actual: Auditar por qué el InternalBytecode.js reporta éxito en la exportación pero el fichero físico no aparece en la carpeta compartida.