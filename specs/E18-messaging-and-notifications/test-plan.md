# E18 Messaging, in-app notifications, and submitted-job tracking — Test plan

Unit tests only (Planning/14-Testing-and-Quality.md).

- Python: recording a portal submission (status, actor, applied date, refusal for other statuses); notifications created once per Submitted/Confirmed; directory matching rules and privacy fields; discoverable and blocks; starting a direct conversation twice reuses it; send text and each attachment kind within and over limits; receipts (sent, delivered via inbox, read); muted members get no notification; team messages both ways; admin connections; audited conversation view; admin user files; API endpoints for each route.
- TypeScript: client hooks (inbox polling interval choice, receipt state helper), web conversation page and notifications dropdown, mobile chats list and conversation screens, admin Messages and Connections tabs.
