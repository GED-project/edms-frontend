import { Navigate } from 'react-router-dom';

// The home page is now the Dashboard at /dashboard.
// This redirect ensures any old links to "/" still work.
export function HomePage() {
  return <Navigate to="/dashboard" replace />;
}
