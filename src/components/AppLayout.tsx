import { ReactNode, useState, useEffect } from 'react';
import logoImg from '@/assets/logo.png';
import { useAuth } from '@/contexts/AuthContext';
import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Truck, Users, Package, MapPin, FileText,
  BarChart3, LogOut, DollarSign, UserCog,
  Headphones, Menu, Building2, Crown, CreditCard, Settings, Plus, Receipt, Trophy, Wrench, X, FileSignature, MoreHorizontal, ChevronLeft, ChevronRight, Landmark } from
'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import { LoadFormDialog } from '@/components/LoadFormDialog';
import { useLoads } from '@/hooks/useLoads';
import { NotificationBell } from '@/components/NotificationBell';
import { LiveNotificationToasts } from '@/components/LiveNotificationToasts';
import { MeetingAlertModal } from '@/components/MeetingAlertModal';
import { ThemeToggle } from '@/components/ThemeToggle';
import { supabase } from '@/integrations/supabase/client';

interface NavItem {
  label: string;
  icon: any;
  path: string;
  permission: string;
  masterOnly?: boolean;
  hideForDispatcher?: boolean;
  adminAndAccountingOnly?: boolean;
}

const topLevelItems: NavItem[] = [
  { label: 'Dashboard', icon: LayoutDashboard, path: '/dashboard', permission: 'dashboard' },
  { label: 'Loads', icon: Package, path: '/loads', permission: 'loads' },
  { label: 'Tracking', icon: MapPin, path: '/tracking', permission: 'tracking' },
];

const teamItems: NavItem[] = [
  { label: 'Fleet', icon: Truck, path: '/fleet', permission: 'fleet' },
  { label: 'Drivers', icon: Users, path: '/drivers', permission: 'drivers' },
  { label: 'Investors', icon: Landmark, path: '/investors', permission: 'drivers', adminAndAccountingOnly: true },
  { label: 'Dispatchers', icon: Headphones, path: '/dispatchers', permission: 'dispatchers' },
];

const accountingItems: NavItem[] = [
  { label: 'Payments', icon: DollarSign, path: '/payments', permission: 'payments.drivers' },
  { label: 'Expenses', icon: Receipt, path: '/expenses', permission: 'expenses' },
  { label: 'Invoices', icon: FileText, path: '/invoices', permission: 'invoices' },
  { label: 'Performance', icon: Trophy, path: '/performance', permission: 'performance' },
];

const moreItems: NavItem[] = [
  { label: 'Maintenance', icon: Wrench, path: '/maintenance', permission: 'fleet', hideForDispatcher: true },
  { label: 'Route History', icon: MapPin, path: '/driver-route-history', permission: 'tracking' },
  { label: 'Documents', icon: FileSignature, path: '/documents', permission: 'dashboard', hideForDispatcher: true },
];

const adminItems: NavItem[] = [
  { label: 'Companies', icon: Building2, path: '/companies', permission: 'companies' },
  { label: 'Users', icon: UserCog, path: '/users', permission: 'users' },
  { label: 'Subscription', icon: CreditCard, path: '/subscription', permission: 'settings' },
];

const tenantNavItems: NavItem[] = [
  ...topLevelItems,
  ...teamItems,
  ...accountingItems,
  ...moreItems,
  ...adminItems,
];

const masterNavItems: NavItem[] = [
  { label: 'Dashboard', icon: LayoutDashboard, path: '/master', permission: 'master' },
  { label: 'Companies', icon: Building2, path: '/master/tenants', permission: 'master' },
  { label: 'Statistics', icon: BarChart3, path: '/master/stats', permission: 'master' },
  { label: 'Billing', icon: CreditCard, path: '/master/billing', permission: 'master' },
  { label: 'Settings', icon: Settings, path: '/master/settings', permission: 'master' },
];

const roleBadgeStyles: Record<string, string> = {
  master_admin: 'bg-purple-600 text-white',
  admin: 'bg-destructive text-destructive-foreground',
  accounting: 'bg-warning text-warning-foreground',
  dispatcher: 'bg-info text-info-foreground',
  driver: 'bg-success text-success-foreground',
};

const roleLabels: Record<string, string> = {
  master_admin: 'MASTER',
  admin: 'ADMIN',
  accounting: 'ACCOUNTING',
  dispatcher: 'DISPATCHER',
  driver: 'DRIVER',
};

export const AppLayout = ({ children }: { children: ReactNode }) => {
  const { profile, role, tenant, signOut, hasPermission, isMasterAdmin } = useAuth();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [loadDialogOpen, setLoadDialogOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [pendingDrivers, setPendingDrivers] = useState(0);
  const { createLoad } = useLoads();

  useEffect(() => {
    if (!profile?.tenant_id) return;
    const fetchPending = async () => {
      const { count } = await supabase
        .from('drivers')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', profile.tenant_id)
        .eq('status', 'pending');
      setPendingDrivers(count || 0);
    };
    fetchPending();
    const channel = supabase
      .channel('pending-drivers-sidebar')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'drivers' }, () => fetchPending())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [profile?.tenant_id]);

  if (!profile) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-4">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        <p className="text-sm text-muted-foreground">Connecting…</p>
        <Button variant="outline" size="sm" onClick={() => window.location.reload()}>Retry</Button>
      </div>
    );
  }

  const handleCreateLoad = async (input: any) => {
    const result = await createLoad(input);
    return result;
  };

  const isMasterRoute = location.pathname.startsWith('/master');
  const useMasterNav = isMasterAdmin && isMasterRoute;
  const isDispatcher = role === 'dispatcher';
  const isAdminOrAccounting = role === 'admin' || role === 'accounting' || isMasterAdmin;
  const initials = profile.full_name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();

  // Mobile items
  const mobileItems = (useMasterNav ? masterNavItems : tenantNavItems).filter(
    (i) => hasPermission(i.permission) && (!i.masterOnly || isMasterAdmin) && (!i.hideForDispatcher || !isDispatcher) && (!i.adminAndAccountingOnly || isAdminOrAccounting)
  );

  // Sidebar section render helpers
  const renderSidebarLink = (item: NavItem) => {
    const active = location.pathname === item.path;
    if (collapsed) {
      return (
        <Tooltip key={item.path}>
          <TooltipTrigger asChild>
            <Link
              to={item.path}
              className={`flex justify-center items-center p-2.5 rounded-lg transition-colors ${
                active ? 'bg-[#266aad] text-white' : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              <item.icon className="h-5 w-5 flex-shrink-0" />
            </Link>
          </TooltipTrigger>
          <TooltipContent side="right">{item.label}</TooltipContent>
        </Tooltip>
      );
    }
    return (
      <Link
        key={item.path}
        to={item.path}
        className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
          active ? 'bg-[#266aad] text-white' : 'text-foreground hover:bg-muted'
        }`}
      >
        <item.icon className="h-4 w-4 flex-shrink-0" />
        <span className="flex-1 truncate">{item.label}</span>
        {item.path === '/drivers' && pendingDrivers > 0 && (
          <span className="inline-flex items-center justify-center h-4 min-w-[16px] px-1 rounded-full bg-orange-500 text-white text-[10px] font-bold leading-none">
            {pendingDrivers}
          </span>
        )}
      </Link>
    );
  };

  const renderSectionLabel = (label: string) => {
    if (collapsed) return <div className="my-1 border-t border-border mx-2" />;
    return (
      <p className="px-3 pt-4 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
    );
  };

  const filterVisible = (items: NavItem[]) =>
    items.filter((i) =>
      hasPermission(i.permission) &&
      (!i.masterOnly || isMasterAdmin) &&
      (!i.hideForDispatcher || !isDispatcher) &&
      (!i.adminAndAccountingOnly || isAdminOrAccounting)
    );

  return (
    <div className="flex h-screen overflow-hidden bg-background">

      {/* ── Sidebar (desktop) ── */}
      <aside
        className={`hidden lg:flex flex-col bg-card border-r border-border shrink-0 transition-all duration-300 ${
          collapsed ? 'w-[68px]' : 'w-60'
        }`}
      >
        {/* Logo / brand */}
        <div className={`flex items-center gap-3 h-14 border-b border-border shrink-0 ${collapsed ? 'justify-center px-2' : 'px-4'}`}>
          {tenant?.logo_url
            ? <img src={tenant.logo_url} alt="" className="h-7 w-7 rounded flex-shrink-0 object-cover" />
            : <img src={logoImg} alt="Dispatch Up" className="h-7 w-7 rounded flex-shrink-0 object-cover" />
          }
          {!collapsed && (
            <span
              className="text-lg font-extrabold tracking-tight truncate text-foreground"
              style={{ textShadow: '0 1px 2px hsl(var(--primary) / 0.5), 0 2px 8px hsl(var(--primary) / 0.3)' }}
            >
              Dispatch Up TMS
            </span>
          )}
        </div>

        {/* Nav items */}
        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
          {useMasterNav ? (
            <>
              {masterNavItems.filter(i => hasPermission(i.permission)).map(renderSidebarLink)}
              {renderSectionLabel('')}
              {collapsed ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Link
                      to="/dashboard"
                      className="flex justify-center items-center p-2.5 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                    >
                      <Truck className="h-5 w-5" />
                    </Link>
                  </TooltipTrigger>
                  <TooltipContent side="right">Go to App</TooltipContent>
                </Tooltip>
              ) : (
                <Link
                  to="/dashboard"
                  className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                >
                  <Truck className="h-4 w-4" />
                  <span>Go to App</span>
                </Link>
              )}
            </>
          ) : (
            <>
              {filterVisible(topLevelItems).map(renderSidebarLink)}

              {filterVisible(teamItems).length > 0 && (
                <>
                  {renderSectionLabel('Team')}
                  {filterVisible(teamItems).map(renderSidebarLink)}
                </>
              )}

              {filterVisible(accountingItems).length > 0 && (
                <>
                  {renderSectionLabel('Accounting')}
                  {filterVisible(accountingItems).map(renderSidebarLink)}
                </>
              )}

              {filterVisible(moreItems).length > 0 && (
                <>
                  {renderSectionLabel('More')}
                  {filterVisible(moreItems).map(renderSidebarLink)}
                </>
              )}

              {filterVisible(adminItems).length > 0 && (
                <>
                  {renderSectionLabel('Admin')}
                  {filterVisible(adminItems).map(renderSidebarLink)}
                </>
              )}

              {isMasterAdmin && (
                <>
                  {renderSectionLabel('')}
                  {collapsed ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Link
                          to={isMasterRoute ? '/dashboard' : '/master'}
                          className="flex justify-center items-center p-2.5 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                        >
                          {isMasterRoute ? <Truck className="h-5 w-5" /> : <Crown className="h-5 w-5" />}
                        </Link>
                      </TooltipTrigger>
                      <TooltipContent side="right">{isMasterRoute ? 'App' : 'Master Panel'}</TooltipContent>
                    </Tooltip>
                  ) : (
                    <Link
                      to={isMasterRoute ? '/dashboard' : '/master'}
                      className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                    >
                      {isMasterRoute ? <Truck className="h-4 w-4" /> : <Crown className="h-4 w-4" />}
                      <span>{isMasterRoute ? 'Go to App' : 'Master Panel'}</span>
                    </Link>
                  )}
                </>
              )}
            </>
          )}
        </nav>

        {/* User profile + collapse */}
        <div className="border-t border-border p-3 shrink-0">
          {collapsed ? (
            <div className="flex flex-col items-center gap-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Avatar className="h-8 w-8 cursor-pointer">
                    <AvatarFallback className={`text-[10px] font-semibold ${isMasterAdmin ? 'bg-purple-600 text-white' : 'bg-[#266aad] text-white'}`}>
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                </TooltipTrigger>
                <TooltipContent side="right">{profile.full_name}</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button onClick={signOut} className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
                    <LogOut className="h-4 w-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right">Sign Out</TooltipContent>
              </Tooltip>
            </div>
          ) : (
            <div className="flex items-center gap-2 mb-2">
              <Avatar className="h-8 w-8 flex-shrink-0">
                <AvatarFallback className={`text-[10px] font-semibold ${isMasterAdmin ? 'bg-purple-600 text-white' : 'bg-[#266aad] text-white'}`}>
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold truncate">{profile.full_name}</p>
                <p className="text-[10px] text-muted-foreground truncate">{profile.email}</p>
              </div>
              <button onClick={signOut} className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors flex-shrink-0">
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* Collapse toggle */}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-xs text-muted-foreground hover:bg-muted transition-colors ${collapsed ? 'justify-center' : ''}`}
          >
            {collapsed
              ? <ChevronRight className="h-4 w-4" />
              : <><ChevronLeft className="h-3.5 w-3.5" /><span>Collapse</span></>
            }
          </button>
        </div>
      </aside>

      {/* ── Main area (header + content) ── */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">

        {/* Top bar */}
        <header className="top-header flex items-center justify-between h-14 px-4 lg:px-5 shrink-0" style={{ paddingTop: 'max(0.5rem, env(safe-area-inset-top, 0.5rem))' }}>
          <div className="flex items-center gap-3">
            {/* Mobile hamburger */}
            <button className="lg:hidden p-1.5 rounded-md hover:bg-white/10" onClick={() => setMobileMenuOpen(true)}>
              <Menu className="h-5 w-5" />
            </button>
            {/* Mobile logo */}
            <div className="lg:hidden flex items-center gap-2">
              {tenant?.logo_url
                ? <img src={tenant.logo_url} alt="" className="h-7 w-7 rounded object-cover" />
                : <img src={logoImg} alt="" className="h-7 w-7 rounded" />
              }
              <span className="text-sm font-semibold text-white truncate max-w-[140px]">
                {tenant?.name || 'Dispatch Up'}
              </span>
            </div>
            {/* New Load button */}
            {hasPermission('loads') && (
              <Button
                size="sm"
                onClick={() => setLoadDialogOpen(true)}
                className="gap-1.5 h-8 text-xs bg-white hover:bg-white/90 text-[#266aad] border-[#266aad] border shadow-[0_0_0_2px_#266aad33]"
                variant="outline"
              >
                <Plus className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">New Load</span>
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {isMasterAdmin && isMasterRoute && (
              <Badge className="bg-purple-500/30 text-purple-200 text-[10px] border-purple-400/30 hidden md:inline-flex">
                Master Panel
              </Badge>
            )}
            {tenant?.name && (
              <span className="hidden lg:inline text-sm font-semibold text-white truncate max-w-[200px]">
                {tenant.name}
              </span>
            )}
            <ThemeToggle />
            <NotificationBell />
            <Badge className={`text-[10px] hidden sm:inline-flex ${roleBadgeStyles[role || 'admin']}`}>
              {roleLabels[role || 'admin']}
            </Badge>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6 pb-[88px] lg:pb-6">
          {children}
        </main>
      </div>

      {/* ── Mobile overlay menu ── */}
      {mobileMenuOpen && (
        <>
          <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setMobileMenuOpen(false)} />
          <div className="fixed inset-y-0 left-0 z-50 w-72 bg-card shadow-xl lg:hidden flex flex-col animate-in slide-in-from-left duration-200">
            <div className="flex items-center justify-between h-14 px-4 border-b">
              <div className="flex items-center gap-2">
                <img src={logoImg} alt="" className="h-6 w-6 rounded" />
                <span className="text-sm font-semibold">{tenant?.name || 'Dispatch Up TMS'}</span>
              </div>
              <button onClick={() => setMobileMenuOpen(false)} className="p-1.5 rounded-md hover:bg-muted">
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto py-2 px-2 space-y-0.5">
              {mobileItems.map((item) => {
                const active = location.pathname === item.path;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                      active ? 'bg-[#266aad] text-white' : 'text-foreground hover:bg-muted'
                    }`}
                  >
                    <item.icon className="h-4 w-4 flex-shrink-0" />
                    <span>{item.label}</span>
                    {item.path === '/drivers' && pendingDrivers > 0 && (
                      <span className="ml-auto inline-flex items-center justify-center h-5 min-w-[20px] px-1.5 rounded-full bg-orange-500 text-white text-[11px] font-bold leading-none">
                        {pendingDrivers}
                      </span>
                    )}
                  </Link>
                );
              })}
              {isMasterAdmin && (
                <div className="mt-3 pt-3 border-t">
                  <Link
                    to={isMasterRoute ? '/dashboard' : '/master'}
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-foreground hover:bg-muted"
                  >
                    {isMasterRoute ? <Truck className="h-4 w-4" /> : <Crown className="h-4 w-4" />}
                    <span>{isMasterRoute ? 'Go to App' : 'Master Panel'}</span>
                  </Link>
                </div>
              )}
            </nav>
            <div className="border-t p-3">
              <div className="flex items-center gap-2">
                <Avatar className="h-8 w-8">
                  <AvatarFallback className={`text-xs font-semibold ${isMasterAdmin ? 'bg-purple-600 text-white' : 'bg-[#266aad] text-white'}`}>
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold truncate">{profile.full_name}</p>
                  <p className="text-[10px] text-muted-foreground truncate">{profile.email}</p>
                </div>
                <button onClick={signOut} className="p-1.5 rounded-md hover:bg-muted text-muted-foreground">
                  <LogOut className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── Mobile bottom tab bar ── */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-40 lg:hidden bg-card border-t border-border flex items-end justify-around"
        style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom, 0.5rem))' }}
      >
        {(useMasterNav
          ? [
              { label: 'Dashboard', icon: LayoutDashboard, path: '/master', perm: 'master' },
              { label: 'Companies', icon: Building2, path: '/master/tenants', perm: 'master' },
              { label: 'Stats', icon: BarChart3, path: '/master/stats', perm: 'master' },
              { label: 'Billing', icon: CreditCard, path: '/master/billing', perm: 'master' },
              { label: 'Settings', icon: Settings, path: '/master/settings', perm: 'master' },
            ]
          : [
              { label: 'Dashboard', icon: LayoutDashboard, path: '/dashboard', perm: 'dashboard' },
              { label: 'Loads', icon: Package, path: '/loads', perm: 'loads' },
              { label: 'Fleet', icon: Truck, path: '/fleet', perm: 'fleet' },
              { label: 'Payments', icon: DollarSign, path: '/payments', perm: 'payments.drivers' },
            ]
        )
          .filter((t) => hasPermission(t.perm))
          .map((tab) => {
            const active = location.pathname === tab.path;
            return (
              <Link
                key={tab.path}
                to={tab.path}
                className={`flex flex-col items-center gap-0.5 pt-2 px-3 min-w-[56px] transition-colors ${
                  active ? 'text-primary' : 'text-muted-foreground'
                }`}
              >
                <tab.icon className="h-5 w-5" />
                <span className="text-[10px] font-medium leading-tight">{tab.label}</span>
                {active && <span className="block h-0.5 w-5 rounded-full bg-primary mt-0.5" />}
              </Link>
            );
          })}
        {!useMasterNav && (
          <button
            onClick={() => setMobileMenuOpen(true)}
            className="flex flex-col items-center gap-0.5 pt-2 px-3 min-w-[56px] text-muted-foreground"
          >
            <MoreHorizontal className="h-5 w-5" />
            <span className="text-[10px] font-medium leading-tight">More</span>
          </button>
        )}
      </nav>

      <LoadFormDialog
        open={loadDialogOpen}
        onOpenChange={setLoadDialogOpen}
        onSubmit={handleCreateLoad}
      />

      {(role === 'admin' || role === 'dispatcher' || role === 'accounting' || role === 'master_admin') && (
        <LiveNotificationToasts />
      )}
      <MeetingAlertModal />
    </div>
  );
};
