import { useState, useRef, useEffect } from 'react';
import { Bell, BellRing, BellOff, CheckCheck, MapPin, Camera, Truck, Package, UserPlus, Wrench, Mail, MailWarning, FileSignature } from 'lucide-react';
import { useNotifications } from '@/hooks/useNotifications';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatDistanceToNow } from 'date-fns';
import { useNavigate } from 'react-router-dom';

const typeIcons: Record<string, typeof Bell> = {
  driver_arrived: MapPin,
  pod_uploaded: Camera,
  status_changed: Truck,
  load_assigned: Package,
  new_driver_onboarded: UserPlus,
  maintenance: Wrench,
  broker_email_sent: Mail,
  broker_email_failed: MailWarning,
  broker_email_thread: MailWarning,
  document_signed: FileSignature,
};

const typeColors: Record<string, string> = {
  driver_arrived: 'text-[#266aad]',
  pod_uploaded: 'text-emerald-500',
  status_changed: 'text-amber-500',
  load_assigned: 'text-violet-500',
  new_driver_onboarded: 'text-green-500',
  maintenance: 'text-orange-500',
  broker_email_sent: 'text-emerald-600',
  broker_email_failed: 'text-red-500',
  broker_email_thread: 'text-amber-500',
  document_signed: 'text-[#266aad]',
};

/** 'default' = nunca se aceptaron, 'denied' = bloqueadas en el navegador */
const browserPermission = (): NotificationPermission | 'unsupported' =>
  typeof Notification === 'undefined' ? 'unsupported' : Notification.permission;

export const NotificationBell = () => {
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();
  const [open, setOpen] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>(browserPermission);
  const panelRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  // Pedir el permiso desde un clic: así el navegador sí muestra el cartel
  const enableBrowserNotifications = async () => {
    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      if (result === 'granted') {
        new Notification('Notificaciones activadas', { body: 'Te avisaremos aquí aunque estés en otra pestaña.' });
      }
    } catch {
      setPermission(browserPermission());
    }
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleNotificationClick = (n: any) => {
    markAsRead(n.id);
    if (n.load_id) {
      navigate(`/loads`);
    }
    setOpen(false);
  };

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2 rounded-md text-white hover:bg-white/20 transition-colors"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground animate-pulse">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 max-h-96 overflow-y-auto rounded-lg border bg-card shadow-lg z-50">
          <div className="flex items-center justify-between p-3 border-b">
            <h3 className="text-sm font-semibold text-foreground">Notifications</h3>
            {unreadCount > 0 && (
              <Button variant="ghost" size="sm" className="text-xs gap-1 h-7" onClick={markAllAsRead}>
                <CheckCheck className="h-3.5 w-3.5" /> Mark all read
              </Button>
            )}
          </div>

          {permission === 'default' && (
            <button
              type="button"
              onClick={enableBrowserNotifications}
              className="w-full flex items-center gap-2 px-3 py-2 border-b bg-primary/5 text-left hover:bg-primary/10 transition-colors"
            >
              <BellRing className="h-4 w-4 text-primary flex-shrink-0" />
              <span className="text-xs text-foreground">
                <span className="font-semibold">Activar notificaciones</span>
                <span className="block text-muted-foreground">Recíbelas aunque estés en otra pestaña</span>
              </span>
            </button>
          )}
          {permission === 'denied' && (
            <div className="flex items-start gap-2 px-3 py-2 border-b bg-amber-50 dark:bg-amber-950/30">
              <BellOff className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <p className="text-[11px] text-amber-800 dark:text-amber-200">
                Las notificaciones están bloqueadas en este navegador. Actívalas desde el ícono
                a la izquierda de la dirección web y recarga la página.
              </p>
            </div>
          )}

          {notifications.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">No notifications yet</div>
          ) : (
            <div className="divide-y">
              {notifications.slice(0, 20).map(n => (
                <button
                  key={n.id}
                  onClick={() => handleNotificationClick(n)}
                  className={`w-full text-left p-3 hover:bg-muted/50 transition-colors ${!n.is_read ? 'bg-primary/5' : ''}`}
                >
                  <div className="flex gap-2">
                    {(() => { const Icon = typeIcons[n.type] || Bell; const color = typeColors[n.type] || 'text-muted-foreground'; return <Icon className={`h-4 w-4 mt-0.5 flex-shrink-0 ${color}`} />; })()}
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm text-foreground ${!n.is_read ? 'font-semibold' : ''}`}>{n.title}</p>
                      <p className="text-xs text-muted-foreground line-clamp-3">{n.message}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                      </p>
                    </div>
                    {!n.is_read && <div className="w-2 h-2 rounded-full bg-primary mt-1.5 flex-shrink-0" />}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
