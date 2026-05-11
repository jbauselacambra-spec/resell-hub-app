import { Platform } from 'react-native';

// ─── ResellHub Design System v2 — Light Theme (Sprint 4) ─────────────────────
// Reemplaza la paleta AMOLED oscura en todas las pantallas.
// Un único fichero importado por todos los screens para consistencia total.

export const DS = {
  // Fondos
  bg:        '#F8F9FA',   // fondo app
  white:     '#FFFFFF',   // tarjetas / superficies
  surface2:  '#F0F2F5',   // superficies elevadas / inputs

  // Bordes
  border:    '#EAEDF0',
  borderMed: '#D8DCE3',

  // Marca
  primary:   '#FF6B35',   // naranja principal
  primaryBg: '#FFF2EE',   // fondo tint naranja

  // Semánticos
  success:   '#00D9A3',
  successBg: '#E8FBF6',
  warning:   '#FFB800',
  warningBg: '#FFF8E0',
  danger:    '#E63946',
  dangerBg:  '#FFEBEC',
  blue:      '#004E89',
  blueBg:    '#EAF2FB',
  purple:    '#6C63FF',
  purpleBg:  '#F0EFFE',

  // Texto
  text:      '#1A1A2E',   // texto principal
  textMed:   '#5C6070',   // texto secundario
  textLow:   '#A0A5B5',   // texto bajo énfasis / placeholders

  // Tipografía
  mono:      Platform.OS === 'android' ? 'monospace' : 'Courier New',
};

// Colores semánticos por tipo de alerta (usados en Dashboard, Stats, Products)
export const ALERT_COLORS = {
  critical:    DS.danger,
  stale:       DS.primary,
  seasonal:    DS.warning,
  opportunity: DS.success,
};

// Colores de severidad de producto
export const SEV_COLORS = {
  'CRÍTICO':    DS.danger,
  'INVISIBLE':  DS.textLow,
  'DESINTERÉS': DS.warning,
  'CASI LISTO': DS.success,
};
