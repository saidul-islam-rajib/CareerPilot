# E07 Contact verification — Tasks

- [ ] One-time code store with hashing, attempts, cooldown, hourly limit, fail closed
- [ ] Verification service, email, endpoints
- [ ] Client contract, in-memory adapter, hook, schema
- [ ] Web verify dialog and mobile verify screen
- [ ] Docker check: code email in Mailpit, contact verified in the browser
- [!] SMS verification for phone numbers — needs an SMS provider account and credentials (external, outside local scope); recommendation: add an SMS sender port with a sandbox adapter, then a provider adapter when credentials exist
