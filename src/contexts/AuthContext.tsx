import React, { createContext, useContext, useState, ReactNode } from 'react';
import { User, UserRole } from '@/types';
import { mockUsers } from '@/data/mockData';

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => boolean;
  logout: () => void;
  hasPermission: (permission: string) => boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

const rolePermissions: Record<UserRole, string[]> = {
  admin: [
    'dashboard.full', 'loads.*', 'fleet.*', 'drivers.*', 'dispatchers.*',
    'payments.drivers', 'payments.investors', 'payments.dispatchers',
    'invoices.*', 'reports.full', 'users.*', 'tracking.*', 'settings.*',
  ],
  accounting: [
    'dashboard.full', 'loads.view', 'loads.edit',
    'payments.drivers', 'payments.investors', 'payments.dispatchers',
    'invoices.*', 'reports.full', 'dispatchers.view', 'drivers.view', 'fleet.view', 'tracking.*',
  ],
  dispatcher: [
    'dashboard.own', 'loads.create', 'loads.edit.own', 'loads.view.own',
    'drivers.view.own', 'fleet.view', 'tracking.*', 'reports.own',
  ],
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);

  const login = (email: string, _password: string) => {
    const found = mockUsers.find(u => u.email === email);
    if (found) {
      setUser(found);
      return true;
    }
    return false;
  };

  const logout = () => setUser(null);

  const hasPermission = (permission: string) => {
    if (!user) return false;
    const perms = rolePermissions[user.role];
    return perms.some(p => {
      if (p === permission) return true;
      if (p.endsWith('.*') && permission.startsWith(p.replace('.*', ''))) return true;
      if (p.endsWith('*') && permission.startsWith(p.replace('*', ''))) return true;
      return false;
    });
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, hasPermission }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
