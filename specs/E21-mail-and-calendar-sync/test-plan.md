# E21 Mail and calendar sync (Google) — Test plan

Unit tests only (Planning/14-Testing-and-Quality.md); Google is replaced by `FakeGoogleGateway`.

- Python: vault round trip, wrong key, key fallback; state signing, expiry, tampering, PKCE verifier single use; authorize URL contents; callback success, denied, bad state, failed exchange (nothing stored); status and admin JSON never contain tokens; disconnect revokes, soft deletes, survives a failed revoke; classifier phrases per kind and confidence; matching by address, domain, free-mail exact only, ties skipped; sync records once and is idempotent, applies progress only, suggests rejection and offer, confirms awaiting-confirmation applications, notifies; token refresh and revoked grant to needs_reconnect with one notification; calendar create, unchanged no call, update, cancel, no duplicates; date parsing; routes; worker schedule and activity.
- TypeScript: api-client in-memory and HTTP, client-core hooks, web page, mobile screen (browser opening, hint), admin card, timeline link.
- Manual (not in the suite): connect from http://localhost:3000/settings/connected-accounts with a Google test user, reply to an application contact, Sync now, confirm the timeline entry and the calendar event.
