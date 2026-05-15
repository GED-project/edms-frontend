import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { ScreenLoader } from '@/components/screen-loader';
import { AppLayout } from '@/components/layout/AppLayout';
import { TenantRouteGuard } from '@/components/auth/TenantRouteGuard';
import { PermissionGuard } from '@/components/auth/RoleGuard';
import { DashboardPage } from '@/features/dashboard/page';
import { DocumentsPageConnected } from '@/features/documents/page-connected';
import { DocumentViewPage } from '@/features/documents/DocumentViewPage';
import { DocumentUploadPage } from '@/features/documents/DocumentUploadPage';
import { ScanDocumentPage } from '@/features/documents/ScanDocumentPage';
import { SharedDocumentsPage } from '@/features/documents/shared-page';
import { ApprovalsPage } from '@/features/documents/approvals-page';
import { AdminPage } from '@/features/admin/page';
import { AuditLogPage } from '@/features/admin/AuditLogPage';
import { SettingsPage } from '@/features/settings/page';
import LibrariesPage from '@/features/libraries/page';
import { HostLayout } from '@/features/host/HostLayout';
import { HostDashboardPage } from '@/features/host/HostDashboardPage';
import { TenantsPage } from '@/features/host/TenantsPage';
import { HostStoragePage } from '@/features/host/HostStoragePage';
import { Permission } from '@/lib/auth-rbac/roles';
import { LandingRedirect } from './landing-redirect';

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

      {/* Host-only routes — HostLayout handles host guard. */}
      <Route element={<HostLayout />}>
        <Route path="/host" element={<Navigate to="/host/dashboard" replace />} />
        <Route path="/host/dashboard" element={<HostDashboardPage />} />
        <Route path="/host/tenants" element={<TenantsPage />} />
        <Route path="/host/storage" element={<HostStoragePage />} />
      </Route>

      {/* Tenant-only routes — TenantRouteGuard blocks the host from accessing them. */}
      <Route
        element={
          <TenantRouteGuard>
            <AppLayout />
          </TenantRouteGuard>
        }
      >
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/documents">
          <Route index element={<DocumentsPageConnected />} />
          <Route path="shared" element={<SharedDocumentsPage />} />
          <Route
            path="approvals"
            element={
              <PermissionGuard
                requiredPermission={Permission.APPROVE_DOCUMENT}
                fallback={<Navigate to="/dashboard" replace />}
              >
                <ApprovalsPage />
              </PermissionGuard>
            }
          />
          <Route path="upload" element={<DocumentUploadPage />} />
          <Route path="scan" element={<ScanDocumentPage />} />
          <Route path=":id" element={<DocumentViewPage />} />
        </Route>
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/audit" element={<AuditLogPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/libraries" element={<LibrariesPage />} />
      </Route>

      {/* Index & catch-all — route based on the current user's scope. */}
      <Route index element={<LandingRedirect />} />
      <Route path="*" element={<LandingRedirect />} />
    </Routes>
  );
}
