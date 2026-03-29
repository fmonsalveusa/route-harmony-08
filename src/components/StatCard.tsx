import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  trend?: { value: string; positive: boolean };
  iconClassName?: string;
}

export const StatCard = ({ title, value, subtitle, icon: Icon, trend, iconClassName = 'bg-primary/10 text-primary' }: StatCardProps) => (
  <div className="bg-card rounded-lg border p-5 shadow-sm animate-fade-in group hover:shadow-xl transition-all duration-300">
    <div className="flex items-start justify-between">
      <div className="space-y-1">
        <p className="text-sm text-muted-foreground">{title}</p>
        <p className="text-2xl font-bold tracking-tight">{value}</p>
        {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
        {trend && (
          <p className={`text-xs font-medium ${trend.positive ? 'text-success' : 'text-destructive'}`}>
            {trend.positive ? '↑' : '↓'} {trend.value}
          </p>
        )}
      </div>
      <div className={`p-2.5 rounded-lg ${iconClassName} backdrop-blur-sm`}>
        <Icon className="h-5 w-5" />
      </div>
    </div>
  </div>
);
