# E12 Job sources and rematching — Test plan (unit only)

- Matching: a profile change rescores listings, keeps approved, applied, and dismissed jobs, refills tracks best first, never places a listing in two tracks, and applies by rule only newly placed jobs in automatic tracks; a track change rematches.
- Sources: adding a source saves its definition, checks it once, and makes it due for scheduled checks; unsafe addresses (http, private, loopback, link-local, credentials) and unknown connectors are refused without fetching; suggestions hide sources already added; the endpoints require the sources permission.
- Admin app: the add form validates and adds; a suggestion is added with one click and leaves the list.
