import { Pencil, Trash2 } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { DbTruckMaintenance } from '@/hooks/useTruckMaintenance';
import { getMaintenanceTypeConfig } from './maintenanceConstants';

interface OneTimeMaintenanceTableProps {
  items: DbTruckMaintenance[];
  onEdit: (item: DbTruckMaintenance) => void;
  onDelete: (id: string) => void;
}

export function OneTimeMaintenanceTable({ items, onEdit, onDelete }: OneTimeMaintenanceTableProps) {
  if (items.length === 0) return null;

  return (
    <div className="mt-3">
      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-1">
        One-Time Services
      </h4>
      <div className="rounded-md border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Type</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Date</TableHead>
              <TableHead className="text-right">Odometer</TableHead>
              <TableHead className="text-right">Cost</TableHead>
              <TableHead>Vendor</TableHead>
              <TableHead className="w-[80px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => {
              const config = getMaintenanceTypeConfig(item.maintenance_type);
              const Icon = config.icon;
              return (
                <TableRow key={item.id}>
                  <TableCell className="py-2">
                    <div className="flex items-center gap-2">
                      <Icon className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">{config.label}</span>
                    </div>
                  </TableCell>
                  <TableCell className="py-2 text-sm">
                    {new Date(item.last_performed_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="py-2 text-sm text-right tabular-nums">
                    {item.last_miles.toLocaleString()} mi
                  </TableCell>
                  <TableCell className="py-2 text-sm text-right tabular-nums">
                    {item.cost ? `$${item.cost.toLocaleString()}` : '—'}
                  </TableCell>
                  <TableCell className="py-2 text-sm text-muted-foreground">
                    {item.vendor || '—'}
                  </TableCell>
                  <TableCell className="py-2">
                    <div className="flex items-center gap-1">
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
    </div>
  );
}
