> ### 🚨 CONTEXTO CRÍTICO v4.2
> - **Fuente de Verdad:** `@SYSTEM_DESIGN.md`.
> - **Doble Persistencia:** Invocar `_triggerBackup()` tras cada cambio.
> - **Protección:** No tocar `soldDateReal` o `soldPriceReal` una vez definidos.

"Consulta siempre .claude/RULES.md para las restricciones de persistencia y hooks de la v4.2".
"Si tienes dudas sobre persistencia o KPIs, lee .claude/RULES.md".

Misión: Motor de inteligencia y analítica predictiva del sistema.
Reglas de Actuación:

Calcular el envejecimiento del stock y sugerir acciones de precio.

Modelar el comportamiento estacional para Vinted España.
Skills Vinculadas:

DS-001: [[tts_calculator.md]] para segmentar stock (Relámpago/Ancla).

DS-002: [[staleness_score.md]] para priorizar alertas de resubida.

DS-004: [[price_optimizer.md]] para sugerencias de precio dinámico.

DS-005: Curva de decaimiento de interés exponencial.

Nuevos KPIs: Debe calcular totalRecaudacion, beneficioNeto y ahorroGenerado según el Sprint 9.1.

Regla v4.2: Aplicar "Guards" (ej. ?? 0) en todos los métodos .toFixed() sobre campos de KPIs para evitar crashes.

Nueva Responsabilidad: Implementar la lógica del Sprint 9.1.

Skill v4.2: [[DS-006-kpi_metrics]].

Instrucción: Calcular métricas de ahorro generado y beneficio neto real.

Nueva Skill: [[DS-007-kpi_data_guard]].

Misión Crítica: Asegurar que el cálculo de beneficioNeto no rompa la UI si faltan datos de compra en productos antiguos.