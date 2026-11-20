export const AdminRoutes = {
  signIn: '/sign-in',
  setPassword: '/set-password',
  forgotPassword: '/forgot-password',
  dashboard: '/',
  users: '/users',
  user: (id: string) => `/users/${encodeURIComponent(id)}`,
  opportunities: '/opportunities',
  reports: '/reports',
  sources: '/sources',
  government: '/government',
  portals: '/portals',
  applications: '/applications',
  settings: '/settings',
  audit: '/audit',
  privacy: '/privacy',
  admins: '/admins',
  messages: '/messages',
  security: '/security',
} as const;

export function listLink(route: string, filter: Record<string, string>): string {
  return `${route}?${new URLSearchParams(filter).toString()}`;
}
