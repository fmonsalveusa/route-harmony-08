import { motion } from 'framer-motion';
import { Pencil, Trash2, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { getMaintenanceTypeConfig, getStatusColor } from './maintenanceConstants';
import { formatDate } from '@/lib/dateUtils';
import type { DbTruckMaintenance } from '@/hooks/useTruckMaintenance';

interface Props {
  item: DbTruckMaintenance;
  onEdit: () => void;
  onDelete: () => void;
  onLogService: () => void;
}

export function MaintenanceCard({ item, onEdit, onDelete, onLogService }: Props) {
  const cfg = getMaintenanceTypeConfig(
    item.maintenance_type.toLowerCase().replace(/\s+/g, '_')
  );
  const colors = getStatusColor(item.status);
  const Icon = cfg.icon;

  const milesPercent = item.interval_miles && item.interval_miles > 0
    ? Math.min((item.miles_accumulated / item.interval_miles) * 100, 100)
    : null;

  const daysRemaining = item.next_due_date
    ? Math.ceil((new Date(item.next_due_date).getTime() - Date.now()) / 86400000)
    : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-lg border ${colors.border} ${colors.bg} p-4 space-y-3`}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <div className={`p-1.5 rounded-md ${colors.bg}`}>
            <Icon className={`h-4 w-4 ${colors.text}`} />
          </div>
          <div>
            <p className="font-semibold text-sm">{item.maintenance_type}</p>
            {item.description && <p className="text-xs text-muted-foreground">{item.description}</p>}
          </div>
        </div>
        <Badge variant="outline" className={`${colors.text} ${colors.border} text-[10px] uppercase font-bold`}>
          {item.status}
        </Badge>
      </div>

      {/* Miles progress */}
      {milesPercent !== null && (
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{item.miles_accumulated.toLocaleString()} mi</span>
            <span>{item.interval_miles?.toLocaleString()} mi interval</span>
          </div>
          <div className="relative">
            <Progress
              value={milesPercent}
              className="h-2"
            />
          </div>
        </div>
      )}

      {/* Info row */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span>Last: {formatDate(item.last_performed_at)}</span>
        <span>Odometer: {item.last_miles.toLocaleString()} mi</span>
        {daysRemaining !== null && (
          <span className={daysRemaining <= 0 ? 'text-red-600 font-medium' : daysRemaining <= 30 ? 'text-amber-600' : ''}>
            {daysRemaining <= 0 ? `${Math.abs(daysRemaining)}d overdue` : `${daysRemaining}d remaining`}
          </span>
        )}
        {item.cost ? <span>${Number(item.cost).toFixed(2)}</span> : null}
      </div>

      {/* Actions */}
      <div className="flex gap-1.5 pt-1">
        <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={onLogService}>
          <RotateCcw className="h-3 w-3" /> Log Service
        </Button>
        <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={onEdit}>
          <Pencil className="h-3 w-3" />
        </Button>
        <Button size="sm" variant="ghost" className="h-7 text-xs text-destructive" onClick={onDelete}>
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>
    </motion.div>
  );
}
