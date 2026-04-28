import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import { X, MapPin, Camera, Truck, Bell, UserPlus, Wrench, Package } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface LiveToast {
  id: string;
  type: string;
  title: string;
  message: string;
  load_id: string | null;
  created_at: string;
}

const typeIcons: Record<string, typeof Bell> = {
  driver_arrived: MapPin,
  pod_uploaded: Camera,
  status_changed: Truck,
  status_change: Truck,
  load_assigned: Package,
  new_driver_onboarded: UserPlus,
  maintenance: Wrench,
};

const typeColors: Record<string, string> = {
  driver_arrived: 'text-[#266aad]',
  pod_uploaded: 'text-emerald-500',
  status_changed: 'text-amber-500',
  status_change: 'text-amber-500',
  load_assigned: 'text-violet-500',
  new_driver_onboarded: 'text-green-500',
  maintenance: 'text-orange-500',
};

// Request browser notification permission on mount
function requestNotificationPermission() {
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
  }
}

function showBrowserNotification(title: string, body: string) {
  if ('Notification' in window && Notification.permission === 'granted') {
    try {
      new Notification(title, { body, icon: '/pwa-icon.png' });
    } catch {
      // Silent fail for environments that don't support Notification constructor
    }
  }
}

export function LiveNotificationToasts() {
  const [toasts, setToasts] = useState<LiveToast[]>([]);
  const { profile, role, isMasterAdmin } = useAuth();
  const isAdmin = role === 'admin' || isMasterAdmin;
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Debounce timer for invalidateQueries — coalesces bursts of notifications
  // (e.g. driver_arrived + pod_uploaded at the same time) into a single refetch.
  const invalidateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    requestNotificationPermission();
  }, []);

  useEffect(() => {
    if (!profile?.tenant_id) return;

    const channel = supabase
      .channel('live-toasts')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications' },
        (payload) => {
          const n = payload.new as any;
          if (n.tenant_id !== profile.tenant_id) return;

          // Notificaciones de onboarding solo para administradores
          if (n.type === 'new_driver_onboarded' && !isAdmin) return;

          const toast: LiveToast = {
            id: n.id,
            type: n.type,
            title: n.title,
            message: n.message,
            load_id: n.load_id,
            created_at: n.created_at,
          };

          setToasts((prev) => [toast, ...prev].slice(0, 5));

          // Refresh loads data when a status change or driver action notification arrives.
          // Debounced: if multiple notifications arrive in quick succession,
          // only one invalidateQueries call is made after the burst settles.
          if (['status_changed', 'driver_arrived', 'pod_uploaded'].includes(n.type)) {
            if (invalidateTimerRef.current) clearTimeout(invalidateTimerRef.current);
            invalidateTimerRef.current = setTimeout(() => {
              queryClient.invalidateQueries({ queryKey: ['loads'] });
              invalidateTimerRef.current = null;
            }, 1500);
          }

          // Browser push notification para maintenance y nuevo onboarding (solo admin)
          if (n.type === 'maintenance' || (n.type === 'new_driver_onboarded' && isAdmin)) {
            showBrowserNotification(n.title, n.message);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      if (invalidateTimerRef.current) clearTimeout(invalidateTimerRef.current);
    };
  }, [profile?.tenant_id]);

  const dismiss = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

 const handleClick = async (toast: LiveToast) => {
  await supabase
    .from('notifications')
    .update({ is_read: true } as any)
    .eq('id', toast.id);
  dismiss(toast.id);
  if (toast.type === 'new_driver_onboarded') {
    navigate('/drivers');
  } else if (toast.type === 'maintenance') {
    navigate('/maintenance');
  } else if (toast.load_id) {
    // Navegar a loads con el load_id para abrir el detalle automáticamente
    navigate(`/loads?openLoad=${toast.load_id}`);
  } else {
    navigate('/loads');
  }
};

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[60] flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      <AnimatePresence mode="popLayout">
        {toasts.map((toast) => {
          const Icon = typeIcons[toast.type] || Bell;
          const color = typeColors[toast.type] || 'text-primary';

          return (
            <motion.div
              key={toast.id}
              layout
              initial={{ opacity: 0, x: 120, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 120, scale: 0.95 }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              className="pointer-events-auto cursor-pointer rounded-lg border bg-card shadow-lg hover:shadow-xl transition-shadow"
              onClick={() => handleClick(toast)}
            >
              <div className="flex items-start gap-3 p-3">
                <div className={`mt-0.5 flex-shrink-0 ${color}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground leading-tight">{toast.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-3">{toast.message}</p>
                  <p className="text-[10px] text-muted-foreground/60 mt-1">
                    {formatDistanceToNow(new Date(toast.created_at), { addSuffix: true })}
                  </p>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    dismiss(toast.id);
                  }}
                  className="flex-shrink-0 p-1 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
