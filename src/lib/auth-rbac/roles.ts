/**
 * System Roles
 */
export enum Role {
  ADMIN = 'Admin',
  MANAGER = 'Manager',
  USER = 'User',
  READER = 'Reader'
}

/**
 * System Permissions
 * These should match the permission keys defined in the backend/matrix.
 */
export enum Permission {
  // Document Operations
  READ_DOCUMENT = 'documents.read',
  CREATE_DOCUMENT = 'documents.create',
  EDIT_DOCUMENT = 'documents.edit',
  DELETE_DOCUMENT = 'documents.delete',
  APPROVE_DOCUMENT = 'documents.approve',

  // Administrative Operations
  MANAGE_USERS = 'users.manage',
  MANAGE_ROLES = 'roles.manage',
  MANAGE_TENANT = 'tenant.manage',
  VIEW_AUDIT_LOGS = 'audit.view',
}

/**
 * Type helper for User with RBAC
 */
export interface AuthenticatedUser {
  id: string;
  email: string;
  fullName: string;
  role: Role;
  permissions: Permission[];
}
