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

Design decisions and compatibility notes are recorded in [docs/DECISIONS.md](./docs/DECISIONS.md).
