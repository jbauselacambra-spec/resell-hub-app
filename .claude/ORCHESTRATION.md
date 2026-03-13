🎼 Orquestación de Workflows - ResellHub v3.0
Este documento define la secuencia de colaboración entre agentes para los procesos críticos del sistema.

1. NEW_PRODUCT_PIPELINE 📥
Disparador: Nueva carpeta detectada en /ResellHub/inbox/.

DEVOPS: DO-002 detecta la carpeta y activa el flujo.

ARCHITECT: ARCH-002 procesa las imágenes (conversión y recorte de 1px).

ARCHITECT: ARCH-003 extrae metadatos automáticamente usando Vision API.

DATA_SCIENTIST: DS-002 inicializa el staleness_score en 0.

UI_SPECIALIST: Muestra el producto en estado pending con animación de entrada.

QA_ENGINEER: QA-001 registra el evento PRODUCT_INGESTED en el log de auditoría.

2. DAILY_STALENESS_AUDIT ⏰
Disparador: Ejecución programada cada día a las 09:00.

DATA_SCIENTIST: DS-002 recalcula el score de todos los productos activos.

DATA_SCIENTIST: DS-005 identifica productos cuya curva de interés ha caído por debajo del 30%.

GROWTH_HACKER: GH-001 genera la lista de resubidas recomendadas para el día.

SECURITY_OFFICER: SEC-001 filtra la lista para no exceder los límites de seguridad (máx. 10/día).

DEVOPS: DO-003 dispara notificaciones locales si existen alertas críticas (>70 score).

3. PRODUCT_REPUBLISH 🔄
Disparador: Confirmación manual del usuario para resubir un artículo.

SECURITY_OFFICER: SEC-001 valida que han pasado al menos 48h desde la última publicación.

ARCHITECT: ARCH-002 genera un nuevo procesado de imagen (nuevo recorte de 1px) para invalidar el hash.

DATA_SCIENTIST: DS-004 sugiere el precio óptimo para la resubida.

GROWTH_HACKER: GH-001 confirma si estamos en la ventana horaria óptima (19:00-21:00).

ARCHITECT: ARCH-001 actualiza la base de datos incrementando el contador de resubidas.

UI_SPECIALIST: Presenta la ficha de producto lista para copiar datos a Vinted.

4. MARK_AS_SOLD ✅
Disparador: El usuario marca un producto como vendido.

ARCHITECT: Actualiza el estado a sold y registra la fecha de venta.

DATA_SCIENTIST: DS-001 calcula el TTS (Time-to-Sell) final del producto.

GROWTH_HACKER: GH-002 recalibra los umbrales de categorías Relámpago/Ancla con el nuevo dato.

DATA_SCIENTIST: DS-003 actualiza el modelo de estacionalidad mensual.

UI_SPECIALIST: Ejecuta la animación de celebración y mueve el item a la sección "Vendidos".

QA_ENGINEER: QA-001 emite un log crítico con el reporte de la venta.


🛠️ 5. SYSTEM_SELF_EVOLUTION (Flujo de Mejora Continua)
Disparador: Un agente identifica una carencia técnica o lógica durante la ejecución de un workflow.

AGENTE DETECTOR: Si un agente no encuentra una skill en .claude/skills/ para una tarea nueva, emite un log: MISSING_CAPABILITY_DETECTED.

AI_ARCHITECT: Interviene automáticamente para analizar la necesidad basándose en @SYSTEM_DESIGN.md.

AI_ARCHITECT:

Si es una Skill: Crea el nuevo .md en /skills con la lógica algorítmica.

Si es un Agente: Crea el nuevo .md en /agents definiendo su misión y reglas.

LIBRARIAN: Actualiza el índice en skills.json y el mapeo en el .mdc para asegurar que la nueva pieza sea "oficial".

DEBUGGER: Valida que la nueva skill no viole ninguna de las 17 Reglas Maestras (especialmente la Regla 3 de Campos Protegidos).

## 🚑 6. EMERGENCY_FIX_PERSISTENCE (Sprint 10.2)
**Objetivo:** Restaurar backup, categorías e imágenes de vendidos.

1. **DEBUGGER**: Identifica si el fallo de imágenes es por path relativo vs absoluto tras el movimiento a 'Vendidos'.
2. **ARCHITECT**: Actualiza `DatabaseService.js` para que `_triggerBackup()` incluya el estado completo de `categories`.
3. **MIGRATION_MANAGER**: Ejecuta un script de reparación para re-vincular `imageHash` con los productos vendidos que perdieron su URI.
4. **UI_SPECIALIST**: Fuerza un re-render de la lista de vendidos asegurando el Guard `?? default_placeholder` si la imagen no existe.