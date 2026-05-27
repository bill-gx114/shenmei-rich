import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useSession } from '../hooks/useSession';

/**
 * Route-level gate. Use only for routes that require an authenticated user
 * (e.g. /new admin entry form). Anonymous visitors get bounced to /login
 * with a return-to query string so they come back after signing in.
 *
 * The rest of the app (today's exhibit, archive grid, work detail) renders
 * for anonymous users too — RLS lets them read global rows.
 */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { session, loading, configured } = useSession();
  const location = useLocation();

  if (!configured) return <>{children}</>;

  if (loading) {
    return (
      <div
        className="museum"
        style={{
          display: 'grid',
          placeItems: 'center',
          minHeight: '100vh',
          color: 'var(--ink-3)',
          fontFamily: 'var(--display)',
          fontStyle: 'italic',
          letterSpacing: '0.3em',
        }}
      >
        — 展厅正在开灯 —
      </div>
    );
  }

  if (!session) {
    const returnTo = location.pathname + location.search;
    return <Navigate to={`/login?returnTo=${encodeURIComponent(returnTo)}`} replace />;
  }

  return <>{children}</>;
}
