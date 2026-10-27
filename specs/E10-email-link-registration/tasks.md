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
- [x] Real-inbox delivery with the owner's Gmail App Password from `.env` (checked 2026-10-27: register answers in about 0.1 s, Gmail accepts the message in about 4 s)
- [x] Account email sent in the background with retries; a final failure withdraws the link and is logged as `email_not_delivered`
- [x] Gmail addresses reach real inboxes again; only the seed domain and reserved example domains stay in Mailpit, guarded by a unit test
- [x] `pnpm phone`: the phone app against the real backend with email links that open on the phone (browser check: register, link from Mailpit on the Wi-Fi address, password set, signed in, API sign-in works)
- [x] Web bundles rebuild when the app config changes (Metro cache key includes the client config), so a demo-mode cache never serves an `http` start
- [!] Gmail shows `info@team-sober.com` as the sender only after the owner verifies it as a "Send mail as" address in the sending Gmail account (external account, outside agent access); until then mail arrives from the Gmail address. Recommendation: step 4 of `docs/runbooks/email-setup.md`.
- [!] Open emailed links directly in the installed Android and iOS apps (Android App Links, iOS Universal Links) — needs the production domain and signed store builds (external, outside local scope); recommendation: host `assetlinks.json` and `apple-app-site-association` on the web domain and add the domain to the Expo config. Until then, emailed links open the web app on any phone and the apps open `careerpilot://set-password` links.
