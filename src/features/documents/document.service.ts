/**
 * Document Service — wired to ABP ConventionalController endpoints.
 *
 * All routes are under /api/app/document (ABP default prefix for DocumentAppService).
 * The Vite proxy forwards /api → https://localhost:44324 in development.
 */

import { apiClient } from '@/lib/api.client';

// ─── Enums (mirror backend EdmsEnums.cs) ─────────────────────────────────────

export enum DocumentState {
  Draft = 0,
  PendingReview = 1,
  Approved = 2,
  Rejected = 3,
  Archived = 4,
  CheckedOut = 5,
}

export enum SecurityClearance {
  Public = 0,
  Internal = 1,
  Confidential = 2,
  TopSecret = 3,
}

export enum TagFilterMode {
  Or = 0,
  And = 1,
}

// ─── DTOs (mirror backend Dtos/) ─────────────────────────────────────────────

export interface DocumentDto {
  id: string;
  title: string;
  description?: string;
  categoryId?: string;
  state: DocumentState;
  clearanceLevel: SecurityClearance;
  organizationUnitId?: string;
  creationTime: string;
  creatorId?: string;
}

export interface DocumentPreviewDto {
  id: string;
  title: string;
  state: DocumentState;
}

export interface DocumentVersionDto {
  id: string;
  documentId: string;
  versionNumber: number;
  versionLabel: string;
  fileSize: number;
  extension: string;
  blobStorageKey: string;
  creationTime: string;
  creatorId?: string;
}

export interface TrashItemDto extends DocumentDto {
  deletionTime?: string;
  deleterId?: string;
}

export interface TagDto {
  id: string;
  name: string;
}

export interface PagedResult<T> {
  items: T[];
  totalCount: number;
}

// ─── Input types ──────────────────────────────────────────────────────────────

export interface GetDocumentListInput {
  skipCount?: number;
  maxResultCount?: number;
  sorting?: string;
  tags?: string[];
  filterMode?: TagFilterMode;
  title?: string;
}

export interface CreateDocumentInput {
  title: string;
  description?: string;
  categoryId?: string;
  folderId?: string;
  clearanceLevel?: SecurityClearance;
  organizationUnitId?: string;
  metadata?: Record<string, string>;
}

// ─── API functions ────────────────────────────────────────────────────────────

/** GET /api/app/document — paged list with optional filters */
export async function getDocuments(input?: GetDocumentListInput): Promise<PagedResult<DocumentDto>> {
  const { data } = await apiClient.get<PagedResult<DocumentDto>>('/app/document', {
    params: {
      skipCount: input?.skipCount ?? 0,
      maxResultCount: input?.maxResultCount ?? 50,
      sorting: input?.sorting,
      title: input?.title,
      filterMode: input?.filterMode,
      // tags are repeated query params: tags=a&tags=b
      ...(input?.tags && input.tags.length > 0 ? { tags: input.tags } : {}),
    },
    paramsSerializer: (params) => {
      const parts: string[] = [];
      for (const [key, val] of Object.entries(params)) {
        if (val === undefined || val === null) continue;
        if (Array.isArray(val)) {
          val.forEach((v) => parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(v))}`));
        } else {
          parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(val))}`);
        }
      }
      return parts.join('&');
    },
  });
  return data;
}

/** GET /api/app/document/{id}/get-preview */
export async function getDocumentPreview(id: string): Promise<DocumentPreviewDto> {
  const { data } = await apiClient.get<DocumentPreviewDto>(`/app/document/${id}/get-preview`);
  return data;
}

/**
 * POST /api/app/document/create-document  (multipart/form-data)
 * Sends file + JSON metadata as a multipart form.
 */
export async function createDocument(
  input: CreateDocumentInput,
  file: File,
  onProgress?: (pct: number) => void,
): Promise<DocumentDto> {
  const form = new FormData();
  form.append('file', file);
  form.append('input.title', input.title);
  if (input.description) form.append('input.description', input.description);
  if (input.folderId) form.append('input.folderId', input.folderId);
  if (input.categoryId) form.append('input.categoryId', input.categoryId);
  if (input.organizationUnitId) form.append('input.organizationUnitId', input.organizationUnitId);
  form.append('input.clearanceLevel', String(input.clearanceLevel ?? SecurityClearance.Public));
  if (input.metadata) {
    for (const [k, v] of Object.entries(input.metadata)) {
      form.append(`input.metadata[${k}]`, v);
    }
  }

  const { data } = await apiClient.post<DocumentDto>('/app/document/create-document', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: (e) => {
      if (onProgress && e.total) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    },
  });
  return data;
}

/**
 * GET /api/app/document/{id}/get-file?versionNumber=N
 * Streams file bytes — returns a blob URL for download/preview.
 */
export async function getFileBlob(id: string, versionNumber?: number): Promise<string> {
  const { data } = await apiClient.get<Blob>(`/app/document/${id}/get-file`, {
    responseType: 'blob',
    params: versionNumber != null ? { versionNumber } : undefined,
  });
  return URL.createObjectURL(data);
}

/**
 * GET /api/app/document/{id}/download-document?versionNumber=N
 * Triggers a browser download.
 */
export async function downloadDocument(id: string, filename: string, versionNumber?: number): Promise<void> {
  const url = await getFileBlob(id, versionNumber);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

/** POST /api/app/document/{id}/submit-for-review */
export async function submitForReview(id: string): Promise<void> {
  await apiClient.post(`/app/document/${id}/submit-for-review`);
}

/** POST /api/app/document/{id}/approve-document */
export async function approveDocument(id: string): Promise<void> {
  await apiClient.post(`/app/document/${id}/approve-document`);
}

/** GET /api/app/document/documents-for-review?organizationUnitId=... */
export async function getDocumentsForReview(organizationUnitId?: string): Promise<DocumentPreviewDto[]> {
  const { data } = await apiClient.get<DocumentPreviewDto[]>('/app/document/documents-for-review', {
    params: organizationUnitId ? { organizationUnitId } : undefined,
  });
  return data;
}

/** POST /api/app/document/{id}/archive */
export async function archiveDocument(id: string): Promise<void> {
  await apiClient.post(`/app/document/${id}/archive`);
}

/** POST /api/app/document/{id}/check-out */
export async function checkOut(id: string): Promise<void> {
  await apiClient.post(`/app/document/${id}/check-out`);
}

/** POST /api/app/document/{id}/check-in */
export async function checkIn(id: string): Promise<void> {
  await apiClient.post(`/app/document/${id}/check-in`);
}

/** PUT /api/app/document/{id}/rename */
export async function renameDocument(id: string, newName: string): Promise<DocumentDto> {
  const { data } = await apiClient.put<DocumentDto>(`/app/document/${id}/rename`, null, {
    params: { newName },
  });
  return data;
}

/** PUT /api/app/document/{id}/move */
export async function moveDocument(id: string, targetFolderId: string | null): Promise<DocumentDto> {
  const { data } = await apiClient.put<DocumentDto>(`/app/document/${id}/move`, null, {
    params: targetFolderId ? { targetFolderId } : undefined,
  });
  return data;
}

/** POST /api/app/document/{id}/move-to-trash */
export async function moveToTrash(id: string): Promise<void> {
  await apiClient.post(`/app/document/${id}/move-to-trash`);
}

/** GET /api/app/document/trash-items */
export async function getTrashItems(): Promise<TrashItemDto[]> {
  const { data } = await apiClient.get<TrashItemDto[]>('/app/document/trash-items');
  return data;
}

/** POST /api/app/document/{id}/restore */
export async function restoreFromTrash(id: string): Promise<void> {
  await apiClient.post(`/app/document/${id}/restore`);
}

/** DELETE /api/app/document/{id}/hard-delete */
export async function hardDelete(id: string): Promise<void> {
  await apiClient.delete(`/app/document/${id}/hard-delete`);
}

/** DELETE /api/app/document/{id}/delete-document */
export async function deleteDocument(id: string): Promise<void> {
  await apiClient.delete(`/app/document/${id}/delete-document`);
}

/** GET /api/app/document/{id}/version-history */
export async function getVersionHistory(documentId: string): Promise<DocumentVersionDto[]> {
  const { data } = await apiClient.get<DocumentVersionDto[]>(`/app/document/${documentId}/version-history`);
  return data;
}

/**
 * POST /api/app/document/{id}/add-new-version (multipart/form-data)
 * Upload a new version of an existing document.
 */
export async function addNewVersion(
  documentId: string,
  file: File,
  onProgress?: (pct: number) => void,
): Promise<DocumentVersionDto> {
  const form = new FormData();
  form.append('file', file);

  const { data } = await apiClient.post<DocumentVersionDto>(
    `/app/document/${documentId}/add-new-version`,
    form,
    {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (e) => {
        if (onProgress && e.total) {
          onProgress(Math.round((e.loaded / e.total) * 100));
        }
      },
    },
  );
  return data;
}

// ─── Tagging ──────────────────────────────────────────────────────────────────

/** POST /api/app/document/{id}/add-tag?tagName=... */
export async function addTag(documentId: string, tagName: string): Promise<TagDto> {
  const { data } = await apiClient.post<TagDto>(`/app/document/${documentId}/add-tag`, null, {
    params: { tagName },
  });
  return data;
}

/** DELETE /api/app/document/{id}/remove-tag?tagName=... */
export async function removeTag(documentId: string, tagName: string): Promise<void> {
  await apiClient.delete(`/app/document/${documentId}/remove-tag`, {
    params: { tagName },
  });
}

/** GET /api/app/document/suggestions?input=... — tag autocomplete */
export async function getTagSuggestions(input: string): Promise<string[]> {
  const { data } = await apiClient.get<string[]>('/app/document/suggestions', {
    params: { input },
  });
  return data;
}

// ─── Metadata ─────────────────────────────────────────────────────────────────

/** PUT /api/app/document/{id}/update-metadata */
export async function updateMetadata(documentId: string, metadata: Record<string, string>): Promise<void> {
  await apiClient.put(`/app/document/${documentId}/update-metadata`, metadata);
}
