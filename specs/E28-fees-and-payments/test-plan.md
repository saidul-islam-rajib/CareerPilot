# E28 Fees and payments tracking — Test plan

| Acceptance criterion | Test type | Test file | Status |
|---|---|---|---|
| Rules and payments CRUD, reference | unit (Python) | services/core/tests/unit/fees/test_overview.py, test_payments.py | Passing |
| Paid needs evidence; uncertain flow; transitions | unit (Python) | services/core/tests/unit/fees/test_payments.py | Passing |
| Duplicate transaction and possible duplicate | unit (Python) | services/core/tests/unit/fees/test_payments.py | Passing |
| Reminders, totals, government fees reused | unit (Python) | services/core/tests/unit/fees/test_overview.py | Passing |
| Soft delete and audit columns | unit (Python) | services/core/tests/unit/fees/test_persistence.py | Passing |
| Excluded employers in matching, automation, submission | unit (Python) | tests/unit/matching/test_rematch.py, automation/test_dry_run.py, candidate/test_submission.py | Passing |
| Private push text | unit (Python) | services/core/tests/unit/messaging/test_push.py | Passing |
| API client and hooks | unit (TypeScript) | packages/api-client/src/fees, packages/client-core/src/hooks/use-fees.spec.ts | See tasks |
| Web and mobile screens | unit (TypeScript) | apps/web and apps/mobile fees specs | See tasks |
