/**
 * Auth Service
 *
 * Responsibility boundary:
 * - Frontend sends credentials over HTTPS (TLS-encrypted transport).
 * - The backend is solely responsible for hashing passwords with bcrypt
 *   and sending the confirmation email.
 * - Swap mock implementations → real API calls when backend is ready.
 */

import { Role, Permission } from '@/lib/auth-rbac/roles';

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
  };
}

export interface ResetPasswordPayload {
  token: string;
  password: string;
}

// ---------------------------------------------------------------------------
// RBAC Permission Sets — proper inheritance hierarchy
// ---------------------------------------------------------------------------

/** All permissions granted to a Standard User */
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

/** Manager inherits all Standard User permissions + Manager-specific ones */
const MANAGER_PERMISSIONS: Permission[] = [
  ...STANDARD_USER_PERMISSIONS,
  Permission.REVIEW_DOCUMENT,
  Permission.MANAGE_USERS,
  Permission.MANAGE_PERMISSIONS,
  Permission.APPROVE_SHARING_REQUEST,
  Permission.MANAGE_LIBRARIES,
  Permission.APPROVE_DOCUMENT,
];

/** Admin inherits all Manager permissions (which include Standard User) + Admin-specific ones */
const ADMIN_PERMISSIONS: Permission[] = [
  ...MANAGER_PERMISSIONS,
  Permission.CONSULTE_AUDIT_LOGS,
];

// ---------------------------------------------------------------------------
// Demo accounts — always available, no registration required
// ---------------------------------------------------------------------------

const DEMO_ACCOUNTS: Record<string, { fullName: string; role: Role; permissions: Permission[] }> = {
  'admin@entreprise.fr': {
    fullName: 'Admin System',
    role: Role.ADMIN,
    permissions: ADMIN_PERMISSIONS,
  },
  'manager@entreprise.fr': {
    fullName: 'Jean Dupont',
    role: Role.MANAGER,
    permissions: MANAGER_PERMISSIONS,
  },
  'user@entreprise.fr': {
    fullName: 'Marie Martin',
    role: Role.USER,
    permissions: STANDARD_USER_PERMISSIONS,
  },
};

// ---------------------------------------------------------------------------
// Mock persistent "database" — stored in localStorage to survive page refresh
// Replace entirely when wiring the real backend.
// ---------------------------------------------------------------------------

const MOCK_DB_KEY = 'edms_mock_registered_users';

interface MockRegisteredUser {
  email: string;
  fullName: string;
  /** In a real app the backend hashes this — here we store plaintext for demo only */
  password: string;
}

function _loadRegisteredUsers(): Map<string, MockRegisteredUser> {
  try {
    const raw = localStorage.getItem(MOCK_DB_KEY);
    if (!raw) return new Map();
    const arr: MockRegisteredUser[] = JSON.parse(raw);
    return new Map(arr.map((u) => [u.email, u]));
  } catch {
    return new Map();
  }
}

function _saveRegisteredUsers(db: Map<string, MockRegisteredUser>): void {
  localStorage.setItem(MOCK_DB_KEY, JSON.stringify([...db.values()]));
}

// ---------------------------------------------------------------------------
// Service functions
// ---------------------------------------------------------------------------

/**
 * Check whether an email is already taken.
 * Replace with: GET /api/auth/check-email?email=...
 */
export async function checkEmailAvailability(
  email: string,
): Promise<{ available: boolean }> {
  await new Promise((r) => setTimeout(r, 400));
  const emailLower = email.toLowerCase();
  // Demo accounts are always "taken"
  if (DEMO_ACCOUNTS[emailLower]) return { available: false };
  const db = _loadRegisteredUsers();
  return { available: !db.has(emailLower) };
}

/**
 * Register a new user.
 * The backend will:
 *  - verify email uniqueness
 *  - hash the password with bcrypt
 *  - persist the user
 *  - send a confirmation email
 *
 * Replace with: POST /api/auth/register
 */
export async function registerUser(
  payload: RegisterPayload,
): Promise<RegisterResult> {
  await new Promise((r) => setTimeout(r, 800));

  const emailLower = payload.email.toLowerCase();

  // Block registration on demo accounts
  if (DEMO_ACCOUNTS[emailLower]) {
    return { success: false, message: 'Cette adresse e-mail est déjà utilisée.' };
  }

  const db = _loadRegisteredUsers();

  if (db.has(emailLower)) {
    return { success: false, message: 'Cette adresse e-mail est déjà utilisée.' };
  }

  db.set(emailLower, {
    email: emailLower,
    fullName: payload.fullName,
    password: payload.password, // Backend would hash this — demo only
  });
  _saveRegisteredUsers(db);

  return {
    success: true,
    message: 'Compte créé avec succès. Un e-mail de confirmation vous a été envoyé.',
  };
}

/**
 * Log in a user.
 * Replace with: POST /api/auth/login or POST /connect/token (ABP)
 */
export async function loginUser(
  payload: LoginPayload,
): Promise<LoginResult> {
  await new Promise((r) => setTimeout(r, 800));

  const emailLower = payload.email.toLowerCase();

  // 1. Check demo accounts first (any password ≥ 8 chars is accepted)
  if (DEMO_ACCOUNTS[emailLower]) {
    if (payload.password.length < 8) {
      return { success: false, message: 'Le mot de passe doit contenir au moins 8 caractères.' };
    }
    const demo = DEMO_ACCOUNTS[emailLower];
    return {
      success: true,
      accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.mock_token.signature_mock',
      user: {
        id: `demo_${emailLower.split('@')[0]}`,
        email: emailLower,
        fullName: demo.fullName,
        role: demo.role,
        permissions: demo.permissions,
      },
    };
  }

  // 2. Check registered users (password must match what was used at registration)
  const db = _loadRegisteredUsers();
  const registeredUser = db.get(emailLower);

  if (!registeredUser) {
    return { success: false, message: 'Identifiants incorrects ou compte inexistant.' };
  }

  if (registeredUser.password !== payload.password) {
    return { success: false, message: 'Identifiants incorrects ou compte inexistant.' };
  }

  return {
    success: true,
    accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.mock_token.signature_mock',
    user: {
      id: `usr_${emailLower.split('@')[0]}`,
      email: emailLower,
      fullName: registeredUser.fullName,
      role: Role.USER,
      permissions: STANDARD_USER_PERMISSIONS,
    },
  };
}

/**
 * Log out a user.
 * Replace with: POST /api/auth/logout
 * Le backend est responsable d'invalider le Refresh Token (ex: suppression du cookie)
 * et de blacklister l'Access Token si nécessaire.
 */
export async function logoutUser(): Promise<{ success: boolean }> {
  await new Promise((r) => setTimeout(r, 400));
  return { success: true };
}

/**
 * Request a password reset link.
 * Replace with: POST /api/auth/forgot-password
 */
export async function forgotPassword(_email: string): Promise<{ success: boolean }> {
  await new Promise((r) => setTimeout(r, 1000));

  // Dans un vrai système, on ne dit jamais si l'email existe ou non pour éviter
  // le "user enumeration". On répond toujours "Succès".
  // On écrit un log console juste pour pouvoir tester le flux de développement localement.
  console.log(`[Mock Dev] Faux email envoyé ! Le lien de réinitialisation est: http://localhost:5173/auth/reset-password?token=mock_reset_token_${Date.now()}`);

  return { success: true };
}

/**
 * Reset the password using the token sent by email.
 * Replace with: POST /api/auth/reset-password
 */
export async function resetPassword(payload: ResetPasswordPayload): Promise<{ success: boolean; message: string }> {
  await new Promise((r) => setTimeout(r, 1000));

  if (!payload.token || payload.token.length < 5) {
    return { success: false, message: 'Le jeton de réinitialisation est invalide ou a expiré.' };
  }

  return { success: true, message: 'Votre mot de passe a été modifié avec succès.' };
}
