import { Badge } from '@/components/ui/badge';

const statusConfig: Record<string, { label: string; className: string }> = {
  planned: { label: 'Planned', className: 'bg-[hsl(215,70%,50%)] text-white' },
  dispatched: { label: 'Dispatched', className: 'bg-[hsl(270,60%,50%)] text-white' },
  in_transit: { label: 'In Transit', className: 'bg-[hsl(205,85%,50%)] text-white' },
  delivered: { label: 'Delivered', className: 'bg-[hsl(152,60%,40%)] text-white' },
  tonu: { label: 'TONU', className: 'bg-[hsl(30,90%,50%)] text-white' },
  cancelled: { label: 'Canceled', className: 'bg-[hsl(0,72%,51%)] text-white' },
  // Factoring statuses
  pending_factoring: { label: 'Pending', className: 'bg-[hsl(38,92%,50%)] text-white' },
  in_progress_factoring: { label: 'In Progress', className: 'bg-[hsl(205,85%,50%)] text-white' },
  ready_factoring: { label: 'Ready', className: 'bg-[hsl(152,60%,40%)] text-white' },
  // Other statuses for drivers/trucks
  available: { label: 'Disponible', className: 'bg-[hsl(152,60%,40%)] text-white' },
  assigned: { label: 'Asignado', className: 'bg-[hsl(205,85%,50%)] text-white' },
  resting: { label: 'Descanso', className: 'bg-[hsl(38,92%,50%)] text-white' },
  inactive: { label: 'Inactivo', className: 'bg-[hsl(0,72%,51%)] text-white' },
  on_route: { label: 'En Ruta', className: 'bg-[hsl(205,85%,50%)] text-white' },
  maintenance: { label: 'Mantenimiento', className: 'bg-[hsl(38,92%,50%)] text-white' },
  active: { label: 'Activo', className: 'bg-[hsl(152,60%,40%)] text-white' },
  pending: { label: 'Pendiente', className: 'bg-[hsl(38,92%,50%)] text-white' },
  paid: { label: 'Pagada', className: 'bg-[hsl(152,60%,40%)] text-white' },
  processing: { label: 'Procesando', className: 'bg-[hsl(205,85%,50%)] text-white' },
  overdue: { label: 'Vencida', className: 'bg-[hsl(0,72%,51%)] text-white' },
};

export const StatusBadge = ({ status, className: extraClass }: { status: string; className?: string }) => {
  const config = statusConfig[status] || { label: status, className: 'bg-muted text-muted-foreground' };
  return <span className={`status-badge ${config.className} ${extraClass || ''}`}>{config.label}</span>;
};
