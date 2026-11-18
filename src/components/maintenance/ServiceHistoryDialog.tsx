import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useServiceLog } from '@/hooks/useServiceLog';
import { formatDate } from '@/lib/dateUtils';
import { Loader2, History, DollarSign, Gauge } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  maintenanceId: string | null;
  maintenanceType: string;
}

export function ServiceHistoryDialog({ open, onOpenChange, maintenanceId, maintenanceType }: Props) {
  const { logs, isLoading } = useServiceLog(open ? maintenanceId : null);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto rounded-[28px] border-0 bg-[#f8fafd] dark:bg-background [&_label]:text-xs [&_label]:font-medium [&_label]:text-[#444746] dark:[&_label]:text-muted-foreground [&_input:not([type=checkbox]):not([type=radio]):not([type=file])]:rounded-lg [&_input]:shadow-none [&_input:not([type=checkbox]):not([type=radio])]:bg-white dark:[&_input]:bg-card [&_input]:border-[#c4c7c5] dark:[&_input]:border-border [&_input:focus-visible]:ring-1 [&_input:focus-visible]:ring-[#0b57d0] [&_input:focus-visible]:border-[#0b57d0] [&_button[role=combobox]]:rounded-lg [&_button[role=combobox]]:shadow-none [&_button[role=combobox]]:bg-white dark:[&_button[role=combobox]]:bg-card [&_button[role=combobox]]:border-[#c4c7c5] dark:[&_button[role=combobox]]:border-border [&_textarea]:rounded-lg [&_textarea]:shadow-none [&_textarea]:bg-white dark:[&_textarea]:bg-card [&_textarea]:border-[#c4c7c5]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-[22px] leading-7 font-normal text-[#1f1f1f] dark:text-foreground">
            <History className="h-5 w-5" />
            Service History — {maintenanceType}
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : logs.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-8">
            No service history recorded yet.
          </p>
        ) : (
          <div className="space-y-3">
            {logs.map((log, idx) => {
              const prevLog = logs[idx + 1]; // logs está ordenado DESC, el siguiente es el anterior
              const milesDriven = prevLog
                ? Number(log.odometer_miles) - Number(prevLog.odometer_miles)
                : null;
              return (
              <div
                key={log.id}
                className="relative pl-6 pb-3 border-l-2 border-muted last:border-l-0"
              >
                {/* Timeline dot */}
                <div className={`absolute -left-[5px] top-1 w-2 h-2 rounded-full ${idx === 0 ? 'bg-primary' : 'bg-muted-foreground/40'}`} />

                <div className="rounded-md border bg-card p-3 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold">{formatDate(log.performed_at)}</p>
                    {milesDriven !== null && milesDriven > 0 && (
                      <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                        +{milesDriven.toLocaleString()} mi desde último servicio
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Gauge className="h-3 w-3" />
                      {Number(log.odometer_miles).toLocaleString()} mi
                    </span>
                    {log.cost != null && (
                      <span className="flex items-center gap-1">
                        <DollarSign className="h-3 w-3" />
                        ${Number(log.cost).toFixed(2)}
                      </span>
                    )}
                    {log.vendor && <span>{log.vendor}</span>}
                  </div>
                  {log.notes && <p className="text-xs text-muted-foreground">{log.notes}</p>}
                </div>
              </div>
            );})}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
