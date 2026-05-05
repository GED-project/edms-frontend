import React, { createContext, useContext, useState, useEffect } from 'react';
import { Role, Permission, AuthenticatedUser } from '@/lib/auth-rbac/roles';

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
    // Simulate checking for stored session
    const storedUser = localStorage.getItem('edms_user');
    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser));
      } catch (e) {
        console.error('Failed to parse stored user', e);
      }
    }
    setIsLoading(false);
  }, []);

  const login = (userData: AuthenticatedUser) => {
    setUser(userData);
    localStorage.setItem('edms_user', JSON.stringify(userData));
  };

  const logout = () => {
    setUser(null);
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
