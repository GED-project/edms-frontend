/**
 * Activity / Audit Log Service — wraps the backend ActivityLogAppService.
 * Endpoint: GET /api/app/activity-log/my-activity
 */

import { apiClient } from '@/lib/api.client';
import type { ActionType, ActivityEntry } from '@/lib/activity-logger';

// ─── DTOs ─────────────────────────────────────────────────────────────────────

export interface BackendActivityDto {
  id: string;
  executionTime: string;
  userName: string;
  /** Friendly action: "Upload" | "Download" | "Delete" | "Update" | "Info" */
  actionName: string;
  /** Resolved document/folder/library title (empty when not resolvable). */
  title: string;
  entityId: string;
  /** Parsed service name, e.g. "Document", "Folder", "Library" */
  entityName: string;
  browserInfo: string;
  clientIpAddress: string;
}

export interface UserForAuditFilterDto {
  id: string;
  userName: string;
  email?: string;
}

export interface PagedResult<T> {
  items: T[];
  totalCount: number;
}

export interface GetActivityInput {
  startDate?: string;
  endDate?: string;
  actionType?: string;
  userId?: string;
  skipCount?: number;
  maxResultCount?: number;
  sorting?: string;
}

// ─── Mapping ──────────────────────────────────────────────────────────────────

const ACTION_MAP: Record<string, ActionType> = {
  Upload: 'upload',
  Download: 'download',
  Delete: 'delete',
  Update: 'edit',
  Info: 'view',
};

export function mapBackendEntry(dto: BackendActivityDto): ActivityEntry {
  const action: ActionType = ACTION_MAP[dto.actionName] ?? 'view';

  // Prefer the resolved title; fall back to "EntityType #shortId" or just entity type.
  let documentName: string;
  if (dto.title) {
    documentName = dto.title;
  } else if (dto.entityId) {
    documentName = `${dto.entityName} #${dto.entityId.slice(0, 8)}`;
  } else {
    documentName = dto.entityName || 'Inconnu';
  }

  return {
    id: `backend-${dto.id}`,
    action,
    documentName,
    user: dto.userName,
    date: dto.executionTime,
    details: dto.browserInfo || undefined,
  };
}

// ─── API ──────────────────────────────────────────────────────────────────────

export async function getActivityLogs(
  input?: GetActivityInput,
): Promise<PagedResult<BackendActivityDto>> {
  const { data } = await apiClient.get<PagedResult<BackendActivityDto>>(
    '/app/activity-log/my-activity',
    { params: input },
  );
  return data;
}

export async function getUsersForAuditFilter(): Promise<UserForAuditFilterDto[]> {
  const { data } = await apiClient.get<UserForAuditFilterDto[]>(
    '/app/activity-log/users-for-audit-filter',
  );
  return data;
}
