# E15 Add a job by link — Test plan (unit only)

- Backend: a posting link is read, matched, saved to a track, and opened; adding again returns the same job; pages without structured data use the title and main text; unreadable and unsafe links are refused; the job stays private to the person who added it; the endpoint.
- Web: required link, unreadable link message, a known link opens the job.
- Mobile: required link and opening the job after adding.
