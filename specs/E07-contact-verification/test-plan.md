# E07 Contact verification — Test plan (unit only)

- `services/core/tests/unit/platform/test_one_time_codes.py`: hashing (no plain code stored), expiry, wrong attempts lock, cooldown, hourly limit, store unavailable fails closed.
- `services/core/tests/unit/candidate/test_contact_verification.py`: send emails a code to the address, confirm verifies, wrong/expired codes, phone rejected, already verified, API routes.
- `packages/api-client` in-memory test; `packages/validation` schema test.
- `apps/web` contacts: verify dialog flow; `apps/mobile`: verify screen flow.
