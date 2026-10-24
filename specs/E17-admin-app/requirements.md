# E17 Admin app – requirements

Requirement IDs: §53.1–53.6, §14 (themes, credits), acceptance criteria 63, 79, 80.

- Separate app (own address, port 3001) and separate admin sign-in; user accounts never gain admin access.
- Roles: Super Admin (everything), Support, Operations, Read-only; permissions per area and action; navigation and actions follow permissions.
- Dashboard: users, applications (by submission status, outcome, mode, per day), opportunities, sources, notifications, system health, emergency-stop state.
- Management: users (search, filter, detail, suspend with confirmation, reactivate, pause automation), opportunities (flag, expire), sources (enable/disable, run check), applications (cancel queued with confirmation), audit log, admins and roles.
- Platform settings: theme for the user apps with live preview before applying; platform limits; emergency stop with reason and confirmation.
- Safeguards: secrets shown as metadata only; every sensitive view and change audited; admin sessions time out after inactivity (configurable).
