# SKILL: react-native-hooks-safety

## Cuándo usar esta skill

Usar esta skill siempre que:
- Se creen o modifiquen componentes React Native con hooks
- Se usen `useState`, `useEffect`, `useMemo`, `useCallback`, `useRef`
- Aparezca el error "Rendered more hooks than during the previous render"
- Aparezca el error "React has detected a change in the order of Hooks called"
- Se añadan early returns (carga, loading states, guards de null) a un componente

---

## La Regla Fundamental

**React rastrea hooks por posición ordinal, no por nombre.**

Si el render N ejecuta 5 hooks y el render N+1 ejecuta 8 hooks → CRASH inmediato.

```
Error: Rendered more hooks than during the previous render.
```

---

## Patrón PROHIBIDO — Early return antes de hooks

```jsx
// ❌ CRASH GARANTIZADO
export default function MyScreen({ navigation }) {
  const [data, setData] = useState(null);           // hook 1
  useEffect(() => { load().then(setData); }, []);    // hook 2

  if (!data) return null;   // ← si esto ejecuta, los hooks 3,4,5 no se ejecutan

  const processed = useMemo(() => compute(data), [data]);  // hook 3 — CONDICIONAL
  const filtered  = useMemo(() => filter(data), [data]);   // hook 4 — CONDICIONAL
  const sorted    = useMemo(() => sort(data), [data]);     // hook 5 — CONDICIONAL

  return <View>{...}</View>;
}
```

**Por qué crashea:**
- Render 1: data=null → sale en el return → 2 hooks ejecutados
- Render 2: data cargado → pasa el return → 5 hooks ejecutados
- React: "antes tenías 2, ahora tienes 5" → CRASH

---

## Patrón CORRECTO — Todos los hooks primero

```jsx
// ✅ CORRECTO — todos los hooks ANTES de cualquier return condicional
export default function MyScreen({ navigation }) {
  // ── ZONA DE HOOKS — nunca se interrumpe ──────────────────
  const [data, setData] = useState(null);           // hook 1
  useEffect(() => { load().then(setData); }, []);    // hook 2

  // useMemo maneja null internamente — SIEMPRE se ejecuta
  const processed = useMemo(() => data ? compute(data) : [], [data]);  // hook 3
  const filtered  = useMemo(() => data ? filter(data) : [], [data]);   // hook 4
  const sorted    = useMemo(() => data ? sort(data) : [], [data]);     // hook 5
  // ── FIN ZONA DE HOOKS ────────────────────────────────────

  // Early return DESPUÉS de todos los hooks
  if (!data) return <LoadingView />;

  return <View>{...}</View>;
}
```

---

## Casos especiales frecuentes en ResellHub

### Caso 1: config nunca es null

```jsx
// ❌ INCORRECTO — guard innecesario que puede causar crash
const [config, setConfig] = useState(() => DatabaseService.getConfig());
// ...hooks...
if (!config) return null;   // DatabaseService.getConfig() NUNCA retorna null
const kpis = useMemo(...);  // CONDICIONAL = BUG
```

```jsx
// ✅ CORRECTO — init síncrono, nunca null
const [config, setConfig] = useState(() => DatabaseService.getConfig());
// getConfig() siempre retorna { ...DEFAULT_CONFIG, ...savedConfig }
// El guard es innecesario Y peligroso

const kpis = useMemo(() => {
  // Si config está vacío, los parseInt con fallback funcionan bien
  return compute(config);
}, [config]);

// Derivadas simples (no hooks) pueden ir donde quieran
const ttsLightning = parseInt(config?.ttsLightning || 7);
```

### Caso 2: kpis que pueden ser null

```jsx
// ❌ INCORRECTO
const [kpis, setKpis] = useState(null);
if (!kpis) return null;             // antes de useMemo
const annual = useMemo(..., [kpis]); // CONDICIONAL = BUG

// ✅ CORRECTO
const [kpis, setKpis] = useState(null);
const annual = useMemo(() => kpis ? groupByYear(kpis) : [], [kpis]); // maneja null

if (!kpis) return null; // después de todos los hooks
```

### Caso 3: navigation listener en useEffect

```jsx
// ✅ PATRÓN ESTÁNDAR ResellHub para cargar datos en focus
useEffect(() => {
  const load = () => {
    setConfig(DatabaseService.getConfig());
    setData(DatabaseService.getData());
  };
  load();
  const unsub = navigation.addListener('focus', load);
  return unsub;  // cleanup
}, [navigation]);
```

---

## Checklist de verificación

Antes de entregar cualquier componente React Native:

```
[ ] ¿Todos los useState están al inicio del componente?
[ ] ¿El useEffect está antes de cualquier return condicional?
[ ] ¿Todos los useMemo/useCallback están antes de cualquier return condicional?
[ ] ¿Los useMemo manejan internamente los casos null/undefined de sus dependencias?
[ ] ¿Los early returns (if(!x) return null) están DESPUÉS de todos los hooks?
[ ] ¿Las variables derivadas de estado (no hooks) están después de los hooks?
```

---

## Herramienta de diagnóstico

Para detectar el patrón problemático en un fichero:

```python
# Ejecutar en bash_tool para diagnosticar un fichero
import re

content = open('MyScreen.jsx').read()
lines = content.split('\n')
hook_re = re.compile(r'\b(useState|useEffect|useMemo|useCallback|useRef)\b')
return_re = re.compile(r'^\s+if\s*\(.*\)\s*return\s+(null|<|\w)')

first_return = None
for i, line in enumerate(lines, 1):
    if return_re.match(line) and first_return is None:
        first_return = i
        print(f"Primer early return en línea {i}: {line.strip()}")
    if first_return and hook_re.search(line):
        print(f"  ⚠️ HOOK después de early return en línea {i}: {line.strip()}")
```

---

## Registro de bugs detectados y corregidos en ResellHub

| Sprint | Screen | Bug | Fix |
|--------|--------|-----|-----|
| 9 | `AdvancedStatsScreen` | `useMemo` × 3 después de `if (!kpis) return null` | Mover `useMemo` antes del return |
| 9.1 | `SoldHistoryScreen` | `useMemo` × 3 después de `if (!config) return null` | Eliminar guard (config nunca es null) |

---

## Referencia oficial

- React Rules of Hooks: https://react.dev/reference/rules/rules-of-hooks
- "Only Call Hooks at the Top Level" — la regla más importante de React
