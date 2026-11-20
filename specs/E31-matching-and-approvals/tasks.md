# E31 Matching rules, feedback, bulk approval, reports, fees from data, AI policy, pasted circulars — Tasks

Each task is end to end: backend, API client, client-core hook, web and mobile screens, unit tests. State lives in the workspace document unless a table is named.

- [x] 1 Compensation rule (§51): one global rule in preferences (minimum, currency, period, hard filter or preference, unstated policy include/exclude/recommend-only, range basis). Salary is read from the posting text by config phrases; other currency or missing period counts as not stated (no exchange rates in v1). Default: unstated is recommended, not applied automatically
- [x] 2 Match feedback: a verdict and reasons per opportunity; similar titles and organizations move the score by a configured weight, shown as a match factor
- [ ] 3 Bulk approval (§37.6): list shows employer, role, route, files, warnings; the call carries the exact approval ids and file hashes shown, and items with blocking warnings, fees or attestations are refused and listed
- [ ] 4 Opportunity reports (dead link, inaccurate detail, false merge, fraud): table opportunity_reports with audit columns; admin list and status change, each action written to the admin audit log
- [ ] 5 Fee rule read from the opportunity or academic program (E28 option B) and receipts uploaded as stored files (E28 option B)
- [ ] 6 Employer AI-use policy field (REQ-10.7) on the opportunity, read from the posting text by config phrases; generated text is not attached when the policy forbids it
- [ ] 7 Admin paste circular text: reuses the government connector parsing on pasted text and fills a draft the admin reviews; nothing is published without review (alljobs.teletalk.com.bd needs JavaScript)

Decisions: per-track compensation rules are a follow-up (global only); currency conversion needs a stated rate and date, so mismatched currency is treated as not stated (§51.2).
