import { createTheme } from "@mui/material/styles";
import { palette, shape, type ThemeMode } from "./palette";

type PaletteScheme = (typeof palette)[ThemeMode];

declare module "@mui/material/styles" {
  interface Palette {
    accent: string;
    disabled: string;
    errorContainer: string;
    expenseSoft: string;
    focusRing: string;
    hero: string;
    incomeSoft: string;
    inverseOnSurface: string;
    inversePrimary: string;
    inverseSurface: string;
    onBackground: string;
    onHero: string;
    onError: string;
    onErrorContainer: string;
    onPrimaryContainer: string;
    onSecondary: string;
    onSecondaryContainer: string;
    onSurface: string;
    onSurfaceVariant: string;
    onTertiary: string;
    onTertiaryContainer: string;
    primaryHover: string;
    primaryPressed: string;
    primaryContainer: string;
    progressFill: string;
    progressGood: string;
    progressOver: string;
    progressTrack: string;
    secondaryContainer: string;
    selectedSurface: string;
    scrim: string;
    shadow: string;
    surfaceBright: string;
    surfaceContainer: string;
    surfaceContainerHigh: string;
    surfaceContainerHighest: string;
    surfaceContainerLow: string;
    surfaceContainerLowest: string;
    surfaceDim: string;
    surfaceTint: string;
    surfaceVariant: string;
    tertiary: string;
    tertiaryContainer: string;
    textMuted: string;
    warningSoft: string;
    infoSoft: string;
  }

  interface PaletteOptions {
    accent?: string;
    disabled?: string;
    errorContainer?: string;
    expenseSoft?: string;
    focusRing?: string;
    hero?: string;
    incomeSoft?: string;
    inverseOnSurface?: string;
    inversePrimary?: string;
    inverseSurface?: string;
    onBackground?: string;
    onHero?: string;
    onError?: string;
    onErrorContainer?: string;
    onPrimaryContainer?: string;
    onSecondary?: string;
    onSecondaryContainer?: string;
    onSurface?: string;
    onSurfaceVariant?: string;
    onTertiary?: string;
    onTertiaryContainer?: string;
    primaryHover?: string;
    primaryPressed?: string;
    primaryContainer?: string;
    progressFill?: string;
    progressGood?: string;
    progressOver?: string;
    progressTrack?: string;
    secondaryContainer?: string;
    selectedSurface?: string;
    scrim?: string;
    shadow?: string;
    surfaceBright?: string;
    surfaceContainer?: string;
    surfaceContainerHigh?: string;
    surfaceContainerHighest?: string;
    surfaceContainerLow?: string;
    surfaceContainerLowest?: string;
    surfaceDim?: string;
    surfaceTint?: string;
    surfaceVariant?: string;
    tertiary?: string;
    tertiaryContainer?: string;
    textMuted?: string;
    warningSoft?: string;
    infoSoft?: string;
  }
}

function createSchemeColors(colors: PaletteScheme) {
  return {
    primary: {
      main: colors.primary,
      contrastText: colors.onPrimary,
    },
    secondary: {
      main: colors.secondary,
      contrastText: colors.onSecondary,
    },
    background: { default: colors.background, paper: colors.surface },
    text: {
      primary: colors.onSurface,
      secondary: colors.textSecondary,
      disabled: colors.disabled,
    },
    divider: colors.border,
    success: { main: colors.success },
    error: { main: colors.error, contrastText: colors.onError },
    warning: { main: colors.warning },
    info: { main: colors.info },
    accent: colors.accent,
    disabled: colors.disabled,
    errorContainer: colors.errorContainer,
    expenseSoft: colors.expenseSoft,
    focusRing: colors.focusRing,
    hero: colors.hero,
    incomeSoft: colors.incomeSoft,
    inverseOnSurface: colors.inverseOnSurface,
    inversePrimary: colors.inversePrimary,
    inverseSurface: colors.inverseSurface,
    onBackground: colors.onBackground,
    onHero: colors.onHero,
    onError: colors.onError,
    onErrorContainer: colors.onErrorContainer,
    onPrimaryContainer: colors.onPrimaryContainer,
    onSecondary: colors.onSecondary,
    onSecondaryContainer: colors.onSecondaryContainer,
    onSurface: colors.onSurface,
    onSurfaceVariant: colors.onSurfaceVariant,
    onTertiary: colors.onTertiary,
    onTertiaryContainer: colors.onTertiaryContainer,
    primaryHover: colors.primaryHover,
    primaryPressed: colors.primaryPressed,
    primaryContainer: colors.primaryContainer,
    progressFill: colors.progressFill,
    progressGood: colors.progressGood,
    progressOver: colors.progressOver,
    progressTrack: colors.progressTrack,
    secondaryContainer: colors.secondaryContainer,
    selectedSurface: colors.selectedSurface,
    scrim: colors.scrim,
    shadow: colors.shadow,
    surfaceBright: colors.surfaceBright,
    surfaceContainer: colors.surfaceContainer,
    surfaceContainerHigh: colors.surfaceContainerHigh,
    surfaceContainerHighest: colors.surfaceContainerHighest,
    surfaceContainerLow: colors.surfaceContainerLow,
    surfaceContainerLowest: colors.surfaceContainerLowest,
    surfaceDim: colors.surfaceDim,
    surfaceTint: colors.surfaceTint,
    surfaceVariant: colors.surfaceVariant,
    tertiary: colors.tertiary,
    tertiaryContainer: colors.tertiaryContainer,
    textMuted: colors.textMuted,
    warningSoft: colors.warningSoft,
    infoSoft: colors.infoSoft,
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
    h1: { fontSize: "1.875rem", fontWeight: 700, lineHeight: 1.2 },
    h2: { fontSize: "1.5rem", fontWeight: 700, lineHeight: 1.25 },
    h3: { fontSize: "1.25rem", fontWeight: 600, lineHeight: 1.3 },
    h4: { fontSize: "1.125rem", fontWeight: 600, lineHeight: 1.35 },
    subtitle1: { fontSize: "1rem", fontWeight: 500, lineHeight: 1.45 },
    body1: { fontSize: "0.875rem", lineHeight: 1.45 },
    body2: { fontSize: "0.75rem", lineHeight: 1.4 },
    caption: { fontSize: "0.75rem", lineHeight: 1.35 },
    button: {
      fontSize: "0.875rem",
      fontWeight: 600,
      lineHeight: 1.25,
      textTransform: "none",
    },
  },
  shape: {
    borderRadius: Number.parseInt(shape.radiusMedium, 10),
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
