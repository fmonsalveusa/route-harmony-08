import { ReactNode, useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Home, Package, Wallet, User, Bell, CheckCheck, MapPinCheck, X, LogOut } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useDriverTracking } from '@/contexts/DriverTrackingContext';
import { supabase } from '@/integrations/supabase/client';
import { formatDistanceToNow } from 'date-fns';
import logoImg from '@/assets/logo.png';
import { isNativePlatform } from '@/lib/nativeTracking';
import { initPushNotifications } from '@/lib/nativePushNotifications';
import { GpsPermissionBanner } from '@/components/driver-app/GpsPermissionBanner';
import { LocationDisclosureDialog } from '@/components/driver-app/LocationDisclosureDialog';
import { useTheme } from 'next-themes';

// GPS sale de la barra inferior: se abre con el chip "GPS" de la barra superior
const allTabs = [
  { label: 'Home', icon: Home, path: '/driver', roles: ['driver', 'investor'] },
  { label: 'Loads', icon: Package, path: '/driver/loads', roles: ['driver', 'investor'] },
  { label: 'Payments', icon: Wallet, path: '/driver/payments', roles: ['driver', 'investor'] },
  { label: 'Profile', icon: User, path: '/driver/profile', roles: ['driver'] },
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
  const { signOut, profile, role } = useAuth();
  const { tracking, nearbyStop, confirmArrival, dismissArrival } = useDriverTracking();
  const isInvestorOnly = role === 'investor';
  const tabs = useMemo(() => allTabs.filter(t => t.roles.includes(role || 'driver')), [role]);
  const { resolvedTheme, setTheme } = useTheme();

  // Forzar Light mode en la app móvil siempre
  useEffect(() => {
    setTheme('light');
  }, [setTheme]);
  const [bellOpen, setBellOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
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
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
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

  // Configure native status bar + lifecycle when running in Capacitor
  useEffect(() => {
    if (!isNativePlatform()) return;

    // Status bar styling synced with theme — fully defensive
    try {
      import('@capacitor/status-bar').then(({ StatusBar, Style }) => {
        try {
          const isDark = resolvedTheme === 'dark';
          StatusBar.setStyle({ style: isDark ? Style.Dark : Style.Light }).catch(() => {});
          StatusBar.setBackgroundColor({ color: isDark ? '#0f172a' : '#f8fafd' }).catch(() => {});
        } catch { /* ignore */ }
      }).catch(() => {});
    } catch { /* ignore */ }

    // App lifecycle — re-sync GPS on foreground
    try {
      import('@capacitor/app').then(({ App }) => {
        const listener = App.addListener('appStateChange', ({ isActive }) => {
          if (isActive && tracking) {
            // GPS re-sync is handled by DriverTrackingContext's native plugin
          }
        });
        return () => { listener.then(l => l.remove()); };
      }).catch(() => {});
    } catch { /* ignore */ }
  }, [tracking, resolvedTheme]);

  // Initialize push notifications for native app
  useEffect(() => {
    if (driverId) {
      initPushNotifications(driverId);
    }
  }, [driverId]);

  const isAndroid = /android/i.test(navigator.userAgent);
  const initials = (profile?.full_name || profile?.email || '?')
    .split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]?.toUpperCase()).join('');

  return (
    <div className={`flex flex-col h-[100dvh] bg-[#f8fafd] text-[#1f1f1f] ${isAndroid ? 'android-driver-app' : ''}`}>
      {/* Barra superior estilo Google: logo + app, GPS, notificaciones, avatar (cerrar sesión) */}
      <header className="flex items-center justify-between min-h-[64px] px-3 py-2 bg-[#f8fafd]" style={{ paddingTop: 'max(env(safe-area-inset-top, 0px), 8px)' }}>
        <div className="flex items-center gap-3 min-w-0">
          <img src={logoImg} alt="" className="h-9 w-9 rounded-full" />
          <div className="min-w-0 leading-tight">
            <p className="text-[18px] font-normal truncate">Dispatch Up</p>
            <p className="text-xs text-[#444746] truncate">{isInvestorOnly ? 'Investor' : profile?.full_name || 'Driver'}</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {!isInvestorOnly && (
            <Link
              to="/driver/tracking"
              className={`flex items-center gap-1.5 h-8 pl-2.5 pr-3 rounded-full text-xs font-medium ${tracking ? 'bg-[#c4eed0] text-[#0d652d]' : 'bg-[#e9eef6] text-[#444746]'}`}
            >
              <span className={`h-2 w-2 rounded-full ${tracking ? 'bg-[#1e8e3e] animate-pulse' : 'bg-[#9aa0a6]'}`} />
              GPS
            </Link>
          )}
          <div className="relative" ref={panelRef}>
            <button onClick={() => setBellOpen(!bellOpen)} aria-label="Notifications" className="relative h-11 w-11 flex items-center justify-center rounded-full text-[#444746] active:bg-[#e9eef6] transition-colors">
              <Bell className="h-6 w-6" />
              {unreadCount > 0 && (
                <span className="absolute top-1.5 right-1.5 flex h-4 min-w-4 px-1 items-center justify-center rounded-full bg-[#b3261e] text-[10px] font-bold text-white">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>
            {bellOpen && (
              <div className="absolute right-0 top-full mt-2 w-80 max-w-[calc(100vw-24px)] max-h-96 overflow-y-auto rounded-3xl bg-white shadow-[0_4px_16px_rgba(0,0,0,0.16)] z-50">
                <div className="flex items-center justify-between px-4 py-3">
                  <h3 className="text-base font-normal">Notifications</h3>
                  {unreadCount > 0 && (
                    <button onClick={markAllAsRead} className="text-xs font-medium text-[#0b57d0] flex items-center gap-1">
                      <CheckCheck className="h-3.5 w-3.5" /> Mark all read
                    </button>
                  )}
                </div>
                {notifications.length === 0 ? (
                  <div className="p-6 text-center text-sm text-[#444746]">No notifications</div>
                ) : (
                  <div className="pb-2">
                    {notifications.slice(0, 20).map(n => (
                      <button key={n.id} onClick={() => handleNotificationClick(n)}
                        className={`w-full text-left px-4 py-3 active:bg-[#e9eef6] transition-colors ${!n.is_read ? 'bg-[#eef3fd]' : ''}`}>
                        <div className="flex gap-3">
                          <span className="text-lg">{typeIcons[n.type] || '📢'}</span>
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm ${!n.is_read ? 'font-medium' : ''}`}>{n.title}</p>
                            <p className="text-xs text-[#444746] truncate">{n.message}</p>
                            <p className="text-[10px] text-[#747775] mt-0.5">
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
          <div className="relative" ref={menuRef}>
            <button onClick={() => setMenuOpen(o => !o)} aria-label="Account" className="h-11 w-11 flex items-center justify-center rounded-full active:bg-[#e9eef6] transition-colors">
              <span className="h-8 w-8 rounded-full bg-[#0b57d0] text-white text-xs font-medium flex items-center justify-center">{initials}</span>
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-full mt-2 w-64 rounded-3xl bg-white shadow-[0_4px_16px_rgba(0,0,0,0.16)] z-50 p-2">
                <div className="px-3 py-2">
                  <p className="text-sm font-medium truncate">{profile?.full_name}</p>
                  <p className="text-xs text-[#444746] truncate">{profile?.email}</p>
                </div>
                <button onClick={signOut} className="w-full flex items-center gap-3 px-3 h-11 rounded-full text-sm text-[#1f1f1f] active:bg-[#e9eef6]">
                  <LogOut className="h-5 w-5 text-[#444746]" /> Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* GPS background permission — sin esto el tracking muere al cerrar la app */}
      {!isInvestorOnly && <GpsPermissionBanner driverId={driverId} />}
      {!isInvestorOnly && <LocationDisclosureDialog />}

      {/* Geofence Arrival Banner */}
      {nearbyStop && (
        <div className="mx-3 mt-2 p-4 rounded-3xl bg-[#d3e3fd] text-[#041e49] shadow-sm animate-in slide-in-from-top-2">
          <div className="flex items-start gap-3">
            <MapPinCheck className="h-6 w-6 mt-0.5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-base font-medium">
                {nearbyStop.stop_type === 'pickup' ? 'You are near the pickup' : 'You are near the delivery'}
              </p>
              <p className="text-sm opacity-80 truncate mt-0.5">{nearbyStop.address}</p>
              <div className="flex gap-2 mt-3">
                <button className="h-10 px-5 rounded-full bg-[#0b57d0] text-white text-sm font-medium flex items-center gap-1.5 disabled:opacity-60" onClick={handleConfirmArrival} disabled={confirming}>
                  <MapPinCheck className="h-4 w-4" />
                  {confirming ? 'Marking...' : 'Mark Arrival'}
                </button>
                <button className="h-10 px-4 rounded-full text-[#0b57d0] text-sm font-medium flex items-center gap-1" onClick={dismissArrival}>
                  <X className="h-4 w-4" />
                  Ignore
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>

      {/* Barra inferior Material 3: pastilla en la pestaña activa */}
      <nav className="flex items-stretch justify-around bg-[#f0f4f9] safe-area-pb pt-3 pb-2">
        {tabs.map(tab => {
          const active = location.pathname === tab.path || (tab.path !== '/driver' && location.pathname.startsWith(tab.path));
          return (
            <Link key={tab.path} to={tab.path} className="flex-1 flex flex-col items-center gap-1 min-w-0">
              <span className={`flex items-center justify-center h-8 w-16 rounded-full transition-colors duration-200 ${active ? 'bg-[#d3e3fd] text-[#041e49]' : 'text-[#444746]'}`}>
                <tab.icon className="h-6 w-6" strokeWidth={active ? 2.25 : 1.75} />
              </span>
              <span className={`text-xs ${active ? 'font-semibold text-[#1f1f1f]' : 'font-medium text-[#444746]'}`}>{tab.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
};
