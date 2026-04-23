import { z } from 'zod';

export const forgotPasswordSchema = z.object({
  email: z
    .string()
    .min(1, "L'adresse e-mail est requise")
    .email('Adresse e-mail invalide'),
});

export type ForgotPasswordFormValues = z.infer<typeof forgotPasswordSchema>;
