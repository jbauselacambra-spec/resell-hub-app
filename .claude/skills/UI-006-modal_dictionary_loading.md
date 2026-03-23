# Skill: UI-006 — Modal Dictionary Loading (Anti-Regression)

**ID:** UI-006  
**Agente propietario:** UI_SPECIALIST + DEBUGGER  
**Versión:** 2.0 — Marzo 2026 (corrige Sprint 12 insuficiente)  
**Disparador:** Cualquier modal que muestre categorías o subcategorías del diccionario

---

## El Problema (historial de bugs)

Este bug ha aparecido **3 veces** en sprints distintos porque cada fix fue incompleto:

| Sprint | Fix aplicado | Por qué falló |
|--------|-------------|---------------|
| Sprint 12 | Corregir indentación de `useEffect` | El useEffect correcto carga dict, pero si getFullDictionary() devuelve null (bug Hotfix 5), el modal sigue vacío |
| Hotfix 5 | Corregir handleSaveDictionary para usar DatabaseService | Fix correcto, pero datos anteriores ya corrompidos en MMKV equivocado |
| Sprint 12 v2 | useState inicializado con dict cargado | No cubría el fallback al diccionario legacy |

---

## Root Cause Definitivo

El flujo roto era:

```
CatModal/CategoryModal abre
  → useEffect ejecuta
  → DatabaseService.getFullDictionary()
  → devuelve null (datos guardados en MMKV equivocado antes del fix)
  → fallback a getDictionary()
  → también vacío (mismo problema)
  → dict = {}
  → hasSubs() siempre false
  → el modal nunca avanza al paso 2
```

---

## Patrón Correcto — `loadDictionaryWithFallbacks()`

**SIEMPRE usar esta función en cualquier modal que cargue el diccionario:**

```js
// [OBLIGATORIO] Función centralizada — copiar exactamente en cada archivo que la necesite
function loadDictionaryWithFallbacks() {
  try {
    // Prioridad 1: diccionario completo con subcategorías
    const full = DatabaseService.getFullDictionary();
    if (full && typeof full === 'object' && Object.keys(full).length > 0) {
      LogService.debug(`Modal: dict completo — ${Object.keys(full).length} cats`, LOG_CTX.UI);
      return full;
    }

    // Prioridad 2: diccionario legacy (sin subcategorías, pero al menos muestra categorías)
    const legacy = DatabaseService.getDictionary();
    if (legacy && typeof legacy === 'object' && Object.keys(legacy).length > 0) {
      LogService.debug(`Modal: usando dict legacy — ${Object.keys(legacy).length} cats`, LOG_CTX.UI);
      const normalized = {};
      Object.entries(legacy).forEach(([cat, val]) => {
        normalized[cat] = Array.isArray(val)
          ? { tags: val, subcategories: {} }
          : { tags: val?.tags || [], subcategories: val?.subcategories || {} };
      });
      return normalized;
    }

    // Nivel 3: sin datos — mostrar mensaje de ayuda en la UI
    LogService.warn('Modal dict: vacío — configura en Ajustes → Categorías', LOG_CTX.UI);
    return {};
  } catch (e) {
    LogService.error('loadDictionaryWithFallbacks', LOG_CTX.UI, e);
    return {};
  }
}
```

---

## Patrón de Componente Modal Correcto

```jsx
function CatModal({ visible, onClose, onSelect, currentCat, currentSub }) {
  // [CRÍTICO] Inicializar CON datos ya cargados — no esperar al useEffect
  // Esto garantiza que el primer render ya tiene el dict correcto
  const [dict, setDict] = useState(() => loadDictionaryWithFallbacks());
  const [selCat, setSelCat] = useState(currentCat || null);
  const [step, setStep] = useState('cat');

  React.useEffect(() => {
    if (!visible) return;
    // Recargar en cada apertura para capturar cambios recientes en Ajustes
    const freshDict = loadDictionaryWithFallbacks();
    setDict(freshDict);
    setSelCat(currentCat || null);
    setStep('cat');

    // Log de diagnóstico SIEMPRE — ayuda a detectar futuros problemas
    const catCount = Object.keys(freshDict).length;
    const subCount = Object.values(freshDict).reduce(
      (acc, v) => acc + Object.keys(v?.subcategories || {}).length, 0
    );
    LogService.debug(
      `CatModal abierto — ${catCount} cats, ${subCount} subs totales`,
      LOG_CTX.UI,
    );
  }, [visible, currentCat]);

  // ... resto del componente
}
```

---

## Anti-Patrones PROHIBIDOS

```jsx
// ❌ PROHIBIDO: useState con valor vacío — el primer render no tiene datos
const [dict, setDict] = useState({});

// ❌ PROHIBIDO: cargar solo del diccionario completo sin fallback
const full = DatabaseService.getFullDictionary();
if (full) setDict(full);
// (si full es null por datos corruptos, el modal queda vacío)

// ❌ PROHIBIDO: useEffect con indentación incorrecta (fuera del componente)
function MyModal() {
  const [dict, setDict] = useState({});

React.useEffect(() => {   // ← sin indentación = nivel módulo = se ejecuta una vez
  ...
}, [visible]);

// ❌ PROHIBIDO: No mostrar estado vacío con instrucciones al usuario
// Si dict = {}, el usuario no sabe qué hacer. SIEMPRE mostrar mensaje de ayuda.
```

---

## Estado Vacío — SIEMPRE mostrar mensaje de ayuda

```jsx
{cats.length === 0 && step === 'cat' && (
  <View style={{ alignItems:'center', padding:24, gap:10 }}>
    <Icon name="tag" size={32} color={DS.textLow}/>
    <Text style={{ fontSize:15, fontWeight:'800', color:DS.textMed }}>
      Sin categorías configuradas
    </Text>
    <Text style={{ fontSize:12, color:DS.textLow, textAlign:'center', lineHeight:18 }}>
      Ve a Ajustes → Categorías para añadir tus categorías y subcategorías.
    </Text>
  </View>
)}
```

---

## Archivos que usan este patrón

| Archivo | Componente modal | Versión correcta |
|---------|----------------|-----------------|
| `screens/ProductDetailScreen.jsx` | `CatModal` | v2.0 (Marzo 2026) |
| `screens/SoldEditDetailView.jsx` | `CategoryModal` | v2.0 (Marzo 2026) |
| `screens/SettingsScreen.jsx` | Modal calendario | Carga dict en useEffect principal ✅ |

---

## Checklist QA para modales de categorías

```
[ ] useState inicializado con loadDictionaryWithFallbacks() (no {})
[ ] useEffect recarga en cada apertura (no solo al montar)
[ ] Logs de diagnóstico con conteo de cats y subs
[ ] Estado vacío muestra mensaje de ayuda con instrucciones
[ ] hasSubs() funciona correctamente con el dict cargado
[ ] El paso 2 (subcategorías) aparece cuando hay subs configuradas
[ ] El paso 1 (categorías) funciona aunque no haya subs
```
