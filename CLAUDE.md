# ╔══════════════════════════════════════════════════════════════════════════╗
# ║         RESELLHUB — INSTRUCCIONES PARA CLAUDE PROJECTS/CODE            ║
# ║         Punto de entrada multiagente · v4.3 · Marzo 2026               ║
# ╚══════════════════════════════════════════════════════════════════════════╝

## 🎯 PROPÓSITO DE ESTE FICHERO

Este es el fichero que Claude lee al entrar en cada conversación del proyecto ResellHub.
Define el protocolo obligatorio de trabajo multiagente y los punteros a la documentación
canónica. **Nunca ignorar este fichero.**

---

## 📁 MAPA DE FICHEROS CRÍTICOS

```
.claude/
├── RULES.md                    ← Reglas maestras 1-19 (leer SIEMPRE)
├── VALIDATOR.md                ← Checklist de integridad del sistema
├── agents/
│   ├── ORCHESTRATOR.md
│   ├── ARCHITECT.md
│   ├── AI_ARCHITECT.md
│   ├── LIBRARIAN.md
│   ├── QA_ENGINEER.md
│   ├── MIGRATION_MANAGER.md
│   └── SECURITY_OFFICER.md
└── skills/
    ├── ARCH-001-smart_merge.md
    ├── ARCH-005-backup_system.md
    ├── react-native-hooks-safety.SKILL.md
    ├── patch-delivery-safety.SKILL.md   ← NUEVA v4.3
    └── SYS-003-claude_projects_integration.md

services/resellhub_v4.2.mdc    ← Las 18 reglas canónicas (Cursor)
SYSTEM_DESIGN.md               ← FUENTE DE VERDAD DEL PROYECTO
```

---

## 🚨 PROTOCOLO OBLIGATORIO DE ENTRADA

**ANTES de responder cualquier petición técnica**, Claude DEBE:

1. Asumir el rol de **[ORCHESTRATOR]**
2. Consultar `.claude/RULES.md` para las **19 reglas maestras**
3. Respetar la fuente de verdad: `SYSTEM_DESIGN.md`
4. **Entregar SIEMPRE archivos completos** — nunca parches parciales

---

## 🔒 LAS 8 REGLAS DE HIERRO (nunca violar)

| # | Regla | Consecuencia si se viola |
|---|-------|--------------------------|
| 1 | `SYSTEM_DESIGN.md` es la única fuente de verdad | Regresión de arquitectura |
| 2 | Los 7 Campos Sagrados son INMUTABLES en imports | Corrupción de datos del usuario |
| 3 | Hooks SIEMPRE antes de early returns | Crash en runtime (React invariant) |
| 4 | Tab 6 = VintedImportScreen · LogsScreen = Stack.Screen | UX rota |
| 5 | `_triggerBackup()` tras CADA escritura MMKV | Pérdida de datos |
| 6 | `seoTags` eliminado desde v2.1 — nunca reintroducir | Regresión |
| 7 | Todo trabajo pasa por [ORCHESTRATOR] — sin excepciones | Inconsistencia |
| **8** | **SIEMPRE entregar archivos COMPLETOS** — nunca fragmentos a pegar | **Typos fatales como `seEffect`** |

### ⚠️ REGLA 8 — Entrega de código (NUEVA v4.3)

**NUNCA** generar fragmentos de código con instrucciones como:
- "reemplaza esta función por..."
- "pega esto después de la línea X..."
- "busca Y y sustitúyelo por..."

**SIEMPRE** generar el archivo completo listo para sobreescribir.

**Razón:** Los parches parciales requieren que el usuario pegue código manualmente,
lo que introduce typos silenciosos como `seEffect` (falta la `u`) que crashean la app
con errores crípticos (`ReferenceError: Property 'seEffect' doesn't exist`).

**Formato correcto de entrega:**
```
✅ CORRECTO: Archivo completo SettingsScreen.jsx (800 líneas, listo para reemplazar)
❌ INCORRECTO: "En handleSaveDictionary añade JSON.parse(JSON.stringify(...))"
❌ INCORRECTO: "Busca el useEffect y reemplázalo por..."
```

### Los 7 Campos Sagrados (NUNCA sobreescribir en imports):
```
firstUploadDate · category · title · brand · soldPriceReal · soldDateReal · isBundle
```

---

## 📊 ESTADO DEL PROYECTO (Sprint 13 — Marzo 2026)

### Stack técnico
- **Framework:** React Native 0.76 + Expo SDK 52 (bare workflow)
- **Storage:** react-native-mmkv + FileSystem (doble capa Sprint 10)
- **Dispositivo objetivo:** Poco X7 Pro (393dp · 120Hz · Android 14)
- **Bundle ID:** `com.perdigon85.resellhub`

### Fix activo — Sprint 13: Subcategorías no aparecen en modales

**Bug:** `ReferenceError: Property 'seEffect' doesn't exist` en SettingsScreen
**Causa raíz:** Typo introducido al pegar parche parcial (`seEffect` en vez de `useEffect`)
**Fix:** Archivo completo `SettingsScreen.jsx` entregado con:
- `handleSaveDictionary`: `JSON.parse(JSON.stringify(dictionary))` antes de guardar
- `useEffect` inicial: copia profunda al cargar diccionario
- `saveFullDictionary` en DatabaseService: copia profunda + verificación post-escritura

**Lección aprendida → Regla 8:** Entregar siempre archivos completos.

### Navegación canónica (App.jsx — 6 tabs fijos)
```
Tab 1: Inicio       → DashboardScreen
Tab 2: Inventario   → ProductsScreen
Tab 3: Vendidos     → SoldHistoryScreen
Tab 4: Stats        → AdvancedStatsScreen
Tab 5: Config       → SettingsScreen
Tab 6: Importar     → VintedImportScreen

Stack (no tabs):
  ProductDetail   → ProductDetailScreen
  SoldEditDetail  → SoldEditDetailView
  Logs            → LogsScreen
```

---

## 🔄 TABLA DE CLASIFICACIÓN AUTOMÁTICA

| Situación | Modo | Agentes |
|-----------|------|---------|
| Bug en archivo existente | PAIR | [DEBUGGER] + [QA_ENGINEER] → entrega archivo completo |
| Feature UI sin datos | PAIR | [UI_SPECIALIST] + [QA_ENGINEER] |
| Feature con datos nuevos | FULL | [ARCHITECT] + [UI_SPECIALIST] + [QA_ENGINEER] + [LIBRARIAN] |
| Typo/crash runtime | SOLO | [DEBUGGER] → entrega archivo completo corregido |

---

## 📋 CHANGELOG DE SPRINTS

| Sprint | Rama | Descripción |
|--------|------|-------------|
| 1-12 | varios | Ver SYSTEM_DESIGN.md |
| **13** | `fix/sprint13-seeffect-typo-subcats` | Fix typo `seEffect` + Regla 8 archivos completos |

---

## ⚡ PROTOCOLO DE ENTREGA DE CÓDIGO

```
SIEMPRE que se modifique un archivo:
  1. Generar el archivo COMPLETO (no fragmentos)
  2. El usuario solo necesita REEMPLAZAR el archivo, sin pegar nada
  3. Nombre de archivo exacto al original del proyecto
  4. Sin comentarios "// reemplaza aquí..." dentro del código

NUNCA:
  - Generar archivos de parche con instrucciones de edición manual
  - Usar placeholders como "// ... resto del código ..."
  - Generar solo la función o bloque modificado
```

---

## 🏁 CHECKLIST PRE-ENTREGA

```
[ ] Los 7 Campos Sagrados no han sido tocados en imports
[ ] Hooks antes de early returns en todos los componentes
[ ] Tab 6 = VintedImportScreen en App.jsx
[ ] _triggerBackup() en todos los métodos de escritura nuevos
[ ] LogService.add() en todos los catch
[ ] SYSTEM_DESIGN.md actualizado
[ ] Archivos entregados COMPLETOS (no fragmentos)   ← NUEVO v4.3
[ ] Sin typos en nombres de hooks/funciones React   ← NUEVO v4.3
```

---

*CLAUDE.md — ResellHub v4.3 · Sprint 13 · Marzo 2026*