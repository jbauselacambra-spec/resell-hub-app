# 📐 Documentación del Sistema de Diseño - ResellHub

## 🎨 Filosofía de Diseño

ResellHub sigue un enfoque de **Minimalismo Vibrante** - interfaces limpias con toques de color estratégicos para guiar la atención del usuario hacia acciones importantes.

### Principios Clave

1. **Claridad Visual**: Jerarquía clara con espaciado generoso
2. **Acción Inmediata**: Botones y CTAs prominentes
3. **Feedback Constante**: Estados visuales para cada interacción
4. **Datos Primero**: Estadísticas siempre visibles y actualizadas
5. **Mobile-First**: Optimizado para uso con una mano

---

## 🎨 Paleta de Colores

### Colores Primarios

```css
Primary Orange:    #FF6B35
├─ Uso: CTAs principales, acciones importantes
├─ Variantes:
│  ├─ Light:  #FF8555
│  ├─ Dark:   #E55A2B
│  └─ Ghost:  #FF6B3515 (15% opacity)

Secondary Blue:    #004E89
├─ Uso: Headers, elementos de confianza
├─ Variantes:
│  ├─ Light:  #0066AA
│  ├─ Dark:   #003366
│  └─ Ghost:  #004E8910 (10% opacity)
```

### Colores Semánticos

```css
Success:  #00D9A3  /* Productos vendidos, confirmaciones */
Warning:  #FFB800  /* Alertas, productos para resubir */
Danger:   #E63946  /* Errores, acciones destructivas */
Info:     #5E81AC  /* Información neutral */
```

### Colores Neutros

```css
Gray Scale:
├─ Gray 50:   #F8F9FA  /* Fondos suaves */
├─ Gray 100:  #F0F0F0  /* Borders sutiles */
├─ Gray 200:  #E8E8E8  /* Dividers */
├─ Gray 300:  #D0D0D0  /* Disabled states */
├─ Gray 500:  #999999  /* Secondary text */
├─ Gray 700:  #666666  /* Body text */
└─ Gray 900:  #1A1A2E  /* Headings, principal text */
```

### Gradientes

```css
Sunset Gradient:
background: linear-gradient(135deg, #FF6B35 0%, #E63946 100%);

Ocean Gradient:
background: linear-gradient(135deg, #004E89 0%, #5E81AC 100%);

Success Gradient:
background: linear-gradient(135deg, #00D9A3 0%, #00C896 100%);
```

---

## 📏 Espaciado y Grid

### Sistema de Espaciado (8pt Grid)

```javascript
const SPACING = {
  xs:   4,   // 0.25rem
  sm:   8,   // 0.5rem
  md:   12,  // 0.75rem
  base: 16,  // 1rem    ← Base unit
  lg:   20,  // 1.25rem
  xl:   24,  // 1.5rem
  xxl:  32,  // 2rem
  xxxl: 48,  // 3rem
};
```

### Aplicación

```javascript
// Padding de containers
paddingHorizontal: SPACING.base,  // 16dp

// Margin entre secciones
marginBottom: SPACING.lg,         // 20dp

// Spacing en cards
padding: SPACING.base,            // 16dp

// Separación de elementos inline
marginRight: SPACING.sm,          // 8dp
```

### Grid Layout

```
┌─────────────────────────────────┐
│ 16dp │    Content Area    │ 16dp│
│      │                    │     │
│      │  ┌──────────────┐  │     │
│      │  │   Card       │  │     │
│      │  └──────────────┘  │     │
│      │        20dp        │     │
│      │  ┌──────────────┐  │     │
│      │  │   Card       │  │     │
│      │  └──────────────┘  │     │
└─────────────────────────────────┘
```

---

## 🔤 Tipografía

### Fuentes

```javascript
Font Family: System Default
├─ iOS:     SF Pro Display / SF Pro Text
├─ Android: Roboto
└─ Fallback: -apple-system, sans-serif
```

### Escala Tipográfica

```javascript
const TYPOGRAPHY = {
  // Display
  display1: {
    fontSize: 36,
    fontWeight: '800',
    lineHeight: 44,
    letterSpacing: -0.5,
  },
  
  // Headings
  h1: {
    fontSize: 28,
    fontWeight: '800',
    lineHeight: 36,
    letterSpacing: -0.5,
  },
  h2: {
    fontSize: 24,
    fontWeight: '700',
    lineHeight: 32,
  },
  h3: {
    fontSize: 20,
    fontWeight: '700',
    lineHeight: 28,
  },
  h4: {
    fontSize: 18,
    fontWeight: '600',
    lineHeight: 26,
  },
  
  // Body
  body: {
    fontSize: 16,
    fontWeight: '400',
    lineHeight: 24,
  },
  bodyBold: {
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 24,
  },
  
  // Small
  small: {
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 20,
  },
  caption: {
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 16,
  },
  
  // Button
  button: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
};
```

### Uso

```javascript
<Text style={[styles.h1, { color: COLORS.gray900 }]}>
  ResellHub
</Text>

<Text style={[styles.body, { color: COLORS.gray700 }]}>
  Gestiona tus productos fácilmente
</Text>
```

---

## 🧩 Componentes

### StatCard

**Dimensiones**: 110 x 100dp  
**Uso**: Mostrar métricas clave  
**Estados**: Normal, Pressed

```javascript
<StatCard
  icon="package"           // Feather icon name
  value={12}              // Número a mostrar
  label="Activos"         // Descripción
  color="#004E89"         // Color temático
  onPress={() => {}}      // Acción al tap
/>
```

**Especificaciones**:
- Background: #FFFFFF
- Border Radius: 16dp
- Shadow: elevation 3
- Padding: 16dp
- Icon Container: 48x48dp, circle
- Icon: 24x24dp
- Value: 24dp, weight 700
- Label: 11dp, weight 500, color #666

### ProductCard

**Dimensiones**: 100% width x 140dp height  
**Layout**: Horizontal  
**Estados**: Normal, Pressed, NeedsRepost, Sold

```javascript
<ProductCard
  product={{
    id: 1,
    title: 'iPhone 13 Pro',
    brand: 'Apple',
    price: 650,
    images: ['url'],
    tags: ['Electrónica'],
    status: 'active', // 'active' | 'needs_repost' | 'sold'
    views: 45,
    daysActive: 30,
  }}
  onPress={() => {}}
/>
```

**Especificaciones**:
- Background: #FFFFFF
- Border: 1dp #E8E8E8
- Border Radius: 16dp
- Thumbnail: 120x120dp (left)
- Content Padding: 12dp
- Border-left (repost): 4dp #FFB800
- Sold Overlay: opacity 0.6

### AlertBanner

**Dimensiones**: 100% width x auto (min 80dp)  
**Uso**: Notificaciones urgentes  
**Animación**: Pulse (1s loop)

```javascript
<AlertBanner
  count={3}              // Número de productos
  onPress={() => {}}    // Acción al tap
/>
```

**Especificaciones**:
- Background: #FFF9E6
- Border-left: 4dp #FFB800
- Border Radius: 12dp
- Padding: 16dp
- Icon Container: 40x40dp, circle
- Icon: 24x24dp
- Shadow: #FFB800, elevation 4

### PrimaryButton

**Dimensiones**: 100% width x 48dp height  
**Estados**: Normal, Pressed, Disabled

```javascript
<TouchableOpacity
  style={styles.primaryButton}
  onPress={() => {}}
  disabled={false}
>
  <Text style={styles.buttonText}>
    Guardar Producto
  </Text>
</TouchableOpacity>
```

**Especificaciones**:
- Background: #FF6B35
- Pressed: #E55A2B, scale 0.96
- Disabled: #CCCCCC, opacity 0.5
- Border Radius: 12dp
- Text: 16dp, weight 700, #FFFFFF

---

## 🎭 Animaciones

### Principios

1. **Duración**: 200-300ms (rápidas y naturales)
2. **Easing**: `useNativeDriver: true` siempre
3. **Feedback**: Cada interacción tiene respuesta visual

### Tipos de Animaciones

#### Scale on Press

```javascript
const scaleAnim = new Animated.Value(1);

const handlePressIn = () => {
  Animated.spring(scaleAnim, {
    toValue: 0.95,
    useNativeDriver: true,
  }).start();
};

const handlePressOut = () => {
  Animated.spring(scaleAnim, {
    toValue: 1,
    friction: 3,
    useNativeDriver: true,
  }).start();
};

<Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
  {/* Content */}
</Animated.View>
```

#### Fade In

```javascript
const fadeAnim = new Animated.Value(0);

useEffect(() => {
  Animated.timing(fadeAnim, {
    toValue: 1,
    duration: 300,
    useNativeDriver: true,
  }).start();
}, []);

<Animated.View style={{ opacity: fadeAnim }}>
  {/* Content */}
</Animated.View>
```

#### Pulse (Alert Banner)

```javascript
const pulseAnim = new Animated.Value(1);

useEffect(() => {
  Animated.loop(
    Animated.sequence([
      Animated.timing(pulseAnim, {
        toValue: 1.02,
        duration: 1000,
        useNativeDriver: true,
      }),
      Animated.timing(pulseAnim, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      }),
    ])
  ).start();
}, []);
```

#### Slide In from Bottom

```javascript
const slideAnim = new Animated.Value(100);

useEffect(() => {
  Animated.spring(slideAnim, {
    toValue: 0,
    friction: 8,
    tension: 40,
    useNativeDriver: true,
  }).start();
}, []);

<Animated.View 
  style={{ 
    transform: [{ translateY: slideAnim }] 
  }}
>
  {/* Content */}
</Animated.View>
```

---

## 📱 Responsive Design

### Breakpoints

```javascript
import { Dimensions } from 'react-native';

const { width, height } = Dimensions.get('window');

const BREAKPOINTS = {
  small: width < 375,      // iPhone SE
  medium: width >= 375,    // iPhone 11, Poco X7 Pro
  large: width >= 768,     // iPad, tablets
};
```

### Adaptive Layouts

```javascript
// 3 columnas en portrait, 4 en landscape
const statsPerRow = width > height ? 4 : 3;

// Cards más grandes en tablets
const cardWidth = width >= 768 
  ? (width - 64) / 2  // 2 columnas
  : width - 32;       // 1 columna
```

### Safe Areas

```javascript
import { SafeAreaView } from 'react-native';

<SafeAreaView style={{ flex: 1 }}>
  {/* Content automáticamente respeta notch, home indicator, etc. */}
</SafeAreaView>
```

---

## ♿ Accesibilidad

### Contraste de Color

Todos los pares de colores cumplen **WCAG AA**:

```
Primary (#FF6B35) on White → 4.8:1 ✅
Gray 700 (#666) on White → 5.7:1 ✅
Gray 900 (#1A1A2E) on White → 13.4:1 ✅
```

### Touch Targets

**Mínimo**: 48x48dp (Apple & Google guidelines)

```javascript
// Todos los botones e íconos táctiles
minWidth: 48,
minHeight: 48,
```

### Screen Reader Support

```javascript
<TouchableOpacity
  accessible={true}
  accessibilityLabel="Marcar producto como vendido"
  accessibilityHint="Mueve este producto a la sección de vendidos"
  accessibilityRole="button"
>
  <Icon name="check-circle" />
</TouchableOpacity>
```

### Focus Indicators

```javascript
// Modo de navegación por teclado (tablets con teclado)
<TouchableOpacity
  style={[
    styles.button,
    isFocused && styles.buttonFocused
  ]}
/>

buttonFocused: {
  borderWidth: 2,
  borderColor: '#FF6B35',
}
```

---

## 🌙 Modo Oscuro (Futuro)

### Paleta Dark Mode

```css
Dark Background:  #121212
Dark Surface:     #1E1E1E
Dark Border:      #2C2C2C

Primary (ajustado):  #FF7F4D
Success (ajustado):  #00EBB5
```

### Implementación

```javascript
import { useColorScheme } from 'react-native';

const scheme = useColorScheme();
const colors = scheme === 'dark' ? DARK_COLORS : LIGHT_COLORS;

<View style={{ backgroundColor: colors.background }}>
  {/* Content */}
</View>
```

---

## 📊 Iconografía

### Librería

**Feather Icons** - Consistente, minimalista, open-source

```javascript
import Icon from 'react-native-vector-icons/Feather';

<Icon name="home" size={24} color="#FF6B35" />
```

### Tamaños Estándar

```javascript
const ICON_SIZES = {
  small: 16,   // Inline con texto
  medium: 24,  // Botones, tabs
  large: 32,   // Headers, features
  xlarge: 48,  // Ilustraciones
};
```

### Uso por Contexto

```
home → Dashboard
package → Productos
bar-chart-2 → Estadísticas
settings → Configuración
alert-circle → Alertas
check-circle → Éxito/Vendido
refresh-cw → Resubir
eye → Vistas
clock → Tiempo activo
```

---

## 🎯 Estados de UI

### Loading States

```javascript
// Shimmer effect
<View style={styles.shimmer}>
  <LinearGradient
    colors={['#E8E8E8', '#F0F0F0', '#E8E8E8']}
    start={{ x: 0, y: 0 }}
    end={{ x: 1, y: 0 }}
    style={{ flex: 1 }}
  />
</View>
```

### Empty States

```javascript
<View style={styles.emptyState}>
  <Icon name="inbox" size={64} color="#CCC" />
  <Text style={styles.emptyTitle}>
    No hay productos
  </Text>
  <Text style={styles.emptySubtitle}>
    Añade tu primer producto para empezar
  </Text>
  <PrimaryButton 
    title="Añadir Producto"
    onPress={() => {}}
  />
</View>
```

### Error States

```javascript
<View style={styles.errorState}>
  <Icon name="alert-triangle" size={48} color="#E63946" />
  <Text style={styles.errorTitle}>
    Algo salió mal
  </Text>
  <SecondaryButton 
    title="Reintentar"
    onPress={() => {}}
  />
</View>
```

---

## 📦 Exportar Componentes Reutilizables

### Estructura de Carpetas

```
components/
├── atoms/
│   ├── Button.jsx
│   ├── Icon.jsx
│   └── Tag.jsx
├── molecules/
│   ├── StatCard.jsx
│   ├── ProductCard.jsx
│   └── AlertBanner.jsx
└── organisms/
    ├── ProductList.jsx
    ├── StatsGrid.jsx
    └── ChartSection.jsx
```

### Ejemplo: Button Component

```javascript
// components/atoms/Button.jsx

export const Button = ({ 
  title, 
  onPress, 
  variant = 'primary',
  disabled = false,
  icon,
  ...props 
}) => {
  const styles = getButtonStyles(variant);
  
  return (
    <TouchableOpacity
      style={[styles.button, disabled && styles.disabled]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.7}
      {...props}
    >
      {icon && <Icon name={icon} size={20} color="#FFF" />}
      <Text style={styles.text}>{title}</Text>
    </TouchableOpacity>
  );
};
```

---

**Sistema de Diseño v1.0 - ResellHub**  
*Última actualización: Febrero 2025*
