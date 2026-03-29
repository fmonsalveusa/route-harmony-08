import { AlertTriangle, ShieldAlert } from 'lucide-react';
import { isPast, addDays, differenceInDays } from 'date-fns';
import { formatDate } from '@/lib/dateUtils';

interface ExpiryBadgeProps {
  date: string | null | undefined;
  label: string;
}

export function ExpiryBadge({ date, label }: ExpiryBadgeProps) {
  if (!date) return null;

  const expiryDate = new Date(date + 'T00:00:00');
  const now = new Date();
  const expired = isPast(expiryDate);
  const daysLeft = differenceInDays(expiryDate, now);
  const nearExpiry = !expired && daysLeft <= 30;

  if (!expired && !nearExpiry) return null;

  return (
    <div
      className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-medium ${
        expired
          ? 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800 text-red-700 dark:text-red-400'
          : 'bg-orange-50 dark:bg-orange-950/30 border-orange-200 dark:border-orange-800 text-orange-700 dark:text-orange-400'
      }`}
    >
      {expired ? (
        <ShieldAlert className="h-4 w-4 shrink-0" />
      ) : (
        <AlertTriangle className="h-4 w-4 shrink-0" />
      )}
      <span>
        {label}: {expired ? 'Expired' : `Expires in ${daysLeft} days`} — {formatDate(date)}
      </span>
    </div>
  );
}
