# E28 Fees and payments tracking — Requirements

**Requirement IDs:** REQ-10.10, REQ-10.11, REQ-40.1, REQ-27 (payments), REQ-49 and REQ-51 (government fee window, compensation), acceptance criteria 24 and 25.

## Scope

CareerPilot records fees and payments for every application kind. It never makes a payment, never stores card details, and never sends money. Where a portal takes payment (mobile banking, SMS, bank, card on the official site), the user pays there and records the outcome here. Government fees already tracked per application (E22) are shown in the same overview and are not duplicated.

## User stories

- As a job seeker, I want the fee an employer or portal asks for kept next to the opportunity so that I know the cost and the deadline before I apply.
- As an applicant, I want each payment recorded with payee, amount, method, transaction ID and receipt so that I have evidence if a portal loses it.
- As an applicant, I want to be reminded of payment deadlines in the app so that I do not miss one.
- As an applicant whose payment may not have gone through, I want it shown as uncertain until I confirm the outcome so that I never pay twice or assume it was paid.
- As a user with a confidential search, I want my current employer and related companies excluded so that they are never recommended, applied to or contacted.
- As a user, I want private notifications so that a lock screen shows no job, employer or message details.

## Acceptance criteria

- WHEN the user adds a fee rule for an opportunity or application THE SYSTEM SHALL store kind, payee, amount, currency, purpose, official source, whether the payee is verified, deadline and waiver note.
- WHEN a fee rule is turned into a payment record THE SYSTEM SHALL copy its details and link the two.
- WHEN a payment is marked paid THE SYSTEM SHALL require evidence (a receipt entry or a transaction ID) and SHALL NOT report it paid otherwise.
- WHEN the user is not sure a payment went through THE SYSTEM SHALL keep it uncertain, show verification guidance (check with the payee, do not pay again, add a receipt), and change it only when the user confirms paid, not paid, failed or refunded.
- WHEN a transaction ID already exists on another payment THE SYSTEM SHALL refuse the record as a duplicate.
- WHEN two payments for one fee rule are both paid THE SYSTEM SHALL flag a possible duplicate with refund guidance.
- WHEN a payment is overdue, due within the configured days, or uncertain THE SYSTEM SHALL list it as a reminder in the fees overview.
- WHEN a payee is not marked verified and the payment is open THE SYSTEM SHALL show an unverified-payee warning.
- WHEN the overview is built THE SYSTEM SHALL include government fee records (E22) as read-only lines and totals per currency.
- WHEN the user adds an excluded employer THE SYSTEM SHALL remove its jobs from recommendations, block automatic application, cancel queued applications to it before sending, and never email it.
- WHEN private notifications are on THE SYSTEM SHALL send push text that hides titles, names and message bodies; the in-app notification keeps the details.

## Out of scope in v1

- Paying through a gateway, payment-provider webhooks and hosted checkout (REQ-10.11): CareerPilot records only; see tasks.
- Uploading receipt files: receipts are references (message text, receipt number, portal confirmation, statement line).
