# E10 Email link registration — Test plan (unit only)

- `services/core/tests/unit/platform/test_one_time_codes.py`: `peek` does not use up the code, counts wrong attempts, reports expiry.
- `services/core/tests/unit/candidate/test_account_links.py`: registration stores a `registered` account with the consent record and emails a link; the same answer and no email for an active account; a second registration replaces the link; registered accounts cannot sign in; inspect shows name, email, and purpose; policy-breaking passwords leave the link usable; completing activates, creates the profile, signs in, and uses up the link; expired, used, replaced, and malformed links; reset emails a reset link, the same answer for unknown emails, and ends older sessions; cooldown never reveals an account; delivery failure withdraws the link; API routes never return the secret.
- `packages/api-client`: HTTP paths and bodies; in-memory registration, demo link, set password, reset.
- `packages/validation`: `register` without password, `setPassword` policy and confirmation.
- `apps/web/src/features/auth`: register sends and shows the check-your-email card with resend; set-password checks the link, shows invalid and expired states, enforces the policy, and signs in.
- `apps/mobile/src/features/auth`: the same flows on the register and set-password screens.
- `services/core/tests/unit/platform/test_email_delivery.py`: the background courier retries retryable failures, stops on permanent ones, withdraws the link after the last try, and never resends an unknown outcome.
- `services/core/tests/unit/platform/test_platform.py`: the web address override moves email links and allows that origin, refuses unsafe values, and the mail sandbox list holds only seed and example domains.
- `packages/client-core/src/config/client-config.spec.ts`: the `dev` section never ships to the apps.
