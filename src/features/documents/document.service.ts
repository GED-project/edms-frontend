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
  Review = 1,
  Approved = 2,
  Archived = 3,
  Trash = 4,
}

export enum SecurityClearance {
  Public = 0,
  Internal = 1,
  Confidential = 2,
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

export interface DocumentOcrTextDto {
  documentId: string;
  ocrText?: string;
  ocrBlobKey?: string;
  processedAtUtc?: string;
}

export interface OcrPreviewDto {
  ocrText: string;
  hasText: boolean;
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
  folderId?: string | null;
  libraryId?: string | null;
  sharedOnly?: boolean;
  reviewOnly?: boolean;
}

export interface CreateDocumentInput {
  title: string;
  description?: string;
  categoryId?: string;
  folderId?: string;
  libraryId?: string;
  requestApproval?: boolean;
  approverUserId?: string;
  clearanceLevel?: SecurityClearance;
  organizationUnitId?: string;
  ocrText?: string;
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
      ...(input?.folderId != null ? { folderId: input.folderId } : {}),
      ...(input?.libraryId != null ? { libraryId: input.libraryId } : {}),
      ...(input?.sharedOnly ? { sharedOnly: true } : {}),
      ...(input?.reviewOnly ? { reviewOnly: true } : {}),
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

/** GET /api/app/document/{id}/preview */
export async function getDocumentPreview(id: string): Promise<DocumentPreviewDto> {
  const { data } = await apiClient.get<DocumentPreviewDto>(`/app/document/${id}/preview`);
  return data;
}

/**
 * GET /api/app/document/thumbnail/{id}
 * Returns a blob URL for image documents; resolves to null for non-image files (PDF/Word/etc.)
 * so callers can fall back to PDF.js or a file-type icon.
 */
export async function getThumbnailBlobUrl(id: string): Promise<string | null> {
  try {
    const { data } = await apiClient.get<Blob>(`/app/document/thumbnail/${id}`, {
      responseType: 'blob',
    });
    return URL.createObjectURL(data);
  } catch {
    return null;
  }
}


export async function createDocument(
  input: CreateDocumentInput,
  file: File,
  onProgress?: (pct: number) => void,
): Promise<DocumentDto> {
  const form = new FormData();
  form.append('file', file);
  form.append('Title', input.title);
  if (input.description) form.append('Description', input.description);
  if (input.folderId) form.append('FolderId', input.folderId);
  if (input.libraryId) form.append('LibraryId', input.libraryId);
  if (input.categoryId) form.append('CategoryId', input.categoryId);
  if (input.organizationUnitId) form.append('OrganizationUnitId', input.organizationUnitId);
  form.append('RequestApproval', String(Boolean(input.requestApproval)));
  if (input.approverUserId) form.append('ApproverUserId', input.approverUserId);
  form.append('ClearanceLevel', String(input.clearanceLevel ?? SecurityClearance.Public));
  if (input.ocrText && input.ocrText.trim().length > 0) {
    form.append('OcrText', input.ocrText.trim());
  }
  if (input.metadata) {
    for (const [k, v] of Object.entries(input.metadata)) {
      form.append(`Metadata[${k}]`, v);
    }
  }

  const { data } = await apiClient.post<DocumentDto>('/app/document/create', form, {
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
 * Downscales an image File to a max edge of `maxEdge` px (JPEG, quality 0.85)
 * to keep OCR fast. Non-image files are returned unchanged.
 */
async function downscaleImageForOcr(file: File, maxEdge = 1600): Promise<File> {
  if (!file.type.startsWith('image/')) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const { width, height } = bitmap;
    const longest = Math.max(width, height);
    if (longest <= maxEdge) {
      bitmap.close?.();
      return file;
    }
    const scale = maxEdge / longest;
    const w = Math.round(width * scale);
    const h = Math.round(height * scale);
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      bitmap.close?.();
      return file;
    }
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close?.();
    const blob: Blob = await new Promise((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error('toBlob failed'))),
        'image/jpeg',
        0.85,
      );
    });
    const newName = file.name.replace(/\.[^.]+$/, '') + '.jpg';
    return new File([blob], newName, { type: 'image/jpeg' });
  } catch {
    return file;
  }
}

/** POST /api/app/document/extract-ocr-preview (multipart/form-data) */
export async function extractOcrPreview(file: File, signal?: AbortSignal): Promise<OcrPreviewDto> {
  const optimized = await downscaleImageForOcr(file);
  const form = new FormData();
  form.append('file', optimized);
  const { data } = await apiClient.post<OcrPreviewDto>('/app/document/extract-ocr-preview', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
    signal,
    timeout: 120000,
  });
  return data;
}

/**
 * When axios uses responseType: 'blob', error bodies also arrive as Blobs.
 * This unwraps the JSON inside an error blob so callers see the real message.
 */
async function rethrowBlobError(err: any): Promise<never> {
  const blob = err?.response?.data;
  if (blob instanceof Blob) {
    try {
      const text = await blob.text();
      const parsed = JSON.parse(text);
      if (err.response) err.response.data = parsed;
    } catch {
      /* keep original error */
    }
  }
  throw err;
}

/**
 * GET /api/app/document/file/{documentId}?versionNumber=N
 * Streams file bytes — returns a blob URL for download/preview.
 */
export async function getFileBlob(id: string, versionNumber?: number): Promise<string> {
  try {
    const { data } = await apiClient.get<Blob>(`/app/document/file/${id}`, {
      responseType: 'blob',
      params: versionNumber != null ? { versionNumber } : undefined,
    });
    return URL.createObjectURL(data);
  } catch (err) {
    return rethrowBlobError(err);
  }
}

/**
 * POST /api/app/document/download-document/{documentId}?versionNumber=N
 * Triggers a browser download with the server-supplied filename.
 */
export async function downloadDocument(id: string, filename: string, versionNumber?: number): Promise<void> {
  let blob: Blob;
  let serverFilename: string | undefined;
  try {
    const response = await apiClient.post<Blob>(
      `/app/document/download-document/${id}`,
      null,
      {
        responseType: 'blob',
        params: versionNumber != null ? { versionNumber } : undefined,
      },
    );
    blob = response.data;
    const cd = response.headers?.['content-disposition'] as string | undefined;
    const match = cd?.match(/filename\*?=(?:UTF-8'')?"?([^";]+)"?/i);
    if (match) serverFilename = decodeURIComponent(match[1]);
  } catch (err) {
    return rethrowBlobError(err);
  }
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = serverFilename || filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

/** GET /api/app/document/ocr-text/{documentId} */
export async function getOcrText(documentId: string): Promise<DocumentOcrTextDto> {
  try {
    const { data } = await apiClient.get<DocumentOcrTextDto>(`/app/document/ocr-text/${documentId}`);
    return data;
  } catch {
    try {
      // Fallback route if a manual controller exposes REST-style path.
      const { data } = await apiClient.get<DocumentOcrTextDto>(`/app/document/${documentId}/ocr-text`);
      return data;
    } catch {
      // Legacy fallback for conventional query-string route shape.
      const { data } = await apiClient.get<DocumentOcrTextDto>('/app/document/ocr-text', {
        params: { documentId },
      });
      return data;
    }
  }
}

/** GET /api/app/document/{documentId}/ocr-file */
export async function downloadOcrFile(documentId: string, fallbackFilename?: string): Promise<void> {
  let blob: Blob;
  let serverFilename: string | undefined;

  try {
    const response = await apiClient.get<Blob>(`/app/document/${documentId}/ocr-file`, {
      responseType: 'blob',
    });

    blob = response.data;
    const cd = response.headers?.['content-disposition'] as string | undefined;
    const match = cd?.match(/filename\*?=(?:UTF-8'')?"?([^";]+)"?/i);
    if (match) serverFilename = decodeURIComponent(match[1]);
  } catch (err) {
    return rethrowBlobError(err);
  }

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = serverFilename || fallbackFilename || `${documentId}_ocr.txt`;
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

/** GET /api/app/document/documents-for-review/{organizationUnitId} */
export async function getDocumentsForReview(organizationUnitId?: string): Promise<DocumentPreviewDto[]> {
  const path = organizationUnitId
    ? `/app/document/documents-for-review/${organizationUnitId}`
    : '/app/document/documents-for-review';
  const { data } = await apiClient.get<DocumentPreviewDto[]>(path);
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

/** POST /api/app/document/{id}/rename */
export async function renameDocument(id: string, newName: string): Promise<DocumentDto> {
  const { data } = await apiClient.post<DocumentDto>(`/app/document/${id}/rename`, null, {
    params: { newName },
  });
  return data;
}

/** POST /api/app/document/{id}/move/{targetFolderId} */
export async function moveDocument(id: string, targetFolderId: string | null): Promise<DocumentDto> {
  const path = targetFolderId
    ? `/app/document/${id}/move/${targetFolderId}`
    : `/app/document/${id}/move`;
  const { data } = await apiClient.post<DocumentDto>(path);
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

/** POST /api/app/document/{id}/hard-delete */
export async function hardDelete(id: string): Promise<void> {
  await apiClient.post(`/app/document/${id}/hard-delete`);
}

/** DELETE /api/app/document/document/{documentId} */
export async function deleteDocument(id: string): Promise<void> {
  await apiClient.delete(`/app/document/document/${id}`);
}

/** GET /api/app/document/version-history/{documentId} */
export async function getVersionHistory(documentId: string): Promise<DocumentVersionDto[]> {
  const { data } = await apiClient.get<DocumentVersionDto[]>(`/app/document/version-history/${documentId}`);
  return data;
}

/**
 * POST /api/app/document/new-version/{documentId} (multipart/form-data)
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
    `/app/document/new-version/${documentId}`,
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

/** POST /api/app/document/tag/{documentId}?tagName=... */
export async function addTag(documentId: string, tagName: string): Promise<TagDto> {
  const { data } = await apiClient.post<TagDto>(`/app/document/tag/${documentId}`, null, {
    params: { tagName },
  });
  return data;
}

/** DELETE /api/app/document/tag/{documentId}?tagName=... */
export async function removeTag(documentId: string, tagName: string): Promise<void> {
  await apiClient.delete(`/app/document/tag/${documentId}`, {
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

/** PUT /api/app/document/metadata/{documentId} */
export async function updateMetadata(documentId: string, metadata: Record<string, string>): Promise<void> {
  await apiClient.put(`/app/document/metadata/${documentId}`, metadata);
}
