import React, { createContext, useContext, useState, useEffect } from 'react';
import { Role, Permission, AuthenticatedUser } from '@/lib/auth-rbac/roles';
import { setAccessToken } from '@/lib/api.client';
import { getCurrentTenantCode } from '@/lib/tenant';

interface AuthContextType {
  user: AuthenticatedUser | null;
  isLoading: boolean;
  login: (userData: AuthenticatedUser) => void;
  logout: () => void;
  hasRole: (role: Role) => boolean;
  hasPermission: (permission: Permission) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function normalizeUserRole(rawRole: unknown): Role {
  const value = String(rawRole ?? '').toLowerCase();
  if (value === Role.ADMIN) return Role.ADMIN;
  if (value === Role.MANAGER) return Role.MANAGER;
  return Role.USER;
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthenticatedUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const storedUser = localStorage.getItem('edms_user');
    const refreshToken = sessionStorage.getItem('edms_refresh_token');

    if (!storedUser || !refreshToken) {
      // No stored session — show login immediately
      setIsLoading(false);
      return;
    }

    // Restore user object into state immediately so the UI renders correctly
    try {
      const parsed = JSON.parse(storedUser) as Partial<AuthenticatedUser>;
      const normalized: AuthenticatedUser = {
        id: String(parsed.id ?? ''),
        email: String(parsed.email ?? ''),
        fullName: String(parsed.fullName ?? ''),
        role: normalizeUserRole(parsed.role),
        permissions: Array.isArray(parsed.permissions) ? parsed.permissions : [],
        tenantId: parsed.tenantId ?? null,
        tenantCode: parsed.tenantCode ?? null,
        isHost: typeof parsed.isHost === 'boolean' ? parsed.isHost : parsed.tenantId === null,
      };
      setUser(normalized);
      localStorage.setItem('edms_user', JSON.stringify(normalized));
    } catch {
      localStorage.removeItem('edms_user');
      setIsLoading(false);
      return;
    }

    // Silently exchange the refresh token for a new access token
    const params = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: import.meta.env.VITE_OIDC_CLIENT_ID ?? 'GedProject_Vue',
    });

    const tenantCode = getCurrentTenantCode();
    if (tenantCode) {
      params.append('__tenant', tenantCode);
    }

    const refreshHeaders: Record<string, string> = {
      'Content-Type': 'application/x-www-form-urlencoded',
    };
    if (tenantCode) {
      refreshHeaders['__tenant'] = tenantCode;
    }

    fetch('/connect/token', {
      method: 'POST',
      headers: refreshHeaders,
      body: params.toString(),
    })
      .then((res) => {
        if (!res.ok) throw new Error('Refresh failed');
        return res.json();
      })
      .then((json) => {
        setAccessToken(json.access_token as string);
        if (json.refresh_token) {
          sessionStorage.setItem('edms_refresh_token', json.refresh_token as string);
        }
      })
      .catch(() => {
        // Refresh failed — force re-login
        setUser(null);
        sessionStorage.removeItem('edms_refresh_token');
        localStorage.removeItem('edms_user');
      })
      .finally(() => setIsLoading(false));
  }, []);

  const login = (userData: AuthenticatedUser) => {
    setUser(userData);
    localStorage.setItem('edms_user', JSON.stringify(userData));
  };

  const logout = () => {
    setUser(null);
    setAccessToken(null);
    sessionStorage.removeItem('edms_refresh_token');
    localStorage.removeItem('edms_user');
  };

  const hasRole = (role: Role) => {
    return user?.role === role;
  };

  const hasPermission = (permission: Permission) => {
    // Le rôle Admin a toujours toutes les permissions par défaut (Super User)
    if (user?.role === Role.ADMIN) return true;
    
    return user?.permissions.includes(permission) ?? false;
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout, hasRole, hasPermission }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
