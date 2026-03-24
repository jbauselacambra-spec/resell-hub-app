# Skill: stale-closure-prevention — React State Handlers

**ID:** UI-007 / ARCH-008  
**Agente propietario:** DEBUGGER + QA_ENGINEER  
**Versión:** 1.0 — Marzo 2026  
**Disparador:** Cualquier handler que lea estado React que pudo haber sido modificado por callbacks funcionales

---

## El Bug (historial)

**Sprint 13b — SettingsScreen:**

```
SÍNTOMA:  Usuario añade subcategoría "Cortavientos" a "Ropa" en Settings.
           La subcategoría aparece en la UI correctamente.
           Al pulsar "Guardar categorías" → 0 subcategorías guardadas.
           Logs: "💾 Guardando: 7 cats, 0 subcats"

CAUSA:    handleSaveDictionary() leía `dictionary` del closure del render
           donde se definió el componente/función. Los updates funcionales
           setDictionary(prev => ...) actualizaron el estado de React,
           pero el closure ya había capturado el valor anterior.

LOG DIAGNÓSTICO:
  "CatModal: 7 cats, 0 subcats"  ← modal abre con dict del MMKV
  "Guardando: 7 cats, 0 subcats" ← handler lee el mismo dict inicial
  (las subcategorías añadidas en UI nunca llegaron al handler)
```

---

## Por qué ocurre

```js
function MyComponent() {
  const [dict, setDict] = useState({ Ropa: { subcategories: {} } });

  // Este handler se define en el render N
  // Captura `dict` del render N en su closure
  const handleSave = () => {
    console.log(dict); // ← SIEMPRE el dict del render N
    save(dict);        // ← stale si dict cambió después del render N
  };

  const addSub = (sub) => {
    // Esto actualiza React state en el render N+1
    // PERO handleSave sigue apuntando al dict del render N
    setDict(prev => ({
      ...prev,
      Ropa: {
        ...prev.Ropa,
        subcategories: { ...prev.Ropa.subcategories, [sub]: {} }
      }
    }));
  };

  // El usuario pulsa "+" → addSub → React re-renders → dict actualizado en UI
  // El usuario pulsa "Guardar" → handleSave → lee dict STALE → 0 subcategorías
}
```

---

## Detección

**Señales de stale closure en estado:**

1. La UI muestra los datos correctos (el estado React está actualizado)
2. Al guardar, los datos en MMKV/BD no contienen los cambios
3. El bug es SILENCIOSO — no hay crash, no hay error
4. Los logs muestran el valor original, no el actualizado
5. El problema empeora cuando hay múltiples niveles de estado anidado

**Pregunta de diagnóstico clave:**
> "¿El handler que guarda fue definido en un render anterior al que hizo el update?"

---

## Solución: useRef como mirror del estado

```js
function MyComponent() {
  // ── PATRÓN CORRECTO ───────────────────────────────────────────
  const dictRef = useRef({});           // ref: siempre fresco
  const [dict, setDict] = useState({}); // state: para re-renders de UI

  // Helper que actualiza AMBOS de forma atómica
  const updateDict = (updaterOrValue) => {
    if (typeof updaterOrValue === 'function') {
      setDict(prev => {
        const next = updaterOrValue(prev);
        dictRef.current = next;   // ← sincronizar ref
        return next;
      });
    } else {
      dictRef.current = updaterOrValue; // ← sincronizar ref
      setDict(updaterOrValue);
    }
  };

  // El handler lee del REF — siempre fresco, nunca stale
  const handleSave = () => {
    const current = dictRef.current;  // ← ref, no closure
    save(current);
  };

  // Los updates usan el helper
  const addSub = (cat, sub) => {
    updateDict(prev => ({
      ...prev,
      [cat]: {
        ...prev[cat],
        subcategories: { ...(prev[cat]?.subcategories || {}), [sub]: {} }
      }
    }));
  };

  // La UI lee del state (para re-renders)
  return <View>{Object.keys(dict).map(...)}</View>;
}
```

---

## Alternativas (menos preferidas)

### Opción B: useCallback con deps completas

```js
// ✅ Funciona, pero se recrea el handler en cada render (peor performance)
const handleSave = useCallback(() => {
  save(dict);
}, [dict]); // ← dict en deps = siempre el valor más reciente
```

**Problema:** Si el botón "Guardar" tiene `activeOpacity` y el usuario
pulsa muy rápido, puede ejecutar la versión anterior antes del re-render.
`useRef` es más seguro para datos críticos.

### Opción C: Pasar el dict como parámetro al handler

```js
// ✅ Simple para casos pequeños
<SaveBtn onPress={() => handleSave(dict)} />

const handleSave = (currentDict) => {
  save(currentDict); // ← parámetro, no closure
};
```

**Problema:** Difícil de mantener con estado complejo y muchos niveles de anidación.

---

## Checklist QA para handlers de guardado

```
[ ] El handler que guarda ¿lee del closure de `state`?
    → Si SÍ: ¿es posible que el estado cambie entre renders?
       → Si SÍ: usar useRef como mirror
[ ] Los updates de estado anidado usan setDictionary(prev => ...)?
    → Si SÍ: el handler que los lee necesita useRef
[ ] Hay múltiples CatCardExpanded/subcomponentes que llaman setDictionary?
    → Si SÍ: stale closure casi garantizado — usar useRef
[ ] El log de guardado muestra menos datos que la UI?
    → CONFIRMADO stale closure — aplicar patrón useRef
```

---

## Archivos en ResellHub que usan este patrón

| Archivo | State con stale closure | Fix aplicado |
|---------|------------------------|--------------|
| `screens/SettingsScreen.jsx` | `dictionary` leído en `handleSaveDictionary` | `dictionaryRef` + `updateDictionary()` helper ✅ |

---

## Regla 9 en CLAUDE.md

Este skill implementa la **Regla 9** del sistema multiagente:

> Handlers que leen estado anidado modificado por callbacks funcionales
> DEBEN usar `useRef` como mirror para evitar stale closures silenciosos.
