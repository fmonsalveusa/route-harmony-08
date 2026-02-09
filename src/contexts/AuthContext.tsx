import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { User, Session } from '@supabase/supabase-js';

export type AppRole = 'master_admin' | 'admin' | 'accounting' | 'dispatcher' | 'driver';

export interface Profile {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  avatar_url: string | null;
  tenant_id: string | null;
  is_master_admin: boolean;
  is_active: boolean;
}

export interface TenantInfo {
  id: string;
  name: string;
  logo_url: string | null;
  is_active: boolean;
}

export interface SubscriptionInfo {
  plan: string;
  status: string;
  max_users: number;
  max_trucks: number;
  price_monthly: number;
  next_payment_date: string;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  role: AppRole | null;
  tenant: TenantInfo | null;
  subscription: SubscriptionInfo | null;
  loading: boolean;
  isMasterAdmin: boolean;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  hasPermission: (permission: string) => boolean;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

const rolePermissions: Record<AppRole, string[]> = {
  master_admin: ['master.*'],
  admin: [
    'dashboard.full', 'loads.*', 'fleet.*', 'drivers.*', 'dispatchers.*',
    'payments.drivers', 'payments.investors', 'payments.dispatchers',
    'invoices.*', 'reports.full', 'users.*', 'tracking.*', 'settings.*', 'companies.*', 'expenses.*',
  ],
  accounting: [
    'dashboard.full', 'loads.view', 'loads.edit',
    'payments.drivers', 'payments.investors', 'payments.dispatchers',
    'invoices.*', 'reports.full', 'dispatchers.view', 'drivers.view', 'fleet.view', 'tracking.*', 'companies.*', 'expenses.*',
  ],
  dispatcher: [
    'dashboard.own', 'loads.create', 'loads.edit.own', 'loads.view.own',
    'drivers.view.own', 'fleet.view', 'tracking.*', 'reports.own',
  ],
  driver: ['dashboard.own', 'loads.view.own'],
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [tenant, setTenant] = useState<TenantInfo | null>(null);
  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUserData = async (userId: string) => {
    // Fetch profile
    const { data: profileData } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (!profileData) return;
    setProfile(profileData as Profile);

    // Fetch role
    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .maybeSingle();

    const userRole = (roleData?.role as AppRole) || (profileData.is_master_admin ? 'master_admin' : 'admin');
    setRole(userRole);

    // Fetch tenant info if user has a tenant
    if (profileData.tenant_id) {
      const { data: tenantData } = await supabase
        .from('tenants')
        .select('id, name, logo_url, is_active')
        .eq('id', profileData.tenant_id)
        .maybeSingle();

      if (tenantData) setTenant(tenantData as TenantInfo);

      // Fetch subscription
      const { data: subData } = await supabase
        .from('subscriptions')
        .select('plan, status, max_users, max_trucks, price_monthly, next_payment_date')
        .eq('tenant_id', profileData.tenant_id)
        .maybeSingle();

      if (subData) setSubscription(subData as SubscriptionInfo);
    }
  };

  const refreshProfile = async () => {
    if (user) await fetchUserData(user.id);
  };

  useEffect(() => {
    const { data: { subscription: authSub } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user) {
        setTimeout(() => {
          fetchUserData(session.user.id).finally(() => setLoading(false));
        }, 0);
      } else {
        setProfile(null);
        setRole(null);
        setTenant(null);
        setSubscription(null);
        setLoading(false);
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchUserData(session.user.id).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    return () => authSub.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  };

  const signUp = async (email: string, password: string, fullName: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/`,
        data: { full_name: fullName },
      },
    });
    return { error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const isMasterAdmin = profile?.is_master_admin === true || role === 'master_admin';

  const hasPermission = (permission: string) => {
    if (!role) return false;
    if (isMasterAdmin) return permission.startsWith('master') || true;
    const perms = rolePermissions[role] || [];
    return perms.some(p => {
      if (p === permission) return true;
      if (p.endsWith('.*') && permission.startsWith(p.replace('.*', ''))) return true;
      if (p.endsWith('*') && permission.startsWith(p.replace('*', ''))) return true;
      // Also match if a role permission starts with the requested permission (e.g. 'dashboard.full' matches 'dashboard')
      if (p.startsWith(permission + '.') || p.startsWith(permission + '*')) return true;
      return false;
    });
  };

  return (
    <AuthContext.Provider value={{
      user, session, profile, role, tenant, subscription, loading,
      isMasterAdmin, signIn, signUp, signOut, hasPermission, refreshProfile,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
