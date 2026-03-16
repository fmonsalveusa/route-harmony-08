import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface SubscriptionInfo {
  current_plan: string;
  subscription_status: string;
  max_drivers: number;
  max_loads: number;
  trial_ends_at: string | null;
  subscription_ends_at: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
}

export interface SubscriptionDetails {
  plan: string;
  status: string;
  price_monthly: number;
  max_users: number;
  max_trucks: number;
}

const PLAN_LABELS: Record<string, string> = {
  basic: 'Basic',
  pro: 'Pro',
  enterprise: 'Enterprise',
  trial: 'Trial',
};

const PLAN_PRICES: Record<string, number> = {
  basic: 49,
  pro: 99,
  enterprise: 149,
};

export function useSubscription() {
  const { profile } = useAuth();
  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null);
  const [activeDriverCount, setActiveDriverCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchSubscription = useCallback(async () => {
    if (!profile?.tenant_id) return;

    const { data } = await supabase
      .from('tenants')
      .select('current_plan, subscription_status, max_drivers, max_loads, trial_ends_at, subscription_ends_at, stripe_customer_id, stripe_subscription_id')
      .eq('id', profile.tenant_id)
      .maybeSingle();

    if (data) setSubscription(data as any as SubscriptionInfo);

    // Count active drivers
    const { count } = await supabase
      .from('drivers')
      .select('*', { count: 'exact', head: true })
      .neq('status', 'inactive');

    setActiveDriverCount(count || 0);
    setLoading(false);
  }, [profile?.tenant_id]);

  useEffect(() => {
    fetchSubscription();

    if (!profile?.tenant_id) return;

    // Listen for realtime changes on this tenant's row
    const channel = supabase
      .channel(`tenant-sub-${profile.tenant_id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'tenants',
          filter: `id=eq.${profile.tenant_id}`,
        },
        () => {
          fetchSubscription();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchSubscription, profile?.tenant_id]);

  const canAddDriver = () => {
    if (!subscription) return true;
    if (subscription.max_drivers === -1) return true;
    return activeDriverCount < subscription.max_drivers;
  };

  const driversRemaining = () => {
    if (!subscription || subscription.max_drivers === -1) return Infinity;
    return Math.max(0, subscription.max_drivers - activeDriverCount);
  };

  const isTrialing = () => subscription?.subscription_status === 'trialing';
  const isActive = () => ['active', 'trialing'].includes(subscription?.subscription_status || '');
  const isSuspended = () => subscription?.subscription_status === 'suspended';
  const isCanceled = () => subscription?.subscription_status === 'canceled';

  const getPlanLabel = () => PLAN_LABELS[subscription?.current_plan || ''] || subscription?.current_plan || 'N/A';
  const getPlanPrice = () => PLAN_PRICES[subscription?.current_plan || ''] || 0;

  const openCustomerPortal = async () => {
    const { data, error } = await supabase.functions.invoke('customer-portal');
    if (error || !data?.url) {
      console.error('Portal error:', error, data);
      return null;
    }
    return data.url as string;
  };

  return {
    subscription,
    activeDriverCount,
    loading,
    canAddDriver,
    driversRemaining,
    isTrialing,
    isActive,
    isSuspended,
    isCanceled,
    getPlanLabel,
    getPlanPrice,
    openCustomerPortal,
    refetch: fetchSubscription,
  };
}
