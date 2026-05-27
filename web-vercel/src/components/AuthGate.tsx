import type { ReactNode } from 'react';
import { useSession } from '../hooks/useSession';
import { LoginPage } from '../pages/LoginPage';

/**
 * Wraps the app. When Supabase env vars are missing, falls through to the
 * children (lets the mock-data shell still render in dev). When configured,
 * blocks anonymous users with the login page.
 */
export function AuthGate({ children }: { children: ReactNode }) {
  const { session, loading, configured } = useSession();

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

  if (!session) return <LoginPage />;

  return <>{children}</>;
}
