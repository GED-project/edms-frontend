/**
 * Settings Service — wraps backend UserPreferenceAppService and GedUserProfileAppService.
 *
 * GET  /api/app/user-preference/my-preferences
 * PUT  /api/app/user-preference/my-preferences
 * GET  /api/app/ged-user-profile/profile
 * PUT  /api/app/ged-user-profile/profile
 * POST /api/app/ged-user-profile/change-password
 */

import { apiClient } from '@/lib/api.client';

export interface UserPreferencesDto {
  theme: string;
  language: string;
  emailNotifications: boolean;
  approvalNotifications: boolean;
}

export async function getMyPreferences(): Promise<UserPreferencesDto> {
  const { data } = await apiClient.get<UserPreferencesDto>(
    '/app/user-preference/my-preferences',
  );
  return data;
}

export async function updateMyPreferences(input: UserPreferencesDto): Promise<void> {
  await apiClient.put('/app/user-preference/my-preferences', input);
}

export interface UserProfileDto {
  name: string;
  surname: string;
  email: string;
  userName: string;
}

export interface UpdateUserProfileDto {
  name: string;
  surname: string;
  email: string;
}

export async function getProfile(): Promise<UserProfileDto> {
  const { data } = await apiClient.get<UserProfileDto>('/app/ged-user-profile/profile');
  return data;
}

export async function updateProfile(input: UpdateUserProfileDto): Promise<UserProfileDto> {
  const { data } = await apiClient.put<UserProfileDto>('/app/ged-user-profile/profile', input);
  return data;
}

export interface ChangePasswordDto {
  currentPassword: string;
  newPassword: string;
}

export async function changePassword(input: ChangePasswordDto): Promise<void> {
  await apiClient.post('/app/ged-user-profile/change-password', input);
}
