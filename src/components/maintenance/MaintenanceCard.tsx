import { Pencil, Trash2, RotateCcw, History, Calendar, Gauge, DollarSign } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { getStatusColor } from './maintenanceConstants';
import { formatDate } from '@/lib/dateUtils';
import type { DbTruckMaintenance } from '@/hooks/useTruckMaintenance';

interface Props {
  item: DbTruckMaintenance;
  onEdit: () => void;
  onDelete: () => void;
  onLogService: () => void;
  onViewHistory: () => void;
}

export function MaintenanceCard({ item, onEdit, onDelete, onLogService, onViewHistory }: Props) {
  const isRecurring = !!(item.interval_miles || item.interval_days);

  const milesPercent = item.interval_miles && item.interval_miles > 0
    ? Math.min((item.miles_accumulated / item.interval_miles) * 100, 100)
    : null;

  const daysRemaining = item.next_due_date
    ? Math.ceil((new Date(item.next_due_date).getTime() - Date.now()) / 86400000)
    : null;

  const borderColor = item.status === 'due'
    ? 'border-l-[#E24B4A]'
    : item.status === 'warning'
    ? 'border-l-[#EF9F27]'
    : 'border-l-[#639922]';

  const badgeCls = item.status === 'due'
    ? 'bg-[#FCEBEB] text-[#A32D2D]'
    : item.status === 'warning'
    ? 'bg-[#FAEEDA] text-[#854F0B]'
    : 'bg-[#EAF3DE] text-[#3B6D11]';

  const progressColor = item.status === 'due'
    ? 'bg-[#E24B4A]'
    : item.status === 'warning'
    ? 'bg-[#EF9F27]'
    : 'bg-[#639922]';

  const badgeLabel = isRecurring ? item.status.toUpperCase() : 'ONE-TIME';

  return (
    <div className={`bg-card border border-border rounded-lg p-3 border-l-[3px] ${borderColor} space-y-2.5`}>

      {/* Top row: type + badge */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm truncate">{item.maintenance_type}</p>
          {item.description && (
            <p className="text-[11px] text-muted-foreground truncate">{item.description}</p>
          )}
        </div>
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-sm flex-shrink-0 ${badgeCls}`}>
          {badgeLabel}
        </span>
      </div>

      {/* Miles progress */}
      {milesPercent !== null && (
        <div className="space-y-1">
          <div className="flex justify-between text-[10px] text-muted-foreground">
            <span>{item.miles_accumulated.toLocaleString()} mi</span>
            <span>{item.interval_miles?.toLocaleString()} mi interval</span>
          </div>
          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${progressColor}`}
              style={{ width: `${milesPercent}%` }}
            />
          </div>
        </div>
      )}

      {/* Meta info */}
      <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <Calendar className="h-3 w-3" />
          {formatDate(item.last_performed_at)}
        </span>
        <span className="flex items-center gap-1">
          <Gauge className="h-3 w-3" />
          {item.last_miles.toLocaleString()} mi
        </span>
        {item.cost && (
          <span className="flex items-center gap-1">
            <DollarSign className="h-3 w-3" />
            ${Number(item.cost).toFixed(2)}
          </span>
        )}
        {daysRemaining !== null && (
          <span className={daysRemaining <= 0 ? 'text-red-600 font-medium' : daysRemaining <= 30 ? 'text-amber-600' : ''}>
            {daysRemaining <= 0 ? `${Math.abs(daysRemaining)}d overdue` : `${daysRemaining}d left`}
          </span>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1.5 pt-0.5">
        {isRecurring && (
          <Button size="sm" variant="outline" className="h-7 px-2 text-[11px] gap-1 border-primary/30 text-primary hover:bg-primary/5" onClick={onLogService}>
            <RotateCcw className="h-3 w-3" /> Log Service
          </Button>
        )}
        {isRecurring && (
          <Button size="sm" variant="outline" className="h-7 px-2 text-[11px] gap-1" onClick={onViewHistory}>
            <History className="h-3 w-3" /> History
          </Button>
        )}
        <div className="ml-auto flex gap-1">
          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={onEdit}>
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive hover:text-destructive" onClick={onDelete}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
