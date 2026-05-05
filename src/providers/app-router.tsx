import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { ScreenLoader } from '@/components/screen-loader';
import { AppLayout } from '@/components/layout/AppLayout';
import { DashboardPage } from '@/features/dashboard/page';
import { DocumentsPage } from '@/features/documents/page';
import { DocumentViewPage } from '@/features/documents/DocumentViewPage';
import { DocumentUploadPage } from '@/features/documents/DocumentUploadPage';
import { ScanDocumentPage } from '@/features/documents/ScanDocumentPage';
import { AdminPage } from '@/features/admin/page';
import { SettingsPage } from '@/features/settings/page';
import { ActivityPage } from '@/features/activity/page';

const LazyAuthModule = lazy(() => import('@/auth'));

export function AppRouter() {
  return (
    <Routes>
      {/* Auth routes (unauthenticated) */}
      <Route
        path="/auth/*"
        element={
          <Suspense fallback={<ScreenLoader />}>
            <LazyAuthModule />
          </Suspense>
        }
      />

      {/* Protected app routes — AppLayout handles the auth guard */}
      <Route element={<AppLayout />}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/documents">
          <Route index element={<DocumentsPage />} />
          <Route path="upload" element={<DocumentUploadPage />} />
          <Route path="scan" element={<ScanDocumentPage />} />
          <Route path=":id" element={<DocumentViewPage />} />
        </Route>
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/activity" element={<ActivityPage />} />
      </Route>

      {/* Catch-all */}
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
