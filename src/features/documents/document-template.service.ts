import { apiClient } from '@/lib/api.client';

// ── DTOs ──────────────────────────────────────────────────────────────────────

export interface DocumentTemplateLookupDto {
  id: string;
  name: string;
  description?: string;
}

export interface DocumentTemplateDetailDto {
  id: string;
  name: string;
  description?: string;
  defaultMetadataJson: string;
  fileBlobName: string;
  creationTime: string;
}

export interface TemplateMetadataDto {
  templateId: string;
  metadata: Record<string, unknown>;
}

export interface InstantiateDocumentInput {
  templateId: string;
  title?: string;
  description?: string;
  folderId?: string;
  libraryId?: string;
  clearanceLevel?: number;
  organizationUnitId?: string;
  formData?: Record<string, unknown>;
}

export interface CreateUpdateDocumentTemplateDto {
  name: string;
  description?: string;
  /** JSON object: key = field name, value = default value (type drives the widget) */
  defaultMetadataJson: string;
  fileBlobName?: string;
}

// ── Read ──────────────────────────────────────────────────────────────────────

export async function getDocumentTemplates(): Promise<DocumentTemplateLookupDto[]> {
  const { data } = await apiClient.get<DocumentTemplateLookupDto[]>('/app/document-template/templates');
  return data;
}

export async function getAllDocumentTemplatesDetailed(): Promise<DocumentTemplateDetailDto[]> {
  const { data } = await apiClient.get<DocumentTemplateDetailDto[]>('/app/document-template/all');
  return data;
}

export async function getTemplateMetadata(templateId: string): Promise<TemplateMetadataDto> {
  const { data } = await apiClient.get<TemplateMetadataDto>('/app/document-template/template-metadata', {
    params: { templateId },
  });
  return data;
}

// ── Instantiate ───────────────────────────────────────────────────────────────

export async function instantiateDocument(input: InstantiateDocumentInput) {
  const { data } = await apiClient.post('/app/document-template/instantiate-document', input);
  return data;
}

// ── Admin CRUD ────────────────────────────────────────────────────────────────

export async function createDocumentTemplate(
  dto: CreateUpdateDocumentTemplateDto,
): Promise<DocumentTemplateDetailDto> {
  const { data } = await apiClient.post<DocumentTemplateDetailDto>('/app/document-template', dto);
  return data;
}

export async function updateDocumentTemplate(
  id: string,
  dto: CreateUpdateDocumentTemplateDto,
): Promise<DocumentTemplateDetailDto> {
  const { data } = await apiClient.put<DocumentTemplateDetailDto>(`/app/document-template/${id}`, dto);
  return data;
}

export async function deleteDocumentTemplate(id: string): Promise<void> {
  await apiClient.delete(`/app/document-template/${id}`);
}
