# E14 Job sources added by users — Tasks

- [x] Spec and requirement §7.1.1; API design updated
- [x] Backend: review state and owners on sources, per-user visibility in matching, user source service, review queue and decisions, endpoints, audit
- [x] Client: types, ports, HTTP and in-memory adapters, shared hooks, catalog text, enum `source_review`, `jobSources` and `note` limits
- [x] Web page, mobile screens, admin review card
- [x] Docker rebuild keeping local data; web, admin, and the phone bundle serve the new screens; Metro restarted with --clear
- [x] Admin sets the per-user source limit in Platform settings (default 10, range 1 to 100 from config); users see the current limit
- [x] Automatic mode applies to every unhandled listed job; application emails need an apply phrase and exclude accommodation and privacy contacts
- [x] Saved job routes follow the email rules; the submitter uses the current route; address checks use one lookup and retry once
- [ ] Docker rebuild and phone reload for the limit and automatic-apply fixes
