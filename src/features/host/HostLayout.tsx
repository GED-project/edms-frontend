import { useState } from 'react';
import { Navigate, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Building2, HardDrive, LayoutDashboard, LogOut, Menu, X } from 'lucide-react';
import { useAuth } from '@/providers/auth-provider';
import { ScreenLoader } from '@/components/screen-loader';
import { logoutUser } from '@/auth/services/auth.service';
import { setAccessToken } from '@/lib/api.client';
import itcompLogo from '@/assets/itcomp-logo.svg';

interface NavItem {
  label: string;
  to: string;
  icon: React.ElementType;
}

const HOST_NAV: NavItem[] = [
  { label: 'Tableau de bord', to: '/host/dashboard', icon: LayoutDashboard },
  { label: 'Tenants', to: '/host/tenants', icon: Building2 },
  { label: 'Stockage', to: '/host/storage', icon: HardDrive },
];

export function HostLayout() {
  const { user, isLoading, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  if (isLoading) return <ScreenLoader />;
  if (!user) return <Navigate to="/auth/login" state={{ from: location }} replace />;
  // Tenants are not allowed on the host UI.
  if (!user.isHost) return <Navigate to="/dashboard" replace />;

  const handleLogout = async () => {
    try {
      await logoutUser();
    } finally {
      logout();
      setAccessToken(null);
      navigate('/auth/login', { replace: true });
    }
  };

  return (
    <div className="flex min-h-screen bg-background">
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={[
          'fixed top-0 left-0 z-30 h-full w-[230px] flex flex-col transition-transform duration-300 ease-in-out',
          'bg-[#0f1117] dark:bg-background border-r border-white/5',
          mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
        ].join(' ')}
      >
        <div className="flex items-center gap-3 h-16 border-b border-white/5 shrink-0 px-5">
          <img src={itcompLogo} alt="ItDoc" className="h-7 w-7 shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-bold text-white tracking-wide truncate">ItDoc</p>
            <p className="text-[10px] text-amber-400 truncate font-semibold uppercase tracking-wider">
              Host Console
            </p>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
          {HOST_NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={() => setMobileOpen(false)}
              className={({ isActive }) =>
                [
                  'group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150 relative',
                  isActive
                    ? 'bg-primary/15 text-primary shadow-sm'
                    : 'text-zinc-400 hover:bg-white/5 hover:text-zinc-200',
                ].join(' ')
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-0.5 rounded-r-full bg-primary" />
                  )}
                  <item.icon
                    className={`h-[18px] w-[18px] shrink-0 transition-colors ${
                      isActive ? 'text-primary' : 'text-zinc-500 group-hover:text-zinc-300'
                    }`}
                  />
                  <span className="truncate">{item.label}</span>
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="shrink-0 border-t border-white/5 p-2 pb-3">
          <div className="px-3 py-2 mb-1">
            <p className="text-[11px] text-zinc-500 truncate">Connecté en tant que</p>
            <p className="text-sm text-zinc-200 font-medium truncate">{user.fullName}</p>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-zinc-500 hover:bg-red-500/10 hover:text-red-400 transition-all duration-150"
          >
            <LogOut className="h-[18px] w-[18px] shrink-0" />
            <span>Déconnexion</span>
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex flex-1 flex-col lg:ml-[230px]">
        <header className="fixed top-0 right-0 z-10 h-16 border-b bg-background/95 backdrop-blur flex items-center px-6 lg:left-[230px] left-0">
          <button
            onClick={() => setMobileOpen(true)}
            className="lg:hidden mr-3 p-2 rounded-md hover:bg-accent"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
          <h1 className="text-lg font-semibold">Host Console</h1>
          <div className="ml-auto flex items-center gap-2 rounded-full bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-600 dark:text-amber-400 ring-1 ring-amber-500/30">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
            Mode administrateur global
          </div>
        </header>

        <main className="flex-1 pt-16 overflow-auto">
          <div className="p-6">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
