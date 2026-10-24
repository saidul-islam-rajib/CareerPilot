# E01 User web app – design

- Next.js 16 App Router; route files in `apps/web/src/app` re-export feature pages from `apps/web/src/features`.
- Shared logic from `@careerpilot/client-core` (hooks, session, config, enum display) and shared components from `@careerpilot/ui-web` (shadcn/ui-style, Radix primitives, Tailwind 4 classes bound to theme variables).
- Configuration: `next.config.ts` loads `config/defaults/*.yaml` through `scripts/config/load-config.js` into `NEXT_PUBLIC_CAREERPILOT_CONFIG`; the active theme comes from `GET /v1/config` and is applied as CSS variables by `ThemeFromConfig`.
- Session gate: `(auth)` pages require signed-out, `(app)` pages require signed-in; session stored in session storage until the BFF (httpOnly cookies) is added with the backend.
- Security headers set in `next.config.ts`.
