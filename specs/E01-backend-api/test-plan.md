# E01 Backend API – test plan (unit tests only)

| Area | File | Covers |
|---|---|---|
| Platform | `tests/unit/platform/` | Config, hashing, tokens, seed time shift, device names |
| Candidate | `tests/unit/candidate/test_candidate_services.py` | Sign-in, registration rules, suspension, dashboard, approvals, filters, profile, pause, window, deletion, theme |
| Administration | `tests/unit/administration/test_admin_services.py` | Permissions, dashboard maths, audit trail, paging, read-only role, catalog, settings, admin accounts |
| HTTP | `tests/unit/api/test_http_api.py` | JSON shapes, problem details, auth boundaries, paging, theme across apps, security headers |
