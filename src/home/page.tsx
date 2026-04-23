import { Helmet } from 'react-helmet-async';
import { useNavigate } from 'react-router-dom';
import { logoutUser } from '@/auth/services/auth.service';
import { setAccessToken } from '@/lib/api.client';
import { useAuth } from '@/providers/auth-provider';
import { Role, Permission } from '@/lib/auth-rbac/roles';
import { RoleGuard, PermissionGuard } from '@/components/auth/RoleGuard';
import { ShieldCheck, User as UserIcon, Lock, Users } from 'lucide-react';

export function HomePage() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const handleLogout = async () => {
    try {
      await logoutUser();
    } finally {
      // Nettoyage global (Context + LocalStorage)
      logout();
      // Nettoyage Client API
      setAccessToken(null);
      // Redirection
      navigate('/auth/login', { replace: true });
    }
  };

  return (
    <>
      <Helmet>
        <title>Accueil — EDMS Enterprise</title>
        <meta
          name="description"
          content="Tableau de bord principal du système de gestion documentaire d'entreprise."
        />
      </Helmet>

      <div className="flex min-h-screen items-center justify-center bg-background relative px-4">
        
        {/* Actions header (Placeholder) */}
        <div className="absolute top-4 right-4 sm:top-8 sm:right-8 flex items-center gap-3">
          {user && (
            <div className="flex flex-col items-end mr-2">
              <span className="text-sm font-semibold">{user.fullName}</span>
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground px-1.5 py-0.5 bg-secondary rounded border">
                {user.role}
              </span>
            </div>
          )}
          <Button variant="outline" size="sm" onClick={handleLogout} className="text-muted-foreground">
            Me déconnecter
          </Button>
        </div>

        <div className="max-w-2xl w-full text-center space-y-12">
          <div className="space-y-4">
            <h1 className="text-4xl font-bold tracking-tight text-foreground flex items-center justify-center gap-3">
              <ShieldCheck className="h-10 w-10 text-primary" />
              EDMS Enterprise
            </h1>
            <p className="text-muted-foreground text-lg italic">
              Système de Gestion Documentaire & RBAC
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-left">
            {/* Zone Accessible à tous (User, Manager, Admin) */}
            <div className="p-6 rounded-xl border bg-card shadow-sm hover:shadow-md transition-shadow">
              <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center mb-4 text-blue-500">
                <UserIcon className="h-5 w-5" />
              </div>
              <h3 className="font-bold mb-2">Espace Utilisateur</h3>
              <p className="text-sm text-muted-foreground">
                Accessible à tout utilisateur authentifié. Vous pouvez consulter vos documents personnels.
              </p>
            </div>

            {/* Zone Manager/Admin uniquement */}
            <RoleGuard allowedRoles={[Role.ADMIN, Role.MANAGER]} fallback={
              <div className="p-6 rounded-xl border border-dashed bg-muted/30 flex flex-col items-center justify-center text-center opacity-60">
                <Lock className="h-6 w-6 text-muted-foreground mb-2" />
                <p className="text-xs font-medium text-muted-foreground">Accès restreint aux Managers</p>
              </div>
            }>
              <div className="p-6 rounded-xl border bg-card shadow-sm border-indigo-500/20 hover:shadow-md transition-shadow">
                <div className="h-10 w-10 rounded-lg bg-indigo-500/10 flex items-center justify-center mb-4 text-indigo-500">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <h3 className="font-bold mb-2">Espace Gestion</h3>
                <p className="text-sm text-muted-foreground">
                  Visible uniquement par les Managers et Admins. Permet de valider les documents en attente.
                </p>
              </div>
            </RoleGuard>

            {/* Zone Admin uniquement via Permission */}
            <PermissionGuard requiredPermission={Permission.MANAGE_USERS} fallback={null}>
              <div className="p-6 rounded-xl border bg-card shadow-sm border-amber-500/20 hover:shadow-md transition-shadow md:col-span-2">
                <div className="h-10 w-10 rounded-lg bg-amber-500/10 flex items-center justify-center mb-4 text-amber-500">
                  <Users className="h-5 w-5" />
                </div>
                <h3 className="font-bold mb-2">Administration Système</h3>
                <p className="text-sm text-muted-foreground">
                  Visible uniquement si vous avez la permission <code className="text-xs bg-amber-500/10 px-1 rounded">{Permission.MANAGE_USERS}</code>.
                </p>
              </div>
            </PermissionGuard>
          </div>

          <div className="pt-8">
            <p className="text-xs text-muted-foreground">
              Utilisez <code className="bg-muted px-1 rounded">admin@entreprise.fr</code> pour tester le mode Admin complet.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
