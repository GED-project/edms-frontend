/**
 * System Roles
 */
export enum Role {
  ADMIN = 'Admin',
  MANAGER = 'Manager',
  USER = 'Standard User'
}

/**
 * System Permissions
 * These should match the permission keys defined in the backend/matrix.
 */
export enum Permission {
  // Standard User
  LOGIN = 'auth.login',
  LOGOUT = 'auth.logout',
  CREATE_FOLDER = 'folder.create',
  MANAGE_PROFILE = 'profile.manage',
  RESET_PASSWORD = 'password.reset',
  UPLOAD_DOCUMENT = 'document.upload',
  ADD_DESCRIPTION = 'document.add_description',
  PERFORM_OCR = 'document.perform_ocr',
  MANAGE_DOCUMENTS = 'document.manage',
  SHARE_DOCUMENT = 'document.share',
  REQUEST_SHARING_DOCUMENT = 'document.request_sharing',
  SEARCH_DOCUMENT = 'document.search',
  FULL_TEXT_SEARCH = 'document.full_text_search',
  META_DATA_SEARCH = 'document.meta_data_search',
  RETRIEVE_DOCUMENT = 'document.retrieve',
  
  // Manager
  REVIEW_DOCUMENT = 'document.review',
  MANAGE_USERS = 'users.manage',
  MANAGE_PERMISSIONS = 'permissions.manage',
  MANAGE_LIBRARIES = 'libraries.manage',
  APPROVE_DOCUMENT = 'document.approve',
  APPROVE_SHARING_REQUEST = 'document.approve_sharing',

  // Admin
  CONSULTE_AUDIT_LOGS = 'audit.consulte',
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
