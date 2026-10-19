# Sequence Flows

Key runtime flows. Participants: **U** user (web/mobile), **BFF** web server or mobile app, **API** user API, **ADM** admin API, **TMP** Temporal, **W** workers, **DB** PostgreSQL, **S3** object storage, **BUS** event bus, **AI** Claude, **EXT** external system.

## 1. Sign-up, onboarding, and résumé import

```mermaid
sequenceDiagram
  participant U as User
  participant IdP as Keycloak
  participant API
  participant S3
  participant TMP
  participant W as AI worker
  participant AI as Claude
  U->>IdP: Sign up (email/phone, password or passkey, MFA)
  IdP-->>U: Tokens (web: via BFF cookie; mobile: secure store)
  U->>API: POST /v1/onboarding (basics, locale, time zone)
  U->>API: POST /v1/documents/uploads (request presigned URL)
  API-->>U: Presigned URL
  U->>S3: Upload CV
  U->>API: POST /v1/documents/{id}/versions (complete upload)
  API->>TMP: Start ResumeImportWorkflow
  TMP->>W: Scan file (antivirus), extract
  W->>AI: resume_import task (document + profile schema)
  AI-->>W: Structured facts + evidence
  W->>API: Save facts as "extracted, unconfirmed"
  API-->>U: SSE/push: "Review your imported profile"
  U->>API: PATCH /v1/profile/facts (confirm/correct)
```

## 2. Discovery cycle

```mermaid
sequenceDiagram
  participant TMP
  participant W as Discovery worker
  participant EXT as Source
  participant S3
  participant DB
  participant BUS
  TMP->>W: Scheduled DiscoveryWorkflow(source)
  W->>DB: Create search_cycle (running)
  loop pages (rate limited, circuit breaker)
    W->>EXT: list_postings(cursor)
    EXT-->>W: Postings
    W->>S3: Store raw snapshot
    W->>DB: raw_postings + outbox(RawPostingFetched)
  end
  W->>DB: search_cycle = succeeded / partial / failed
  DB-->>BUS: Outbox relay publishes events
```

## 3. Extraction, archive, dedup, fraud

```mermaid
sequenceDiagram
  participant BUS
  participant W as AI worker
  participant AI as Claude
  participant DB
  participant S3
  BUS->>W: RawPostingFetched
  W->>DB: Load opportunity type schema
  W->>AI: posting_extraction (HTML/PDF/image, schema)
  AI-->>W: Fields + evidence + confidence + language
  W->>DB: Find duplicate candidates (similarity + vector)
  opt close candidates
    W->>AI: duplicate_check
  end
  W->>W: Fraud rules + AI signals
  W->>S3: Archive version (Object Lock) + hash
  W->>DB: opportunity + version + fields + outbox(OpportunityPublished or Changed)
```

## 4. Matching and daily digest

```mermaid
sequenceDiagram
  participant BUS
  participant W as Matching worker
  participant DB
  participant AI as Claude
  participant TMP
  participant N as Notification worker
  participant U as User
  BUS->>W: OpportunityPublished
  W->>DB: Candidate users (vector + coarse filters)
  loop each candidate user/track
    W->>W: Hard filters (CEL rules, country, compensation, eligibility checks)
    W->>W: Score (scoring model version)
    W->>AI: match_explanation (only above threshold)
    W->>DB: recommendation + outbox(RecommendationCreated)
  end
  TMP->>N: DigestWorkflow at user's time (time zone)
  N->>DB: Top N per track (track result limit)
  N->>U: Push / WhatsApp / email digest
```

## 5. Approve-each application (end to end)

```mermaid
sequenceDiagram
  participant U as User
  participant API
  participant TMP as ApplicationWorkflow
  participant W as Application worker
  participant AI as Claude
  participant EXT as Portal
  participant DB
  U->>API: POST /v1/applications {opportunity_id, route}
  API->>DB: application (NotStarted) + idempotency
  API->>TMP: Start ApplicationWorkflow
  TMP->>W: Build approval package
  W->>EXT: discover_form (sandbox)
  W->>AI: question_understanding, writing tasks, claim_check
  W->>DB: approval_package (Ready); status AwaitingApproval
  TMP-->>U: Notify "Approval needed"
  U->>API: POST /v1/approval-packages/{id}/approve {edits, edit_scopes, submit_at}
  API->>DB: approval + edits (this app / reusable answer / profile)
  API->>TMP: Signal approved
  TMP->>TMP: Wait for window, caps, pause checks (timers)
  TMP->>W: Pre-submission checks + re-check posting
  W->>DB: intent record (idempotency key)
  W->>EXT: sign in, fill, upload, submit
  EXT-->>W: Confirmation page / number
  W->>DB: evidence + Q&A + files + status Confirmed + outbox
  TMP-->>U: Notify result
```

## 6. New question after approval, answered from WhatsApp

```mermaid
sequenceDiagram
  participant W as Application worker
  participant TMP as ApplicationWorkflow
  participant N as Notification worker
  participant WA as WhatsApp
  participant U as User
  participant API
  W->>TMP: New unanswered required question
  TMP->>TMP: Status AwaitingUserInformation (keep other approved values)
  TMP->>N: Urgent notification with quick-answer action
  N->>WA: Template message + reply buttons / link
  WA->>U: Question
  U->>WA: Answer (or opens app)
  WA->>API: Webhook (signed) with answer
  API->>API: Verify user + message signature + re-auth if required
  API->>TMP: Signal answer (+ save as reusable if chosen)
  TMP->>W: Continue fill and submit
```

## 7. Automatic application with window and caps

```mermaid
sequenceDiagram
  participant BUS
  participant TMP as ApplicationWorkflow
  participant P as Policy (precedence, caps, pauses, countries)
  participant W as Application worker
  participant U as User
  BUS->>TMP: RecommendationCreated (rule candidate)
  TMP->>P: Evaluate rule version (CEL) + precedence (38)
  alt blocked / unknown hard requirement / suspicious
    P-->>TMP: Stop with reason
    TMP-->>U: Listed in "not applied" with reason
  else allowed
    TMP->>TMP: Reserve cap slot; wait for submission window
    TMP->>W: Prepare + checks + re-check posting
    W->>W: Submit + evidence
    TMP-->>U: Notification + daily report entry
  end
```

## 8. Email application and bounce

```mermaid
sequenceDiagram
  participant TMP
  participant W as Application worker
  participant G as Gmail / Graph
  participant SYNC as Mail sync worker
  participant DB
  TMP->>W: Send application email (approved content)
  W->>DB: intent record
  W->>G: Send (user's mailbox, approved attachments)
  G-->>W: Message ID
  W->>DB: email_message + status Confirmed (sent, no bounce yet)
  SYNC->>G: Poll / push notifications for thread
  alt bounce
    G-->>SYNC: Bounce
    SYNC->>DB: status Failed + reason; notify user
  else reply
    G-->>SYNC: Reply
    SYNC->>DB: link to thread; classify (AI); suggest outcome update
  end
```

## 9. Uncertain outcome verification

```mermaid
sequenceDiagram
  participant TMP as VerifySubmissionWorkflow
  participant W as Application worker
  participant EXT as Portal
  participant SYNC as Mail sync
  participant U as User
  TMP->>W: Check portal "my applications" page
  W->>EXT: Read status (no submit)
  alt found
    TMP->>TMP: Confirmed (evidence)
  else not found
    TMP->>SYNC: Look for confirmation email
    alt email found
      TMP->>TMP: Confirmed
    else nothing
      TMP->>U: Manual action required: "Please check if this application went through"
    end
  end
```

The workflow never resubmits on its own while the outcome is unknown (requirements Section 23.2).

## 10. Pause and resume

```mermaid
sequenceDiagram
  participant U as User
  participant API
  participant TMP
  participant DB
  U->>API: POST /v1/pauses {scope, starts_at, ends_at}
  API->>DB: Find approved items with deadlines inside the pause
  API-->>U: List: submit first / keep paused / cancel
  U->>API: Choices
  API->>DB: pause (Scheduled/Active) + outbox(PauseStarted)
  API->>TMP: Signal affected workflows (hold)
  TMP-->>U: Reminder before end
  TMP->>TMP: On end: re-check approvals, rules, profile freshness; resume within caps
```

## 11. Emergency stop (user or platform)

```mermaid
sequenceDiagram
  participant Actor as User / Super Admin
  participant API as API / Admin API
  participant DB
  participant TMP
  participant W as Workers
  Actor->>API: POST /v1/emergency-stop (scope)
  API->>DB: stop flag (checked before every external action) + audit
  API->>TMP: Signal all matching workflows: stop
  TMP->>W: Cancel activities not yet submitting
  W-->>TMP: In-flight submits finish to a safe state, outcome recorded
  TMP-->>Actor: Summary: stopped, in-flight results, affected users notified
```

## 12. Account deletion

```mermaid
sequenceDiagram
  participant U as User
  participant API
  participant TMP as AccountDeletionWorkflow
  participant DB
  participant S3
  participant EXT as Mail/Calendar/Portals
  U->>API: Re-authenticate + request deletion
  API->>TMP: Start (stop all automation immediately)
  TMP-->>U: Offer export; confirm grace period
  TMP->>TMP: Wait grace period (cancellable by signal)
  TMP->>EXT: Revoke OAuth tokens
  TMP->>DB: Delete credentials, personal data, records (redact immutable rows)
  TMP->>S3: Delete documents, archives, evidence (privacy override of retention)
  TMP->>DB: Minimal deletion record + audit
  TMP-->>U: Final confirmation email
```

## 13. Admin views sensitive data

```mermaid
sequenceDiagram
  participant A as Admin
  participant ADM as Admin API
  participant POL as Policy engine
  participant DB
  participant N as Notification
  A->>ADM: GET /admin/v1/users/{id}/identity-details (reason)
  ADM->>POL: Can role view sensitive data?
  POL-->>ADM: Allow (or deny)
  ADM->>DB: audit_event(AdminAccessedSensitiveData)
  ADM->>DB: Read + decrypt sensitive fields (secrets never)
  ADM-->>A: Data
  opt policy requires
    ADM->>N: Notify user of admin access (decision 56)
  end
```

## 14. Daily reconciliation

```mermaid
sequenceDiagram
  participant TMP as ReconciliationWorkflow
  participant DB
  participant ADM as Admin dashboard
  TMP->>DB: Every intent has an outcome?
  TMP->>DB: Every submission has an application record, archived circular, evidence?
  TMP->>DB: Report counts match records?
  TMP->>DB: Outbox fully published?
  alt mismatches
    TMP->>DB: reconciliation_issues
    TMP->>ADM: Alert; affected users informed when relevant
  end
```
