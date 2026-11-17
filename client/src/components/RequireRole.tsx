import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import type { Role } from '../api/types';
import { useAuth } from '../auth/useAuth';
import { hasRole } from '../auth/roles';

type RequireRoleProps = { min: Role; children: ReactNode };

// Shows children only to users with at least the given role; everyone else is
// sent home. Waits for the session check so a saved, stale role (for example
// after a demotion) is never trusted. The server checks the role again on
// every admin request.
export default function RequireRole({ min, children }: RequireRoleProps) {
  const { user, loading } = useAuth();
  if (loading) return <main className="home-content" aria-busy="true" />;
  if (!hasRole(user, min)) return <Navigate to="/" replace />;
  return children;
}
