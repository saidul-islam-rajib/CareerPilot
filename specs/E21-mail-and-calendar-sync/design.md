# E21 Mail and calendar sync (Google) — Design

## Decisions (recorded per CLAUDE.md "make the recommended choice")

- **Scheduling:** a Temporal `InboxSyncWorkflow` on a schedule (`workers.inbox_sync_*`), the same pattern as digests. The activity calls `IntegrationService.sync_all()`; each user is synced in isolation so one failure never stops the others.
- **Google behind a port:** `GoogleGateway` (token exchange, refresh, revoke, profile, Gmail list and get, Calendar insert, update, delete). `HttpGoogleGateway` uses httpx; `FakeGoogleGateway` serves unit tests.
- **Tokens:** `TokenVault` (Fernet) with a key from `CAREERPILOT_VAULT_KEY`; when absent, a key is derived from `CAREERPILOT_TOKEN_SECRET` with HKDF-SHA256. Only `ConnectionRecord.sealed_tokens` holds ciphertext; every view model omits it, and unit tests walk the JSON of every integration endpoint to prove no token appears.
- **OAuth:** `OAuthFlow` builds the URL with `access_type=offline`, `prompt=consent`, `include_granted_scopes=true`, S256 PKCE. The state is a JWT (`TokenService`, audience `google-oauth`, subject = user id, `jti` nonce, lifetime `integrations.google.state_ttl_minutes`). The PKCE verifier stays server side in the coordination store under `KeyNamespace.OAUTH_STATE`, keyed by the nonce and consumed once, so it never appears in a URL.
- **Redirect base:** `integrations.google.redirect_base_url_env` (`CAREERPILOT_API_PUBLIC_URL`), default `http://localhost:8000`. The redirect URI is `<base>/v1/integrations/google/callback`, matching the Google console. The browser is then sent to `<notifications.web_base_url>/settings/connected-accounts?google=connected` or `?google=error&reason=<code>`.
- **Classification:** `ReplyClassifier` port. `RuleBasedClassifier` scores weighted phrases from `config/defaults/integrations.yaml` over the subject and body; confidence = best score / `full_score`, capped at 1. A later Claude classifier plugs in behind the same port (needs `ANTHROPIC_API_KEY`). Kinds that are only suggested (`suggest_only_kinds`: rejection, offer) never change the outcome.
- **Matching:** `ApplicationMatcher` collects, per active application, employer addresses (sent emails, opportunity `application_email`) and domains (free-mail domains from `discovery.warning_signs.free_mail_domains` match by exact address only). Strength: exact address 3, domain 2, organization name in the sender (plus a subject keyword from config) 1. The highest strength wins if unique; ties and no match are skipped.
- **Idempotency:** `SyncedMessage` rows are keyed by (user, Gmail message id); a stored message is ignored. Calendar events are keyed by (user, task id); the stored event id turns a repeat into an update.
- **Reading window:** each run lists messages newer than the last sync (minus overlap) or, the first time, `sync.lookback_days`, using Gmail's `q=after:` search, at most `sync.max_messages_per_run`. (History ids are not used: the date window with the stored message ids is simpler and just as safe; revisit if volume grows.)
- **Status rules:** progress only (`under_review < assessment < interview`), applied at `apply_min_confidence` or above; below it the message is recorded as an other reply without changing the outcome. Rejection and offer are suggestions. A reply to an application in Submitted - awaiting confirmation adds Evidence and moves it to Confirmed (employer evidence, REQ-20.2), through the same listener as other status changes. A newer user decision wins (REQ-38): an outcome the user already set at or beyond the detected stage is kept.
- **Calendar:** every open interview task with a `due_at` is mirrored; `fingerprint` (hash of title, time, location, notes) avoids calls for unchanged tasks. Done tasks keep their event; dismissed tasks cancel it. A time with no stated zone is stored with the user's time zone.
- **Notifications:** `NotificationKind.APPLICATION_REPLY` (a recorded reply; the text names the kind) and `INTEGRATION_ATTENTION` (reconnect needed), in-app and push like E18.
- **Admin:** read-only `GET /admin/v1/users/{id}/integrations`, no token fields exist on its model.

## Data (standard audit columns and soft delete on every table)

- `integration_connections`: `id`, `user_id`, `provider`, `email`, `status`, `connected_at`, `last_sync_at`, `document` (JSON: scopes, last error, access expiry, sealed tokens). One active row per (user, provider).
- `synced_messages`: `id`, `user_id`, `message_id`, `application_id`, `received_at`, `document` (kind, disposition, confidence, subject).
- `calendar_events`: `id`, `user_id`, `task_id`, `document` (application id, Google event id, state, fingerprint).

## API

- User: `GET /v1/integrations/google/authorize-url` returns `{url}`; `GET /v1/integrations/google/callback` (public, redirects); `GET /v1/integrations/google` status; `POST /v1/integrations/google/sync` sync now; `DELETE /v1/integrations/google` disconnect.
- Admin: `GET /admin/v1/users/{id}/integrations`.
- Timeline entries gain an optional `link` (address of the source email).

## Apps

- Web `/settings/connected-accounts`: status, Connect Google (navigates to the authorize URL), Sync now, Disconnect with confirmation, banner from the `google` query flag.
- Mobile `settings/connected-accounts`: the same; Connect opens the URL in the system browser with `expo-web-browser` when installed, else `Linking`; a hint explains that Google only returns to `localhost` while running locally, so connect from the computer.
- Admin: "Connected accounts" card on the user record.
- Application timeline: employer entries with a link show "Open email".

## Config

`config/defaults/integrations.yaml`: `google` (endpoints, scopes, env names, state lifetime, refresh skew, timeout), `sync` (lookback days, overlap, max messages), `classification`, `matching`, `calendar` (default duration, reminder minutes), `dates` (accepted formats).
