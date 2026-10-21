import { createTheme } from "@mui/material/styles";
import { palette, shape, type ThemeMode } from "./palette";

type PaletteScheme = (typeof palette)[ThemeMode];

declare module "@mui/material/styles" {
  interface Palette {
    accent: string;
    disabled: string;
    focusRing: string;
    hero: string;
    onHero: string;
    primaryHover: string;
    primaryPressed: string;
    selectedSurface: string;
  }

  interface PaletteOptions {
    accent?: string;
    disabled?: string;
    focusRing?: string;
    hero?: string;
    onHero?: string;
    primaryHover?: string;
    primaryPressed?: string;
    selectedSurface?: string;
  }
}

function createSchemeColors(colors: PaletteScheme) {
  return {
    primary: { main: colors.primary, contrastText: colors.onPrimary },
    secondary: { main: colors.secondary },
    background: { default: colors.background, paper: colors.surface },
    text: {
      primary: colors.textPrimary,
      secondary: colors.textSecondary,
      disabled: colors.disabled,
    },
    divider: colors.border,
    success: { main: colors.success },
    error: { main: colors.error },
    warning: { main: colors.warning },
    info: { main: colors.info },
    accent: colors.accent,
    disabled: colors.disabled,
    focusRing: colors.focusRing,
    hero: colors.hero,
    onHero: colors.onHero,
    primaryHover: colors.primaryHover,
    primaryPressed: colors.primaryPressed,
    selectedSurface: colors.selectedSurface,
  };
}

export const theme = createTheme({
  cssVariables: {
    colorSchemeSelector: '[data-theme="%s"]',
  },
  colorSchemes: {
    light: { palette: createSchemeColors(palette.light) },
    dark: { palette: createSchemeColors(palette.dark) },
  },
  defaultColorScheme: "light",
  typography: {
    fontFamily: "var(--font-inter), Inter, sans-serif",
    h1: { fontSize: "1.75rem", fontWeight: 700, lineHeight: 1.2 },
    h2: { fontSize: "1.125rem", fontWeight: 600, lineHeight: 1.3 },
    body1: { fontSize: "0.875rem", lineHeight: 1.5 },
    caption: { fontSize: "0.75rem", lineHeight: 1.35 },
  },
  shape: {
    borderRadius: Number.parseInt(shape.radiusControl, 10),
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: ({ theme }) => ({
          minHeight: shape.touchTarget,
          borderRadius: shape.radiusControl,
          "&.MuiButton-containedPrimary:hover": {
            backgroundColor: theme.palette.primaryHover,
          },
          "&.MuiButton-containedPrimary:active": {
            backgroundColor: theme.palette.primaryPressed,
          },
          "&.Mui-focusVisible": {
            outline: `2px solid ${theme.palette.focusRing}`,
            outlineOffset: 2,
          },
          "&.Mui-disabled": {
            color: theme.palette.disabled,
          },
        }),
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: {
          minWidth: shape.touchTarget,
          minHeight: shape.touchTarget,
          borderRadius: shape.radiusControl,
        },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: ({ theme }) => ({
          minHeight: shape.touchTarget,
          borderRadius: shape.radiusControl,
          "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
            borderColor: theme.palette.focusRing,
          },
        }),
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          borderRadius: shape.radiusCard,
        },
      },
    },
  },
});
