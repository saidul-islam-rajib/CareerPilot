# E01 Mobile app – test plan (unit tests only)

| Area | Spec file | Covers |
|---|---|---|
| Config | `src/core/config/app-config.spec.ts` | YAML defaults parse, invalid config rejected |
| Sign in | `src/features/auth/sign-in-screen.spec.tsx` | Validation, wrong credentials, local default account |
| Register | `src/features/auth/register-screen.spec.tsx` | Consent required, duplicate email, password mismatch |
| Today | `src/features/home/home-screen.spec.tsx` | Counts, tracks, navigation, pause banner and resume |
| Opportunity | `src/features/opportunities/opportunity-screen.spec.tsx` | Explanation, hard failure, prepare, dismiss, circular |
| Approvals | `src/features/approvals/approval-screen.spec.tsx` | AI marking, edit answer, confirm and queue, reject |
| Applications | `src/features/applications/applications-screen.spec.tsx` | Statuses, filters, full record |
| Profile | `src/features/profile/profile-screen.spec.tsx` | Reorder, primary contact, viewer |
| Settings | `src/features/settings/settings.spec.tsx` | Tracks, pause, window, activity, deletion, credits |
| UI | `src/ui/ui.spec.tsx` | Template splitting, drop index, zoom clamp, buttons, fields, stepper |
