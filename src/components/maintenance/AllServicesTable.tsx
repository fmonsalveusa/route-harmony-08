import { useState } from 'react';
import { Pencil, Trash2, RotateCcw, ChevronDown, ChevronRight, History, Gauge, DollarSign } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DbTruckMaintenance } from '@/hooks/useTruckMaintenance';
import { useServiceLog } from '@/hooks/useServiceLog';
import { getMaintenanceTypeConfig, getStatusColor } from './maintenanceConstants';
import { formatDate } from '@/lib/dateUtils';

interface AllServicesTableProps {
  items: DbTruckMaintenance[];
  getTruckLabel: (id: string) => string;
  onEdit: (item: DbTruckMaintenance) => void;
  onDelete: (id: string) => void;
  onLogService: (item: DbTruckMaintenance) => void;
  onViewHistory: (item: DbTruckMaintenance) => void;
}

function ServiceHistoryRow({ maintenanceId }: { maintenanceId: string }) {
  const { logs, isLoading } = useServiceLog(maintenanceId);

  if (isLoading) {
    return (
      <TableRow>
        <TableCell colSpan={11} className="py-4 text-center text-muted-foreground text-xs">
          Loading history…
        </TableCell>
      </TableRow>
    );
  }

  if (logs.length === 0) {
    return (
      <TableRow>
        <TableCell colSpan={11} className="py-4 text-center text-muted-foreground text-xs">
          No service history recorded yet.
        </TableCell>
      </TableRow>
    );
  }

  return (
    <>
      {logs.map((log) => (
        <TableRow key={log.id} className="bg-muted/30">
          <TableCell className="py-1.5 pl-10 text-xs text-muted-foreground whitespace-nowrap">
            {formatDate(log.performed_at)}
          </TableCell>
          <TableCell className="py-1.5 text-xs text-muted-foreground" />
          <TableCell className="py-1.5 text-xs text-muted-foreground italic" colSpan={2}>
            <div className="flex items-center gap-1">
              <History className="h-3 w-3" />
              Service Log
            </div>
          </TableCell>
          <TableCell className="py-1.5" />
          <TableCell className="py-1.5 text-xs text-right tabular-nums text-muted-foreground">
            <span className="flex items-center justify-end gap-1">
              <Gauge className="h-3 w-3" />
              {Number(log.odometer_miles).toLocaleString()} mi
            </span>
          </TableCell>
          <TableCell className="py-1.5" />
          <TableCell className="py-1.5" />
          <TableCell className="py-1.5 text-xs text-right tabular-nums text-muted-foreground">
            {log.cost != null ? (
              <span className="flex items-center justify-end gap-1">
                <DollarSign className="h-3 w-3" />
                ${Number(log.cost).toFixed(2)}
              </span>
            ) : '—'}
          </TableCell>
          <TableCell className="py-1.5 text-xs text-muted-foreground">
            {log.vendor || '—'}
          </TableCell>
          <TableCell className="py-1.5" />
        </TableRow>
      ))}
    </>
  );
}

export function AllServicesTable({ items, getTruckLabel, onEdit, onDelete, onLogService, onViewHistory }: AllServicesTableProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const sorted = [...items].sort((a, b) =>
    new Date(b.last_performed_at).getTime() - new Date(a.last_performed_at).getTime()
  );

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

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
            <TableHead className="w-[120px]" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.map((item) => {
            const config = getMaintenanceTypeConfig(item.maintenance_type);
            const Icon = config.icon;
            const isRecurring = !!(item.interval_miles || item.interval_days);
            const statusColor = getStatusColor(item.status);
            const isExpanded = expandedIds.has(item.id);

            return (
              <>
                <TableRow key={item.id}>
                  <TableCell className="py-2 text-sm whitespace-nowrap">
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5 shrink-0"
                        onClick={() => toggleExpand(item.id)}
                      >
                        {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                      </Button>
                      {new Date(item.last_performed_at).toLocaleDateString()}
                    </div>
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
                {isExpanded && <ServiceHistoryRow maintenanceId={item.id} />}
              </>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
