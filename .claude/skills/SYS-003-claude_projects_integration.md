# 🔧 Skill: SYS-003 — claude_projects_integration

**ID:** SYS-003  
**Agente propietario:** AI_ARCHITECT  
**Versión:** 1.0 — Marzo 2026  
**Disparador:** Cualquier sesión de trabajo en Claude Projects o Claude Code

---

## Misión

Garantizar que Claude opere correctamente dentro del sistema multiagente de ResellHub
cuando se usa desde **Claude Projects** (claude.ai) o **Claude Code** (CLI), en lugar
de desde Cursor IDE.

---

## Diferencias clave: Cursor vs Claude Projects

| Aspecto | Cursor | Claude Projects |
|---------|--------|-----------------|
| Punto de entrada de reglas | `resellhub_v4.2.mdc` | `CLAUDE.md` (este proyecto) |
| Acceso a ficheros | Directo vía `@mention` | Project Knowledge (subidos) |
| Contexto de proyecto | Automático por workspace | Explícito en Project Knowledge |
| Fichero de instrucciones | `.cursor/rules/*.mdc` | `CLAUDE.md` en la raíz |
| Agentes | Roles en el `.mdc` | Roles activados por [ORCHESTRATOR] |

---

## Protocolo de lectura al iniciar sesión

Cuando Claude recibe una petición en este proyecto, DEBE ejecutar este orden:

```
1. Leer CLAUDE.md (este fichero ya lo provee el sistema)
2. Consultar .claude/RULES.md para las 18 reglas
3. Si la tarea implica código → consultar SYSTEM_DESIGN.md sección relevante
4. Activar [ORCHESTRATOR] y formatear cabecera de análisis
5. Delegar a los agentes correspondientes
6. Al finalizar → verificar VALIDATOR.md checklist
```

---

## Cómo referenciar ficheros del proyecto

En Claude Projects, los ficheros del project knowledge se referencian por nombre.
Los más importantes para el trabajo diario:

| Fichero | Cuándo consultarlo |
|---------|-------------------|
| `SYSTEM_DESIGN.md` | Cualquier duda de arquitectura, datos o UI |
| `.claude/RULES.md` | Antes de cualquier cambio de código |
| `skills.json` | Para conocer qué skills tiene cada agente |
| `.claude/VALIDATOR.md` | Antes de entregar un sprint o commit |
| `resellhub_v4.2.mdc` | Referencia completa del sistema (Cursor) |

---

## Integración con el sistema de skills existente

Esta skill se añade al catálogo en `skills.json` bajo el agente `AI_ARCHITECT`:

```json
{
  "id": "SYS-003",
  "name": "claude_projects_integration",
  "description": "Protocolo de operación de Claude en Projects/Code. Define orden de lectura de ficheros, activación de agentes y diferencias con Cursor IDE.",
  "trigger": "Primera petición de cada sesión en Claude Projects o Claude Code",
  "output": "Cabecera [ORCHESTRATOR] + agentes activados + confirmación de contexto leído"
}
```

---

## Reglas específicas para Claude Projects

1. **Sin `@mention` de ficheros** — En Projects no se puede escribir `@SYSTEM_DESIGN.md`. Claude debe usar el project knowledge search internamente y hacer referencia por nombre.

2. **Contexto persistente** — El project knowledge está siempre disponible. No pedir al usuario que pegue código que ya debería estar en el knowledge.

3. **Confirmación de contexto** — Si la petición toca un sprint no documentado en el project knowledge, Claude debe pedirle al usuario que añada la documentación relevante.

4. **Outputs como ficheros** — Cuando se generen ficheros de código (`.jsx`, `.js`, `.ps1`, `.md`), usar el sistema de ficheros del artefacto para que el usuario pueda descargarlos.

5. **Validación cruzada** — Al detectar una posible regresión (p.ej. alguien menciona "tab Logs"), activar inmediatamente [QA_ENGINEER] con la Regla 11 y corregir antes de continuar.

---

## Auto-diagnóstico al inicio de sesión

Si la primera petición de una sesión contiene una petición técnica compleja sin contexto
previo, Claude DEBE responder primero con:

```
[AI_ARCHITECT] — CONTEXTO CARGADO
Sprint actual: 10.1
Última rama: fix/sprint10-navigation-revert
Stack: RN 0.76 + Expo 52 (bare) + MMKV + FileSystem
Reglas activas: 18 (ver .claude/RULES.md)
Skills disponibles: ver skills.json
Listo para [ORCHESTRATOR].
```

---

*SYS-003-claude_projects_integration.md · AI_ARCHITECT · v1.0 · Marzo 2026*
