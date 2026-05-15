import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/providers/auth-provider';
import { ScreenLoader } from '@/components/screen-loader';

/**
 * Wraps tenant-only routes.  Hosts (TenantId == null) are redirected
 * to the host console.  Unauthenticated users are sent to login.
 */
export function TenantRouteGuard({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) return <ScreenLoader />;
  if (!user) return <Navigate to="/auth/login" state={{ from: location }} replace />;
  if (user.isHost) return <Navigate to="/host/dashboard" replace />;

  return <>{children}</>;
}
