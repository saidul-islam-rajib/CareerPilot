# E11 Fresh start — Tasks

- [x] Spec
- [x] Backend starts empty: no seeding in repositories or the migrate job; enum catalog, default tracks, and platform defaults in config; sample data and mock job sources moved to test fixtures (`careerpilot.testing`)
- [x] First Super Admin by email link: pending admin, admin links and endpoints, owner email from `.env`, admin set-password and forgot-password pages
- [ ] Local fresh start: back up, then empty the local database, Redis sessions and links, and Mailpit; restart; owner link sent
- [x] Apps without demo mode: the apps always use the API; the in-memory API and sample data are unit-test doubles only (`@careerpilot/client-core/src/testing`); demo link, demo scripts, and demo config removed; the TypeScript enum catalog is `enumCatalog`, tested to match `config/defaults/enum-values.yaml`
- [!] Screen validators (`scripts/validate/*.mjs`) sign in with the old demo accounts and open sample records, so no environment has the data they need any more. Recommendation: run them against a throwaway stack filled from the test fixtures (never the owner's local data), or let them register an account first.
- [x] Documents: CLAUDE.md, Planning/18-Seed-Data.md, README, RUN-LOCALLY, requirements cross-references (Requirements.md never described seed data)
