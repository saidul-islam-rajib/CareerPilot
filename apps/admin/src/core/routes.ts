export const AdminRoutes = {
  signIn: '/sign-in',
  setPassword: '/set-password',
  forgotPassword: '/forgot-password',
  dashboard: '/',
  users: '/users',
  user: (id: string) => `/users/${encodeURIComponent(id)}`,
  opportunities: '/opportunities',
  sources: '/sources',
  government: '/government',
  applications: '/applications',
  settings: '/settings',
  audit: '/audit',
  privacy: '/privacy',
  admins: '/admins',
  messages: '/messages',
} as const;

export function listLink(route: string, filter: Record<string, string>): string {
  return `${route}?${new URLSearchParams(filter).toString()}`;
}
