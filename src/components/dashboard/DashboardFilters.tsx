import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';

interface DashboardFiltersProps {
  year: string;
  month: string;
  week: string;
  onYearChange: (v: string) => void;
  onMonthChange: (v: string) => void;
  onWeekChange: (v: string) => void;
}

const currentYear = new Date().getFullYear();
const years = Array.from({ length: 5 }, (_, i) => String(currentYear - i));

const months = [
  { value: '01', label: 'Enero' }, { value: '02', label: 'Febrero' },
  { value: '03', label: 'Marzo' }, { value: '04', label: 'Abril' },
  { value: '05', label: 'Mayo' }, { value: '06', label: 'Junio' },
  { value: '07', label: 'Julio' }, { value: '08', label: 'Agosto' },
  { value: '09', label: 'Septiembre' }, { value: '10', label: 'Octubre' },
  { value: '11', label: 'Noviembre' }, { value: '12', label: 'Diciembre' },
];

const weeks = Array.from({ length: 53 }, (_, i) => ({ value: String(i + 1), label: `Semana ${i + 1}` }));

export function DashboardFilters({ year, month, week, onYearChange, onMonthChange, onWeekChange }: DashboardFiltersProps) {
  const hasFilters = year !== 'all' || month !== 'all' || week !== 'all';

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select value={year} onValueChange={onYearChange}>
        <SelectTrigger className="w-[110px] h-8 text-xs"><SelectValue placeholder="Año" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos</SelectItem>
          {years.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}
        </SelectContent>
      </Select>
      <Select value={month} onValueChange={onMonthChange}>
        <SelectTrigger className="w-[130px] h-8 text-xs"><SelectValue placeholder="Mes" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos</SelectItem>
          {months.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
        </SelectContent>
      </Select>
      <Select value={week} onValueChange={onWeekChange}>
        <SelectTrigger className="w-[130px] h-8 text-xs"><SelectValue placeholder="Semana" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todas</SelectItem>
          {weeks.map(w => <SelectItem key={w.value} value={w.value}>{w.label}</SelectItem>)}
        </SelectContent>
      </Select>
      {hasFilters && (
        <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => { onYearChange('all'); onMonthChange('all'); onWeekChange('all'); }}>
          <X className="h-3 w-3 mr-1" /> Limpiar
        </Button>
      )}
    </div>
  );
}
