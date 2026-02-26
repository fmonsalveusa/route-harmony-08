import { ReactNode, useState, useEffect } from 'react';
import logoImg from '@/assets/logo.png';
import { useAuth } from '@/contexts/AuthContext';
import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Truck, Users, Package, MapPin, FileText,
  BarChart3, LogOut, DollarSign, UserCog,
  Headphones, Menu, Building2, Crown, CreditCard, Settings, Plus, Receipt, Trophy, Wrench, X } from
'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import { LoadFormDialog } from '@/components/LoadFormDialog';
import { useLoads } from '@/hooks/useLoads';
import { NotificationBell } from '@/components/NotificationBell';
import { LiveNotificationToasts } from '@/components/LiveNotificationToasts';
import { ThemeToggle } from '@/components/ThemeToggle';
import { supabase } from '@/integrations/supabase/client';

interface NavItem {
  label: string;
  icon: any;
  path: string;
  permission: string;
}

const tenantNavItems: NavItem[] = [
{ label: 'Dashboard', icon: LayoutDashboard, path: '/dashboard', permission: 'dashboard' },
{ label: 'Loads', icon: Package, path: '/loads', permission: 'loads' },
{ label: 'Tracking', icon: MapPin, path: '/tracking', permission: 'tracking' },
{ label: 'Fleet', icon: Truck, path: '/fleet', permission: 'fleet' },
{ label: 'Drivers', icon: Users, path: '/drivers', permission: 'drivers' },
{ label: 'Dispatchers', icon: Headphones, path: '/dispatchers', permission: 'dispatchers' },
{ label: 'Payments', icon: DollarSign, path: '/payments', permission: 'payments.drivers' },
{ label: 'Expenses', icon: Receipt, path: '/expenses', permission: 'expenses' },
{ label: 'Maintenance', icon: Wrench, path: '/maintenance', permission: 'fleet' },
{ label: 'Performance', icon: Trophy, path: '/performance', permission: 'performance' },
{ label: 'Invoices', icon: FileText, path: '/invoices', permission: 'invoices' },
{ label: 'Companies', icon: Building2, path: '/companies', permission: 'companies' },
{ label: 'Users', icon: UserCog, path: '/users', permission: 'users' }];


const masterNavItems: NavItem[] = [
{ label: 'Dashboard', icon: LayoutDashboard, path: '/master', permission: 'master' },
{ label: 'Companies', icon: Building2, path: '/master/tenants', permission: 'master' },
{ label: 'Statistics', icon: BarChart3, path: '/master/stats', permission: 'master' },
{ label: 'Billing', icon: CreditCard, path: '/master/billing', permission: 'master' },
{ label: 'Settings', icon: Settings, path: '/master/settings', permission: 'master' }];


const roleBadgeStyles: Record<string, string> = {
  master_admin: 'bg-purple-600 text-white',
  admin: 'bg-destructive text-destructive-foreground',
  accounting: 'bg-warning text-warning-foreground',
  dispatcher: 'bg-info text-info-foreground',
  driver: 'bg-success text-success-foreground'
};

const roleLabels: Record<string, string> = {
  master_admin: 'MASTER ADMIN',
  admin: 'ADMIN',
  accounting: 'ACCOUNTING',
  dispatcher: 'DISPATCHER',
  driver: 'DRIVER'
};

export const AppLayout = ({ children }: {children: ReactNode;}) => {
  const { profile, role, tenant, signOut, hasPermission, isMasterAdmin } = useAuth();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [loadDialogOpen, setLoadDialogOpen] = useState(false);
  const [pendingDrivers, setPendingDrivers] = useState(0);
  const { createLoad } = useLoads();

  useEffect(() => {
    if (!profile?.tenant_id) return;
    const fetchPending = async () => {
      const { count } = await supabase.
      from('drivers').
      select('*', { count: 'exact', head: true }).
      eq('tenant_id', profile.tenant_id).
      eq('status', 'pending');
      setPendingDrivers(count || 0);
    };
    fetchPending();
    const channel = supabase.
    channel('pending-drivers-topnav').
    on('postgres_changes', { event: '*', schema: 'public', table: 'drivers' }, () => fetchPending()).
    subscribe();
    return () => {supabase.removeChannel(channel);};
  }, [profile?.tenant_id]);

  if (!profile) return null;

  const handleCreateLoad = async (input: any) => {
    const result = await createLoad(input);
    return result;
  };

  const isMasterRoute = location.pathname.startsWith('/master');
  const navItems = isMasterAdmin && isMasterRoute ? masterNavItems : tenantNavItems;
  const visibleItems = navItems.filter((item) => hasPermission(item.permission));
  const initials = profile.full_name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-background">
      {/* ── Row 1: Blue header ── */}
      <header className="top-header flex items-center justify-between min-h-14 px-4 lg:px-6 shrink-0" style={{ paddingTop: 'max(0.5rem, env(safe-area-inset-top, 0.5rem))' }}>
        {/* Left: logo + name */}
        <div className="flex items-center gap-3">
          <button className="lg:hidden p-1.5 rounded-md hover:bg-white/10" onClick={() => setMobileMenuOpen(true)}>
            <Menu className="h-5 w-5" />
          </button>
          {tenant?.logo_url ?
          <img src={tenant.logo_url} alt="" className="h-7 w-7 rounded flex-shrink-0 object-cover" /> :

          <img src={logoImg} alt="Load Up TMS" className="h-7 w-7 rounded flex-shrink-0 object-cover" />
          }
          <span className="text-sm font-semibold tracking-tight truncate max-w-[160px] hidden sm:inline">
            {tenant?.name || 'Load Up TMS'}
          </span>
          {isMasterAdmin && isMasterRoute &&
          <Badge className="bg-purple-500/30 text-purple-200 text-[10px] border-purple-400/30 hidden md:inline-flex">
              Master Panel
            </Badge>
          }
          {hasPermission('loads') &&
          <Button size="sm" variant="secondary" onClick={() => setLoadDialogOpen(true)} className="gap-1 h-8 text-xs">
              <Plus className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">New Load</span>
            </Button>
          }
        </div>

        {/* Right: actions */}
        <div className="flex items-center gap-2 sm:gap-3">

          {isMasterAdmin &&
          <Link
            to={isMasterRoute ? '/dashboard' : '/master'}
            className="hidden md:flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-md hover:bg-white/10 transition-colors">

              {isMasterRoute ? <Truck className="h-3.5 w-3.5" /> : <Crown className="h-3.5 w-3.5" />}
              <span>{isMasterRoute ? 'App' : 'Master'}</span>
            </Link>
          }

          <ThemeToggle />
          <NotificationBell />

          <Badge className={`text-[10px] hidden sm:inline-flex ${roleBadgeStyles[role || 'admin']}`}>
            {roleLabels[role || 'admin']}
          </Badge>

          <div className="hidden md:block text-right">
            <p className="text-xs font-medium leading-none">{profile.full_name}</p>
            <p className="text-[10px] opacity-70">{profile.email}</p>
          </div>

          <Avatar className="h-7 w-7">
            <AvatarFallback className={`text-[10px] font-semibold ${isMasterAdmin ? 'bg-purple-600 text-white' : 'bg-white/20 text-white'}`}>
              {initials}
            </AvatarFallback>
          </Avatar>

          <Tooltip>
            <TooltipTrigger asChild>
              <button onClick={signOut} className="p-1.5 rounded-md hover:bg-white/10 transition-colors">
                <LogOut className="h-4 w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent>Sign Out</TooltipContent>
          </Tooltip>
        </div>
      </header>

      {/* ── Row 2: White navigation bar (desktop) ── */}
      <nav className="top-nav hidden lg:flex items-center px-4 overflow-x-auto shrink-0">
        {visibleItems.map((item) => {
          const active = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`top-nav-item flex items-center gap-2 ${active ? 'top-nav-item-active' : ''}`}>

              <item.icon className="h-4 w-4" />
              <span className="text-sm font-bold">{item.label}</span>
              {item.path === '/drivers' && pendingDrivers > 0 &&
              <span className="inline-flex items-center justify-center h-4 min-w-[16px] px-1 rounded-full bg-orange-500 text-white text-[10px] font-bold leading-none">
                  {pendingDrivers}
                </span>
              }
            </Link>);

        })}
      </nav>

      {/* ── Mobile menu overlay ── */}
      {mobileMenuOpen &&
      <>
          <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setMobileMenuOpen(false)} />
          <div className="fixed inset-y-0 left-0 z-50 w-72 bg-card shadow-xl lg:hidden flex flex-col animate-in slide-in-from-left duration-200">
            <div className="flex items-center justify-between h-14 px-4 border-b">
              <div className="flex items-center gap-2">
                <img src={logoImg} alt="" className="h-6 w-6 rounded" />
                <span className="text-sm font-semibold">{tenant?.name || 'Load Up TMS'}</span>
              </div>
              <button onClick={() => setMobileMenuOpen(false)} className="p-1.5 rounded-md hover:bg-muted">
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto py-2 px-2 space-y-0.5">
              {visibleItems.map((item) => {
              const active = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors
                      ${active ? 'bg-primary/10 text-primary font-semibold' : 'text-foreground hover:bg-muted'}
                    `}>

                    <item.icon className="h-4 w-4 flex-shrink-0" />
                    <span>{item.label}</span>
                    {item.path === '/drivers' && pendingDrivers > 0 &&
                  <span className="ml-auto inline-flex items-center justify-center h-5 min-w-[20px] px-1.5 rounded-full bg-orange-500 text-white text-[11px] font-bold leading-none">
                        {pendingDrivers}
                      </span>
                  }
                  </Link>);

            })}

              {isMasterAdmin &&
            <div className="mt-3 pt-3 border-t">
                  <Link
                to={isMasterRoute ? '/dashboard' : '/master'}
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-foreground hover:bg-muted">

                    {isMasterRoute ? <Truck className="h-4 w-4" /> : <Crown className="h-4 w-4" />}
                    <span>{isMasterRoute ? 'Go to App' : 'Master Panel'}</span>
                  </Link>
                </div>
            }
            </nav>
          </div>
        </>
      }

      {/* ── Main content ── */}
      <main className="flex-1 overflow-y-auto p-4 lg:p-6">
        {children}
      </main>

      <LoadFormDialog
        open={loadDialogOpen}
        onOpenChange={setLoadDialogOpen}
        onSubmit={handleCreateLoad} />


      {(role === 'admin' || role === 'dispatcher' || role === 'accounting' || role === 'master_admin') &&
      <LiveNotificationToasts />
      }
    </div>);

};