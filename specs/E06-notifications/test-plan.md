# E06 Notifications and account settings — Test plan (unit only)

- `services/core/tests/unit/candidate/test_digest.py`: due once per local day after the chosen time; preferences respected; sections for sent and blocked applications; failed delivery not reported as sent; settings endpoint validation; new users see the default time.
- `services/workers/tests/unit/test_discovery_worker.py`: digest schedule and workflow wiring.
- `packages/validation/src/schemas.spec.ts`: `changePassword` and `notifications` schemas.
- `packages/api-client/src/http/http-api.spec.ts`: wrong current password keeps the session.
- `apps/web/src/features/settings/settings-pages.spec.tsx` and `apps/mobile/src/features/settings/settings.spec.tsx`: notifications and password screens.
