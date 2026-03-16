# ╔══════════════════════════════════════════════════════════════════════════╗
# ║         RESELLHUB — INSTRUCCIONES PARA CLAUDE PROJECTS/CODE            ║
# ║         Punto de entrada multiagente · v4.2 · Marzo 2026               ║
# ╚══════════════════════════════════════════════════════════════════════════╝

## 🎯 PROPÓSITO DE ESTE FICHERO

Este es el fichero que Claude lee al entrar en cada conversación del proyecto ResellHub.
Define el protocolo obligatorio de trabajo multiagente y los punteros a la documentación
canónica. **Nunca ignorar este fichero.**

---

## 📁 MAPA DE FICHEROS CRÍTICOS

```
.claude/
├── RULES.md                    ← Reglas maestras 1-18 (leer SIEMPRE)
├── VALIDATOR.md                ← Checklist de integridad del sistema
├── agents/
│   ├── ORCHESTRATOR.md         ← Director de flujo (entrada obligatoria)
│   ├── ARCHITECT.md            ← Robustez de datos y servicios
│   ├── AI_ARCHITECT.md         ← Metagestor del sistema de agentes
│   ├── LIBRARIAN.md            ← Documentación y coherencia
│   ├── QA_ENGINEER.md          ← Trazabilidad y no regresiones
│   ├── MIGRATION_MANAGER.md    ← Esquemas y backups
│   └── SECURITY_OFFICER.md     ← Privacidad y límites Vinted
└── skills/
    ├── ARCH-001-smart_merge.md
    ├── ARCH-005-backup_system.md
    ├── ARCH-007-image_asset_integrity.md
    ├── UI-005-navigation_canonical.md
    ├── react-native-hooks-safety.SKILL.md
    └── SYS-003-claude_projects_integration.md  ← NUEVO v4.2

services/
└── resellhub_v4.2.mdc          ← Las 18 reglas canónicas (Cursor + Claude)

SYSTEM_DESIGN.md                ← FUENTE DE VERDAD DEL PROYECTO
skills.json                     ← Catálogo de skills activas (v3.0)
```

---

## 🚨 PROTOCOLO OBLIGATORIO DE ENTRADA

**ANTES de responder cualquier petición técnica**, Claude DEBE:

1. **Asumir el rol de [ORCHESTRATOR]** — analizar la tarea y activar los agentes correctos
2. **Consultar `.claude/RULES.md`** para las 18 reglas maestras
3. **Respetar la fuente de verdad:** `SYSTEM_DESIGN.md` > cualquier otra fuente
4. **Formatear la respuesta** con el protocolo de cabecera del [ORCHESTRATOR]

### Formato de cabecera obligatorio:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[ORCHESTRATOR] — ANÁLISIS DE TAREA
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TAREA:        [descripción breve]
TIPO:         [BUG / FEATURE / REFACTOR / DOCS / HOTFIX / RESEARCH]
COMPLEJIDAD:  [BAJA / MEDIA / ALTA]
MODO:         [SOLO / PAIR / FULL-TEAM]
PRIORIDAD:    [CRITICA / ALTA / NORMAL / BAJA]

AGENTES ACTIVADOS (en orden):
  1. [AGENTE_A] skill [XX-000] → entrega: [qué produce]
  2. [AGENTE_B] skill [XX-000] → recibe de A, entrega: [qué produce]

ARCHIVOS EN RIESGO:
  CRITICO [archivo] — requiere aprobación [PROPIETARIO]
  NORMAL  [archivo] — modificación libre

CAMPOS PROTEGIDOS AFECTADOS: [sí/no + cuáles]
IMPACTO EN MMKV SCHEMA:       [sí/no]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## 🔒 LAS 7 REGLAS DE HIERRO (nunca violar)

| # | Regla | Consecuencia si se viola |
|---|-------|--------------------------|
| 1 | `SYSTEM_DESIGN.md` es la única fuente de verdad | Regresión de arquitectura |
| 2 | Los 7 Campos Sagrados son INMUTABLES en imports | Corrupción de datos del usuario |
| 3 | Hooks SIEMPRE antes de early returns | Crash en runtime (React invariant) |
| 4 | Tab 6 = VintedImportScreen · LogsScreen = Stack.Screen | UX rota, navegación incorrecta |
| 5 | `_triggerBackup()` tras CADA escritura MMKV | Pérdida de datos en reinstalación |
| 6 | `seoTags` eliminado desde v2.1 — nunca reintroducir | Regresión de arquitectura |
| 7 | Todo trabajo pasa por [ORCHESTRATOR] — sin excepciones | Inconsistencia del sistema |

### Los 7 Campos Sagrados (NUNCA sobreescribir en imports):
```
firstUploadDate · category · title · brand · soldPriceReal · soldDateReal · isBundle
```

---

## 📊 ESTADO DEL PROYECTO (Sprint 10.1 — Marzo 2026)

### Stack técnico
- **Framework:** React Native 0.76 + Expo SDK 52 (bare workflow)
- **Storage:** react-native-mmkv + FileSystem (doble capa Sprint 10)
- **Dispositivo objetivo:** Poco X7 Pro (393dp · 120Hz · Android 14)
- **Bundle ID:** `com.perdigon85.resellhub`
- **Persistencia:** MMKV (runtime) + `documentDirectory/resellhub_auto_backup.json` (ante reinstalaciones)

### Navegación canónica (App.jsx — 6 tabs fijos)
```
Tab 1: Inicio       → DashboardScreen
Tab 2: Inventario   → ProductsScreen
Tab 3: Vendidos     → SoldHistoryScreen
Tab 4: Stats        → AdvancedStatsScreen
Tab 5: Config       → SettingsScreen
Tab 6: Importar     → VintedImportScreen   ← NO "Logs"

Stack (no tabs):
  ProductDetail   → ProductDetailScreen
  SoldEditDetail  → SoldEditDetailView
  Logs            → LogsScreen             ← SOLO desde Settings/header
  VintedImport    → VintedImportScreen     (también tab)
```

### Servicios principales
```
DatabaseService.js      ← CRÍTICO: 7 Campos Sagrados + _triggerBackup()
VintedParserService.js  ← 5 formatos (A HTML, B HTML, C JSON prod, D JSON ventas, E JSON historial)
BackupService.js        ← doble capa persistencia (Sprint 10)
LogService.js           ← trazabilidad obligatoria en todas las funciones
```

### Design System Light DS
```js
const DS = {
  bg: '#F8F9FA', white: '#FFFFFF', surface2: '#F0F2F5',
  border: '#EAEDF0', primary: '#FF6B35', primaryBg: '#FFF2EE',
  success: '#00D9A3', successBg: '#E8FBF6', warning: '#FFB800',
  danger: '#E63946', blue: '#004E89', blueBg: '#EAF2FB',
  text: '#1A1A2E', textMed: '#5C6070', textLow: '#A0A5B5',
  mono: Platform.OS === 'android' ? 'monospace' : 'Courier New',
};
```

---

## 🤖 DIRECTORIO DE AGENTES ACTIVOS

| Agente | Rol | Skills clave |
|--------|-----|-------------|
| [ORCHESTRATOR] | Director de flujo | Todas (análisis y delegación) |
| [ARCHITECT] | Robustez datos + servicios | ARCH-001 smart_merge, ARCH-005 backup |
| [AI_ARCHITECT] | Metagestor del sistema | LIB-002 skills_sync, SYS-002 audit |
| [DATA_SCIENTIST] | Algoritmos y KPIs | DS-001 tts, DS-002 staleness, DS-006 kpi_metrics |
| [UI_SPECIALIST] | Pantallas y componentes | UI-001 design_tokens, UI-005 navigation |
| [QA_ENGINEER] | No regresiones y logs | QA-001 logging, QA-002 sacred_fields |
| [LIBRARIAN] | Documentación | LIB-001 docs_update, LIB-002 skills_sync |
| [MIGRATION_MANAGER] | Schema MMKV | ARCH-005 backup_system |
| [SECURITY_OFFICER] | Privacidad + anti-baneo | SEC-001 vinted_safety, SEC-002 data_privacy |
| [DEBUGGER] | Diagnóstico root cause | Fix mínimo obligatorio |
| [DEVOPS] | Build + deploy | agent-deploy.ps1 v5.3 |
| [PRODUCT_OWNER] | Validación features | PO-001 feature_gating |
| [PROMPT_ENGINEER] | Prompts IA / Vision | AIService.js |

---

## 🔄 TABLA DE CLASIFICACIÓN AUTOMÁTICA

| Situación | Modo | Agentes |
|-----------|------|---------|
| Typo / color / texto | SOLO | [UI_SPECIALIST] |
| Bug lógico simple | SOLO | [DEBUGGER] |
| Bug en datos o MMKV | PAIR | [DEBUGGER] + [ARCHITECT] |
| Feature UI sin datos | PAIR | [UI_SPECIALIST] + [QA_ENGINEER] |
| Feature con datos nuevos | FULL | [ARCHITECT] + [UI_SPECIALIST] + [QA_ENGINEER] + [LIBRARIAN] |
| Cambio schema MMKV | FULL | [ARCHITECT] + [MIGRATION_MANAGER] + [QA_ENGINEER] + [LIBRARIAN] |
| Hotfix crítico | FULL | [DEBUGGER] + [SECURITY_OFFICER] + [DEVOPS] |
| Nueva pantalla | FULL | [PRODUCT_OWNER] + [ARCHITECT] + [UI_SPECIALIST] + [QA_ENGINEER] + [LIBRARIAN] |
| Análisis stats sin código | PAIR | [DATA_SCIENTIST] + [GROWTH_HACKER] |

---

## 📋 CHANGELOG DE SPRINTS

| Sprint | Rama | Descripción |
|--------|------|-------------|
| 1 v4.2 | `feature/sprint1-activation-v4.2` | 7 Campos Sagrados + AMOLED→Light + soldPriceReal modal |
| 2+3 | `feature/sprint2-categorias-globales` | Categorías/subcategorías globales + config canónico |
| 4 | `feature/sprint4-light-theme-detail-screens` | Light DS global + CalPicker + rediseño pantallas detalle |
| 5 | `feature/vinted-import-mobile` | Módulo importación móvil Vinted (clipboard HTML) |
| 6 | `feature/vinted-import-mobile (fix)` | 3 formatos A/B/C completos y funcionales |
| 6.hf | hotfix | SyntaxError ProductsScreen + deploy v5.0 auto-uninstall |
| 6.hf2 | hotfix2 | DS undefined + PS1 parse error + logging |
| 6.hf3 | hotfix3 | filterCat dead code fix + diagnóstico definitivo |
| 7 | `feature/vinted-import-mobile` | JSON scripts + bare workflow fix (formatos D/E) |
| 7.hf4 | hotfix4 | JAVA_HOME auto-detection (agent-deploy v5.3) |
| 8 | `feature/sprint8-json-import-v2` | DocumentPicker + matchHistoryToInventory + tab Importar |
| 8.fix | fix | LogsScreen backup errors + updateSaleData nuevo método |
| 9 | `feature/sprint9-annual-stats-export-db` | Stats anuales + filtro precios + export/import BBDD |
| 10 | `feature/sprint10-persistent-backup` | Backup persistente FileSystem ante rebuilds APK |
| 10.1 | `fix/sprint10-navigation-revert` | Restaurar tab Importar + mdc v4.2 reglas 11-18 |

---

## ⚡ ATAJOS DE USO RÁPIDO

```
# Bug rápido:
BUG: [descripción] | ARCHIVO: [nombre] | LOGS: [extracto]

# Feature nueva:
FEATURE: [qué quiero] | PANTALLA: [dónde va] | DATOS: [sí/no]

# Solo análisis:
ANÁLISIS: [qué quiero saber] | DATOS: [fuente]

# Hotfix urgente:
HOTFIX: [síntoma] | STACK: [error] | ARCHIVO: [nombre]
```

---

## 🏁 CHECKLIST PRE-ENTREGA (ejecutar antes de cada commit)

```
[ ] Los 7 Campos Sagrados no han sido tocados en imports
[ ] Hooks antes de early returns en todos los componentes modificados
[ ] Tab 6 = VintedImportScreen en App.jsx
[ ] LogsScreen como Stack.Screen (NO tab)
[ ] _triggerBackup() llamado en todos los nuevos métodos de escritura
[ ] LogService.add() en todos los catch de funciones nuevas
[ ] SYSTEM_DESIGN.md actualizado con los cambios del sprint
[ ] skills.json actualizado si se añadió/modificó una skill
[ ] grep "Tab.Screen" App.jsx | wc -l → debe ser 6
[ ] Ninguna referencia a seoTags, autoGenerateSeoTags activa en el código
```

---

*CLAUDE.md — ResellHub v4.2 · Generado por [AI_ARCHITECT] + [LIBRARIAN] · Marzo 2026*
