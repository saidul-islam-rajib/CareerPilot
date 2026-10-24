export const AdminRoutes = {
  signIn: '/sign-in',
  dashboard: '/',
  users: '/users',
  user: (id: string) => `/users/${encodeURIComponent(id)}`,
  opportunities: '/opportunities',
  sources: '/sources',
  applications: '/applications',
  settings: '/settings',
  audit: '/audit',
  admins: '/admins',
} as const;
