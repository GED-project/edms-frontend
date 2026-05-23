import { apiClient } from '@/lib/api.client';

// ── DTOs ──────────────────────────────────────────────────────────────────────

export interface LibraryTemplateLookupDto {
  id: string;
  name: string;
  description?: string;
  /** Raw JSON array of folder nodes — used for the tree preview. */
  folderStructureJson: string;
}

export interface LibraryTemplateDetailDto {
  id: string;
  name: string;
  description?: string;
  folderStructureJson: string;
  creationTime: string;
}

export interface CreateUpdateLibraryTemplateDto {
  name: string;
  description?: string;
  /**
   * JSON array of folder nodes:
   * [{ "name": "Folder", "roles": ["admin"], "children": [...] }]
   */
  folderStructureJson: string;
}

/** Parsed representation of a single folder node in the tree. */
export interface FolderNode {
  name: string;
  roles: string[];
  children: FolderNode[];
}

export function parseFolderStructure(json: string): FolderNode[] {
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// ── Read ──────────────────────────────────────────────────────────────────────

export async function getLibraryTemplates(): Promise<LibraryTemplateLookupDto[]> {
  const { data } = await apiClient.get<LibraryTemplateLookupDto[]>('/app/library-template/templates');
  return data;
}

export async function getAllLibraryTemplatesDetailed(): Promise<LibraryTemplateDetailDto[]> {
  const { data } = await apiClient.get<LibraryTemplateDetailDto[]>('/app/library-template/all');
  return data;
}

// ── Instantiate ───────────────────────────────────────────────────────────────

export async function buildLibraryFromTemplate(templateId: string) {
  const { data } = await apiClient.post('/app/library-template/build-library', null, {
    params: { templateId },
  });
  return data;
}

// ── Admin CRUD ────────────────────────────────────────────────────────────────

export async function createLibraryTemplate(
  dto: CreateUpdateLibraryTemplateDto,
): Promise<LibraryTemplateDetailDto> {
  const { data } = await apiClient.post<LibraryTemplateDetailDto>('/app/library-template', dto);
  return data;
}

export async function updateLibraryTemplate(
  id: string,
  dto: CreateUpdateLibraryTemplateDto,
): Promise<LibraryTemplateDetailDto> {
  const { data } = await apiClient.put<LibraryTemplateDetailDto>(`/app/library-template/${id}`, dto);
  return data;
}

export async function deleteLibraryTemplate(id: string): Promise<void> {
  await apiClient.delete(`/app/library-template/${id}`);
}
