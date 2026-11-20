import { AlertTriangle } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { LoadAlert } from '@/lib/loadAlerts';
import { cn } from '@/lib/utils';

/** Chip ámbar con lo que no cuadra en la carga. No muestra nada si no hay alertas. */
export const LoadAlertChip = ({ alerts, className, onClick }: { alerts: LoadAlert[]; className?: string; onClick?: () => void }) => {
  if (alerts.length === 0) return null;
  const text = alerts.length === 1 ? alerts[0].label : `${alerts.length} alertas`;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onClick?.(); }}
          className={cn(
            'inline-flex items-center gap-1 max-w-full px-2 py-0.5 rounded-full text-[11px] font-medium bg-[#feefc3] text-[#7a4f01] hover:bg-[#fde293] dark:bg-amber-900/40 dark:text-amber-200 transition-colors',
            className,
          )}
        >
          <AlertTriangle className="h-3 w-3 shrink-0" />
          <span className="truncate">{text}</span>
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="max-w-xs">
        <ul className="space-y-0.5 text-xs">
          {alerts.map((a) => <li key={a.code}>• {a.label}</li>)}
        </ul>
      </TooltipContent>
    </Tooltip>
  );
};
