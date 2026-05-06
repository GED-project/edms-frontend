import React, { createContext, useContext, useState, useEffect } from 'react';
import { Role, Permission, AuthenticatedUser } from '@/lib/auth-rbac/roles';
import { setAccessToken } from '@/lib/api.client';

interface AuthContextType {
  user: AuthenticatedUser | null;
  isLoading: boolean;
  login: (userData: AuthenticatedUser) => void;
  logout: () => void;
  hasRole: (role: Role) => boolean;
  hasPermission: (permission: Permission) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

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
      setUser(JSON.parse(storedUser));
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

    fetch('/connect/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
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
