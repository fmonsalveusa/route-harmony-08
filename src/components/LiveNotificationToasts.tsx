import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import { X, MapPin, Camera, Truck, Bell, UserPlus, Wrench } from 'lucide-react';
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
  status_change: Truck,
  new_driver_onboarded: UserPlus,
  maintenance: Wrench,
};

const typeColors: Record<string, string> = {
  driver_arrived: 'text-blue-500',
  pod_uploaded: 'text-emerald-500',
  status_change: 'text-amber-500',
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
  const { profile } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

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

          const toast: LiveToast = {
            id: n.id,
            type: n.type,
            title: n.title,
            message: n.message,
            load_id: n.load_id,
            created_at: n.created_at,
          };

          setToasts((prev) => [toast, ...prev].slice(0, 5));

          // Refresh loads data when a status change or driver action notification arrives
          if (['status_changed', 'driver_arrived', 'pod_uploaded'].includes(n.type)) {
            queryClient.invalidateQueries({ queryKey: ['loads'] });
          }

          // Browser push notification for maintenance alerts
          if (n.type === 'maintenance') {
            showBrowserNotification(n.title, n.message);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
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
    navigate(toast.type === 'new_driver_onboarded' ? '/drivers' : toast.type === 'maintenance' ? '/maintenance' : '/loads');
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
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{toast.message}</p>
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
