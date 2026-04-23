import { z } from 'zod';

export const loginSchema = z.object({
  email: z
    .string()
    .min(1, "L'adresse e-mail est requise")
    .email('Adresse e-mail invalide'),
  password: z.string().min(1, 'Le mot de passe est requis'),
});

export type LoginFormValues = z.infer<typeof loginSchema>;
