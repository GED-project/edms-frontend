import { apiClient } from '@/lib/api.client';

export interface ShareRequestDto {
  id: string;
  documentId: string;
  requesterId: string;
  targetUserId: string;
  requestedPermissions: string;
  status: 'Pending' | 'Approved' | 'Rejected';
  creationTime: string;
}

export interface CreateShareRequestDto {
  documentId: string;
  targetUserId?: string;
  requestedForUserId?: string;
  requestedPermissions?: string;
}

class ShareRequestService {
  async requestAccess(
    documentId: string,
    targetUserId?: string,
    permissions?: string,
    requestedForUserId?: string,
  ): Promise<ShareRequestDto> {
    const response = await apiClient.post('/app/share-request/request-access', {
      documentId,
      targetUserId: targetUserId || '00000000-0000-0000-0000-000000000000',
      requestedForUserId: requestedForUserId || '00000000-0000-0000-0000-000000000000',
      requestedPermissions: permissions || 'read',
    });
    return response.data;
  }

  async approve(id: string): Promise<ShareRequestDto> {
    const response = await apiClient.post(`/app/share-request/${id}/approve`, {});
    return response.data;
  }

  async reject(id: string): Promise<ShareRequestDto> {
    const response = await apiClient.post(`/app/share-request/${id}/reject`, {});
    return response.data;
  }

  async getPendingRequests(): Promise<ShareRequestDto[]> {
    const response = await apiClient.get('/app/share-request/get-pending-requests');
    return response.data;
  }

  async getMyRequests(): Promise<ShareRequestDto[]> {
    const response = await apiClient.get('/app/share-request/get-my-requests');
    return response.data;
  }
}

export const shareRequestService = new ShareRequestService();
