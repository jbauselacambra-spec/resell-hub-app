/**
 * theme.js — ResellHub Design System v2
 *
 * FUENTE DE VERDAD VISUAL para toda la app.
 * Importar desde cualquier pantalla:
 *   import { DS, SEMANTIC, FONT } from '../theme';
 *
 * Tipografía: DM Sans (body) + DM Mono (números/precios)
 * Para usarla, añadir en el plugin expo de app.json o cargar con expo-font.
 */

import { Platform } from 'react-native';

// ─── TIPOGRAFÍA ───────────────────────────────────────────────────────────────
export const FONT = {
  // Weights disponibles de DM Sans: 300 | 400 | 500 | 600 | 700
  sans:         Platform.OS === 'android' ? 'DMSans-Regular'   : 'DM Sans',
  sansMedium:   Platform.OS === 'android' ? 'DMSans-Medium'    : 'DM Sans',
  sansSemi:     Platform.OS === 'android' ? 'DMSans-SemiBold'  : 'DM Sans',
  sansBold:     Platform.OS === 'android' ? 'DMSans-Bold'      : 'DM Sans',
  // DM Mono: para precios, fechas, datos numéricos
  mono:         Platform.OS === 'android' ? 'DMSans-Regular'   : 'DM Mono',
  monoMedium:   Platform.OS === 'android' ? 'DMSans-Medium'    : 'DM Mono',
};

// Fallback seguro mientras se carga la fuente custom
export const FONT_FAMILY = {
  body: Platform.select({ ios: 'System', android: 'sans-serif' }),
  mono: Platform.select({ ios: 'Menlo', android: 'monospace' }),
};

// ─── TAMAÑOS DE FUENTE ────────────────────────────────────────────────────────
export const FONT_SIZE = {
  xs:    10,
  sm:    12,
  base:  14,
  md:    16,
  lg:    18,
  xl:    20,
  '2xl': 24,
  '3xl': 28,
  '4xl': 34,
};

// ─── LINE HEIGHTS ─────────────────────────────────────────────────────────────
export const LINE_HEIGHT = {
  tight:  1.1,
  snug:   1.3,
  normal: 1.5,
  relaxed: 1.7,
};

// ─── LETTER SPACING ───────────────────────────────────────────────────────────
export const TRACKING = {
  tight:  -0.5,
  normal:  0,
  wide:    0.5,
  wider:   1.0,
  widest:  1.5,
};

// ─── PALETA DE COLORES ────────────────────────────────────────────────────────

/**
 * DS — Design System tokens. Úsalos SIEMPRE.
 * Nunca uses hex hardcodeados en las pantallas.
 */
export const DS = {
  // ── Marca ──────────────────────────────────────────────────────────────────
  brand:         '#FF4F1A',   // Naranja primario — CTAs, KPI acento
  brandDim:      'rgba(255,79,26,0.10)',
  brandMid:      'rgba(255,79,26,0.18)',
  brandLight:    '#FFF2EE',   // Fondo hover/tint brand

  // ── Superficies ────────────────────────────────────────────────────────────
  white:         '#FFFFFF',
  surface:       '#FFFFFF',   // Cards elevadas
  surface2:      '#F6F5F3',   // Fondo de pantalla (app background)
  surface3:      '#EFEDE9',   // Inputs, chips inactivos, separadores

  // ── Bordes ─────────────────────────────────────────────────────────────────
  border:        'rgba(0,0,0,0.07)',
  borderMed:     'rgba(0,0,0,0.12)',
  borderStrong:  'rgba(0,0,0,0.20)',

  // ── Texto ──────────────────────────────────────────────────────────────────
  text:          '#0F0E0D',   // Texto principal
  text2:         '#5A5752',   // Texto secundario / subtítulos
  text3:         '#A09C97',   // Texto terciario / labels / placeholders

  // ── Semánticos ─────────────────────────────────────────────────────────────
  success:       '#1A9E6E',
  successDim:    'rgba(26,158,110,0.10)',
  successLight:  '#E8F7F2',

  warning:       '#D4820A',
  warningDim:    'rgba(212,130,10,0.10)',
  warningLight:  '#FEF3E2',

  danger:        '#D63B3B',
  dangerDim:     'rgba(214,59,59,0.10)',
  dangerLight:   '#FDEAEA',

  blue:          '#1A68D4',
  blueDim:       'rgba(26,104,212,0.10)',
  blueLight:     '#E8F1FD',

  purple:        '#7248D4',
  purpleDim:     'rgba(114,72,212,0.10)',
  purpleLight:   '#F0EAFF',
};

// ─── ESPACIADO ────────────────────────────────────────────────────────────────
export const SPACE = {
  1:  4,
  2:  8,
  3:  12,
  4:  16,
  5:  20,
  6:  24,
  8:  32,
  10: 40,
  12: 48,
  16: 64,
};

// ─── RADIO DE ESQUINAS ────────────────────────────────────────────────────────
export const RADIUS = {
  sm:  8,    // Badges, inputs pequeños, botones internos
  md:  12,   // Rows de settings, inputs estándar
  lg:  18,   // Cards de producto, alertas, secciones
  xl:  24,   // Cards principales, hero sections
  full: 999, // Pills completamente redondas
};

// ─── SOMBRAS ──────────────────────────────────────────────────────────────────
export const SHADOW = {
  none: {},
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 6,
  },
};

// ─── COMPONENTES ESTÁNDAR ─────────────────────────────────────────────────────

/**
 * Estilos de tarjeta base. Usar con StyleSheet.compose o spread.
 * Ejemplo: style={[CARD.default, styles.miCard]}
 */
export const CARD = {
  default: {
    backgroundColor: DS.surface,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: DS.border,
    padding: SPACE[4],
  },
  compact: {
    backgroundColor: DS.surface,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: DS.border,
    padding: SPACE[3],
  },
  flat: {
    backgroundColor: DS.surface3,
    borderRadius: RADIUS.md,
    padding: SPACE[3],
  },
};

/**
 * Estilos de badge/chip.
 */
export const BADGE = {
  base: {
    paddingHorizontal: SPACE[2],
    paddingVertical: 3,
    borderRadius: RADIUS.full,
    alignSelf: 'flex-start',
  },
  success: {
    backgroundColor: DS.successDim,
  },
  warning: {
    backgroundColor: DS.warningDim,
  },
  danger: {
    backgroundColor: DS.dangerDim,
  },
  blue: {
    backgroundColor: DS.blueDim,
  },
  brand: {
    backgroundColor: DS.brandDim,
  },
};

export const BADGE_TEXT = {
  base: {
    fontSize: FONT_SIZE.xs,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  success: { color: DS.success },
  warning: { color: DS.warning },
  danger:  { color: DS.danger  },
  blue:    { color: DS.blue    },
  brand:   { color: DS.brand   },
};

/**
 * Estilos de botón.
 */
export const BTN = {
  primary: {
    backgroundColor: DS.brand,
    borderRadius: RADIUS.lg,
    paddingVertical: SPACE[4],
    paddingHorizontal: SPACE[5],
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: SPACE[2],
  },
  secondary: {
    backgroundColor: DS.surface3,
    borderRadius: RADIUS.lg,
    paddingVertical: SPACE[4],
    paddingHorizontal: SPACE[5],
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: SPACE[2],
    borderWidth: 1,
    borderColor: DS.borderMed,
  },
  ghost: {
    borderRadius: RADIUS.lg,
    paddingVertical: SPACE[4],
    paddingHorizontal: SPACE[5],
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: SPACE[2],
  },
  sm: {
    borderRadius: RADIUS.sm,
    paddingVertical: SPACE[2],
    paddingHorizontal: SPACE[3],
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
};

export const BTN_TEXT = {
  primary:   { color: '#FFFFFF', fontSize: FONT_SIZE.base, fontWeight: '600', letterSpacing: 0.1 },
  secondary: { color: DS.text,   fontSize: FONT_SIZE.base, fontWeight: '600' },
  ghost:     { color: DS.brand,  fontSize: FONT_SIZE.base, fontWeight: '600' },
  sm:        { fontSize: FONT_SIZE.sm, fontWeight: '700' },
};

/**
 * Estilos de input de texto.
 */
export const INPUT = {
  base: {
    backgroundColor: DS.surface3,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: DS.border,
    paddingHorizontal: SPACE[4],
    paddingVertical: SPACE[3],
    fontSize: FONT_SIZE.base,
    color: DS.text,
  },
  focused: {
    borderColor: DS.brand,
    backgroundColor: DS.brandLight,
  },
};

// ─── TEXTOS SEMÁNTICOS ─────────────────────────────────────────────────────────

/**
 * TXT — Tipografía estándar. Usar para garantizar consistencia.
 * Ejemplo: <Text style={TXT.title}>Mi título</Text>
 */
export const TXT = {
  // Display / Pantallas principales
  display: {
    fontSize: FONT_SIZE['3xl'],
    fontWeight: '700',
    color: DS.text,
    letterSpacing: TRACKING.tight,
    lineHeight: FONT_SIZE['3xl'] * LINE_HEIGHT.tight,
  },
  heading: {
    fontSize: FONT_SIZE.xl,
    fontWeight: '700',
    color: DS.text,
    letterSpacing: -0.3,
  },
  subheading: {
    fontSize: FONT_SIZE.lg,
    fontWeight: '600',
    color: DS.text,
  },
  title: {
    fontSize: FONT_SIZE.md,
    fontWeight: '600',
    color: DS.text,
  },
  body: {
    fontSize: FONT_SIZE.base,
    fontWeight: '400',
    color: DS.text,
    lineHeight: FONT_SIZE.base * LINE_HEIGHT.normal,
  },
  bodyMed: {
    fontSize: FONT_SIZE.base,
    fontWeight: '500',
    color: DS.text,
  },
  caption: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '400',
    color: DS.text2,
    lineHeight: FONT_SIZE.sm * LINE_HEIGHT.normal,
  },
  label: {
    fontSize: FONT_SIZE.xs,
    fontWeight: '600',
    color: DS.text3,
    letterSpacing: TRACKING.wider,
    textTransform: 'uppercase',
  },
  // Números / Precios
  price: {
    fontSize: FONT_SIZE.xl,
    fontWeight: '700',
    color: DS.brand,
    fontFamily: FONT_FAMILY.mono,
    letterSpacing: TRACKING.tight,
  },
  priceSm: {
    fontSize: FONT_SIZE.md,
    fontWeight: '700',
    color: DS.brand,
    fontFamily: FONT_FAMILY.mono,
  },
  mono: {
    fontFamily: FONT_FAMILY.mono,
    fontWeight: '500',
  },
  // Estados semánticos
  success: { fontSize: FONT_SIZE.sm, fontWeight: '700', color: DS.success },
  warning: { fontSize: FONT_SIZE.sm, fontWeight: '700', color: DS.warning },
  danger:  { fontSize: FONT_SIZE.sm, fontWeight: '700', color: DS.danger  },
  muted:   { fontSize: FONT_SIZE.sm, fontWeight: '400', color: DS.text3   },
};

// ─── LAYOUT ───────────────────────────────────────────────────────────────────
export const LAYOUT = {
  screenPadH: SPACE[4],   // Padding horizontal de pantallas: 16px
  screenPadV: SPACE[5],   // Padding vertical de pantallas: 20px
  headerPadT: 52,         // Padding top de headers (safe area Android)
  tabBarH:    72,         // Altura de la barra de tabs
  sectionGap: SPACE[6],   // Gap entre secciones: 24px
  cardGap:    SPACE[2],   // Gap entre cards: 8px
};

// ─── MONTH NAMES ──────────────────────────────────────────────────────────────
export const MONTH_NAMES = [
  'Enero','Febrero','Marzo','Abril','Mayo','Junio',
  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre',
];
export const MONTH_NAMES_SHORT = [
  'Ene','Feb','Mar','Abr','May','Jun',
  'Jul','Ago','Sep','Oct','Nov','Dic',
];

// ─── HELPERS ──────────────────────────────────────────────────────────────────

/**
 * ttsColor(tts, config) → color semántico para el TTS
 */
export function ttsColor(tts, config) {
  if (!tts || tts === 0) return DS.text3;
  const lightning = parseInt(config?.ttsLightning || 7);
  const anchor    = parseInt(config?.ttsAnchor    || 30);
  if (tts <= lightning) return DS.success;
  if (tts <= anchor)    return DS.warning;
  return DS.danger;
}

/**
 * ttsEmoji(tts, config) → emoji para el TTS
 */
export function ttsEmoji(tts, config) {
  if (!tts || tts === 0) return '';
  const lightning = parseInt(config?.ttsLightning || 7);
  const anchor    = parseInt(config?.ttsAnchor    || 30);
  if (tts <= lightning) return '⚡';
  if (tts <= anchor)    return '🟡';
  return '⚓';
}

/**
 * fmtPrice(value) → "89€" o "89,50€"
 */
export function fmtPrice(value) {
  const n = Math.max(0, Number(value ?? 0));
  return n % 1 === 0 ? `${n}€` : `${n.toFixed(2).replace('.', ',')}€`;
}

/**
 * fmtDate(iso) → "12 abr 2026"
 */
export function fmtDate(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('es-ES', {
      day: '2-digit', month: 'short', year: 'numeric',
    });
  } catch { return '—'; }
}

/**
 * fmtDateLong(iso) → "12 de abril de 2026"
 */
export function fmtDateLong(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('es-ES', {
      day: 'numeric', month: 'long', year: 'numeric',
    });
  } catch { return '—'; }
}

export default DS;
