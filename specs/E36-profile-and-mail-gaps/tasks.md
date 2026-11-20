# E36 Profile and mail gaps (REMAINING rows E04, E05, E11)

## Decisions
- Sensitive profile fields are flagged `sensitive` in `config/defaults/profile.yaml` (NID, passport, birth registration); the server masks them in every profile response, reveal is an explicit audited call, and saving a masked value back keeps the stored one. Addresses section already exists (BD).
- Signature: draw pad (web SVG, mobile gesture + SVG) encoded to PNG by shared `signature-png`, upload from files or gallery, replace, remove. Photo crop stays square; aspect presets are not built (portal sizing belongs to the prepare-photo-signature step).
- Inbound bounces are read through the user's connected Gmail (`gmail.readonly`); a bounce marks that application's delivery failed and notifies the user; nothing is resent.

## Tasks
- [x] Identity masking, reveal audit, API client, web and mobile UI, tests
- [x] Signature set and remove (API, in-memory, web pad, mobile pad), tests
- [ ] Photo crop aspect presets (deferred, square crop works on both platforms)
- [ ] Inbound bounce detection through Gmail, status change, notification, tests
- [ ] Screen validators create their own data through register and Mailpit with @sober.com addresses
- [ ] Fix pyright errors in tests/unit/discovery/test_discovery.py
