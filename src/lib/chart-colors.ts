/**
 * Recharts SVG props (fill, stroke, stopColor) cannot use CSS classes or
 * var() references — they require literal colour strings. This file provides
 * named constants that mirror the design tokens in globals.css so that all
 * chart components share a single source of truth and dark-mode variants
 * can be added here without hunting across every file.
 */

export const CHART_COLORS = {
  /** Primary loss / error — matches --error (#ba1a1a light, #ffb4ab dark) */
  loss:        "#ba1a1a",
  /** Injected energy / primary blue — matches --primary (#0058bc) */
  inject:      "#0058bc",
  /** Billed / recovered — green */
  bill:        "#1e7e34",
  /** Warning / amber */
  warning:     "#d97706",
  /** Neutral / muted — grey */
  neutral:     "#717786",
  /** Technical loss (lighter than commercial) */
  techLoss:    "#94a3b8",
  /** Commercial loss */
  commercialLoss: "#ba1a1a",
  /** Gradient stop — translucent loss */
  lossLight:   "#ba1a1a",
} as const;

/** Leaflet / map marker colours — loss classification */
export const MAP_COLORS = {
  critico:  "#ba1a1a",
  atencao:  "#d97706",
  normal:   "#1e7e34",
} as const;
