import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  FileText,
  Settings,
  LogOut,
  Users,
  ScrollText,
  Activity,
  ChevronLeft,
  ChevronRight,
  Wrench,
  FolderOpen,
} from 'lucide-react';
import { useAuth } from '@/providers/auth-provider';
import { logoutUser } from '@/auth/services/auth.service';
import { setAccessToken } from '@/lib/api.client';
import { Permission } from '@/lib/auth-rbac/roles';
import itcompLogo from '@/assets/itcomp-logo.svg';

interface NavItem {
  label: string;
  to: string;
  icon: React.ElementType;
  requiredPermission?: Permission;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

const NAV_SECTIONS: NavSection[] = [
  {
    title: 'MAIN',
    items: [
      { label: 'Dashboard', to: '/dashboard', icon: LayoutDashboard },
      { label: 'Document Library', to: '/documents', icon: FolderOpen },
      { label: 'Activité', to: '/activity', icon: Activity },
    ],
  },
  {
    title: 'OPERATION',
    items: [
      { label: 'Rapports', to: '/reports', icon: ScrollText },
      {
        label: 'Administration',
        to: '/admin',
        icon: Users,
        requiredPermission: Permission.MANAGE_USERS,
      },
      { label: 'Paramètres', to: '/settings', icon: Settings },
    ],
  },
  {
    title: 'SYSTEM',
    items: [
      {
        label: 'Audit Log',
        to: '/audit',
        icon: FileText,
        requiredPermission: Permission.CONSULTE_AUDIT_LOGS,
      },
      { label: 'Intégrations', to: '/integrations', icon: Wrench },
    ],
  },
];

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  mobileOpen: boolean;
  onMobileClose: () => void;
}

export function Sidebar({ collapsed, onToggle, mobileOpen, onMobileClose }: SidebarProps) {
  const { hasPermission, logout } = useAuth();
  const navigate = useNavigate();

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
    <>
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={onMobileClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={[
          'fixed top-0 left-0 z-30 h-full flex flex-col transition-all duration-300 ease-in-out',
          // Dark background matching the main interface for cohesion
          'bg-[#0f1117] dark:bg-background',
          'border-r border-white/5',
          collapsed ? 'w-[70px]' : 'w-[230px]',
          mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
        ].join(' ')}
      >
        {/* Logo / Brand */}
        <div className={`flex items-center gap-3 h-16 border-b border-white/5 shrink-0 ${collapsed ? 'justify-center px-3' : 'px-5'}`}>
          <img
            src={itcompLogo}
            alt="EDMS"
            className={`shrink-0 ${collapsed ? 'h-8 w-8' : 'h-7 w-7'}`}
          />
          {!collapsed && (
            <div className="min-w-0">
              <p className="text-sm font-bold text-white tracking-wide truncate">EDMS</p>
              <p className="text-[10px] text-zinc-500 truncate">Enterprise</p>
            </div>
          )}
        </div>



        {/* Navigation Sections */}
        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-1 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-zinc-700">
          {NAV_SECTIONS.map((section) => {
            const visibleItems = section.items.filter((item) => {
              if (item.requiredPermission) return hasPermission(item.requiredPermission);
              return true;
            });

            if (visibleItems.length === 0) return null;

            return (
              <div key={section.title} className="mb-1">
                {/* Section heading */}
                {!collapsed && (
                  <p className="px-3 pt-3 pb-1.5 text-[9px] font-bold uppercase tracking-[0.15em] text-zinc-600 select-none">
                    {section.title}
                  </p>
                )}
                {collapsed && (
                  <div className="border-t border-white/5 my-2" />
                )}

                <div className="space-y-0.5">
                  {visibleItems.map((item) => (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      onClick={onMobileClose}
                      title={collapsed ? item.label : undefined}
                      className={({ isActive }) =>
                        [
                          'group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150 relative',
                          isActive
                            ? 'bg-primary/15 text-primary shadow-sm'
                            : 'text-zinc-400 hover:bg-white/5 hover:text-zinc-200',
                          collapsed ? 'justify-center px-0' : '',
                        ].join(' ')
                      }
                    >
                      {({ isActive }) => (
                        <>
                          {/* Active bar indicator */}
                          {isActive && !collapsed && (
                            <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-0.5 rounded-r-full bg-primary" />
                          )}
                          <item.icon
                            className={`h-[18px] w-[18px] shrink-0 transition-colors ${
                              isActive ? 'text-primary' : 'text-zinc-500 group-hover:text-zinc-300'
                            }`}
                          />
                          {!collapsed && (
                            <span className="truncate">{item.label}</span>
                          )}
                        </>
                      )}
                    </NavLink>
                  ))}
                </div>
              </div>
            );
          })}
        </nav>

        {/* Footer — Logout */}
        <div className="shrink-0 border-t border-white/5 p-2 pb-3">
          <button
            onClick={handleLogout}
            title="Déconnexion"
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-zinc-500 hover:bg-red-500/10 hover:text-red-400 transition-all duration-150 ${collapsed ? 'justify-center' : ''}`}
          >
            <LogOut className="h-[18px] w-[18px] shrink-0" />
            {!collapsed && <span>Logout</span>}
          </button>
        </div>

        {/* Collapse toggle — desktop only */}
        <button
          onClick={onToggle}
          className="absolute -right-3 top-[72px] hidden lg:flex h-6 w-6 items-center justify-center rounded-full border border-zinc-700 bg-[#1a1d2e] text-zinc-400 hover:text-zinc-100 hover:border-zinc-500 transition-all shadow-lg"
          aria-label={collapsed ? 'Développer la sidebar' : 'Réduire la sidebar'}
        >
          {collapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronLeft className="h-3 w-3" />}
        </button>
      </aside>
    </>
  );
}
