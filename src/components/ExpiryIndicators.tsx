import { AlertTriangle, ShieldAlert } from 'lucide-react';
import { isPast, differenceInDays } from 'date-fns';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface ExpiryDot {
  date: string | null | undefined;
  label: string;
}

interface Props {
  items: ExpiryDot[];
}

export function ExpiryIndicators({ items }: Props) {
  const alerts = items.filter(i => {
    if (!i.date) return false;
    const d = new Date(i.date + 'T00:00:00');
    const daysLeft = differenceInDays(d, new Date());
    return daysLeft <= 30;
  });

  if (alerts.length === 0) return null;

  return (
    <TooltipProvider>
      <div className="flex items-center gap-1">
        {alerts.map(item => {
          const d = new Date(item.date! + 'T00:00:00');
          const expired = isPast(d);
          const daysLeft = differenceInDays(d, new Date());

          return (
            <Tooltip key={item.label}>
              <TooltipTrigger asChild>
                <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                  expired
                    ? 'bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-400'
                    : 'bg-orange-100 dark:bg-orange-950/40 text-orange-700 dark:text-orange-400'
                }`}>
                  {expired ? (
                    <ShieldAlert className="h-3 w-3" />
                  ) : (
                    <AlertTriangle className="h-3 w-3" />
                  )}
                  {item.label}
                </span>
              </TooltipTrigger>
              <TooltipContent>
                <p className="text-xs">
                  {item.label}: {expired ? 'Expired' : `Expires in ${daysLeft} days`}
                </p>
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    </TooltipProvider>
  );
}
