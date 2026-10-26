# E10 Email link registration — Design

## Flow

1. Register: full name, email, consent (no password). The account is stored in the `registered` state with an empty password hash and the consent record (document versions, time, IP, device). A set-password link is emailed.
2. The email links to `{notifications.web_base_url}{account_links.set_password_path}?token={user_id}.{secret}`. The page inspects the link and shows the name, email, and whether it finishes registration or resets a password.
3. Set password: the password is checked against the policy first, then the link is redeemed (single use). A `registered` account becomes `active`, its profile is created, and the user is signed in. A reset sets `credentials_changed_at`, which ends every session issued before it.
4. Forgot password: an `active` or `paused` account gets a reset link; a `registered` account gets a new registration link; nothing is sent otherwise. The response is always 204.

## Backend

- Config `config/defaults/account-links.yaml`: `token_bytes`, `ttl_minutes`, `max_attempts`, `resend_cooldown_seconds`, `sends_per_hour`, `set_password_path`. Public config exposes `accountLinks.ttlMinutes` and `accountLinks.resendCooldownSeconds`.
- Link secrets reuse `platform.one_time_codes.OneTimeCodes` (redis-coord, `cp:{env}:otp:account_link:{user_id}`) with a URL-safe token generator. A new `peek` checks a code without using it up; `check` uses it up. Issuing a new link replaces the old one. Cooldown and hourly limits apply per account; when they refuse a send, the request still answers 204 so it never reveals whether an account exists.
- `candidate.services.account_links.AccountLinkService`: `send(account)`, `inspect(token) → AccountLinkDetails(purpose, full_name, email)`, `redeem(token) → Account`. Email text comes from the `accountLinks.*` catalog keys through the `EmailSender` port (Mailpit locally); a failed delivery withdraws the link and returns 503 `delivery_failed`.
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
