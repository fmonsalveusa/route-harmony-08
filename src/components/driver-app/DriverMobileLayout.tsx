import { ReactNode, useState, useRef, useEffect, useCallback } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Package, DollarSign, User, LogOut, MapPin, Bell, CheckCheck, Navigation, MapPinCheck, X } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useDriverTracking } from '@/contexts/DriverTrackingContext';
import { supabase } from '@/integrations/supabase/client';
import { formatDistanceToNow } from 'date-fns';
import { Button } from '@/components/ui/button';
import logoImg from '@/assets/logo.png';

const tabs = [
  { label: 'Home', icon: LayoutDashboard, path: '/driver' },
  { label: 'Loads', icon: Package, path: '/driver/loads' },
  { label: 'Tracking', icon: MapPin, path: '/driver/tracking' },
  { label: 'Payments', icon: DollarSign, path: '/driver/payments' },
  { label: 'Profile', icon: User, path: '/driver/profile' },
];

const typeIcons: Record<string, string> = {
  load_assigned: '📦',
  driver_arrived: '📍',
  pod_uploaded: '📄',
  status_changed: '🚚',
};

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  load_id: string | null;
  driver_id: string | null;
  is_read: boolean;
  created_at: string;
}

export const DriverMobileLayout = ({ children }: { children: ReactNode }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut, profile } = useAuth();
  const { tracking, nearbyStop, confirmArrival, dismissArrival } = useDriverTracking();
  const [bellOpen, setBellOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [driverId, setDriverId] = useState<string | null>(null);

  // Fetch driver id from email
  useEffect(() => {
    if (!profile?.email) return;
    supabase.from('drivers').select('id').eq('email', profile.email).maybeSingle().then(({ data }) => {
      if (data) setDriverId(data.id);
    });
  }, [profile?.email]);

  const fetchNotifications = useCallback(async (dId: string) => {
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('driver_id', dId)
      .order('created_at', { ascending: false })
      .limit(50);
    if (data) {
      setNotifications(data as any);
      setUnreadCount((data as any).filter((n: any) => !n.is_read).length);
    }
  }, []);

  useEffect(() => {
    if (!driverId) return;
    fetchNotifications(driverId);

    const channel = supabase
      .channel(`driver-notifications-${driverId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, (payload) => {
        const n = payload.new as any;
        if (n.driver_id !== driverId) return;
        setNotifications(prev => [n, ...prev].slice(0, 50));
        setUnreadCount(prev => prev + 1);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [driverId, fetchNotifications]);

  const markAsRead = useCallback(async (id: string) => {
    await supabase.from('notifications').update({ is_read: true } as any).eq('id', id);
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
    setUnreadCount(prev => Math.max(0, prev - 1));
  }, []);

  const markAllAsRead = useCallback(async () => {
    const unreadIds = notifications.filter(n => !n.is_read).map(n => n.id);
    if (unreadIds.length === 0) return;
    await supabase.from('notifications').update({ is_read: true } as any).in('id', unreadIds);
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    setUnreadCount(0);
  }, [notifications]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setBellOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleNotificationClick = (n: any) => {
    markAsRead(n.id);
    if (n.load_id) navigate(`/driver/loads/${n.load_id}`);
    setBellOpen(false);
  };

  const handleConfirmArrival = async () => {
    if (!nearbyStop || confirming) return;
    setConfirming(true);
    await confirmArrival(nearbyStop.id);
    setConfirming(false);
  };

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header */}
      <header className="flex items-center justify-between h-16 px-4 border-b bg-card shadow-sm">
        <div className="flex items-center gap-2">
          <img src={logoImg} alt="Logo" className="h-8 w-8 rounded" />
          <span className="text-base font-bold text-foreground">Load Up Driver</span>
        </div>
        <div className="flex items-center gap-2">
          {/* GPS Tracking Indicator */}
          {tracking && (
            <Link to="/driver/tracking" className="flex items-center gap-1 px-2 py-1 rounded-full bg-success/15 text-success text-xs font-semibold animate-pulse">
              <Navigation className="h-3.5 w-3.5" />
              GPS
            </Link>
          )}
          <div className="relative" ref={panelRef}>
            <button onClick={() => setBellOpen(!bellOpen)} className="relative p-2 rounded-md text-muted-foreground hover:bg-muted">
              <Bell className="h-6 w-6" />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground animate-pulse">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>
            {bellOpen && (
              <div className="absolute right-0 top-full mt-2 w-80 max-h-96 overflow-y-auto rounded-lg border bg-card shadow-lg z-50">
                <div className="flex items-center justify-between p-3 border-b">
                  <h3 className="text-sm font-semibold">Notifications</h3>
                  {unreadCount > 0 && (
                    <button onClick={markAllAsRead} className="text-xs text-primary flex items-center gap-1">
                      <CheckCheck className="h-3.5 w-3.5" /> Mark all read
                    </button>
                  )}
                </div>
                {notifications.length === 0 ? (
                  <div className="p-6 text-center text-sm text-muted-foreground">No notifications</div>
                ) : (
                  <div className="divide-y">
                    {notifications.slice(0, 20).map(n => (
                      <button key={n.id} onClick={() => handleNotificationClick(n)}
                        className={`w-full text-left p-3 hover:bg-muted/50 transition-colors ${!n.is_read ? 'bg-primary/5' : ''}`}>
                        <div className="flex gap-2">
                          <span className="text-lg">{typeIcons[n.type] || '📢'}</span>
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm ${!n.is_read ? 'font-semibold' : ''}`}>{n.title}</p>
                            <p className="text-xs text-muted-foreground truncate">{n.message}</p>
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
          <button onClick={signOut} className="p-2 rounded-md text-muted-foreground hover:bg-muted">
            <LogOut className="h-5 w-5" />
          </button>
        </div>
      </header>

      {/* Geofence Arrival Banner */}
      {nearbyStop && (
        <div className="mx-3 mt-2 p-3 rounded-lg border border-primary/30 bg-primary/5 shadow-md animate-in slide-in-from-top-2">
          <div className="flex items-start gap-2">
            <MapPinCheck className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground">
                {nearbyStop.stop_type === 'pickup' ? '📦 Near Pickup' : '🏁 Near Delivery'}
              </p>
              <p className="text-sm text-muted-foreground truncate mt-0.5">{nearbyStop.address}</p>
              <div className="flex gap-2 mt-2">
                <Button size="sm" className="h-7 text-xs" onClick={handleConfirmArrival} disabled={confirming}>
                  <MapPinCheck className="h-3.5 w-3.5 mr-1" />
                  {confirming ? 'Marking...' : 'Mark Arrival'}
                </Button>
                <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={dismissArrival}>
                  <X className="h-3.5 w-3.5 mr-1" />
                  Ignore
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>

      {/* Bottom Tab Bar */}
      <nav className="flex items-center justify-around h-[72px] border-t bg-card shadow-[0_-2px_10px_rgba(0,0,0,0.05)] safe-area-pb">
        {tabs.map(tab => {
          const active = location.pathname === tab.path || (tab.path !== '/driver' && location.pathname.startsWith(tab.path));
          return (
            <Link
              key={tab.path}
              to={tab.path}
              className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg transition-colors ${
                active ? 'text-primary' : 'text-muted-foreground'
              }`}
            >
              <tab.icon className={`h-6 w-6 ${active ? 'text-primary' : ''}`} />
              <span className="text-xs font-medium">{tab.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
};
