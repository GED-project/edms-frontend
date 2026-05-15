/**
 * Auth Service — wired to ABP / OpenIddict backend.
 *
 * Login  : POST /connect/token  (Resource Owner Password Credentials)
 * Register: POST /api/app/account/register  (ABP Account module)
 * Forgot  : POST /api/app/account/send-password-reset-code
 * Reset   : POST /api/app/account/reset-password
 * Profile : GET  /api/identity/my-profile  (resolve role/permissions after login)
 */

import axios from 'axios';
import { Role, Permission } from '@/lib/auth-rbac/roles';
import { setAccessToken } from '@/lib/api.client';
import { apiClient } from '@/lib/api.client';
import { getCurrentTenantCode } from '@/lib/tenant';

export interface RegisterPayload {
  fullName: string;
  email: string;
  password: string;
}

export interface RegisterResult {
  success: boolean;
  message: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface LoginResult {
  success: boolean;
  message?: string;
  accessToken?: string;
  user?: {
    id: string;
    email: string;
    fullName: string;
    role: Role;
    permissions: Permission[];
    tenantId: string | null;
    tenantCode: string | null;
    isHost: boolean;
  };
}

export interface ResetPasswordPayload {
  email: string;
  token: string;
  password: string;
}

// ---------------------------------------------------------------------------
// RBAC — map ABP roles to frontend Permission sets
// ---------------------------------------------------------------------------

const STANDARD_USER_PERMISSIONS: Permission[] = [
  Permission.LOGIN,
  Permission.LOGOUT,
  Permission.RESET_PASSWORD,
  Permission.MANAGE_PROFILE,
  Permission.CREATE_FOLDER,
  Permission.UPLOAD_DOCUMENT,
  Permission.ADD_DESCRIPTION,
  Permission.PERFORM_OCR,
  Permission.MANAGE_DOCUMENTS,
  Permission.SHARE_DOCUMENT,
  Permission.REQUEST_SHARING_DOCUMENT,
  Permission.SEARCH_DOCUMENT,
  Permission.FULL_TEXT_SEARCH,
  Permission.META_DATA_SEARCH,
  Permission.RETRIEVE_DOCUMENT,
];

const MANAGER_PERMISSIONS: Permission[] = [
  ...STANDARD_USER_PERMISSIONS,
  Permission.REVIEW_DOCUMENT,
  Permission.MANAGE_USERS,
  Permission.MANAGE_PERMISSIONS,
  Permission.APPROVE_SHARING_REQUEST,
  Permission.MANAGE_LIBRARIES,
  Permission.APPROVE_DOCUMENT,
];

const ADMIN_PERMISSIONS: Permission[] = [
  ...MANAGER_PERMISSIONS,
  Permission.CONSULTE_AUDIT_LOGS,
];

function resolvePermissions(roles: string[]): { role: Role; permissions: Permission[] } {
  const lower = roles.map((r) => r.toLowerCase());
  if (lower.includes('admin')) return { role: Role.ADMIN, permissions: ADMIN_PERMISSIONS };
  if (lower.includes('manager')) return { role: Role.MANAGER, permissions: MANAGER_PERMISSIONS };
  return { role: Role.USER, permissions: STANDARD_USER_PERMISSIONS };
}

// ---------------------------------------------------------------------------
// ABP profile shape returned by GET /api/identity/my-profile
// ---------------------------------------------------------------------------

interface AbpProfileResponse {
  id: string;
  email: string;
  name?: string;
  surname?: string;
  userName: string;
}

// ABP returns roles at GET /api/identity/my-profile — roles are a separate
// endpoint, but we can derive them from the JWT claims directly.
function extractRolesFromJwt(token: string): string[] {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    const raw = payload['role'] ?? payload['roles'] ?? payload['http://schemas.microsoft.com/ws/2008/06/identity/claims/role'];
    if (!raw) return [];
    return Array.isArray(raw) ? raw : [raw];
  } catch {
    return [];
  }
}

/** Returns the `tenantid` claim from the JWT (or null for Host scope). */
function extractTenantIdFromJwt(token: string): string | null {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    const raw = payload['tenantid']
      ?? payload['http://schemas.microsoft.com/identity/claims/tenantid'];
    if (!raw || typeof raw !== 'string' || raw === '') return null;
    return raw;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// checkEmailAvailability — removed (backend rejects duplicates on register)
// Kept as a no-op so the register page compiles without changes.
// ---------------------------------------------------------------------------

export async function checkEmailAvailability(
  _email: string,
): Promise<{ available: boolean }> {
  return { available: true };
}

// ---------------------------------------------------------------------------
// registerUser — POST /api/app/account/register
// ---------------------------------------------------------------------------

export async function registerUser(
  payload: RegisterPayload,
): Promise<RegisterResult> {
  try {
    await apiClient.post('/app/account-custom/register', {
      userName: payload.email.split('@')[0],
      emailAddress: payload.email,
      password: payload.password,
    });
    return {
      success: true,
      message: 'Compte créé avec succès. Un e-mail de confirmation vous a été envoyé.',
    };
  } catch (err: any) {
    const detail: string =
      err?.response?.data?.error?.message ||
      err?.response?.data?.error?.details ||
      'Échec de l\'inscription.';
    return { success: false, message: detail };
  }
}

// ---------------------------------------------------------------------------
// loginUser — POST /connect/token (OpenIddict ROPC)
// ---------------------------------------------------------------------------

export async function loginUser(
  payload: LoginPayload,
): Promise<LoginResult> {
  try {
    const params = new URLSearchParams();
    params.append('grant_type', 'password');
    params.append('username', payload.email);
    params.append('password', payload.password);
    params.append('client_id', import.meta.env.VITE_OIDC_CLIENT_ID || 'GedProject_Vue');
    params.append('scope', import.meta.env.VITE_OIDC_SCOPE || 'openid profile email GedProject');

    // Multi-tenancy: tell OpenIddict which tenant to authenticate against.
    // Derived from the browser URL subdomain (null → Host).
    const tenantCode = getCurrentTenantCode();
    const headers: Record<string, string> = {
      'Content-Type': 'application/x-www-form-urlencoded',
    };
    if (tenantCode) {
      params.append('__tenant', tenantCode);
      headers['__tenant'] = tenantCode;
    }

    const authUrl = import.meta.env.VITE_AUTH_URL || '';
    const { data } = await axios.post(`${authUrl}/connect/token`, params, { headers });

    const accessToken: string = data.access_token;
    const refreshToken: string | undefined = data.refresh_token;

    // Store tokens
    setAccessToken(accessToken);
    if (refreshToken) sessionStorage.setItem('edms_refresh_token', refreshToken);

    // Decode role from JWT, then fetch display name from profile
    const roles = extractRolesFromJwt(accessToken);
    const { role, permissions } = resolvePermissions(roles);
    const tenantId = extractTenantIdFromJwt(accessToken);

    const profileRes = await apiClient.get<AbpProfileResponse>('/account/my-profile', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const profile = profileRes.data;
    const fullName = [profile.name, profile.surname].filter(Boolean).join(' ') || profile.userName;

    return {
      success: true,
      accessToken,
      user: {
        id: profile.id,
        email: profile.email,
        fullName,
        role,
        permissions,
        tenantId,
        tenantCode,
        isHost: tenantId === null,
      },
    };
  } catch (err: any) {
    const detail: string =
      err?.response?.data?.error_description ||
      err?.response?.data?.error?.message ||
      'Identifiants incorrects.';
    return { success: false, message: detail };
  }
}

// ---------------------------------------------------------------------------
// logoutUser — revoke token + clear local state
// ---------------------------------------------------------------------------

export async function logoutUser(): Promise<{ success: boolean }> {
  setAccessToken(null);
  sessionStorage.removeItem('edms_refresh_token');
  return { success: true };
}

// ---------------------------------------------------------------------------
// forgotPassword — POST /api/app/account/send-password-reset-code
// ---------------------------------------------------------------------------

export async function forgotPassword(email: string): Promise<{ success: boolean }> {
  try {
    await apiClient.post('/app/account/send-password-reset-code', {
      email,
      appName: 'MVC',
    });
    return { success: true };
  } catch {
    // Never reveal whether the email exists (anti-enumeration)
    return { success: true };
  }
}

// ---------------------------------------------------------------------------
// resetPassword — POST /api/app/account/reset-password
// ---------------------------------------------------------------------------

export async function resetPassword(
  payload: ResetPasswordPayload,
): Promise<{ success: boolean; message: string }> {
  try {
    await apiClient.post('/app/account/reset-password', {
      email: payload.email,
      token: payload.token,
      newPassword: payload.password,
    });
    return { success: true, message: 'Votre mot de passe a été modifié avec succès.' };
  } catch (err: any) {
    const detail: string =
      err?.response?.data?.error?.message ||
      'Le jeton de réinitialisation est invalide ou a expiré.';
    return { success: false, message: detail };
  }
}

