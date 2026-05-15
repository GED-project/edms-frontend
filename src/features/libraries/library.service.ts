import { apiClient } from '@/lib/api.client';

export interface LibraryDto {
  id: string;
  name: string;
  description?: string;
  creationTime: string;
  creatorId?: string;
  isPublic: boolean;
}

export interface CreateLibraryDto {
  name: string;
  description?: string;
  isPublic?: boolean;
}

export async function getLibraries(): Promise<LibraryDto[]> {
  const { data } = await apiClient.get<LibraryDto[]>('/app/library');
  return data;
}

export async function createLibrary(input: CreateLibraryDto): Promise<LibraryDto> {
  const { data } = await apiClient.post<LibraryDto>('/app/library', input);
  return data;
}

export async function deleteLibrary(id: string): Promise<void> {
  await apiClient.delete(`/app/library/${id}`);
}

// ── Per-library access control ──────────────────────────────────────────

export interface LibraryAccessDto {
  id: string;
  libraryId: string;
  userId: string;
  userName: string;
  email?: string;
  grantedAt: string;
  grantedById?: string;
}

/** GET /api/app/library/{libraryId}/access */
export async function getLibraryAccess(libraryId: string): Promise<LibraryAccessDto[]> {
  const { data } = await apiClient.get<LibraryAccessDto[]>(`/app/library/${libraryId}/access`);
  return data;
}

/** POST /api/app/library/{libraryId}/access */
export async function grantLibraryAccess(
  libraryId: string,
  userId: string
): Promise<LibraryAccessDto> {
  const { data } = await apiClient.post<LibraryAccessDto>(
    `/app/library/${libraryId}/access`,
    { userId }
  );
  return data;
}

/** DELETE /api/app/library/{libraryId}/access/{userId} */
export async function revokeLibraryAccess(libraryId: string, userId: string): Promise<void> {
  await apiClient.delete(`/app/library/${libraryId}/access/${userId}`);
}

/** POST /api/app/library/{libraryId}/access/tag — grant access to all users with a tag */
export async function grantLibraryAccessByTag(
  libraryId: string,
  tag: string
): Promise<LibraryAccessDto[]> {
  const { data } = await apiClient.post<LibraryAccessDto[]>(
    `/app/library/${libraryId}/access/tag`,
    { tag }
  );
  return data;
}
