import type { CurrentUser, Role } from '../api/types';

// Mirrors backend/lib/roles.js. The server enforces these rules; the client
// only uses them to decide what to show.
const RANK: Record<Role, number> = { user: 0, admin: 1, siteadmin: 2 };

export const ROLE_LABELS: Record<Role, string> = {
  user: 'User',
  admin: 'Admin',
  siteadmin: 'Site admin',
};

export function hasRole(user: Pick<CurrentUser, 'role'> | null | undefined, minRole: Role) {
  return Boolean(user) && RANK[user?.role ?? 'user'] >= RANK[minRole];
}

// Roles the signed-in admin may give an account; siteadmin is never offered
export function assignableRoles(actorRole: Role | undefined): Role[] {
  if (actorRole === 'siteadmin') return ['user', 'admin'];
  if (actorRole === 'admin') return ['user'];
  return [];
}
