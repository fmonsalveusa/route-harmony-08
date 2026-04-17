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
  <div className="bg-card rounded-xl border border-border/50 p-5 shadow-[0_4px_24px_0_hsl(214_68%_8%/0.5)] hover:shadow-[0_8px_32px_0_hsl(214_68%_8%/0.65)] animate-fade-in group transition-all duration-200">
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
