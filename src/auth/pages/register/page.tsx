import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Helmet } from 'react-helmet-async';
import {
  Eye,
  EyeOff,
  CheckCircle2,
  Mail,
  Lock,
  User,
  Loader2,
  ShieldCheck,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import {
  registerSchema,
  type RegisterFormValues,
  getPasswordStrength,
} from '@/auth/lib/register.schema';
import {
  checkEmailAvailability,
  registerUser,
} from '@/auth/services/auth.service';

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

function PasswordStrengthBar({ password }: { password: string }) {
  const strength = getPasswordStrength(password);
  if (!password) return null;

  return (
    <div className="mt-2 space-y-1.5">
      <div className="flex gap-1">
        {[1, 2, 3, 4].map((level) => (
          <div
            key={level}
            className={cn(
              'h-1 flex-1 rounded-full transition-all duration-300',
              strength.score >= level ? strength.color : 'bg-border',
            )}
          />
        ))}
      </div>
      {strength.label && (
        <p className="text-xs text-muted-foreground">
          Sécurité :{' '}
          <span
            className={cn(
              'font-medium',
              strength.score === 1 && 'text-red-500',
              strength.score === 2 && 'text-orange-400',
              strength.score === 3 && 'text-yellow-500',
              strength.score === 4 && 'text-green-600',
            )}
          >
            {strength.label}
          </span>
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

type ViewState = 'form' | 'success';

export function RegisterPage() {
  const [view, setView] = React.useState<ViewState>('form');
  const [showPassword, setShowPassword] = React.useState(false);
  const [showConfirm, setShowConfirm] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [serverError, setServerError] = React.useState<string | null>(null);
  const [registeredEmail, setRegisteredEmail] = React.useState('');

  const {
    register,
    handleSubmit,
    watch,
    setError,
    setValue,
    getValues,
    formState: { errors },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      fullName: '',
      email: '',
      password: '',
      confirmPassword: '',
      terms: undefined,
    },
    mode: 'onBlur',
  });

  const passwordValue = watch('password', '');
  const termsValue = watch('terms');

  const handleEmailBlur = async () => {
    const email = getValues('email');
    if (!email || errors.email) return;
    try {
      const { available } = await checkEmailAvailability(email);
      if (!available) {
        setError('email', {
          type: 'manual',
          message: 'Cette adresse e-mail est déjà associée à un compte.',
        });
      }
    } catch {
      // Let server validate on submit
    }
  };

  const onSubmit = async (data: RegisterFormValues) => {
    setIsSubmitting(true);
    setServerError(null);
    try {
      const result = await registerUser({
        fullName: data.fullName,
        email: data.email,
        password: data.password,
      });
      if (result.success) {
        setRegisteredEmail(data.email);
        setView('success');
      } else {
        setServerError(result.message);
        if (result.message.toLowerCase().includes('e-mail')) {
          setError('email', { type: 'manual', message: result.message });
        }
      }
    } catch {
      setServerError('Une erreur inattendue est survenue. Veuillez réessayer.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Success view
  // ---------------------------------------------------------------------------
  if (view === 'success') {
    return (
      <>
        <Helmet>
          <title>Confirmation — EDMS Enterprise</title>
        </Helmet>
        <div className="flex min-h-screen items-center justify-center bg-background px-4">
          <div className="w-full max-w-md text-center space-y-6 animate-in fade-in-0 slide-in-from-bottom-4 duration-500">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
              <CheckCircle2 className="h-8 w-8 text-green-600 dark:text-green-400" />
            </div>
            <div className="space-y-2">
              <h1 className="text-2xl font-bold tracking-tight text-foreground">
                Compte créé avec succès !
              </h1>
              <p className="text-muted-foreground text-sm leading-relaxed">
                Un e-mail de confirmation a été envoyé à{' '}
                <span className="font-medium text-foreground">
                  {registeredEmail}
                </span>
                .<br />
                Cliquez sur le lien dans l&apos;e-mail pour activer votre compte.
              </p>
            </div>
            <div className="rounded-lg border border-border bg-muted/40 p-4 text-left space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Prochaines étapes
              </p>
              {[
                'Vérifiez votre boîte de réception (et les spams)',
                'Cliquez sur le lien de confirmation',
                'Connectez-vous à votre espace EDMS',
              ].map((step, i) => (
                <div
                  key={i}
                  className="flex items-start gap-2 text-sm text-foreground"
                >
                  <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                    {i + 1}
                  </span>
                  {step}
                </div>
              ))}
            </div>
            <Button
              variant="outline"
              size="lg"
              className="w-full"
              onClick={() => setView('form')}
            >
              Retour à l&apos;inscription
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
        <title>Inscription — EDMS Enterprise</title>
        <meta
          name="description"
          content="Créez votre compte EDMS Enterprise pour accéder à votre espace documentaire."
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
              Gérez vos documents
              <br />
              en toute sécurité.
            </h1>
            <p className="text-sm text-zinc-400 leading-relaxed max-w-xs">
              Plateforme de gestion documentaire d&apos;entreprise — contrôle
              d&apos;accès, audit complet, et conformité RGPD.
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
                Créer un compte
              </h2>
              <p className="text-sm text-muted-foreground">
                Renseignez vos informations pour rejoindre la plateforme.
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
              aria-label="Formulaire d'inscription"
            >
              {/* Full name */}
              <FormField
                label="Nom complet"
                htmlFor="fullName"
                error={errors.fullName?.message}
                required
              >
                <div className="relative">
                  <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="fullName"
                    type="text"
                    variant="lg"
                    autoComplete="name"
                    placeholder="Jean Dupont"
                    className="pl-9"
                    aria-invalid={!!errors.fullName}
                    {...register('fullName')}
                  />
                </div>
              </FormField>

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
                    {...register('email', { onBlur: handleEmailBlur })}
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
                    autoComplete="new-password"
                    placeholder="Min. 8 caractères"
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
                <PasswordStrengthBar password={passwordValue} />
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
                    aria-label={
                      showConfirm
                        ? 'Masquer la confirmation'
                        : 'Afficher la confirmation'
                    }
                    onClick={() => setShowConfirm((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showConfirm ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </FormField>

              {/* Terms */}
              <div className="flex items-start gap-2.5">
                <Checkbox
                  id="terms"
                  checked={termsValue === true}
                  onCheckedChange={(checked) => {
                    setValue(
                      'terms',
                      checked === true
                        ? true
                        : (undefined as unknown as true),
                      { shouldValidate: true },
                    );
                  }}
                  aria-invalid={!!errors.terms}
                  className="mt-0.5"
                />
                <div>
                  <label
                    htmlFor="terms"
                    className="text-sm text-foreground cursor-pointer leading-snug"
                  >
                    J&apos;accepte les{' '}
                    <a
                      href="#"
                      className="text-primary hover:underline font-medium"
                    >
                      conditions d&apos;utilisation
                    </a>{' '}
                    et la{' '}
                    <a
                      href="#"
                      className="text-primary hover:underline font-medium"
                    >
                      politique de confidentialité
                    </a>
                    .
                  </label>
                  <FieldError message={errors.terms?.message} />
                </div>
              </div>

              {/* Submit */}
              <Button
                type="submit"
                variant="primary"
                size="lg"
                className="w-full"
                disabled={isSubmitting}
                id="register-submit"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Création du compte…
                  </>
                ) : (
                  'Créer mon compte'
                )}
              </Button>
            </form>

            {/* Login link */}
            <p className="text-center text-sm text-muted-foreground">
              Vous avez déjà un compte ?{' '}
              <a
                href="/auth/login"
                className="font-medium text-primary hover:underline underline-offset-4"
              >
                Se connecter
              </a>
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
