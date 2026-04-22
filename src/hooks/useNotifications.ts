import { useEffect, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { getTenantId } from '@/hooks/useTenantId';

export interface Notification {
  id: string;
  tenant_id: string;
  type: string;
  title: string;
  message: string;
  load_id: string | null;
  driver_id: string | null;
  is_read: boolean;
  created_at: string;
}

const NOTIFICATIONS_QUERY_KEY = ['notifications'];

async function fetchNotificationsFromDb(): Promise<Notification[]> {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) throw error;
  return (data as Notification[]) ?? [];
}

export function useNotifications() {
  const queryClient = useQueryClient();

  const { data: notifications = [] } = useQuery({
    queryKey: NOTIFICATIONS_QUERY_KEY,
    queryFn: fetchNotificationsFromDb,
  });

  const unreadCount = notifications.filter(n => !n.is_read).length;

  // Reproduce un chime suave usando el Web Audio API (sin archivos externos)
  const playNotificationSound = useCallback(() => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const play = (freq: number, startAt: number, duration: number) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, ctx.currentTime + startAt);
        gain.gain.setValueAtTime(0, ctx.currentTime + startAt);
        gain.gain.linearRampToValueAtTime(0.3, ctx.currentTime + startAt + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + startAt + duration);
        osc.start(ctx.currentTime + startAt);
        osc.stop(ctx.currentTime + startAt + duration);
      };
      play(880, 0, 0.25);   // La5 — primer tono
      play(1100, 0.2, 0.3); // Do#6 — segundo tono
    } catch {
      // Si el navegador bloquea el audio, no hace nada
    }
  }, []);

  // Real-time: agrega notificaciones nuevas al caché directamente
  // Channel name único para evitar conflictos si el hook se monta en varios lugares
  useEffect(() => {
    const channelName = `notifications-realtime-${Math.random().toString(36).slice(2)}`;
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications' },
        (payload) => {
          const newNotification = payload.new as Notification;
          queryClient.setQueryData<Notification[]>(NOTIFICATIONS_QUERY_KEY, (old = []) =>
            [newNotification, ...old].slice(0, 50)
          );
          playNotificationSound();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient, playNotificationSound]);

  const markAsRead = useCallback(async (id: string) => {
    await supabase.from('notifications').update({ is_read: true } as any).eq('id', id);
    queryClient.setQueryData<Notification[]>(NOTIFICATIONS_QUERY_KEY, (old = []) =>
      old.map(n => n.id === id ? { ...n, is_read: true } : n)
    );
  }, [queryClient]);

  const markAllAsRead = useCallback(async () => {
    const unreadIds = notifications.filter(n => !n.is_read).map(n => n.id);
    if (unreadIds.length === 0) return;
    await supabase.from('notifications').update({ is_read: true } as any).in('id', unreadIds);
    queryClient.setQueryData<Notification[]>(NOTIFICATIONS_QUERY_KEY, (old = []) =>
      old.map(n => ({ ...n, is_read: true }))
    );
  }, [notifications, queryClient]);

  const refetch = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_QUERY_KEY });
  }, [queryClient]);

  return { notifications, unreadCount, markAsRead, markAllAsRead, refetch };
}

export async function createNotification(params: {
  type: string;
  title: string;
  message: string;
  load_id?: string;
  driver_id?: string;
}) {
  const tenant_id = await getTenantId();
  await supabase.from('notifications').insert({
    tenant_id,
    type: params.type,
    title: params.title,
    message: params.message,
    load_id: params.load_id || null,
    driver_id: params.driver_id || null,
  } as any);
}
