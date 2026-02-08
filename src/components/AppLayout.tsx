import { ReactNode, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Truck, Users, Package, MapPin, FileText,
  BarChart3, Settings, LogOut, DollarSign, UserCog, ChevronLeft,
  ChevronRight, Headphones, CreditCard, Menu, X, Building2
} from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';

interface NavItem {
  label: string;
  icon: any;
  path: string;
  permission: string;
}

const navItems: NavItem[] = [
  { label: 'Dashboard', icon: LayoutDashboard, path: '/', permission: 'dashboard' },
  { label: 'Cargas', icon: Package, path: '/loads', permission: 'loads' },
  { label: 'Flota', icon: Truck, path: '/fleet', permission: 'fleet' },
  { label: 'Conductores', icon: Users, path: '/drivers', permission: 'drivers' },
  { label: 'Dispatchers', icon: Headphones, path: '/dispatchers', permission: 'dispatchers' },
  { label: 'Pagos', icon: DollarSign, path: '/payments', permission: 'payments.drivers' },
  { label: 'Facturación', icon: FileText, path: '/invoices', permission: 'invoices' },
  { label: 'Empresas', icon: Building2, path: '/companies', permission: 'invoices' },
  { label: 'Seguimiento', icon: MapPin, path: '/tracking', permission: 'tracking' },
  { label: 'Reportes', icon: BarChart3, path: '/reports', permission: 'reports' },
  { label: 'Usuarios', icon: UserCog, path: '/users', permission: 'users' },
];

const roleBadgeStyles: Record<string, string> = {
  admin: 'bg-destructive text-destructive-foreground',
  accounting: 'bg-warning text-warning-foreground',
  dispatcher: 'bg-info text-info-foreground',
};

export const AppLayout = ({ children }: { children: ReactNode }) => {
  const { user, logout, hasPermission } = useAuth();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  if (!user) return null;

  const visibleItems = navItems.filter(item => hasPermission(item.permission));
  const initials = user.name.split(' ').map(n => n[0]).join('').slice(0, 2);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 bg-foreground/50 lg:hidden" onClick={() => setMobileOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed lg:static inset-y-0 left-0 z-50 flex flex-col bg-sidebar border-r border-sidebar-border
        transition-all duration-300 
        ${collapsed ? 'w-16' : 'w-60'}
        ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        {/* Logo */}
        <div className="flex items-center h-16 px-4 border-b border-sidebar-border">
          <Truck className="h-7 w-7 text-sidebar-primary flex-shrink-0" />
          {!collapsed && <span className="ml-3 text-lg font-bold text-sidebar-accent-foreground tracking-tight">TruckFlow</span>}
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
                    ? 'bg-sidebar-accent text-sidebar-primary'
                    : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                  }
                `}
              >
                <item.icon className="h-4.5 w-4.5 flex-shrink-0" />
                {!collapsed && <span>{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* Collapse */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="hidden lg:flex items-center justify-center h-10 border-t border-sidebar-border text-sidebar-muted hover:text-sidebar-accent-foreground transition-colors"
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </aside>

      {/* Main */}
      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Header */}
        <header className="flex items-center justify-between h-16 px-4 lg:px-6 border-b bg-card">
          <button className="lg:hidden p-2 rounded-md hover:bg-muted" onClick={() => setMobileOpen(true)}>
            <Menu className="h-5 w-5" />
          </button>

          <div className="hidden lg:block" />

          <div className="flex items-center gap-3">
            <Badge className={`text-xs ${roleBadgeStyles[user.role]}`}>
              {user.role.toUpperCase()}
            </Badge>
            <div className="hidden sm:block text-right">
              <p className="text-sm font-medium leading-none">{user.name}</p>
              <p className="text-xs text-muted-foreground">{user.email}</p>
            </div>
            <Avatar className="h-8 w-8">
              <AvatarFallback className="bg-primary text-primary-foreground text-xs font-semibold">{initials}</AvatarFallback>
            </Avatar>
            <button onClick={logout} className="p-2 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  );
};
