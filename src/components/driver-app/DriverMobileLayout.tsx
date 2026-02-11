import { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Package, DollarSign, User, LogOut, MapPin } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import logoImg from '@/assets/logo.png';

const tabs = [
  { label: 'Home', icon: LayoutDashboard, path: '/driver' },
  { label: 'Loads', icon: Package, path: '/driver/loads' },
  { label: 'Tracking', icon: MapPin, path: '/driver/tracking' },
  { label: 'Payments', icon: DollarSign, path: '/driver/payments' },
  { label: 'Profile', icon: User, path: '/driver/profile' },
];

export const DriverMobileLayout = ({ children }: { children: ReactNode }) => {
  const location = useLocation();
  const { signOut, profile } = useAuth();

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header */}
      <header className="flex items-center justify-between h-14 px-4 border-b bg-card shadow-sm">
        <div className="flex items-center gap-2">
          <img src={logoImg} alt="Logo" className="h-7 w-7 rounded" />
          <span className="text-sm font-bold text-foreground">Load Up Driver</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground hidden sm:block">{profile?.full_name}</span>
          <button onClick={signOut} className="p-2 rounded-md text-muted-foreground hover:bg-muted">
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>

      {/* Bottom Tab Bar */}
      <nav className="flex items-center justify-around h-16 border-t bg-card shadow-[0_-2px_10px_rgba(0,0,0,0.05)] safe-area-pb">
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
              <tab.icon className={`h-5 w-5 ${active ? 'text-primary' : ''}`} />
              <span className="text-[10px] font-medium">{tab.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
};
