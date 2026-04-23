import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { ScreenLoader } from '@/components/screen-loader';
import { HomePage } from '@/home/page';

const LazyAuthModule = lazy(() => import('@/auth'));

export function AppRouter() {
  const { pathname } = useLocation();
  const isAuth = pathname.startsWith('/auth');

  if (isAuth) {
    return (
      <Routes>
        <Route
          path="/auth/*"
          element={
            <Suspense fallback={<ScreenLoader />}>
              <LazyAuthModule />
            </Suspense>
          }
        />
      </Routes>
    );
  }

  // Root → home
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
