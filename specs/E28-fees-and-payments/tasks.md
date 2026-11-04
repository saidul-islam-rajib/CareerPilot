# E28 Fees and payments tracking — Tasks

- [x] Spec
- [x] Backend: enums, config, models, repository, migration, services, routes
- [x] Backend unit tests
- [x] Excluded employers (matching, automation, submission) and private push text, with tests
- [ ] API client: types, ports, HTTP, in-memory
- [ ] client-core hooks, i18n catalog
- [ ] Web screens (fees, settings)
- [ ] Mobile screens (fees, settings)
- [!] Payment providers and webhooks (REQ-10.11): v1 records only. Option A (chosen): no gateway, the user pays on the official site and records the outcome. Option B: add a payment-provider interface with signed-webhook confirmation. Recommendation: A until a provider and the payment rule limits are approved by the owner.
- [!] Payment rules with limits (REQ-10.10 maximum per application and in total): nothing is paid by CareerPilot, so no spending limits are enforced; automatic rules keep "fees allowed: none" (E25). Option A (chosen): record only. Option B: warn when recorded fees exceed a rule's limit. Recommendation: B when payments are automated.
- [!] Receipt files: receipts are text references. Option A (chosen): references. Option B: upload and store a receipt image or PDF like government applicant copies. Recommendation: B in a follow-up.
- [!] Reminders: shown in the fees overview; push or email reminders need a worker schedule. Option A (chosen): in app only. Option B: Temporal schedule that calls the notification service. Recommendation: B together with the E22 reminders.
- [!] Fees on academic programs (E26) and fees read from opportunity data: the user adds a fee rule linked by opportunity or application ID. Option A (chosen): manual rule. Option B: read the fee from the opportunity or program automatically. Recommendation: B.
