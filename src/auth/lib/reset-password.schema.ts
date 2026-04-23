import { z } from 'zod';

// Nous pouvons réutiliser la logique de force du mot de passe si on le souhaite,
// mais ici on se contente du minimum requis pour l'exemple.
export const resetPasswordSchema = z
  .object({
    password: z
      .string()
      .min(8, 'Le mot de passe doit contenir au moins 8 caractères')
      .regex(/[A-Z]/, 'Doit contenir au moins une lettre majuscule')
      .regex(/[0-9]/, 'Doit contenir au moins un chiffre'),
    confirmPassword: z.string().min(1, 'Veuillez confirmer votre mot de passe'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Les mots de passe ne correspondent pas',
    path: ['confirmPassword'],
  });

export type ResetPasswordFormValues = z.infer<typeof resetPasswordSchema>;
