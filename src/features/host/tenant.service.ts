/**
 * Tenant management service — wraps ABP's `Volo.Abp.TenantManagement` API.
 *
 * All endpoints below are exposed by the host (no `__tenant` header) and
 * require the host admin to be authenticated.
 */

import { apiClient } from '@/lib/api.client';

export interface TenantDto {
  id: string;
  name: string;
  concurrencyStamp?: string;
}

export interface PagedTenants {
  totalCount: number;
  items: TenantDto[];
}

export interface CreateTenantInput {
  name: string;
  adminEmailAddress: string;
  adminPassword: string;
}

export interface UpdateTenantInput {
  name: string;
  concurrencyStamp?: string;
}

export interface ListTenantsInput {
  filter?: string;
  sorting?: string;
  skipCount?: number;
  maxResultCount?: number;
}

/** GET /api/multi-tenancy/tenants */
export async function listTenants(input: ListTenantsInput = {}): Promise<PagedTenants> {
  const { data } = await apiClient.get<PagedTenants>('/multi-tenancy/tenants', {
    params: {
      Filter: input.filter,
      Sorting: input.sorting,
      SkipCount: input.skipCount ?? 0,
      MaxResultCount: input.maxResultCount ?? 50,
    },
  });
  return data;
}

/** GET /api/multi-tenancy/tenants/{id} */
export async function getTenant(id: string): Promise<TenantDto> {
  const { data } = await apiClient.get<TenantDto>(`/multi-tenancy/tenants/${id}`);
  return data;
}

/** POST /api/multi-tenancy/tenants */
export async function createTenant(input: CreateTenantInput): Promise<TenantDto> {
  const { data } = await apiClient.post<TenantDto>('/multi-tenancy/tenants', input);
  return data;
}

/** PUT /api/multi-tenancy/tenants/{id} */
export async function updateTenant(id: string, input: UpdateTenantInput): Promise<TenantDto> {
  const { data } = await apiClient.put<TenantDto>(`/multi-tenancy/tenants/${id}`, input);
  return data;
}

/** DELETE /api/multi-tenancy/tenants/{id} */
export async function deleteTenant(id: string): Promise<void> {
  await apiClient.delete(`/multi-tenancy/tenants/${id}`);
}

// ─── Per-tenant stats (custom backend endpoint) ────────────────────────────

export interface TenantStatsDto {
  tenantId: string;
  tenantName: string;
  userCount: number;
  documentCount: number;
  libraryCount: number;
  storageBytes: number;
}

/** GET /api/app/host-stats/tenant-stats — custom endpoint exposed by the host. */
export async function getAllTenantStats(): Promise<TenantStatsDto[]> {
  const { data } = await apiClient.get<TenantStatsDto[]>('/app/host-stats/tenant-stats');
  return data;
}
