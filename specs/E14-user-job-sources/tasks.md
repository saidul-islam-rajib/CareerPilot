# E14 Job sources added by users — Tasks

- [x] Spec and requirement §7.1.1; API design updated
- [x] Backend: review state and owners on sources, per-user visibility in matching, user source service, review queue and decisions, endpoints, audit
- [x] Client: types, ports, HTTP and in-memory adapters, shared hooks, catalog text, enum `source_review`, `jobSources` and `note` limits
- [x] Web page, mobile screens, admin review card
- [x] Docker rebuild keeping local data; web, admin, and the phone bundle serve the new screens; Metro restarted with --clear
- [x] Admin sets the per-user source limit in Platform settings (default 10, range 1 to 100 from config); users see the current limit
- [x] Automatic mode applies to every unhandled listed job; application emails need an apply phrase and exclude accommodation and privacy contacts
- [x] Saved job routes follow the email rules; the submitter uses the current route; address checks use one lookup and retry once
- [x] Portal applications show "Finish on the employer's site" with a link to the application page (web and mobile)
- [x] Docker rebuilt, worker restarted on the new code, Metro restarted with --clear

## Company name and email search (2026-10-29)

- [x] Parse the add box as link, company email, or name (`discovery/company_search.py`)
- [x] Trigram index for known companies and name verification (`platform/similarity.py`)
- [x] Parallel handle probing on job boards and domains with a deadline and quick fetches
- [x] Hrythmic job board; follow off-site career links except ignored hosts; http redirect hops upgraded to https
- [x] Classify arrangement and country when not stated (`discovery/classification.py`, `config/defaults/classification.yaml`)
- [x] Source jobs by arrangement and "add to my lists" endpoints
- [x] Web and mobile: one input for link, email, or name; counts by arrangement; source jobs screen; long request timeout
