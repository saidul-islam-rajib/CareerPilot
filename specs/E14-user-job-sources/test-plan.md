# E14 Job sources added by users — Test plan (unit only)

- Backend: a user adds by link and it waits for review with the reason; jobs from a pending source are visible only to owners and to everyone after approval; duplicates join or are refused (`source_exists`, `source_shared`, `source_pending`); approval needs a justification, is audited, and cannot be repeated; a kept-private source shows the reason; removing stops a source nobody uses and adding it again revives it; `jobs_not_found` and `source_limit`; address matching ignores scheme, `www.`, and trailing slash; the user and admin endpoints.
- Client: in-memory sources API and admin review queue; enum catalog matches config.
- Web: add with validation, waiting-for-review hint, remove with confirmation; settings links to the page.
- Mobile: add screen validates and goes back; list shows review state and removes after confirming.
- Admin: review card shows who and why, requires a justification, approves and keep-private; read-only admins see requests without actions.
