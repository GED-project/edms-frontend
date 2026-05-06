/**
 * Metadata Definition Service — CRUD for dynamic document metadata fields.
 *
 * Uses ABP CrudAppService conventional routes at /api/app/metadata-definition.
 */

import { apiClient } from '@/lib/api.client';

// ─── Enums ────────────────────────────────────────────────────────────────────

export enum MetadataFieldType {
  Text = 0,
  Number = 1,
  Date = 2,
  Boolean = 3,
  DropdownList = 4,
}

// ─── DTOs ─────────────────────────────────────────────────────────────────────

export interface MetadataDefinitionDto {
  id: string;
  name: string;
  displayName: string;
  fieldType: MetadataFieldType;
  isRequired: boolean;
  dropdownOptions?: string;
  creationTime: string;
  lastModificationTime?: string;
}

export interface CreateUpdateMetadataDefinitionInput {
  name: string;
  displayName: string;
  fieldType: MetadataFieldType;
  isRequired: boolean;
  dropdownOptions?: string;
}

export interface PagedResult<T> {
  items: T[];
  totalCount: number;
}

// ─── API functions ────────────────────────────────────────────────────────────

/** GET /api/app/metadata-definition — list all metadata definitions */
export async function getMetadataDefinitions(skipCount = 0, maxResultCount = 100): Promise<PagedResult<MetadataDefinitionDto>> {
  const { data } = await apiClient.get<PagedResult<MetadataDefinitionDto>>('/app/metadata-definition', {
    params: { skipCount, maxResultCount },
  });
  return data;
}

/** GET /api/app/metadata-definition/{id} */
export async function getMetadataDefinition(id: string): Promise<MetadataDefinitionDto> {
  const { data } = await apiClient.get<MetadataDefinitionDto>(`/app/metadata-definition/${id}`);
  return data;
}

/** POST /api/app/metadata-definition */
export async function createMetadataDefinition(input: CreateUpdateMetadataDefinitionInput): Promise<MetadataDefinitionDto> {
  const { data } = await apiClient.post<MetadataDefinitionDto>('/app/metadata-definition', input);
  return data;
}

/** PUT /api/app/metadata-definition/{id} */
export async function updateMetadataDefinition(id: string, input: CreateUpdateMetadataDefinitionInput): Promise<MetadataDefinitionDto> {
  const { data } = await apiClient.put<MetadataDefinitionDto>(`/app/metadata-definition/${id}`, input);
  return data;
}

/** DELETE /api/app/metadata-definition/{id} */
export async function deleteMetadataDefinition(id: string): Promise<void> {
  await apiClient.delete(`/app/metadata-definition/${id}`);
}
