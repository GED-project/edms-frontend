import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Helmet } from 'react-helmet-async';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Eye,
  EyeOff,
  Mail,
  Lock,
  Loader2,
  ShieldCheck,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { loginSchema, type LoginFormValues } from '@/auth/lib/login.schema';
import { loginUser } from '@/auth/services/auth.service';
import { setAccessToken } from '@/lib/api.client';
import { useAuth } from '@/providers/auth-provider';

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p role="alert" className="mt-1 text-xs text-destructive">
      {message}
    </p>
  );
}

function FormField({
  label,
  htmlFor,
  children,
  error,
  required,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
  error?: string;
  required?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-sm font-medium text-foreground">
        {label}
        {required && (
          <span className="ml-0.5 text-destructive" aria-hidden="true">
            *
          </span>
        )}
      </label>
      {children}
      <FieldError message={error} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();
  const [showPassword, setShowPassword] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [serverError, setServerError] = React.useState<string | null>(null);

  // Default redirect is usually to dashboard or wherever they came from
  const from = location.state?.from?.pathname || '/';

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
    mode: 'onBlur',
  });

  const onSubmit = async (data: LoginFormValues) => {
    setIsSubmitting(true);
    setServerError(null);
    try {
      const result = await loginUser({
        email: data.email,
        password: data.password,
      });

      if (result.success && result.accessToken) {
        // Sauvegarder le JWT en mémoire via notre client API
        setAccessToken(result.accessToken);
        
        // Stocker l'utilisateur (avec son rôle et ses permissions) dans le contexte global
        if (result.user) {
          login(result.user);
        }

        // Redirection vers la page protégée
        navigate(from, { replace: true });
      } else {
        setServerError(result.message || 'La connexion a échoué.');
      }
    } catch {
      setServerError('Une erreur de connexion au serveur est survenue.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <Helmet>
        <title>Connexion — EDMS Enterprise</title>
        <meta
          name="description"
          content="Connectez-vous à votre espace EDMS Enterprise."
        />
      </Helmet>

      <div className="flex min-h-screen bg-background">
        {/* Left panel — branding */}
        <div className="hidden lg:flex lg:w-1/2 xl:w-2/5 flex-col justify-between bg-zinc-950 p-12 text-white">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
              <ShieldCheck className="h-4 w-4 text-white" />
            </div>
            <span className="text-sm font-semibold tracking-wide">
              EDMS Enterprise
            </span>
          </div>
          <div className="space-y-4">
            <h1 className="text-3xl font-bold leading-snug">
              Bienvenue dans votre
              <br />
              espace sécurisé.
            </h1>
            <p className="text-sm text-zinc-400 leading-relaxed max-w-xs">
              Connectez-vous pour accéder à vos documents, valider les flux de
              travail en attente et consulter l&apos;audit système.
            </p>
          </div>
          <p className="text-xs text-zinc-600">
            © {new Date().getFullYear()} EDMS Enterprise. Tous droits réservés.
          </p>
        </div>

        {/* Right panel — form */}
        <div className="flex flex-1 flex-col items-center justify-center px-4 py-12 sm:px-8">
          <div className="w-full max-w-md space-y-8">
            {/* Header */}
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 mb-6 lg:hidden">
                <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary">
                  <ShieldCheck className="h-3.5 w-3.5 text-white" />
                </div>
                <span className="text-sm font-semibold text-foreground">
                  EDMS Enterprise
                </span>
              </div>
              <h2 className="text-2xl font-bold tracking-tight text-foreground">
                Connexion
              </h2>
              <p className="text-sm text-muted-foreground">
                Entrez vos identifiants pour accéder à votre compte.
              </p>
            </div>

            {/* Server error banner */}
            {serverError && (
              <div
                role="alert"
                className="rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive"
              >
                {serverError}
              </div>
            )}

            {/* Form */}
            <form
              onSubmit={handleSubmit(onSubmit)}
              noValidate
              className="space-y-5"
              aria-label="Formulaire de connexion"
            >
              {/* Email */}
              <FormField
                label="Adresse e-mail"
                htmlFor="email"
                error={errors.email?.message}
                required
              >
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    variant="lg"
                    autoComplete="email"
                    placeholder="jean@entreprise.fr"
                    className="pl-9"
                    aria-invalid={!!errors.email}
                    {...register('email')}
                  />
                </div>
              </FormField>

              {/* Password */}
              <FormField
                label="Mot de passe"
                htmlFor="password"
                error={errors.password?.message}
                required
              >
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    variant="lg"
                    autoComplete="current-password"
                    placeholder="Votre mot de passe"
                    className="px-9"
                    aria-invalid={!!errors.password}
                    {...register('password')}
                  />
                  <button
                    type="button"
                    aria-label={
                      showPassword
                        ? 'Masquer le mot de passe'
                        : 'Afficher le mot de passe'
                    }
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
                <div className="flex justify-end mt-1">
                  <a
                    href="/auth/forgot-password"
                    className="text-xs font-medium text-primary hover:underline"
                  >
                    Mot de passe oublié ?
                  </a>
                </div>
              </FormField>

              {/* Submit */}
              <Button
                type="submit"
                variant="primary"
                size="lg"
                className="w-full"
                disabled={isSubmitting}
                id="login-submit"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Connexion en cours…
                  </>
                ) : (
                  'Se connecter'
                )}
              </Button>
            </form>

            {/* Register link */}
            <p className="text-center text-sm text-muted-foreground">
              Vous n&apos;avez pas de compte ?{' '}
              <a
                href="/auth/register"
                className="font-medium text-primary hover:underline underline-offset-4"
              >
                S&apos;inscrire
              </a>
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
