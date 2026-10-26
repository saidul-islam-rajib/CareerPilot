# E10 Email link registration — Tasks

- [ ] Spec, requirements, and planning documents updated
- [ ] Link codes (`peek`), config, enums, account columns and migration
- [ ] Account link service, registration and reset by link, session revocation, endpoints
- [ ] Client contract, in-memory adapter, schemas, hooks, catalog text
- [ ] Web register, check-your-email, and set-password pages
- [ ] Mobile register, check-your-email, and set-password screens (Android and iOS)
- [ ] Docker check: register in the browser, link in Mailpit, password set, signed in; reset link ends other sessions
- [!] Open emailed links directly in the installed Android and iOS apps (Android App Links, iOS Universal Links) — needs the production domain and signed store builds (external, outside local scope); recommendation: host `assetlinks.json` and `apple-app-site-association` on the web domain and add the domain to the Expo config. Until then, emailed links open the web app on any phone and the apps open `careerpilot://set-password` links.
