# E22 Bangladesh government jobs — Test plan

| Acceptance criterion | Test type | Test file | Status |
|---|---|---|---|
| Age as of the cut-off, exact to the day | unit | services/core/tests/unit/government/test_ages_and_eligibility.py | Done |
| Relaxation only with a verified status | unit | same | Done |
| Missing facts are unknown | unit | same | Done |
| Education results, subject, scale | unit | same | Done |
| District, quota claims, filters | unit | same, test_circulars_and_calendar.py | Done |
| Fee deadline, urgency, evidence | unit | test_tracking.py | Done |
| Stages need support for results | unit | test_tracking.py | Done |
| Applicant copy and sealed credentials | unit | test_tracking.py | Done |
| Holidays, weekends, office hours | unit | test_circulars_and_calendar.py | Done |
| Versions and amendments | unit | test_circulars_and_calendar.py | Done |
| Connector limited to public Teletalk pages | unit | test_circulars_and_calendar.py | Done |
| Audit columns and soft delete | unit | test_persistence.py | Done |
