import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Helmet } from 'react-helmet-async';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Eye, EyeOff, Lock, Loader2, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { resetPasswordSchema, type ResetPasswordFormValues } from '@/auth/lib/reset-password.schema';
import { resetPassword } from '@/auth/services/auth.service';

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

type ViewState = 'form' | 'success';

export function ResetPasswordPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const email = searchParams.get('email');

  const [view, setView] = React.useState<ViewState>('form');
  const [showPassword, setShowPassword] = React.useState(false);
  const [showConfirm, setShowConfirm] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [serverError, setServerError] = React.useState<string | null>(null);

  // Vérification de la présence du token
  React.useEffect(() => {
    if (!token || !email) {
      // Pas de token ou email -> lien invalide ou accès manuel. On bloque et on redirige.
      console.warn("Lien de réinitialisation invalide ou manquant. Redirection...");
      navigate('/auth/login', { replace: true });
    }
  }, [token, email, navigate]);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ResetPasswordFormValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: '', confirmPassword: '' },
    mode: 'onBlur',
  });

  const onSubmit = async (data: ResetPasswordFormValues) => {
    if (!token || !email) return;

    setIsSubmitting(true);
    setServerError(null);
    try {
      const result = await resetPassword({
        email,
        token,
        password: data.password,
      });

      if (result.success) {
        setView('success');
      } else {
        setServerError(result.message || 'La réinitialisation a échoué.');
      }
    } catch {
      setServerError('Une erreur de connexion au serveur est survenue.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Ne rien afficher le temps de la redirection si pas de token ou email
  if (!token || !email) return null;

  // ---------------------------------------------------------------------------
  // Success view
  // ---------------------------------------------------------------------------
  if (view === 'success') {
    return (
      <>
        <Helmet>
          <title>Mot de passe modifié — ItDoc</title>
        </Helmet>
        <div className="flex min-h-screen items-center justify-center bg-background px-4">
          <div className="w-full max-w-md text-center space-y-6 animate-in fade-in-0 slide-in-from-bottom-4 duration-500">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
              <CheckCircle2 className="h-8 w-8 text-green-600 dark:text-green-400" />
            </div>
            <div className="space-y-2">
              <h1 className="text-2xl font-bold tracking-tight text-foreground">
                Mot de passe modifié !
              </h1>
              <p className="text-muted-foreground text-sm leading-relaxed">
                Votre mot de passe a été réinitialisé avec succès. Vous pouvez
                désormais utiliser votre nouveau mot de passe pour vous connecter.
              </p>
            </div>
            <Button
              variant="primary"
              size="lg"
              className="w-full"
              onClick={() => navigate('/auth/login')}
            >
              Se connecter
            </Button>
          </div>
        </div>
      </>
    );
  }

  // ---------------------------------------------------------------------------
  // Form view
  // ---------------------------------------------------------------------------
  return (
    <>
      <Helmet>
        <title>Nouveau mot de passe — ItDoc</title>
      </Helmet>

      <div className="flex min-h-screen bg-background">
        {/* Left panel — branding */}
        <div className="hidden lg:flex lg:w-1/2 xl:w-2/5 flex-col justify-between bg-zinc-950 p-12 text-white">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
              <ShieldCheck className="h-4 w-4 text-white" />
            </div>
            <span className="text-sm font-semibold tracking-wide">
              ItDoc
            </span>
          </div>
          <div className="space-y-4">
            <h1 className="text-3xl font-bold leading-snug">
              Sécurisez votre
              <br />
              nouveau compte.
            </h1>
            <p className="text-sm text-zinc-400 leading-relaxed max-w-xs">
              Veuillez choisir un mot de passe robuste, composé d&apos;au minimum 8 caractères incluant des majuscules et des chiffres.
            </p>
          </div>
          <p className="text-xs text-zinc-600">
            © {new Date().getFullYear()} ItDoc. Tous droits réservés.
          </p>
        </div>

        {/* Right panel — form */}
        <div className="flex flex-1 flex-col items-center justify-center px-4 py-12 sm:px-8 relative">
          
          <div className="w-full max-w-md space-y-8 mt-12 sm:mt-0">
            {/* Header */}
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 mb-6 lg:hidden">
                <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary">
                  <ShieldCheck className="h-3.5 w-3.5 text-white" />
                </div>
                <span className="text-sm font-semibold text-foreground">
                  ItDoc
                </span>
              </div>
              <h2 className="text-2xl font-bold tracking-tight text-foreground">
                Nouveau mot de passe
              </h2>
              <p className="text-sm text-muted-foreground">
                Saisissez et confirmez votre nouveau mot de passe.
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
            >
              {/* Password */}
              <FormField
                label="Nouveau mot de passe"
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
                    autoComplete="new-password"
                    placeholder="Min. 8 caractères, 1 maj, 1 chffre"
                    className="px-9"
                    aria-invalid={!!errors.password}
                    {...register('password')}
                  />
                  <button
                    type="button"
                    aria-label={showPassword ? "Masquer" : "Afficher"}
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </FormField>

              {/* Confirm password */}
              <FormField
                label="Confirmer le mot de passe"
                htmlFor="confirmPassword"
                error={errors.confirmPassword?.message}
                required
              >
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="confirmPassword"
                    type={showConfirm ? 'text' : 'password'}
                    variant="lg"
                    autoComplete="new-password"
                    placeholder="Répétez votre mot de passe"
                    className="px-9"
                    aria-invalid={!!errors.confirmPassword}
                    {...register('confirmPassword')}
                  />
                  <button
                    type="button"
                    aria-label={showConfirm ? "Masquer" : "Afficher"}
                    onClick={() => setShowConfirm((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </FormField>

              {/* Submit */}
              <Button
                type="submit"
                variant="primary"
                size="lg"
                className="w-full"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Modification en cours…
                  </>
                ) : (
                  'Réinitialiser mon mot de passe'
                )}
              </Button>
            </form>
          </div>
        </div>
      </div>
    </>
  );
}
