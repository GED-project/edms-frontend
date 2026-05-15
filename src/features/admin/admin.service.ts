/**
 * Admin / User-Management Service — wraps ABP Identity endpoints.
 *
 * Standard user CRUD: /api/identity/users  (ABP Identity module)
 * Custom role assignment: /api/app/user-custom/assign-role
 */

import { apiClient } from '@/lib/api.client';

// ─── DTOs ─────────────────────────────────────────────────────────────────────

export interface IdentityUserDto {
  id: string;
  userName: string;
  name?: string;
  surname?: string;
  email: string;
  emailConfirmed: boolean;
  phoneNumber?: string;
  isActive: boolean;
  lockoutEnabled: boolean;
  creationTime: string;
  roleNames: string[];
}

export interface ShareableUserDto {
  id: string;
  userName: string;
  name?: string;
  surname?: string;
  email?: string;
}

export interface PagedResult<T> {
  items: T[];
  totalCount: number;
}

export interface GetUsersInput {
  filter?: string;
  roleId?: string;
  organizationUnitId?: string;
  userName?: string;
  phoneNumber?: string;
  emailAddress?: string;
  isLockedOut?: boolean;
  notActive?: boolean;
  skipCount?: number;
  maxResultCount?: number;
  sorting?: string;
}

export interface CreateUserInput {
  userName: string;
  name?: string;
  surname?: string;
  email: string;
  password: string;
  roleNames?: string[];
  isActive?: boolean;
  extraProperties?: Record<string, unknown>;
}

export interface UpdateUserInput {
  userName: string;
  name?: string;
  surname?: string;
  email: string;
  password?: string;
  roleNames?: string[];
  isActive?: boolean;
  extraProperties?: Record<string, unknown>;
}

// ─── API functions ────────────────────────────────────────────────────────────

/** GET /api/identity/users — paged list */
export async function getUsers(input?: GetUsersInput): Promise<PagedResult<IdentityUserDto>> {
  const { data } = await apiClient.get<PagedResult<IdentityUserDto>>('/identity/users', {
    params: {
      skipCount: input?.skipCount ?? 0,
      maxResultCount: input?.maxResultCount ?? 50,
      sorting: input?.sorting,
      filter: input?.filter,
      roleId: input?.roleId,
      organizationUnitId: input?.organizationUnitId,
      userName: input?.userName,
      emailAddress: input?.emailAddress,
      isLockedOut: input?.isLockedOut,
      notActive: input?.notActive,
    },
  });
  return data;
}

/** GET /api/app/user-custom/shareable-users */
export async function getShareableUsers(): Promise<ShareableUserDto[]> {
  const { data } = await apiClient.get<ShareableUserDto[]>('/app/user-custom/shareable-users');
  return data;
}

/** GET /api/identity/users/{id} */
export async function getUserById(id: string): Promise<IdentityUserDto> {
  const { data } = await apiClient.get<IdentityUserDto>(`/identity/users/${id}`);
  return data;
}

/** POST /api/identity/users */
export async function createUser(input: CreateUserInput): Promise<IdentityUserDto> {
  const { data } = await apiClient.post<IdentityUserDto>('/identity/users', input);
  return data;
}

/** PUT /api/identity/users/{id} */
export async function updateUser(id: string, input: UpdateUserInput): Promise<IdentityUserDto> {
  const { data } = await apiClient.put<IdentityUserDto>(`/identity/users/${id}`, input);
  return data;
}

/** DELETE /api/identity/users/{id} */
export async function deleteUser(id: string): Promise<void> {
  await apiClient.delete(`/identity/users/${id}`);
}

/** PUT /api/identity/users/{id}/lock — lock user until a future date */
export async function lockUser(id: string, lockoutEnd: string): Promise<void> {
  await apiClient.put(`/identity/users/${id}/lock`, { lockoutEnd });
}

/** PUT /api/identity/users/{id}/unlock */
export async function unlockUser(id: string): Promise<void> {
  await apiClient.put(`/identity/users/${id}/unlock`);
}

/** GET /api/identity/users/{id}/roles */
export async function getUserRoles(id: string): Promise<string[]> {
  const { data } = await apiClient.get<{ items: { name: string }[] }>(`/identity/users/${id}/roles`);
  return data.items.map((r) => r.name);
}

/** PUT /api/identity/users/{id}/roles — replace user's roles */
export async function setUserRoles(id: string, roleNames: string[]): Promise<void> {
  await apiClient.put(`/identity/users/${id}/roles`, { roleNames });
}

// ─── Permission management ────────────────────────────────────────────────────

export interface PermissionGrantInfo {
  name: string;
  displayName: string;
  parentName: string | null;
  isGranted: boolean;
  allowedProviders: string[];
  grantedProviders: { providerName: string; providerKey: string }[];
}

export interface PermissionGroupInfo {
  name: string;
  displayName: string;
  permissions: PermissionGrantInfo[];
}

export interface PermissionListResultDto {
  entityDisplayName: string;
  groups: PermissionGroupInfo[];
}

/** GET /api/permission-management/permissions?providerName=R&providerKey={role} */
export async function getRolePermissions(roleName: string): Promise<PermissionListResultDto> {
  const { data } = await apiClient.get<PermissionListResultDto>('/permission-management/permissions', {
    params: { providerName: 'R', providerKey: roleName },
  });
  return data;
}

/** PUT /api/permission-management/permissions?providerName=R&providerKey={role} */
export async function updateRolePermissions(
  roleName: string,
  permissions: { name: string; isGranted: boolean }[],
): Promise<void> {
  await apiClient.put(
    '/permission-management/permissions',
    { permissions },
    { params: { providerName: 'R', providerKey: roleName } },
  );
}

/**
 * POST /api/app/user-custom/assign-role
 * Custom endpoint to assign a role to a user.
 */
export async function assignRole(userId: string, roleName: string): Promise<void> {
  await apiClient.post('/app/user-custom/assign-role', { userId, roleName });
}

// ─── Tag management ───────────────────────────────────────────────────────────

export interface UserTagsDto {
  userId: string;
  userName: string;
  tags: string[];
}

/** GET /api/app/user-custom/{userId}/tags */
export async function getUserTags(userId: string): Promise<UserTagsDto> {
  const { data } = await apiClient.get<UserTagsDto>(`/app/user-custom/${userId}/tags`);
  return data;
}

/** PUT /api/app/user-custom/tags — set (replace) tags for a user */
export async function setUserTags(userId: string, tags: string[]): Promise<UserTagsDto> {
  const { data } = await apiClient.put<UserTagsDto>('/app/user-custom/tags', { userId, tags });
  return data;
}

/** GET /api/app/user-custom/tags — get all distinct tags across all users */
export async function getAllTags(): Promise<string[]> {
  const { data } = await apiClient.get<string[]>('/app/user-custom/tags');
  return data;
}
