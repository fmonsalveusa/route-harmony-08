import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Filter } from 'lucide-react';

interface FilterOption {
  id: string;
  name: string;
}

interface DashboardFiltersProps {
  year: string;
  month: string;
  week: string;
  dispatcher: string;
  driver: string;
  onYearChange: (v: string) => void;
  onMonthChange: (v: string) => void;
  onWeekChange: (v: string) => void;
  onDispatcherChange: (v: string) => void;
  onDriverChange: (v: string) => void;
  dispatchers: FilterOption[];
  drivers: FilterOption[];
  hideDispatcherFilter?: boolean;
}

const currentYear = new Date().getFullYear();
const years = Array.from({ length: 5 }, (_, i) => String(currentYear - i));

const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];

export function DashboardFilters({
  year, month, week, dispatcher, driver,
  onYearChange, onMonthChange, onWeekChange, onDispatcherChange, onDriverChange,
  dispatchers, drivers, hideDispatcherFilter,
}: DashboardFiltersProps) {
  return (
    <div className="flex flex-wrap gap-2 items-center">
      <Filter className="h-4 w-4 text-muted-foreground" />
      <Select value={year} onValueChange={onYearChange}>
        <SelectTrigger className="w-[120px] h-8 text-xs">
          <SelectValue placeholder="Year" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Years</SelectItem>
          {years.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}
        </SelectContent>
      </Select>
      <Select value={month} onValueChange={onMonthChange}>
        <SelectTrigger className="w-[130px] h-8 text-xs">
          <SelectValue placeholder="Month" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Months</SelectItem>
          {monthNames.map((m, i) => (
            <SelectItem key={i} value={String(i + 1).padStart(2, '0')}>{m}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={week} onValueChange={onWeekChange}>
        <SelectTrigger className="w-[220px] h-8 text-xs">
          <SelectValue placeholder="Week" />
        </SelectTrigger>
        <SelectContent className="max-h-[300px]">
          <SelectItem value="all">All Weeks</SelectItem>
          {Array.from({ length: 52 }, (_, i) => {
            const weekNum = i + 1;
            const yr = Number(year !== 'all' ? year : currentYear);
            const jan4 = new Date(yr, 0, 4);
            const mondayOfWeek1 = new Date(jan4);
            mondayOfWeek1.setDate(jan4.getDate() - ((jan4.getDay() + 6) % 7));
            const start = new Date(mondayOfWeek1);
            start.setDate(mondayOfWeek1.getDate() + (weekNum - 1) * 7);
            const end = new Date(start);
            end.setDate(start.getDate() + 6);
            const fmt = (d: Date) => `${d.getMonth() + 1}/${d.getDate()}`;
            return (
              <SelectItem key={weekNum} value={String(weekNum)}>
                Week {weekNum} (Mon {fmt(start)} - Sun {fmt(end)})
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>
      {!hideDispatcherFilter && (
        <Select value={dispatcher} onValueChange={onDispatcherChange}>
          <SelectTrigger className="w-[160px] h-8 text-xs">
            <SelectValue placeholder="Dispatcher" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Dispatchers</SelectItem>
            {dispatchers.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
          </SelectContent>
        </Select>
      )}
      <Select value={driver} onValueChange={onDriverChange}>
        <SelectTrigger className="w-[160px] h-8 text-xs">
          <SelectValue placeholder="Driver" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Drivers</SelectItem>
          {drivers.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}
