# Frontend decisions

Reviewed 2026-10-20 against the official package documentation.

## Dependencies and runtime

- `idb-keyval` is added as the small IndexedDB key/value store for TanStack Query's signed-in-only persisted cache.
- `@types/node` is aligned to Node 24, the current LTS release. The local Node 26 runtime is Current, not LTS.
- The §2 stack is present: Next.js, React, TypeScript, MUI and its Next adapter, Emotion, Clerk, TanStack Query and persist client, OpenAPI tooling, React Hook Form and Zod, Zustand, Lucide, Tailwind, and Serwist. `@tailwindcss/turbopack` supplies Tailwind's selected Turbopack loader; Emotion packages support MUI. No other §2 dependency is missing.

## CSS and component styling

- Tailwind 4 uses its documented `@tailwindcss/turbopack` loader through `next.config.ts`; `globals.css` imports Tailwind and declares the MUI/Tailwind layer order. This avoids adding the separate PostCSS integration.
- MUI 9.5 documents the `v16-appRouter` cache provider, `enableCssLayer`, and the `@layer theme, base, mui, components, utilities` order for Tailwind 4. The declared layers let utilities override MUI styles.
- MUI's CSS-variable configuration supports a custom color-scheme selector. Both MUI and generated palette tokens use `<html data-theme="light|dark">`; default mode is system.

## Next.js compatibility

- Next.js 16 uses Turbopack by default and documents `next dev --webpack` / `next build --webpack` as the alternative.
- Serwist's `@serwist/next` getting-started guide is explicitly for webpack. Its Turbopack guide instead uses `@serwist/turbopack`, a Serwist route handler, and a different worker import. This is a real integration choice, not a configuration tweak: when PWA wiring begins, either opt into webpack for the existing package or deliberately migrate to the documented Turbopack package and route. The service worker is not wired in this checkpoint, and no compatibility workaround or extra Serwist package is being added.
- Next.js 16 renamed Middleware to Proxy. Clerk's current Next.js guide specifies `proxy.ts` (or `src/proxy.ts` when using `src/`); the current frontend has no authenticated routes to protect yet, so no auth proxy or sign-in screens are introduced here.

## References

- [Serwist: webpack guide](https://serwist.pages.dev/docs/next/getting-started)
- [Serwist: Turbopack guide](https://serwist.pages.dev/docs/next/turbo)
- [Next.js 16 installation and bundlers](https://nextjs.org/docs/app/getting-started/installation)
- [MUI Next.js integration](https://mui.com/material-ui/integrations/nextjs/)
- [MUI Tailwind CSS v4 integration](https://mui.com/material-ui/integrations/tailwindcss/tailwindcss-v4/)
- [MUI CSS variables](https://mui.com/material-ui/customization/css-theme-variables/configuration/)
- [Clerk Next.js middleware / proxy](https://clerk.com/docs/nextjs/reference/clerk-middleware)
- [Node.js release schedule](https://nodejs.org/en/about/previous-releases)
