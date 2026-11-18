# E32 Assisted apply (requirements 10.3, 27.3, 20.2)

When the server run stops at a CAPTCHA or sign-in wall, the user finishes on the employer site inside the app; nothing is re-typed.

- [x] Backend: `GET /v1/portal/applications/{id}/fill-plan` (verified facts + saved answers via config synonyms, account email, has-password flag, CV link, confirmation phrases, skip terms, captcha selectors); `GET .../fill-plan/password` on explicit request; `GET .../evidence` signed screenshot link; `complete` accepts final URL + page text as evidence.
- [ ] api-client + client-core: fill-plan, password, evidence link, user readiness check, complete with evidence.
- [ ] Mobile: Assisted apply screen with `react-native-webview` (version from Expo SDK 58 bundledNativeModules); injected script fills empty inputs (also after navigation and same-origin frames), account email, "Use saved password", CV via DataTransfer else tells the user to pick the file; bar shows filled / left for you / "You complete the check and tap Submit".
- [ ] Script never touches, clicks, solves or reads a CAPTCHA widget, never clicks Submit, never fills declarations, demographic or unknown questions (they are listed).
- [ ] Confirmation phrase on the page offers "Record as submitted" (final URL + text as evidence); without a phrase the user may still mark complete, status stays per §20.2 (submitted, awaiting confirmation), never "confirmed".
- [ ] Policy: `blocked` hosts get official link and copy buttons only; `review` hosts may use assist because the user is present and acts themselves, like a password manager; `allowed` same.
- [ ] Mobile web `.web.tsx` and web attempt panel: official link and copy-to-clipboard buttons.
- [ ] "Check this job" on the opportunity screen (web, mobile): readiness verdict shown plainly, can auto-apply or will stop because.
- [ ] Unit tests: backend fill-plan (done), script builder, screens, hooks. Strings only from en.json, colours from tokens.
