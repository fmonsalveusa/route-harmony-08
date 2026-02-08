import { ReactNode, useState } from 'react';
import logoImg from '@/assets/logo.png';
import { useAuth } from '@/contexts/AuthContext';
import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Truck, Users, Package, MapPin, FileText,
  BarChart3, LogOut, DollarSign, UserCog, ChevronLeft,
  ChevronRight, Headphones, Menu, Building2, Crown, CreditCard, Settings
} from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface NavItem {
  label: string;
  icon: any;
  path: string;
  permission: string;
}

const tenantNavItems: NavItem[] = [
  { label: 'Dashboard', icon: LayoutDashboard, path: '/', permission: 'dashboard' },
  { label: 'Cargas', icon: Package, path: '/loads', permission: 'loads' },
  { label: 'Flota', icon: Truck, path: '/fleet', permission: 'fleet' },
  { label: 'Conductores', icon: Users, path: '/drivers', permission: 'drivers' },
  { label: 'Dispatchers', icon: Headphones, path: '/dispatchers', permission: 'dispatchers' },
  { label: 'Pagos', icon: DollarSign, path: '/payments', permission: 'payments.drivers' },
  { label: 'Facturación', icon: FileText, path: '/invoices', permission: 'invoices' },
  { label: 'Empresas', icon: Building2, path: '/companies', permission: 'companies' },
  { label: 'Seguimiento', icon: MapPin, path: '/tracking', permission: 'tracking' },
  { label: 'Reportes', icon: BarChart3, path: '/reports', permission: 'reports' },
  { label: 'Usuarios', icon: UserCog, path: '/users', permission: 'users' },
];

const masterNavItems: NavItem[] = [
  { label: 'Dashboard', icon: LayoutDashboard, path: '/master', permission: 'master' },
  { label: 'Empresas', icon: Building2, path: '/master/tenants', permission: 'master' },
  { label: 'Estadísticas', icon: BarChart3, path: '/master/stats', permission: 'master' },
  { label: 'Facturación', icon: CreditCard, path: '/master/billing', permission: 'master' },
  { label: 'Configuración', icon: Settings, path: '/master/settings', permission: 'master' },
];

const roleBadgeStyles: Record<string, string> = {
  master_admin: 'bg-purple-600 text-white',
  admin: 'bg-destructive text-destructive-foreground',
  accounting: 'bg-warning text-warning-foreground',
  dispatcher: 'bg-info text-info-foreground',
  driver: 'bg-success text-success-foreground',
};

const roleLabels: Record<string, string> = {
  master_admin: 'MASTER ADMIN',
  admin: 'ADMIN',
  accounting: 'ACCOUNTING',
  dispatcher: 'DISPATCHER',
  driver: 'DRIVER',
};

export const AppLayout = ({ children }: { children: ReactNode }) => {
  const { profile, role, tenant, subscription, signOut, hasPermission, isMasterAdmin } = useAuth();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  if (!profile) return null;

  const navItems = isMasterAdmin && location.pathname.startsWith('/master') ? masterNavItems : tenantNavItems;
  const visibleItems = navItems.filter(item => hasPermission(item.permission));
  const initials = profile.full_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

  const isMasterRoute = location.pathname.startsWith('/master');
  const sidebarBg = isMasterAdmin && isMasterRoute ? 'bg-[hsl(270,40%,15%)]' : 'bg-sidebar';
  const sidebarBorder = isMasterAdmin && isMasterRoute ? 'border-[hsl(270,30%,25%)]' : 'border-sidebar-border';
  const sidebarAccent = isMasterAdmin && isMasterRoute ? 'bg-[hsl(270,30%,22%)]' : 'bg-sidebar-accent';

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {mobileOpen && (
        <div className="fixed inset-0 z-40 bg-foreground/50 lg:hidden" onClick={() => setMobileOpen(false)} />
      )}

      <aside className={`
        fixed lg:static inset-y-0 left-0 z-50 flex flex-col ${sidebarBg} border-r ${sidebarBorder}
        transition-all duration-300
        ${collapsed ? 'w-16' : 'w-60'}
        ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        {/* Logo */}
        <div className={`flex items-center h-16 px-4 border-b ${sidebarBorder}`}>
          {isMasterAdmin && isMasterRoute ? (
            <>
              <img src={logoImg} alt="Load Up TMS" className="h-7 w-7 rounded flex-shrink-0 object-cover" />
              {!collapsed && <span className="ml-3 text-lg font-bold text-purple-200 tracking-tight">Load Up TMS</span>}
            </>
          ) : (
            <>
              {tenant?.logo_url ? (
                <img src={tenant.logo_url} alt="" className="h-7 w-7 rounded flex-shrink-0 object-cover" />
              ) : (
                <img src={logoImg} alt="Load Up TMS" className="h-7 w-7 rounded flex-shrink-0 object-cover" />
              )}
              {!collapsed && <span className="ml-3 text-lg font-bold text-sidebar-accent-foreground tracking-tight truncate">{tenant?.name || 'Load Up TMS'}</span>}
            </>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
          {visibleItems.map(item => {
            const active = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors
                  ${active
                    ? `${sidebarAccent} ${isMasterAdmin && isMasterRoute ? 'text-purple-300' : 'text-sidebar-primary'}`
                    : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                  }
                `}
              >
                <item.icon className="h-4.5 w-4.5 flex-shrink-0" />
                {!collapsed && <span>{item.label}</span>}
              </Link>
            );
          })}

          {/* Switch between master and app views */}
          {isMasterAdmin && (
            <div className={`mt-4 pt-3 border-t ${sidebarBorder}`}>
              <Link
                to={isMasterRoute ? '/' : '/master'}
                onClick={() => setMobileOpen(false)}
                className="flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
              >
                {isMasterRoute ? <Truck className="h-4.5 w-4.5 flex-shrink-0" /> : <Crown className="h-4.5 w-4.5 flex-shrink-0" />}
                {!collapsed && <span>{isMasterRoute ? 'Ir a la App' : 'Panel Master'}</span>}
              </Link>
            </div>
          )}
        </nav>

        {/* Plan widget for tenant admins */}
        {!isMasterAdmin && subscription && !collapsed && role === 'admin' && (
          <div className={`mx-2 mb-2 p-3 rounded-lg border ${sidebarBorder} bg-sidebar-accent/50`}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-sidebar-foreground uppercase">{subscription.plan}</span>
              <Badge className={
                subscription.plan === 'pro' ? 'bg-amber-500 text-white text-[10px]'
                : subscription.plan === 'intermediate' ? 'bg-blue-500 text-white text-[10px]'
                : 'bg-green-500 text-white text-[10px]'
              }>
                ${subscription.price_monthly}/mo
              </Badge>
            </div>
            <div className="space-y-1.5">
              <div>
                <div className="flex justify-between text-[10px] text-sidebar-muted mb-0.5">
                  <span>Usuarios</span>
                  <span>{subscription.max_users} máx</span>
                </div>
                <Progress value={50} className="h-1.5" />
              </div>
              <div>
                <div className="flex justify-between text-[10px] text-sidebar-muted mb-0.5">
                  <span>Camiones</span>
                  <span>{subscription.max_trucks} máx</span>
                </div>
                <Progress value={30} className="h-1.5" />
              </div>
            </div>
          </div>
        )}

        {/* Collapse */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className={`hidden lg:flex items-center justify-center h-10 border-t ${sidebarBorder} text-sidebar-muted hover:text-sidebar-accent-foreground transition-colors`}
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </aside>

      {/* Main */}
      <div className="flex flex-col flex-1 overflow-hidden">
        <header className="flex items-center justify-between h-16 px-4 lg:px-6 border-b bg-card">
          <button className="lg:hidden p-2 rounded-md hover:bg-muted" onClick={() => setMobileOpen(true)}>
            <Menu className="h-5 w-5" />
          </button>

          <div className="hidden lg:flex items-center gap-2">
            {!isMasterAdmin && tenant && (
              <span className="text-sm text-muted-foreground">{tenant.name}</span>
            )}
            {isMasterAdmin && isMasterRoute && (
              <span className="text-sm font-medium text-purple-600">Panel de Administración Global</span>
            )}
          </div>

          <div className="flex items-center gap-3">
            <Badge className={`text-xs ${roleBadgeStyles[role || 'admin']}`}>
              {roleLabels[role || 'admin']}
            </Badge>
            <div className="hidden sm:block text-right">
              <p className="text-sm font-medium leading-none">{profile.full_name}</p>
              <p className="text-xs text-muted-foreground">{profile.email}</p>
            </div>
            <Avatar className="h-8 w-8">
              <AvatarFallback className={`text-xs font-semibold ${isMasterAdmin ? 'bg-purple-600 text-white' : 'bg-primary text-primary-foreground'}`}>
                {initials}
              </AvatarFallback>
            </Avatar>
            <Tooltip>
              <TooltipTrigger asChild>
                <button onClick={signOut} className="p-2 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
                  <LogOut className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent>Cerrar sesión</TooltipContent>
            </Tooltip>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  );
};
