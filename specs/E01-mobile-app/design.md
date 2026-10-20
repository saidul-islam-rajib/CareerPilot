# E01 Mobile app – design

- Expo SDK 57, Expo Router (`src/app` thin routes → `src/features/*` screens), TanStack Query, Zod validation from `packages/validation`.
- Composition root: `src/core/services/app-services.tsx` builds the API adapter from configuration (`config/defaults/*.yaml` → `app.config.ts` → `expo-constants`): `in_memory` (demo data) or `http` (backend `/v1`).
- Theme: `PublicConfigProvider` loads `GET /v1/config`; the active theme key selects a token set from `packages/ui-tokens` (ADR 0025).
- Strings: `packages/i18n` catalog; statuses rendered from `enum_values` metadata (`EnumBadge`).
- Session: secure storage on device, session storage on web; unauthorized responses end the session.
- Accessibility: 44 pt touch targets, labels on every control, move buttons as the alternative to drag, zoom buttons as the alternative to pinch.
