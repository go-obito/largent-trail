import { SignIn } from "@clerk/nextjs";
import type { ComponentProps } from "react";

export const clerkAppearance: NonNullable<
  ComponentProps<typeof SignIn>["appearance"]
> = {
  variables: {
    colorPrimary: "var(--color-primary)",
    colorPrimaryForeground: "var(--color-on-primary)",
    colorBackground: "var(--color-surface)",
    colorForeground: "var(--color-text-primary)",
    colorMutedForeground: "var(--color-text-secondary)",
    colorInput: "var(--color-background)",
    colorInputForeground: "var(--color-text-primary)",
    colorNeutral: "var(--color-text-primary)",
    colorBorder: "var(--color-border)",
    colorRing: "var(--color-focus-ring)",
    borderRadius: "var(--radius-control)",
  },
};
