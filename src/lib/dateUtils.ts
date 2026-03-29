/**
 * Centralized date formatting for the entire application.
 * All dates are displayed in MM/DD/YYYY format, US Eastern timezone.
 */

/** Format a date string (YYYY-MM-DD or ISO) to MM/DD/YYYY for display */
export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  try {
    // Handle YYYY-MM-DD format (treat as local date, not UTC)
    const parts = dateStr.split('T')[0].split('-');
    if (parts.length === 3) {
      const [y, m, d] = parts;
      return `${m}/${d}/${y}`;
    }
    return dateStr;
  } catch {
    return dateStr || '—';
  }
}

/** Get today's date as YYYY-MM-DD in US Eastern timezone */
export function todayET(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
}

/** Get current datetime as ISO string in US Eastern timezone context */
export function nowET(): Date {
  const str = new Date().toLocaleString('en-US', { timeZone: 'America/New_York' });
  return new Date(str);
}

/** Get ISO week number (1-53) for a given date */
export function getISOWeek(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}
