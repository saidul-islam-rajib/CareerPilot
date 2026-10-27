# E10 Email link registration — Design

## Flow

1. Register: full name, email, consent (no password). The account is stored in the `registered` state with an empty password hash and the consent record (document versions, time, IP, device). A set-password link is emailed.
2. The email links to `{notifications.web_base_url}{account_links.set_password_path}?token={user_id}.{secret}`. The page inspects the link and shows the name, email, and whether it finishes registration or resets a password.
3. Set password: the password is checked against the policy first, then the link is redeemed (single use). A `registered` account becomes `active`, its profile is created, and the user is signed in. A reset sets `credentials_changed_at`, which ends every session issued before it.
4. Forgot password: an `active` or `paused` account gets a reset link; a `registered` account gets a new registration link; nothing is sent otherwise. The response is always 204.
5. Registering with an `active` or `paused` email changes nothing and sends the "You already have an account" email (sign-in link plus a reset link). The response is the same 204.

## Mail delivery

- Config `config/defaults/mail.yaml`: `sender_address` (`info@team-sober.com`), `smtp_host` (`smtp.gmail.com`), `smtp_port` (587), `smtp_security` (`starttls` / `tls` / `none`), `smtp_timeout_seconds`, `smtp_user_env` / `smtp_password_env` (`CAREERPILOT_MAIL_USER` / `CAREERPILOT_MAIL_PASSWORD`), `sandbox_only_domains`.
- `bootstrap.account_sender_for`: with both credentials set, account email (links and verification codes) goes through `SmtpEmailSender` in live mode (STARTTLS then login, Gmail App Password) wrapped in `RecipientRoutingSender`, which keeps `sandbox_only_domains` in the sandbox; without them it is the sandbox sender (Mailpit). Digests and job applications always use the sandbox sender outside production.
- A rejected login is a permanent delivery error; the password is never part of an error, log, or repr. Setup steps: `docs/runbooks/email-setup.md`.
- Account email goes through a `Courier`. The API uses `BackgroundCourier` (thread pool of `delivery_workers`, up to `delivery_attempts` tries `retry_delay_seconds` apart), so register and reset answer at once. A final failure withdraws the link, so a new one can be requested straight away, and logs `email_not_delivered`; an unknown outcome is never resent. Tests inject a sender and get the synchronous `DirectCourier`.
- `sandbox_only_domains` holds only the local seed domain and the reserved example domains; a unit test refuses any other entry, so real mailbox domains are never diverted to Mailpit.

## Local testing on a phone

- `notifications.web_base_url_env` (`CAREERPILOT_WEB_BASE_URL`) overrides where email links point; its origin joins the allowed CORS origins. It must be an http(s) URL without credentials, query, or fragment, or the API refuses to start.
- The mobile `start` script (`pnpm mobile`, `pnpm phone`; `scripts/dev/phone.mjs`, config `config/defaults/dev.yaml`) finds the PC's Wi-Fi address, restarts `user-api` reachable on the LAN with links pointing at the Metro server, and starts Metro in `http` mode against that API. Metro runs offline, so the manifest carries no Expo account and a signed-out Expo Go opens it. It then pre-builds the iOS, Android and web bundles. Emailed links open the mobile web build that Metro serves, so they work on the phone. Without Docker it starts with demo data and says so; `start:demo` (`pnpm mobile:demo`) always uses demo data.

## Backend

- Config `config/defaults/account-links.yaml`: `token_bytes`, `ttl_minutes` (default lifetime, 5), `min_ttl_minutes` / `max_ttl_minutes` (bounds, 1–60), `max_attempts`, `sends_per_hour`, `set_password_path`, `sign_in_path`. The effective lifetime is the platform setting `accountLinkTtlMinutes` (admin `PATCH /admin/v1/settings`, strict integer within the bounds) or the default. `AccountLinkPolicy` reads it on every issue and makes the resend cooldown equal to it. Public config exposes `accountLinks.ttlMinutes`, `resendCooldownSeconds`, `minTtlMinutes`, `maxTtlMinutes`; the apps show the countdown as `m:ss`.
- Link secrets reuse `platform.one_time_codes.OneTimeCodes` (redis-coord, `cp:{env}:otp:account_link:{user_id}`) with a URL-safe token generator. A new `peek` checks a code without using it up; `check` uses it up. Issuing a new link replaces the old one. Cooldown and hourly limits apply per account; when they refuse a send, the request still answers 204 so it never reveals whether an account exists.
- `candidate.services.account_links.AccountLinkService`: `send(account)`, `inspect(token) → AccountLinkDetails(purpose, full_name, email)`, `redeem(token) → Account`. Email text comes from the `accountLinks.*` catalog keys and is handed to the courier (see Mail delivery); a failed delivery withdraws the link.
- `AuthService.register` returns nothing; `request_password_reset` sends links; `inspect_link`, `complete_link` are new; `sign_in` refuses `registered` accounts; `authenticate` refuses tokens issued before `credentials_changed_at` (compared in whole seconds, like the token `iat`).
- Enums: `UserAccountStatus.REGISTERED`, `AccountLinkPurpose` (`setup`, `reset`).
- `user_accounts` gains `consent_at`, `consent_ip`, `consent_device`, `credentials_changed_at` (Alembic migration; all nullable).
- API: `POST /v1/auth/register` (204), `POST /v1/auth/password-reset` (204), `POST /v1/auth/account-links/inspect` (`{token}` → details), `POST /v1/auth/account-links/complete` (`{token, password}` → session). Tokens travel in request bodies, never in API paths, so access logs never contain them. Errors: 422 `link_invalid` / `link_expired`, 422 `consent`, 429 `too_many_attempts`, 503 `delivery_failed`.

## Clients

- `AuthApi.register` returns `void`; new `inspectAccountLink(token)` and `completeAccountLink({ token, password })`. The in-memory demo adapter keeps registered accounts and issues the configured `api.demo_link_token` instead of emailing.
- Validation: `register` drops the password fields; new `setPassword` schema (password policy and confirmation).
- Hooks: `useRegisterForm` (`sentTo`, `resend` with a cooldown countdown, `reset`), `useAccountLink(token)`, `useSetPasswordForm(token)` (signs in on success), `accountLinkErrorKey`.
- Web: `/register` shows a check-your-email card after sending; `/set-password` lives outside the `(auth)` group so a signed-in browser can still open reset links, and goes home after success.
- Mobile (Android and iOS): the register screen shows the check-your-email card; `(auth)/set-password` handles `careerpilot://set-password?token=…` links and the demo link; signing in moves the user home through the protected-route redirect.
