# E11 Fresh start — Test plan (unit only)

- `services/core/tests/unit/platform/test_fresh_start.py`: a new system has no people, jobs, or sources (former demo sign-ins fail for users and admins); the enum catalog and theme come from config; new accounts get exactly the configured default tracks; an empty database returns config platform defaults and an empty operations snapshot.
- `services/core/tests/unit/platform/test_platform.py`: sample-data timestamps shift to the test clock.
- Every other backend and worker test builds its container from `careerpilot.testing` (sample repositories and discovery fixtures), so no test depends on runtime seeding.
- Owner link (with the admin link task): the owner gets a pending Super Admin and one link when no admin exists; nothing happens when an admin exists or no owner email is set; the link sets the password, activates, and signs in; expired, used, and malformed links fail; password-link requests answer 204 for every address and email only admins.
