# E28 Fees and payments tracking — Design

## API (user app, all under `/v1`)

- `GET /fees/reference`, `GET /fees/overview` (lines from fee rules, payments and government fees; reminders; totals per currency).
- `GET|POST /fees/rules`, `PUT|DELETE /fees/rules/{id}`, `POST /fees/rules/{id}/payments`.
- `GET|POST /fees/payments`, `GET|PUT|DELETE /fees/payments/{id}`, `POST /fees/payments/{id}/actions` (confirm_paid, confirm_not_paid, mark_uncertain, mark_failed, mark_refunded, mark_waived), `POST /fees/payments/{id}/receipts`, `DELETE /fees/payments/{id}/receipts/{receiptId}`.
- `PUT /settings/excluded-organizations` `{organizations}`; `PUT /settings/private-notifications` `{enabled}`. Both return the preferences.

## Data

- Table `fee_records` (migration `d7a1f3e58c92`): user_id, record_kind (fee_rule or payment), JSON document, all audit columns, soft delete only.
- Preferences gain `excludedOrganizations` and `privateNotifications` (stored in the workspace document, no migration).
- Defaults in `config/defaults/fees.yaml` (currencies, limits, due-soon days, guidance per status) and `account.yaml` (`max_excluded_organizations`).
- Enums: fee kind, payment status, payment action, receipt kind, line source, urgency, reminder kind, guidance, warning.
- Transaction IDs are stored as entered (not credentials) and shown only to their owner.

## Rules

- Status model: due, paid, uncertain, failed, refunded, waived. Allowed transitions are a table in `fees/payments.py`; refunds need a note; paid needs evidence.
- Urgency uses the deadline and `due_soon_days`; only due and uncertain payments are open.
- Government fees: `FeesContext.government` reads `GovernmentTracking.list_for`; unconfirmed maps to uncertain; withdrawn applications and not-required fees are skipped. Edits stay in the government screens.
- Excluded employers match by normalized whole words (Acme excludes Acme Bangladesh Ltd). Enforced in matching, automation safeguards (`excluded_employer`) and `SubmissionService.submit` (cancels queued applications).
- Private push: `NotificationContext.private_lookup` swaps title and body for catalog text; data carries only ids.

## UI states

Web `/fees` and mobile Fees: loading, empty, error with retry, offline via the shared query layer. Overview with reminders on top, lines below, forms in dialogs (web) and sheets (mobile). Settings: Excluded employers list and Private notifications switch. Text from the catalog, colours from theme tokens.

## Edge cases

Uncertain outcome is never retried automatically; duplicate transaction is refused (409); currency outside config is refused; deleting a rule keeps its payments.
