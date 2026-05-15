import { Navigate } from 'react-router-dom';
import { useAuth } from '@/providers/auth-provider';
import { ScreenLoader } from '@/components/screen-loader';

/**
 * Decides where an authenticated user lands based on their scope.
 * - Hosts (TenantId == null)  → /host/dashboard
 * - Tenants                  → /dashboard
 * - Unauthenticated          → /auth/login
 */
export function LandingRedirect() {
  const { user, isLoading } = useAuth();
  if (isLoading) return <ScreenLoader />;
  if (!user) return <Navigate to="/auth/login" replace />;
  return <Navigate to={user.isHost ? '/host/dashboard' : '/dashboard'} replace />;
}
