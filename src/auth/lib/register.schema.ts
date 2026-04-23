import { z } from 'zod';

const PASSWORD_MIN = 8;

export const registerSchema = z
  .object({
    fullName: z
      .string()
      .min(2, 'Le nom complet doit contenir au moins 2 caractères.')
      .max(80, 'Le nom complet ne peut pas dépasser 80 caractères.'),

    email: z
      .string()
      .min(1, "L'adresse e-mail est requise.")
      .email("L'adresse e-mail n'est pas valide."),

    password: z
      .string()
      .min(PASSWORD_MIN, `Le mot de passe doit contenir au moins ${PASSWORD_MIN} caractères.`)
      .regex(/[A-Z]/, 'Le mot de passe doit contenir au moins une majuscule.')
      .regex(/[a-z]/, 'Le mot de passe doit contenir au moins une minuscule.')
      .regex(/[0-9]/, 'Le mot de passe doit contenir au moins un chiffre.')
      .regex(
        /[^A-Za-z0-9]/,
        'Le mot de passe doit contenir au moins un caractère spécial.',
      ),

    confirmPassword: z.string().min(1, 'Veuillez confirmer votre mot de passe.'),

    terms: z.literal(true, {
      message: "Vous devez accepter les conditions d'utilisation."
    }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Les mots de passe ne correspondent pas.',
    path: ['confirmPassword'],
  });

export type RegisterFormValues = z.infer<typeof registerSchema>;

// ---------------------------------------------------------------------------
// Password strength helper
// ---------------------------------------------------------------------------
export interface PasswordStrength {
  score: number; // 0–4
  label: string;
  color: string;
}

export function getPasswordStrength(password: string): PasswordStrength {
  let score = 0;
  if (password.length >= 8) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  const levels: PasswordStrength[] = [
    { score: 0, label: '', color: '' },
    { score: 1, label: 'Faible', color: 'bg-red-500' },
    { score: 2, label: 'Moyen', color: 'bg-orange-400' },
    { score: 3, label: 'Fort', color: 'bg-yellow-400' },
    { score: 4, label: 'Très fort', color: 'bg-green-500' },
  ];

  return levels[score];
}
