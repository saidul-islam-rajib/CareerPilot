# Google sign-in for inbox and calendar sync

CareerPilot reads replies to your applications from Gmail (read only) and adds interviews to Google Calendar. This page lists what the Google Cloud project, the `.env` file, and each environment need. Spec: `specs/E21-mail-and-calendar-sync`.

## Google Cloud console (once)

1. Create a project named CareerPilot and enable the **Gmail API** and **Google Calendar API**.
2. OAuth consent screen: external, status **Testing**, add each person who will connect as a test user (up to 100).
3. Scopes: `openid`, `email`, `https://www.googleapis.com/auth/gmail.readonly` (restricted), `https://www.googleapis.com/auth/calendar.events` (sensitive).
4. Credentials: create an OAuth client of type **Web application** with these redirect URIs (the user API, not the web app):
   - `http://localhost:8000/v1/integrations/google/callback`
   - `http://127.0.0.1:8000/v1/integrations/google/callback`
   - after deployment: `https://api.<your domain>/v1/integrations/google/callback`
5. Google rejects raw LAN addresses such as `192.168.x.x` as redirect URIs, so a phone on the local network cannot finish the Google sign-in. Connect from the computer; the connection belongs to the account, so the phone app then shows it too.

While the consent screen is in Testing mode, refresh tokens expire after 7 days (CareerPilot then shows "Needs reconnecting") and people see a "Google hasn't verified this app" warning (choose Continue). Moving beyond 100 users needs Google's verification and, for `gmail.readonly`, a security assessment.

## Environment variables

| Variable | Needed | Purpose |
| --- | --- | --- |
| `CAREERPILOT_GOOGLE_CLIENT_ID` | yes | OAuth client id |
| `CAREERPILOT_GOOGLE_CLIENT_SECRET` | yes | OAuth client secret (never committed, never logged) |
| `CAREERPILOT_API_PUBLIC_URL` | no | Public address of the user API used for the redirect URI. Default `http://localhost:8000` (`config/defaults/integrations.yaml`). Set to `https://api.<domain>` after deployment. |
| `CAREERPILOT_VAULT_KEY` | recommended | Secret that seals the stored Google tokens (Fernet key derived with HKDF-SHA256). When unset the key is derived from `CAREERPILOT_TOKEN_SECRET`, so changing that secret makes stored tokens unreadable and members must reconnect. Use a long random value and keep it stable. |
| `CAREERPILOT_WEB_BASE_URL` | no | Where the browser returns after Google (`/settings/connected-accounts`). Default `http://localhost:3000`. |

The user API, the admin API, and the workers all need these variables (the workers run the scheduled sync).

## Connecting on your computer

1. Start the stack and open http://localhost:3000, sign in, then **More > Connected accounts** (`/settings/connected-accounts`).
2. Choose **Connect Google**, pick the test user, allow the requested access, and you return to the same page with a green "Google is connected" banner.
3. **Check now** reads recent mail and syncs interviews immediately; otherwise the worker does it every 10 minutes (`workers.inbox_sync_interval_minutes`).
4. **Disconnect** revokes the grant at Google and stops all reading.

## What CareerPilot does and never does

- Reads only messages that look related to your applications (employer address or domain, or the organization name with an application keyword). Unrelated mail is not stored.
- Never sends, labels, moves, or deletes mail. Tokens are encrypted at rest and never returned by any API, user or admin.
- Rejections and offers are only suggested; you set the outcome yourself. Silence is never treated as a rejection.
