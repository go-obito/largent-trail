// frontend/src/styles/palette.ts
// Largent "Cobalt & Cloud" design tokens. This file is the single source of truth.
// `pnpm gen:tokens` generates src/styles/tokens.css from it; the MUI theme imports it directly.
// Keys marked "derived" were added by us and are not in the supplied palette.

export const palette = {
  light: {
    background: "#F5F7FB",
    surface: "#FFFFFF",
    surfaceElevated: "#E2E9F7",
    primary: "#315DE8",
    secondary: "#8FA8FF",
    accent: "#B2C0FF",
    textPrimary: "#1D2738",
    textSecondary: "#647086",
    border: "#DCE3EF",

    // semantic
    success: "#187443", // income / success
    error: "#B42332", // expense / error
    warning: "#946000",
    info: "#315DE8",
    disabled: "#A5ADBB",

    // interaction
    onPrimary: "#FFFFFF",
    primaryHover: "#244AC7",
    primaryPressed: "#1D3CA8",
    focusRing: "#7694FF",
    selectedSurface: "#E2E9FF",

    // derived: dark hero balance card (midnight navy) with light text
    hero: "#111521",
    onHero: "#F1F3FA",
  },
  dark: {
    background: "#111521",
    surface: "#1D2435",
    surfaceElevated: "#282F43",
    primary: "#8CA5FF",
    secondary: "#B2C0FF",
    accent: "#B2C0FF",
    textPrimary: "#F1F3FA",
    textSecondary: "#AAB3C7",
    border: "#343C51",

    success: "#6ED6A0",
    error: "#FF7B86",
    warning: "#F5C66B",
    info: "#8CA5FF",
    disabled: "#596176",

    onPrimary: "#111521",
    primaryHover: "#A2B5FF",
    primaryPressed: "#C0CCFF",
    focusRing: "#8CA5FF",
    selectedSurface: "#283552",

    // derived: hero card must stand out from the dark background
    hero: "#282F43",
    onHero: "#F1F3FA",
  },
} as const;

// Shape tokens (not theme dependent)
export const shape = {
  radiusCard: "20px",
  radiusControl: "14px",
  radiusPill: "999px",
  touchTarget: "44px",
} as const;

export type ThemeMode = keyof typeof palette;
export type PaletteKey = keyof (typeof palette)["light"];
