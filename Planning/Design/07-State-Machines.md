# State Machines

Every stateful entity changes state only through the transitions below. Transitions are enforced in the domain layer, and each transition writes an `application_events` / audit entry and a domain event. Invalid transitions are rejected.

## 1. Application submission status (requirements Section 20.2)

```mermaid
stateDiagram-v2
  [*] --> NotStarted
  NotStarted --> Preparing
  Preparing --> AwaitingUserInformation: missing answer / file / fact
  AwaitingUserInformation --> Preparing: user provides
  Preparing --> AwaitingApproval: approve-each mode or rule requires review
  Preparing --> ApprovedQueued: automatic rule authorizes
  AwaitingApproval --> ApprovedQueued: user approves
  AwaitingApproval --> Cancelled: user rejects / approval expires
  ApprovedQueued --> AwaitingUserInformation: new question after approval (37.4)
  ApprovedQueued --> AwaitingApproval: posting changed materially
  ApprovedQueued --> Cancelled: user cancels / emergency stop / pause / country exclusion
  ApprovedQueued --> Submitting: window open + caps OK + checks pass
  Submitting --> ManualActionRequired: CAPTCHA / MFA / user-only step
  ManualActionRequired --> Submitting: user completes, session valid
  ManualActionRequired --> Failed: not completed before deadline
  Submitting --> SubmittedAwaitingConfirmation: submit done, no evidence yet
  Submitting --> Failed: definite failure
  Submitting --> OutcomeUnknown: crash / timeout / ambiguous response
  SubmittedAwaitingConfirmation --> Confirmed: evidence received
  SubmittedAwaitingConfirmation --> OutcomeUnknown: no evidence within time limit
  OutcomeUnknown --> Confirmed: verification finds evidence
  OutcomeUnknown --> Failed: verification shows not submitted
  OutcomeUnknown --> ManualActionRequired: cannot verify automatically
  Confirmed --> Failed: email bounce received
  Failed --> Preparing: retry allowed (outcome known, deadline open)
  Confirmed --> [*]
  Cancelled --> [*]
```

## 2. Application outcome status

```mermaid
stateDiagram-v2
  [*] --> NoResponseYet: submission confirmed
  NoResponseYet --> UnderReview
  NoResponseYet --> Assessment
  NoResponseYet --> Interview
  NoResponseYet --> Rejected
  NoResponseYet --> Closed: user closes
  UnderReview --> Assessment
  UnderReview --> Interview
  UnderReview --> Rejected
  Assessment --> Interview
  Assessment --> Rejected
  Interview --> Interview: next round
  Interview --> OfferReceived
  Interview --> Admitted
  Interview --> ConditionallyAdmitted
  Interview --> Waitlisted
  Interview --> Rejected
  UnderReview --> Admitted
  UnderReview --> ConditionallyAdmitted
  UnderReview --> Waitlisted
  UnderReview --> Deferred
  Waitlisted --> Admitted
  Waitlisted --> Rejected
  ConditionallyAdmitted --> Admitted: conditions met
  OfferReceived --> OfferAccepted: user accepts
  OfferReceived --> OfferDeclined: user declines
  Admitted --> OfferAccepted
  Admitted --> OfferDeclined
  NoResponseYet --> Withdrawn: user withdraws
  UnderReview --> Withdrawn
  Interview --> Withdrawn
```

Outcome changes come from evidence (classified emails, portal status) or user entry; each records its source (system-observed, organization-reported, user-entered). Silence never moves to `Rejected`.

## 3. Approval package

```mermaid
stateDiagram-v2
  [*] --> Draft
  Draft --> Ready: all items prepared (missing items listed)
  Ready --> Approved: approve / edit and approve
  Ready --> Rejected: user rejects
  Ready --> Deferred: user defers
  Deferred --> Ready: re-checked
  Ready --> Expired: expiry period / deadline passed
  Approved --> Superseded: posting changed materially or new item added
  Superseded --> Ready
  Approved --> Consumed: submission started
  Approved --> Cancelled: user cancels / stop / pause
```

## 4. Opportunity lifecycle

```mermaid
stateDiagram-v2
  [*] --> Discovered
  Discovered --> Extracted
  Extracted --> NeedsReview: low confidence / conflicts
  NeedsReview --> Active: admin or rule resolves
  Extracted --> Active
  Extracted --> Suspicious: fraud signals
  Suspicious --> Active: confirmed legitimate
  Suspicious --> Blocked: confirmed fraudulent
  Active --> ClosingSoon: deadline near
  ClosingSoon --> Closed: deadline passed
  Active --> Changed: new version
  Changed --> Active
  Active --> Withdrawn: removed by source
  Active --> Duplicate: merged into group
  Closed --> [*]
  Withdrawn --> [*]
```

`Withdrawn` and `Closed` opportunities keep their archived versions (requirements Section 50).

## 5. Automatic rule

```mermaid
stateDiagram-v2
  [*] --> Draft
  Draft --> DryRun: simulate
  DryRun --> Draft
  Draft --> Active: user enables (re-auth)
  Active --> Paused: user / pause / inactivity / profile freshness
  Paused --> Active: resumed + checks
  Active --> PendingReapproval: material change to rule or materials
  PendingReapproval --> Active: user re-approves
  Active --> Expired: review date reached
  Expired --> Active: user renews
  Active --> Revoked: user revokes
  Paused --> Revoked
  Revoked --> [*]
```

## 6. Pause

```mermaid
stateDiagram-v2
  [*] --> Scheduled: future start
  [*] --> Active: starts now
  Scheduled --> Active: start time
  Scheduled --> Cancelled
  Active --> EndingSoon: reminder sent
  EndingSoon --> Active: extended
  EndingSoon --> Ended: end time
  Active --> Ended: user ends early
  Ended --> [*]
  Cancelled --> [*]
```

`Active` with no end time = indefinite pause.

## 7. User account

```mermaid
stateDiagram-v2
  [*] --> Registered
  Registered --> Active: email/phone verified
  Active --> Suspended: admin action
  Suspended --> Active: admin reactivates
  Active --> PendingDeletion: user requests deletion
  PendingDeletion --> Active: user cancels in grace period
  PendingDeletion --> Deleted: grace period ends, data anonymized
  Deleted --> [*]
```

All automation stops immediately on entering `Suspended` or `PendingDeletion`.

## 8. Notification delivery

```mermaid
stateDiagram-v2
  [*] --> Queued
  Queued --> Held: quiet hours (non-urgent or override off)
  Held --> Queued: quiet hours end
  Queued --> Sent
  Sent --> Delivered: provider confirms
  Sent --> Failed: provider error
  Failed --> Fallback: fallback channel configured
  Fallback --> Sent
  Failed --> [*]
  Delivered --> Actioned: user acts from notification
  Delivered --> [*]
```

## 9. Search cycle / source check

```mermaid
stateDiagram-v2
  [*] --> Scheduled
  Scheduled --> Running
  Running --> Succeeded
  Running --> Partial: some pages failed
  Running --> Failed
  Running --> RateLimited
  RateLimited --> Scheduled: backoff
  Failed --> Scheduled: retry policy
  Scheduled --> Skipped: source disabled / circuit open
```

## 10. Payment

```mermaid
stateDiagram-v2
  [*] --> Requested
  Requested --> AwaitingUser: outside rule / unverified payee / SMS payment
  Requested --> Processing: within rule
  AwaitingUser --> Processing: user approves
  AwaitingUser --> Cancelled
  Processing --> Confirmed: provider / portal confirmation
  Processing --> Failed
  Processing --> Uncertain: timeout / no confirmation
  Uncertain --> Confirmed: verification
  Uncertain --> Failed: verification
  Confirmed --> RefundRequested
  RefundRequested --> Refunded
```

## 11. Document version

```mermaid
stateDiagram-v2
  [*] --> Draft
  Draft --> Reviewed
  Reviewed --> Approved: approved for reuse
  Approved --> Archived: replaced by user choice
  Draft --> Archived
  Approved --> Expired: validity date passed
```

## 12. Portal account

```mermaid
stateDiagram-v2
  [*] --> Detected: existing account found
  [*] --> Creating: authorized creation
  Creating --> PendingVerification: email/OTP needed
  PendingVerification --> Active
  Creating --> Active
  Detected --> Active: credentials provided
  Active --> SessionExpired
  SessionExpired --> Active: re-login
  Active --> Locked: portal lockout
  Locked --> Active: user resolves
  Active --> Deleted: user deletes credentials
```

## 13. Government application stages (country pack: Bangladesh)

```mermaid
stateDiagram-v2
  [*] --> FormSubmitted
  FormSubmitted --> FeePending
  FeePending --> FeePaid: confirmation evidence
  FeePending --> Lapsed: payment deadline passed
  FeePaid --> AwaitingAdmitCard
  AwaitingAdmitCard --> AdmitCardAvailable
  AdmitCardAvailable --> ExamScheduled
  ExamScheduled --> ExamResult: official result
  ExamResult --> NextStage: passed (written / practical / viva)
  NextStage --> ExamScheduled
  ExamResult --> NotSelected
  NextStage --> Verification: documents / police / medical
  Verification --> Appointed
```

Stage names and order come from the country pack and the circular, so other countries' processes can reuse this mechanism.
