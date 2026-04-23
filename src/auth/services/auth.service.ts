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
// Mock in-memory "database" — remove when wiring the real backend
// ---------------------------------------------------------------------------
const _registeredEmails = new Set<string>();

/**
 * Check whether an email is already taken.
 * Replace with: GET /api/auth/check-email?email=...
 */
export async function checkEmailAvailability(
  email: string,
): Promise<{ available: boolean }> {
  await new Promise((r) => setTimeout(r, 400));
  return { available: !_registeredEmails.has(email.toLowerCase()) };
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

  if (_registeredEmails.has(emailLower)) {
    return { success: false, message: 'Cette adresse e-mail est déjà utilisée.' };
  }

  _registeredEmails.add(emailLower);

  return {
    success: true,
    message:
      'Compte créé avec succès. Un e-mail de confirmation vous a été envoyé.',
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

  // Mock behavior pour le template de test :
  // On autorise si l'email a été enregistré OU si on utilise un email de démo.
  const isDemoOrRegistered = _registeredEmails.has(emailLower) || emailLower === 'admin@entreprise.fr' || emailLower === 'jean@entreprise.fr';

  if (!isDemoOrRegistered || payload.password.length < 8) {
    return { success: false, message: 'Identifiants incorrects ou compte inexistant.' };
  }

  return {
    success: true,
    accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.mock_token.signature_mock', // Faux JWT
    user: {
      id: 'usr_12345',
      email: emailLower,
      fullName: emailLower.split('@')[0], // Pseudo fullName temp
      role: emailLower === 'admin@entreprise.fr' ? Role.ADMIN : (emailLower === 'jean@entreprise.fr' ? Role.MANAGER : Role.USER),
      permissions: emailLower === 'admin@entreprise.fr' 
        ? Object.values(Permission) 
        : (emailLower === 'jean@entreprise.fr' 
            ? [Permission.READ_DOCUMENT, Permission.CREATE_DOCUMENT, Permission.EDIT_DOCUMENT, Permission.APPROVE_DOCUMENT, Permission.VIEW_AUDIT_LOGS]
            : [Permission.READ_DOCUMENT, Permission.CREATE_DOCUMENT]),
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
  // Simule l'appel API pour blacklister le token
  await new Promise((r) => setTimeout(r, 400));
  
  return { success: true };
}

/**
 * Request a password reset link.
 * Replace with: POST /api/auth/forgot-password
 */
export async function forgotPassword(email: string): Promise<{ success: boolean }> {
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

  // Si on est ici, le mot de passe est censé être réinitialisé avec succès côté backend
  return { success: true, message: 'Votre mot de passe a été modifié avec succès.' };
}
