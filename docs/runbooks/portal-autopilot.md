# Portal autopilot

Autopilot opens an employer's career page in Chromium (Playwright), signs in or creates the portal account when the user allowed it, fills the form from the user's verified profile and approved answers, uploads the approved CV, submits once and keeps proof (confirmation text, final URL, screenshot). Spec: `specs/E29-portal-autopilot`. Requirements: sections 10, 27.3, 29, 30.

## Safety model

- Off until the user turns it on (Autopilot setup shows the section 10.1 summary once). No per-job questions afterwards.
- Every employer host is `review` until an admin approves it on the admin Portals page (`config/defaults/portals.yaml` lists the starting values). `blocked` and `review` hosts are never automated.
- Never solves, relays or bypasses CAPTCHA; no stealth, fake user agent, proxy or human-mimicking. If a site blocks us it stops and hands over.
- Never guesses. Unknown required question, no exact choice, demographic without an explicit answer, declaration or attestation, assessment, video, payment, MFA, identity check, closed job, already applied all become Manual action required with the reason, official link and prepared answers, plus a notification.
- Portal passwords are generated per site, sealed with the Fernet vault (`CAREERPILOT_VAULT_KEY`), shown only on the user's explicit view or export. One login attempt, then the account is Needs attention.
- Verification emails and codes are read only from the user's connected Gmail, only when the user allowed it, only from the portal's domain and the last 15 minutes.
- A submit click with an error afterwards is Outcome unknown and is never repeated.

## The live switch

`submission.real_applications` is false in every config file. The environment variable `CAREERPILOT_REAL_APPLICATIONS` (true, 1, yes, on) overrides it. It is forced off when the variable is missing or malformed, when `CI`, `GITHUB_ACTIONS` or `PYTEST_CURRENT_TEST` is set, or when `APP_ENV` is `test` or `ci`.

- Off: the portal worker only opens, detects, maps and reports (read-only). Nothing is typed, no account is created, nothing is submitted. Application email goes to Mailpit.
- On: portal submission and the email route act for real.

### Turn on real applying (owner steps)

1. Connect Gmail in the app (Settings, Integrations) if you want verification emails read.
2. In the admin app, open Portals and set each employer host you have checked the terms of to `allowed`.
3. In the web app, open Autopilot, read the summary, tick what you allow, and press Turn on Autopilot.
4. Put `CAREERPILOT_REAL_APPLICATIONS=true` in your own `.env`. For email applications also set the real mail credentials (`docs/runbooks/email-setup.md`).
5. Rebuild: `docker compose -f docker-compose.yml -f docker-compose.observability.yml up -d --build`.
6. Run a readiness check first (below) on a real job link.

To stop at any time: remove the variable (or set it to false) and rebuild, or turn Autopilot off in the app, or use the emergency stop.

## Readiness check (read-only)

- Web/admin: Readiness check form (POST `/v1/portal/readiness`, admin `/admin/v1/portals/readiness`). The portal worker runs it and stores the report.
- Command line (uses a local Chromium; run from `services/core`):
  `python -m careerpilot.portal.cli readiness <job-url> --email <your CareerPilot email>`
  It prints wall type, CAPTCHA seen, mapped and unknown fields, and the verdict (can auto-apply, or will stop because ...). Playwright browsers: `python -m playwright install chromium` once.

## Containers

`portal-worker` (docker-compose.yml and docker-compose.prod.yml) uses the official Playwright Python image, runs `careerpilot-portal-worker` and serves the `portal` Temporal task queue. The main worker never launches a browser. Per-host interval and concurrency come from `portals.throttle`.

## What will still stop for the user

CAPTCHA and bot checks, MFA, identity checks, assessments, video steps, payments, legal declarations, sign-in with Google/LinkedIn/Microsoft only, sites that need a phone or postal verification, forms with essay or novel questions without an approved answer, sites whose pages change, and every host not approved by an admin.
