# E10 Email link registration — Tasks

- [x] Spec, requirements, and planning documents updated
- [x] Link codes (`peek`), config, enums, account columns and migration
- [x] Account link service, registration and reset by link, session revocation, endpoints
- [x] Client contract, in-memory adapter, schemas, hooks, catalog text
- [x] Web register, check-your-email, and set-password pages
- [x] Mobile register, check-your-email, and set-password screens (Android and iOS)
- [x] Docker check: register in the browser, link in Mailpit, password set, signed in; reset link ends other sessions
- [x] "You already have an account" email for existing accounts; a used link ends its resend cooldown
- [x] Link lifetime set by a Super Admin (default 5 minutes, 1–60, strict integer); a new link only after the previous one expires; token shape checked first
- [x] Real account email through Gmail SMTP (STARTTLS, App Password) from `info@team-sober.com` when credentials are set; protected domains stay in Mailpit
- [!] Real-inbox delivery needs the owner's Gmail App Password and the verified `info@team-sober.com` send-as alias (external accounts, outside agent access); recommendation: follow `docs/runbooks/email-setup.md`, then set `CAREERPILOT_MAIL_PASSWORD` in `.env`.
- [!] Open emailed links directly in the installed Android and iOS apps (Android App Links, iOS Universal Links) — needs the production domain and signed store builds (external, outside local scope); recommendation: host `assetlinks.json` and `apple-app-site-association` on the web domain and add the domain to the Expo config. Until then, emailed links open the web app on any phone and the apps open `careerpilot://set-password` links.
