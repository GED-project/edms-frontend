import { apiClient } from '@/lib/api.client';

export interface FolderDto {
  id: string;
  name: string;
  parentFolderId?: string;
  libraryId: string;
  creationTime: string;
  creatorId?: string;
}

export interface CreateFolderInput {
  name: string;
  libraryId: string;
  parentFolderId?: string;
}

/** POST /api/app/folder */
export async function createFolder(input: CreateFolderInput): Promise<FolderDto> {
  const { data } = await apiClient.post<FolderDto>('/app/folder', {
    libraryId: input.libraryId,
    parentFolderId: input.parentFolderId ?? null,
    name: input.name,
  });
  return data;
}

/** GET /api/app/folder?libraryId=...&parentFolderId=... */
export async function getFolders(libraryId: string, parentFolderId?: string): Promise<FolderDto[]> {
  const { data } = await apiClient.get<FolderDto[]>('/app/folder', {
    params: {
      libraryId,
      ...(parentFolderId ? { parentFolderId } : {}),
    },
  });
  return Array.isArray(data) ? data : (data as any)?.items ?? [];
}

/** DELETE /api/app/folder/{id} */
export async function deleteFolder(id: string): Promise<void> {
  await apiClient.delete(`/app/folder/${id}`);
}

/** PUT /api/app/folder/{id}/rename?newName=... */
export async function renameFolder(id: string, newName: string): Promise<FolderDto> {
  const { data } = await apiClient.put<FolderDto>(`/app/folder/${id}/rename`, null, {
    params: { newName },
  });
  return data;
}
