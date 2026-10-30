# Largent frontend

The mobile-first web app uses Next.js App Router in `src/`, Tailwind CSS 4 for layout, and Material UI for interactive components.

## Development

Run commands from this directory with pnpm:

```text
pnpm dev
pnpm check
pnpm build
pnpm gen:tokens
```

Copy `.env.example` to `.env.local` and fill in the Clerk keys for local authentication. Enable email one-time-code sign-in and Google OAuth for the Clerk instance; the prebuilt sign-in and sign-up pages display the methods enabled for that instance. `.env.local` is ignored by Git.

## Merchant logos

Transaction history and dashboard activity can display merchant logos through [Logo.dev](https://logo.dev). Set `NEXT_PUBLIC_LOGO_DEV_TOKEN` to your Logo.dev **publishable** key (`pk_...`) in `.env.local` and in the Vercel project environment variables, then redeploy. This key is intended for browser use; do not put a Logo.dev secret key (`sk_...`) in a `NEXT_PUBLIC_` variable. Known merchants are resolved through the explicit registry in `src/components/brand/MerchantLogo.tsx`; unknown merchants, failed logo requests, offline use, and an unset token fall back to the existing category badge. The free commercial plan requires the visible Logo.dev attribution included alongside transaction views.

Design decisions and compatibility notes are recorded in [docs/DECISIONS.md](./docs/DECISIONS.md).
