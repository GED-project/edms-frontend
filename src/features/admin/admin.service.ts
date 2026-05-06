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
}

export interface UpdateUserInput {
  userName: string;
  name?: string;
  surname?: string;
  email: string;
  password?: string;
  roleNames?: string[];
  isActive?: boolean;
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

/**
 * POST /api/app/user-custom/assign-role
 * Custom endpoint to assign a role to a user.
 */
export async function assignRole(userId: string, roleName: string): Promise<void> {
  await apiClient.post('/app/user-custom/assign-role', { userId, roleName });
}
