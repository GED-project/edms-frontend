import { apiClient } from '@/lib/api.client';

export type StorageProviderType = 'Local' | 'S3' | 'Minio' | 'Azure';

export const ALL_PROVIDERS: StorageProviderType[] = ['Local', 'S3', 'Minio', 'Azure'];

export interface TenantStorageGrantDto {
  id: string;
  tenantId: string;
  providerType: StorageProviderType;
  isGranted: boolean;
  isActive: boolean;
  configJson: string | null;
}

export interface ProviderConfig {
  // Local
  rootPath?: string;
  // S3 / Minio
  bucketName?: string;
  region?: string;
  endpoint?: string;
  accessKey?: string;
  secretKey?: string;
  // Azure
  containerName?: string;
  connectionString?: string;
}

/** GET /api/app/host-storage/tenants/{tenantId}/grants */
export async function getTenantStorageGrants(tenantId: string): Promise<TenantStorageGrantDto[]> {
  const { data } = await apiClient.get<TenantStorageGrantDto[]>(
    `/app/host-storage/tenants/${tenantId}/grants`,
  );
  return data;
}

export interface SetTenantStorageGrantInput {
  tenantId: string;
  providerType: StorageProviderType;
  isGranted: boolean;
  configJson: string | null;
}

/** PUT /api/app/host-storage/tenants/{tenantId}/grants */
export async function setTenantStorageGrant(
  input: SetTenantStorageGrantInput,
): Promise<TenantStorageGrantDto> {
  const { data } = await apiClient.put<TenantStorageGrantDto>(
    `/app/host-storage/tenants/${input.tenantId}/grants`,
    input,
  );
  return data;
}

/** POST /api/app/host-storage/tenants/{tenantId}/active-provider */
export async function setTenantActiveProvider(
  tenantId: string,
  providerType: StorageProviderType,
): Promise<void> {
  await apiClient.post(`/app/host-storage/tenants/${tenantId}/active-provider`, null, {
    params: { providerType },
  });
}

// ─── Tenant-side (used from within a tenant session) ─────────────────────────

/** GET /api/app/tenant-storage/my-grants */
export async function getMyStorageGrants(): Promise<TenantStorageGrantDto[]> {
  const { data } = await apiClient.get<TenantStorageGrantDto[]>('/app/tenant-storage/my-grants');
  return data;
}

/** POST /api/app/tenant-storage/active-provider */
export async function setMyActiveProvider(providerType: StorageProviderType): Promise<void> {
  await apiClient.post('/app/tenant-storage/active-provider', { providerType });
}

/** GET /api/app/tenant-storage/active-provider */
export async function getMyActiveProvider(): Promise<string | null> {
  const { data } = await apiClient.get<string | null>('/app/tenant-storage/active-provider');
  return data;
}
