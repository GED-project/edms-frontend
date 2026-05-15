import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Helmet } from 'react-helmet-async';
import { Mail, Loader2, ShieldCheck, CheckCircle2, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { forgotPasswordSchema, type ForgotPasswordFormValues } from '@/auth/lib/forgot-password.schema';
import { forgotPassword } from '@/auth/services/auth.service';

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

export function ForgotPasswordPage() {
  const [view, setView] = React.useState<ViewState>('form');
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [serverError, setServerError] = React.useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordFormValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: '' },
    mode: 'onBlur',
  });

  const onSubmit = async (data: ForgotPasswordFormValues) => {
    setIsSubmitting(true);
    setServerError(null);
    try {
      const result = await forgotPassword(data.email);
      if (result.success) {
        setView('success');
      }
    } catch {
      setServerError('Une erreur de connexion au serveur est survenue.');
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
          <title>E-mail envoyé — ItDoc</title>
        </Helmet>
        <div className="flex min-h-screen items-center justify-center bg-background px-4">
          <div className="w-full max-w-md text-center space-y-6 animate-in fade-in-0 slide-in-from-bottom-4 duration-500">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
              <CheckCircle2 className="h-8 w-8 text-green-600 dark:text-green-400" />
            </div>
            <div className="space-y-2">
              <h1 className="text-2xl font-bold tracking-tight text-foreground">
                Vérifiez votre boîte mail
              </h1>
              <p className="text-muted-foreground text-sm leading-relaxed">
                Si un compte est associé à cette adresse e-mail, nous venons de
                vous envoyer un lien pour réinitialiser votre mot de passe. 
                Ce lien est temporaire et expire après 1 heure.
              </p>
            </div>
            
            <Button
              variant="outline"
              size="lg"
              className="w-full"
              onClick={() => window.location.href = '/auth/login'}
            >
              Retour à la page de connexion
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
        <title>Mot de passe oublié — ItDoc</title>
        <meta
          name="description"
          content="Demandez un lien de réinitialisation de mot de passe."
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
              ItDoc
            </span>
          </div>
          <div className="space-y-4">
            <h1 className="text-3xl font-bold leading-snug">
              Un oubli ?
              <br />
              Ça arrive à tout le monde.
            </h1>
            <p className="text-sm text-zinc-400 leading-relaxed max-w-xs">
              Saisissez votre adresse e-mail et nous vous enverrons 
              les instructions pour récupérer votre accès de manière sécurisée.
            </p>
          </div>
          <p className="text-xs text-zinc-600">
            © {new Date().getFullYear()} ItDoc. Tous droits réservés.
          </p>
        </div>

        {/* Right panel — form */}
        <div className="flex flex-1 flex-col items-center justify-center px-4 py-12 sm:px-8 relative">
          
          <a 
            href="/auth/login" 
            className="absolute top-8 left-8 flex items-center text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Retour à la connexion
          </a>

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
                Mot de passe oublié
              </h2>
              <p className="text-sm text-muted-foreground">
                Veuillez indiquer l&apos;adresse e-mail associée à votre compte.
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
                    Envoi en cours…
                  </>
                ) : (
                  'Envoyer le lien de réinitialisation'
                )}
              </Button>
            </form>
          </div>
        </div>
      </div>
    </>
  );
}
