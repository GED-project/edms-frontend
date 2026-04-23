import React from 'react';
import { Role, Permission } from '@/lib/auth-rbac/roles';
import { useAuth } from '@/providers/auth-provider';

interface RoleGuardProps {
  allowedRoles: Role[];
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

/**
 * Renders children only if the user has one of the allowed roles.
 */
export const RoleGuard: React.FC<RoleGuardProps> = ({ allowedRoles, children, fallback = null }) => {
  const { user, hasRole } = useAuth();

  if (!user || !allowedRoles.some(role => hasRole(role))) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
};

interface PermissionGuardProps {
  requiredPermission: Permission;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

/**
 * Renders children only if the user has the required permission.
 */
export const PermissionGuard: React.FC<PermissionGuardProps> = ({ requiredPermission, children, fallback = null }) => {
  const { user, hasPermission } = useAuth();

  if (!user || !hasPermission(requiredPermission)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
};
