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
        className="relative p-2 rounded-full text-[#444746] hover:bg-[#e1e6ee] dark:text-white dark:hover:bg-white/10 transition-colors"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-[16px] px-1 items-center justify-center rounded-full bg-[#d93025] text-[10px] font-medium text-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-[360px] max-h-[480px] overflow-y-auto rounded-[28px] bg-white dark:bg-card border border-[#e3e3e3] dark:border-border shadow-[0_1px_3px_rgba(60,64,67,.3),0_4px_8px_3px_rgba(60,64,67,.15)] z-50">
          <div className="sticky top-0 z-10 flex items-center justify-between px-5 pt-4 pb-3 bg-white dark:bg-card">
            <h3 className="text-[18px] font-normal text-[#1f1f1f] dark:text-foreground">Notifications</h3>
            {unreadCount > 0 && (
              <Button variant="ghost" size="sm" className="text-xs gap-1 h-8 rounded-full px-3 font-medium text-[#0b57d0] hover:text-[#0b57d0] hover:bg-[#e8f0fe] dark:text-blue-300" onClick={markAllAsRead}>
                <CheckCheck className="h-3.5 w-3.5" /> Mark all read
              </Button>
            )}
          </div>

          {permission === 'default' && (
            <button
              type="button"
              onClick={enableBrowserNotifications}
              className="mx-3 mb-2 w-[calc(100%-1.5rem)] flex items-center gap-2 px-3 py-2 rounded-2xl bg-[#e8f0fe] dark:bg-blue-950/40 text-left hover:bg-[#d3e3fd] transition-colors"
            >
              <BellRing className="h-4 w-4 text-primary flex-shrink-0" />
              <span className="text-xs text-foreground">
                <span className="font-semibold">Activar notificaciones</span>
                <span className="block text-muted-foreground">Recíbelas aunque estés en otra pestaña</span>
              </span>
            </button>
          )}
          {permission === 'denied' && (
            <div className="mx-3 mb-2 flex items-start gap-2 px-3 py-2 rounded-2xl bg-[#fef7e0] dark:bg-amber-950/30">
              <BellOff className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <p className="text-[11px] text-amber-800 dark:text-amber-200">
                Las notificaciones están bloqueadas en este navegador. Actívalas desde el ícono
                a la izquierda de la dirección web y recarga la página.
              </p>
            </div>
          )}

          {notifications.length === 0 ? (
            <div className="p-8 text-center text-sm text-[#444746] dark:text-muted-foreground">No notifications yet</div>
          ) : (
            <div className="px-2 pb-2 space-y-0.5">
              {notifications.slice(0, 20).map(n => (
                <button
                  key={n.id}
                  onClick={() => handleNotificationClick(n)}
                  className={`w-full text-left px-3 py-2.5 rounded-2xl hover:bg-[#f0f4f9] dark:hover:bg-muted/50 transition-colors ${!n.is_read ? 'bg-[#f3f6fc] dark:bg-blue-950/20' : ''}`}
                >
                  <div className="flex gap-2">
                    {(() => { const Icon = typeIcons[n.type] || Bell; const color = typeColors[n.type] || 'text-muted-foreground'; return <Icon className={`h-4 w-4 mt-0.5 flex-shrink-0 ${color}`} />; })()}
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm text-[#1f1f1f] dark:text-foreground ${!n.is_read ? 'font-medium' : ''}`}>{n.title}</p>
                      <p className="text-xs text-muted-foreground line-clamp-3">{n.message}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                      </p>
                    </div>
                    {!n.is_read && <div className="w-2 h-2 rounded-full bg-[#0b57d0] mt-1.5 flex-shrink-0" />}
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
