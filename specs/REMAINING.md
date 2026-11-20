# Remaining work for version 1

Updated 2026-11-05. Ticked 6 tasks that code proves built: E02 scheduled checks and digest, E05 dry run and buffer, E28 API client, hooks, web and mobile screens. E29 is excluded (in progress). Backlog rows E08 quiet hours, E09 bulk approval, E20 Play Store release and E22 auto-fix pipeline have no code.

| Item | Spec or backlog row | Category | Note |
|---|---|---|---|
| Bangladesh portal, government notice and university connectors with PDF and Bangla extraction | E02 tasks; E14 | BUILD | Greenhouse, Lever, Ashby exist; BD and university sources missing |
| Profile-based requirement extraction from PDFs and Bangla circulars | E03 tasks | BUILD | Template path first; live AI needs ANTHROPIC_API_KEY (ACCOUNT) |
| Bulk approval of applications | E09 backlog | BUILD | Only single approvals found |
| Email and phone verification with codes | E04 tasks | BUILD | Email code flow exists; phone waits on SMS (E07) |
| Identity details (masked) and addresses sections | E04 tasks | BUILD | Masking exists for contacts only |
| Signature pad and photo crop presets | E04 tasks | BUILD | Web signature and mobile crop screen exist; check both platforms |
| Inbound bounce processing | E05 tasks | BUILD | Only outbound bounce window found; needs inbound mail parsing |
| User reports: dead link, inaccurate detail, false merge, fraud | E02 tasks | BUILD | Nothing found in code |
| Portal routes with browser automation (ATS adapters) | E05 tasks | BUILD | In progress under E29; do not start in parallel |
| Government deadline reminders by worker schedule | E22 [!] | BUILD | Pair with E28 fee reminders |
| Fee rule read from opportunity or program (option B) | E28 [!] | BUILD | Recommended B |
| Receipt upload as stored file (option B) | E28 [!] | BUILD | Recommended as follow-up |
| Fee reminders through worker schedule (option B) | E28 [!] | BUILD | Recommended with E22 reminders |
| Employer AI-use policy field (REQ-10.7) | E24 [!] | BUILD | Draft source already labelled |
| Privacy export and deletion for academic records | E26 [!] | BUILD | Recommended option A |
| Dashboard date, country, track and user filters (53.3) | E27 [!] | BUILD | Recommended option A query filters |
| Live notification counts and system health | E27 [!] | BUILD | Recommended option A |
| Problem reports and academic records on user record | E27 [!] | BUILD | Add admin read ports |
| Create and delete admin accounts and custom roles | E17 tasks | BUILD | Not found in code |
| Normalize workspace documents into per-entity tables | E01-backend-api tasks | BUILD | Internal refactor, lowest priority for seekers |
| Self-healing auto-fix pipeline and triage | E22 backlog | BUILD | Not found; OTel exists |
| Screen validators sign in with old demo accounts | E11 [!] | BUILD | Rewrite to create own test data; no seed |
| Push and WhatsApp channels (urgent and non-urgent choice) | E06 tasks | ACCOUNT | Push partly built; WhatsApp needs Meta WhatsApp Business Platform (paid per conversation) |
| SMS verification for phone numbers | E07 [!] | ACCOUNT | SMS provider, paid per message; choose one with a trial |
| Gmail "Send mail as" for info@team-sober.com | E10 [!] | ACCOUNT | Free; owner verifies in Gmail |
| Android App Links and iOS Universal Links | E10 [!] | ACCOUNT | Apple Developer USD 99/yr for iOS; Android free; needs domain |
| Device push on iPhone | E18 [!] | ACCOUNT | Apple Developer USD 99/yr (paid) |
| Expo Go from any network (EAS Update or hosted Metro) | E20 [!] | ACCOUNT | Expo EAS free tier; check limits |
| AI reply classifier | E21 [!] | ACCOUNT | Anthropic API key, paid per token; rules ship first |
| Live AI quality for drafts | E24 [!] | ACCOUNT | Anthropic API key, paid per token |
| Team alert email on new user messages | E27 [!] | ACCOUNT | Owner sets team mailbox; free if Gmail |
| Google Play Store release | E20 backlog | ACCOUNT | Google Play developer USD 25 one-time (paid) |
| Google verification for restricted gmail.readonly scope | E21 [!] | EXTERNAL | Google review; above 100 test users needs app verification and security assessment (cost to check) |
| First real deploy to VM with domain, DNS and secrets | E20 [!] | EXTERNAL | Production checkpoint; domain is paid |
| linux/arm64 image builds | E20 [!] | EXTERNAL | Verify on the VM at first deploy |
| Reference data check: pay scale and age relaxation | E22 [!] | EXTERNAL | Owner checks gazette values in government.yaml |
| Teletalk terms of use and robots rules check | E22 [!] | EXTERNAL | Owner check before enabling the reader |
| Legal retention periods (REQ-46.2) | E23 [!] | EXTERNAL | Lawyer review |
| WCAG 2.2 AA review and acceptance evidence | E20 backlog | EXTERNAL | Needs a reviewer or auditor |
| Holiday data for movable holidays | E22 [!] | DECISION | Recommend option A: admin enters yearly |
| Requirement 8.4 automatic submission for government track | E22 [!] | DECISION | Recommend A: guided manual only (CLAUDE.md forbids CAPTCHA solving) |
| Circular archive original files and saved page copies | E22 [!] | DECISION | Recommend both: admin upload and connector HTML |
| alljobs.teletalk.com.bd JavaScript rendering | E22 [!] | DECISION | Recommend (a) admin adds or pastes circulars; headless browser later |
| Minimum age and guardian consent (REQ-42) | E23 [!] | DECISION | Recommend 16 with guardian consent below it |
| Referee agreement (REQ-40.3) | E23 [!] | DECISION | Recommend follow-up touching profile editors |
| Recipient time zone for submission windows | E25 [!] | DECISION | Recommend option B later with posting time zone data |
| Per-route submission windows | E25 [!] | DECISION | Recommend option A (built) |
| Academic program work-hour data entry | E26 [!] | DECISION | Option A (user entry) chosen; confirm |
| Payment records only, no gateway | E28 [!] | DECISION | Option A chosen; add provider interface after provider chosen |
| Payment limits per application and in total | E28 [!] | DECISION | Option A record only; recommend warning later |
| Sources total counts private sources | E27 [!] | DECISION | Recommend keep, add shared and private split later |
