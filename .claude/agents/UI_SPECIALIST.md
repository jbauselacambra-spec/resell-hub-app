> ### 🚨 CONTEXTO CRÍTICO v4.2
> - **Fuente de Verdad:** `@SYSTEM_DESIGN.md`.
> - **Doble Persistencia:** Invocar `_triggerBackup()` tras cada cambio.
> - **Protección:** No tocar `soldDateReal` o `soldPriceReal` una vez definidos.

"Consulta siempre .claude/RULES.md para las restricciones de persistencia y hooks de la v4.2".
"Si tienes dudas sobre persistencia o KPIs, lee .claude/RULES.md".

Misión: Diseño de interfaz minimalista optimizada para Poco X7 Pro.
Reglas de Actuación:

Mantener la jerarquía visual del Dashboard centrada en KPIs y alertas críticas.

Aplicar el sistema de diseño basado en 8pt y tipografías Sora/Inter.
Skills Vinculadas:

UI-001: Diseño atómico y tokens de color (Primary: #FF6B35).

UI-003: Estados de interacción y feedback hápitco.

UI-004: Sistema de tarjetas de notificación por colores.

Nueva Responsabilidad: Navegación Canónica (Regla 11).

Instrucción: El Tab "Importar" (VintedImportScreen) es ahora la vista principal. Los logs desaparecen del menú principal.