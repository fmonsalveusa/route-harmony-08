import { Pencil, Trash2, RotateCcw } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DbTruckMaintenance } from '@/hooks/useTruckMaintenance';
import { getMaintenanceTypeConfig, getStatusColor } from './maintenanceConstants';

interface AllServicesTableProps {
  items: DbTruckMaintenance[];
  getTruckLabel: (id: string) => string;
  onEdit: (item: DbTruckMaintenance) => void;
  onDelete: (id: string) => void;
  onLogService: (item: DbTruckMaintenance) => void;
  onViewHistory: (item: DbTruckMaintenance) => void;
}

export function AllServicesTable({ items, getTruckLabel, onEdit, onDelete, onLogService, onViewHistory }: AllServicesTableProps) {
  const sorted = [...items].sort((a, b) =>
    new Date(b.last_performed_at).getTime() - new Date(a.last_performed_at).getTime()
  );

  if (sorted.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        No maintenance records match your filters.
      </div>
    );
  }

  return (
    <div className="rounded-md border overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Truck</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Description</TableHead>
            <TableHead>Recurring</TableHead>
            <TableHead className="text-right">Odometer</TableHead>
            <TableHead className="text-right">Miles Accum.</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Cost</TableHead>
            <TableHead>Vendor</TableHead>
            <TableHead className="w-[100px]" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.map((item) => {
            const config = getMaintenanceTypeConfig(item.maintenance_type);
            const Icon = config.icon;
            const isRecurring = !!(item.interval_miles || item.interval_days);
            const statusColor = getStatusColor(item.status);

            return (
              <TableRow key={item.id}>
                <TableCell className="py-2 text-sm whitespace-nowrap">
                  {new Date(item.last_performed_at).toLocaleDateString()}
                </TableCell>
                <TableCell className="py-2 text-sm font-medium whitespace-nowrap">
                  {getTruckLabel(item.truck_id)}
                </TableCell>
                <TableCell className="py-2">
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">{config.label}</span>
                  </div>
                </TableCell>
                <TableCell className="py-2 text-sm text-muted-foreground max-w-[180px] truncate">
                  {item.description || '—'}
                </TableCell>
                <TableCell className="py-2">
                  <Badge variant={isRecurring ? 'default' : 'secondary'} className="text-xs">
                    {isRecurring ? 'Yes' : 'No'}
                  </Badge>
                </TableCell>
                <TableCell className="py-2 text-sm text-right tabular-nums">
                  {item.last_miles.toLocaleString()} mi
                </TableCell>
                <TableCell className="py-2 text-sm text-right tabular-nums">
                  {isRecurring ? `${(item.miles_accumulated ?? 0).toLocaleString()} mi` : '—'}
                </TableCell>
                <TableCell className="py-2">
                  {isRecurring ? (
                    <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${statusColor.text}`}>
                      <span className={`h-2 w-2 rounded-full ${statusColor.dot}`} />
                      {item.status.toUpperCase()}
                    </span>
                  ) : '—'}
                </TableCell>
                <TableCell className="py-2 text-sm text-right tabular-nums">
                  {item.cost ? `$${item.cost.toLocaleString()}` : '—'}
                </TableCell>
                <TableCell className="py-2 text-sm text-muted-foreground">
                  {item.vendor || '—'}
                </TableCell>
                <TableCell className="py-2">
                  <div className="flex items-center gap-1">
                    {isRecurring && (
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onLogService(item)} title="Log Service">
                        <RotateCcw className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEdit(item)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => onDelete(item.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
