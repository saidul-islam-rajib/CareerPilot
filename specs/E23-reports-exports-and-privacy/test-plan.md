# E23 Reports, exports and privacy — Test plan

Unit tests only, each building its own data.

- Reports: day and week windows in the user's time zone, buckets, track and route totals, upcoming items, other users excluded.
- Exports: CSV columns, PDF header and text, archive sections and files, no secrets in the archive, limits, expiry erases content, re-authentication.
- Deletion: request needs password, account pending, connections revoked, cancel restores, due request anonymizes and sends one confirmation, record kept, files erased, repeat run does nothing.
- Consent: required at registration, optional default off, append-only history, required kinds cannot be revoked.
- Admin: permission, audit entry, no keys or links in responses.
- Persistence: SQL repositories round trip, soft delete.
- Clients: API client http and in-memory, hooks, screens render and call the hooks.
