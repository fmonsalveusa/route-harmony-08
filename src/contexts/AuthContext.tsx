import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { User, Session } from '@supabase/supabase-js';

export type AppRole = 'master_admin' | 'admin' | 'accounting' | 'dispatcher' | 'driver';

const isLovablePreview =
  typeof window !== 'undefined' &&
  (window.location.hostname.includes('lovableproject.com') ||
    window.location.hostname.includes('lovable.app') ||
    window.location.search.includes('__lovable_token'));

const PREVIEW_LOGIN_RELOAD_KEY = 'lovable_preview_login_reload_done';

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
    'invoices.*', 'reports.full', 'users.*', 'tracking.*', 'settings.*', 'companies.*', 'expenses.*', 'performance.*',
  ],
  accounting: [
    'dashboard.full', 'loads.view', 'loads.edit', 'loads.*',
    'payments.drivers', 'payments.investors', 'payments.dispatchers',
    'invoices.*', 'expenses.*', 'performance.*',
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
  const profileLoadedRef = React.useRef(false);

  // Failsafe: avoid permanent blank screen if auth initialization gets stuck
  useEffect(() => {
    const fallbackTimer = setTimeout(() => {
      setLoading((prev) => {
        if (!prev) return prev;
        console.warn('[AuthContext] Loading fallback triggered');
        return false;
      });
    }, 8000);

    return () => clearTimeout(fallbackTimer);
  }, []);

  const clearUserState = () => {
    profileLoadedRef.current = false;
    setProfile(null);
    setRole(null);
    setTenant(null);
    setSubscription(null);
  };

  const forcePreviewHardReloadAfterLogin = () => {
    if (!isLovablePreview) return false;

    try {
      if (sessionStorage.getItem(PREVIEW_LOGIN_RELOAD_KEY) === '1') return false;
      sessionStorage.setItem(PREVIEW_LOGIN_RELOAD_KEY, '1');

      const url = new URL(window.location.href);
      url.searchParams.set('__preview_nocache', String(Date.now()));
      window.location.replace(url.toString());
      return true;
    } catch (error) {
      console.warn('[AuthContext] Preview hard reload fallback:', error);
      window.location.reload();
      return true;
    }
  };

  const fetchUserData = async (userId: string, retries = 3): Promise<boolean> => {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        // Fetch profile
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .maybeSingle();

        if (profileError) throw profileError;

        // If auth user exists but profile does not, stop infinite "Connecting" loop
        if (!profileData) {
          console.error('[AuthContext] Profile not found for authenticated user');
          clearUserState();
          setUser(null);
          setSession(null);
          await supabase.auth.signOut();
          return false;
        }

        profileLoadedRef.current = true;
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

        return true; // success – exit loop
      } catch (err) {
        console.warn(`[AuthContext] fetchUserData attempt ${attempt}/${retries} failed:`, err);
        if (attempt < retries) {
          await new Promise(r => setTimeout(r, 2000 * attempt)); // backoff 2s, 4s
        } else {
          console.error('[AuthContext] All retry attempts exhausted');
        }
      }
    }

    // Hard fail fallback: avoid getting stuck on AppLayout "Connecting..."
    clearUserState();
    setUser(null);
    setSession(null);
    await supabase.auth.signOut();
    return false;
  };

  const refreshProfile = async () => {
    if (user) await fetchUserData(user.id);
  };

  useEffect(() => {
    let initialSessionHandled = false;

    const fetchWithTimeout = async (userId: string) => {
      const result = await Promise.race<boolean>([
        fetchUserData(userId),
        new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 10000)),
      ]);

      if (!result) {
        console.warn('[AuthContext] fetchWithTimeout expired, cleaning session');
        clearUserState();
        setUser(null);
        setSession(null);
        await supabase.auth.signOut();
      }

      return result;
    };

    // First, get the initial session synchronously
    supabase.auth.getSession().then(({ data: { session } }) => {
      initialSessionHandled = true;
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        if (forcePreviewHardReloadAfterLogin()) return;
        fetchWithTimeout(session.user.id).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    // Then listen for future auth changes (sign in, sign out, token refresh)
    const { data: { subscription: authSub } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('[AuthContext] onAuthStateChange event:', event);

      // Skip the initial INITIAL_SESSION event since we handle it above
      if (!initialSessionHandled && event === 'INITIAL_SESSION') {
        return;
      }

      // Token refresh and repeated SIGNED_IN (tab switch) should NOT reset loading
      // This prevents dialogs/forms from being unmounted when switching tabs
      if (event === 'TOKEN_REFRESHED') {
        setSession(session);
        return;
      }

      // If user is already signed in and we get another SIGNED_IN event
      // (happens when switching tabs), just update session silently
      if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
        if (event === 'SIGNED_IN' && session?.user && forcePreviewHardReloadAfterLogin()) {
          return;
        }

        setSession(session);
        setUser(session?.user ?? null);
        // Only fetch data if we haven't loaded a profile yet (first sign in)
        if (!profileLoadedRef.current && session?.user) {
          setLoading(true);
          setTimeout(() => {
            fetchWithTimeout(session.user.id).finally(() => setLoading(false));
          }, 0);
        }
        return;
      }

      // SIGNED_OUT or other events
      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user) {
        setLoading(true);
        setTimeout(() => {
          fetchWithTimeout(session.user.id).finally(() => setLoading(false));
        }, 0);
      } else {
        profileLoadedRef.current = false;
        setProfile(null);
        setRole(null);
        setTenant(null);
        setSubscription(null);
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
