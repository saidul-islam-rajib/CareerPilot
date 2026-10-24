# E17 Admin app – design

- Next.js 16 app in `apps/admin`, components from `@careerpilot/ui-web` (DataTable, Pagination, BarChart, Breakdown, MetricTile, ConfirmDialog), always the Sober theme (`ui.admin_theme`).
- Admin API contract in `packages/api-client/src/admin` (ports, types, role permissions, HTTP adapter under `/admin/v1`, in-memory demo adapter that writes audit entries for every change).
- Admin session in `apps/admin/src/core/admin-session.tsx` with inactivity timeout from `config/defaults/admin.yaml`; `useCan(area, action)` gates actions.
- Generic `ListPage` gives every list search, status filter, and server-side paging.
