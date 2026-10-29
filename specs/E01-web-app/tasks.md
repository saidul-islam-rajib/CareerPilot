# E01 User web app – tasks

- [x] Shared web component library (`packages/ui-web`) and theme variables
- [x] App shell (sidebar, bottom tabs, credit), session gate
- [x] Auth pages with consent
- [x] Today, opportunity, archived circular
- [x] Approvals with editable answers and confirmation dialog
- [x] Applications and submission record
- [x] Profile with drag-and-drop contacts and zoomable images
- [x] Settings: tracks, pause, submission time, activity, about, licences, delete account
- [x] Unit tests (25) and production build
- [x] Visual validation at 390 px and 1280 px (`scripts/validate/web-screens.mjs`, 0 console errors)
- [ ] BFF with httpOnly session cookies (with the backend, E01 foundation)

## Welcome page redesign (2026-10-29)

- [x] Full-width landing at `/welcome`: top bar, hero with product preview, highlights, how it works, the never-do promise, closing call to action, Team Sober credit (web); same story on the mobile welcome screen with fixed sign-up and sign-in buttons
- [x] All text from `welcome.*` in the string catalog, colours from theme tokens, no invented user counts or testimonials
