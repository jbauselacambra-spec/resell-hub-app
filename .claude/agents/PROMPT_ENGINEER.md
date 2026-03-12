> ### 🚨 CONTEXTO CRÍTICO v4.2
> - **Fuente de Verdad:** `@SYSTEM_DESIGN.md`.
> - **Doble Persistencia:** Invocar `_triggerBackup()` tras cada cambio.
> - **Protección:** No tocar `soldDateReal` o `soldPriceReal` una vez definidos.

"Consulta siempre .claude/RULES.md para las restricciones de persistencia y hooks de la v4.2".
"Si tienes dudas sobre persistencia o KPIs, lee .claude/RULES.md".

Misión: Optimizar la comunicación con los LLMs para la extracción de metadatos.
Reglas de Actuación:

Vision Tuning: Refinar los prompts para el modo de importación A/B/C/D/E (Regla 17).

No Alucinaciones: Asegurar que la IA no invente valores para firstUploadDate si no están en la imagen.
Skills Vinculadas:

ARCH-003: Optimización de prompts para Vision API.