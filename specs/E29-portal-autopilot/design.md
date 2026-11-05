# E29 Portal autopilot — Design

## Module

`careerpilot/portal/` (hexagonal). Browser behind `PageDriver` (Protocol); `PlaywrightDriver` is the only adapter that imports Playwright. Unit tests use `FakeDriver`; a scratchpad e2e uses real Chromium against a local fixture career site.

- `enums.py`: host policy, wall kind, page kind, stop reason, field source, field status, verdict, run mode, attempt state, account status, record kind.
- `config.py` and `config/defaults/portals.yaml`: hosts (allowed, blocked, review), adapters (host patterns, selectors, text patterns), generic label synonyms, password policy, per-host interval and concurrency, verification window, polling.
- `driver.py`: `PageDriver`, `FormField`, `PageSnapshot`. `playwright_driver.py`: Chromium, no stealth, default user agent, no proxy.
- `detection.py`: classifies a snapshot (closed, already applied, captcha, mfa, identity, assessment, video, payment, sign-in, register, verification, confirmation).
- `mapping.py`: maps each field to a source (profile fact, saved answer, generated letter, document, consent). Exact-intent matching only; select options need an exact normalised match.
- `accounts.py`: portal accounts with vault-sealed generated password; one login attempt then Needs attention.
- `verification.py`: Gmail verification fetch with consent, domain match and time window.
- `flow.py`: the Section 30 pipeline: open, policy, wall, account, forms (multi-page loop), résumé parse check, upload, submit once, confirm.
- `throttle.py`: per-host interval and concurrency (Bulkhead) from config.
- `runner.py`: loads the application, enforces holds, live switch and permissions, runs the flow, maps the result to the Section 20.2 status and notifications.
- `readiness.py`: read-only run and stored report; `cli.py` runs it from the command line.
- `service.py`: user and admin use cases (autopilot, accounts, attempts, resume, hosts, readiness requests).

## Live switch

`submission.real_applications` (default false) is overridden by env `CAREERPILOT_REAL_APPLICATIONS` (true/false). It is forced false when env `CI` is set, `PYTEST_CURRENT_TEST` is set, or `APP_ENV` is test or ci, and when the value is missing or malformed. Off: readiness-only portal runs and Mailpit email. On: portal writes and live email.

## Process layout

Portal jobs are listed by `due_portal_applications` and run by the `run_portal_application` activity on the `portal` task queue, served only by the `portal-worker` container (Playwright image). The main worker never launches a browser. Readiness requests from the API are stored as records and processed by the portal worker.

## Resume without duplicates

An attempt record per application keeps state, stop reason, prepared answers, portal account id and a `submit_clicked` flag. After `submit_clicked` the application is never run again. Resume moves Manual action required back to Approved - queued (after the user answers; answers become saved answers) or records the user's own completion through the existing record-as-applied flow.

## Host terms (checked 2026-11-05, public pages only)

| Host | Finding | Status |
|---|---|---|
| easy.jobs (brainstation-23.easy.jobs) | Terms allow one personal non-commercial copy of content; no explicit bot rule; nothing on automated applying | review |
| therap.hire.trakstar.com | Trakstar Hire hosted board; terms not found | review |
| career.cefalo.com | In-house ATS; no public terms on automation found | review |
| careers.optimizely.com | SAP SuccessFactors; sign-in wall; terms not found | review |
| Greenhouse, Lever, Workable, Ashby, SmartRecruiters | Public application forms, not individually reviewed | review |

Nothing is `allowed` by default because automation cannot be shown permitted from public pages: an admin approves each host on the Portals page. Fixture hosts are `allowed` only in tests.

## Decisions

- Live switch is off by default in every environment including production (fail closed when missing). Literal reading of "default on only in production.yaml" would make production send when the variable is missing; recommendation kept: the owner sets the variable explicitly.
- A submit click without confirmation evidence is Outcome unknown (not Submitted - awaiting confirmation) because the email-bounce auto-confirmation would otherwise mark it Confirmed.
- Essay questions are stopped unless an approved saved answer matches exactly; generated essay answers are not built.
- Sign in with Google/LinkedIn/Microsoft is never used; those sites stop as unsupported sign-in.

## Hard stops

Each is a `StopReason` with a message key, official link, prepared answers and a notification. Stops only the user can clear (captcha, MFA, identity, assessment, video, payment, attestation) are resumed by recording the user's own completion; stops answerable in the app (unknown question, no exact choice, demographic, verification) are resumed by saving the answer.

## Readiness findings on real public pages (2026-11-05, read-only, no profile attached)

| Employer | Page | Finding |
|---|---|---|
| Brain Station 23 (easy.jobs) | company page lists open jobs such as `/oqwvmsgpnk-aspnet-developer`; each Apply Now goes to `/apply` | The apply page is a candidate single sign-on (`app.easy.jobs/auth/sso/candidate`) loaded in a cross-origin frame. Sign-in wall, form not visible without an account. Host is review. |
| Therap (Trakstar Hire) | `https://therap.hire.trakstar.com/jobs/fk0hw8r/` (Software Engineer) | Public form on the job page: first/last name, email, phone, university, major, CGPA, GitHub, years of experience, current company, LinkedIn, resume. reCAPTCHA frames are present, so Autopilot stops for the user. Host is review. |
| Cefalo | `career.cefalo.com/job/...` pages listed are past their deadline (closed); `/open-application` is a three-step form (upload CV, details, review) with reCAPTCHA | Closed jobs stop with Closed; the open application stops at reCAPTCHA. Host is review. |
| Optimizely (SAP SuccessFactors) | `careers.optimizely.com/job/Dhaka-Software-Engineer-II-1212-BD/1363501155/` | The job page shows no Apply control without signing in at `career55.sapsf.eu`; sign-in wall, form not inspectable read-only. Host is review. |

Every host is also `review`, so a live run would stop at Host review until an admin approves it.

## Challenge and frame handling

- A challenge stops the run only when visible: reCAPTCHA v2 anchor frames with `size=normal` or `compact`, the visible challenge frame (`bframe`), an hCaptcha checkbox or challenge frame, a Turnstile widget. Invisible or badge-only variants (v3, `size=invisible`, `grecaptcha.execute`) do not stop on their own. Selectors live in `config/defaults/portals.yaml` and are matched on visibility.
- A challenge at or after submit stops with CAPTCHA and the outcome stays Outcome unknown; the application is never resubmitted. Nothing solves, relays or evades a challenge.
- When the page has no form fields and a child frame does, the driver operates on that frame.

## Email route

With the live switch on, application email goes through the Gmail API as the user's own mailbox (`gmail.send`, requested only when the user enables the email route; the status reports `sendAccess`). With no connection or no send scope the application goes to Manual action required with the prepared email. With the switch off, mail goes to Mailpit as before.

## Readiness verdicts after driver fixes (2026-11-05, no profile attached, all hosts review)

- Brain Station 23 (easy.jobs): Apply opens a new tab to a candidate single sign-on; sign-in wall; will stop (host review, wall unverified).
- Therap (Trakstar): reCAPTCHA present; will stop (host review, CAPTCHA).
- Cefalo: listed jobs are closed (past deadline); open application has reCAPTCHA; will stop.
- Optimizely (SuccessFactors): no Apply control without signing in; will stop (no form).

## Readiness verdicts after the second pass (2026-11-05, read-only)

See the end of this file for the latest run; Trakstar and Cefalo use invisible reCAPTCHA (`grecaptcha.execute`, `size: invisible`), so they no longer stop on a challenge by themselves. Hosts remain `review`, so an admin approval is still required.

| Employer | Verdict (no profile attached) |
|---|---|
| Therap (Trakstar) | Will stop: host review and an unmapped question; no challenge seen (invisible reCAPTCHA). With an approved host and a profile with the needed answers it can proceed to submit; confirmation text is not known, so an unconfirmed submit is Outcome unknown. |
| Cefalo open application | Will stop only for host review; form opens without a wall or visible challenge. Three-step flow uses Next and Submit labels. |
| Optimizely (SuccessFactors) | Will stop: host review and no form; Apply leads to the career55.sapsf.eu sign-in and create-account pages, not inspectable read-only. |
| Brain Station 23 (easy.jobs) | Will stop: candidate single sign-on in a frame is a sign-in wall; the SSO page cannot be inspected read-only. |
