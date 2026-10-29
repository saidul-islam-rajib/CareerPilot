# E01 Mobile app – tasks

- [x] Shared packages: tokens, i18n, domain enums, validation, API contract
- [x] App shell, providers, navigation guard, theme from config
- [x] Auth: welcome, sign in, register with consent, password reset
- [x] Today, opportunity detail, archived circular
- [x] Approvals with editable answers and confirmation
- [x] Applications list and submission record
- [x] Profile with drag-and-drop contacts and zoomable photo/signature
- [x] Settings: tracks, pause, submission window, activity, about, licences, delete account
- [x] Unit tests for every screen
- [x] Visual validation of every screen at phone width (scripts/validate/mobile-screens.mjs, 19 screens, 0 console errors)
- [x] Native build on Android/iOS device: EAS Build (`apps/mobile/eas.json`, docs/runbooks/mobile-release.md); Android APK built and installable; iOS builds wait for an Apple Developer account
- [x] Test builds can change the server address on the phone (`useServerAddress`, Sign in / More → Server)
