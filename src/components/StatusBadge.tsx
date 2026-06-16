import { Badge } from '@/components/ui/badge';

const statusConfig: Record<string, { label: string; className: string }> = {
  planned:          { label: 'Planned',          className: 'bg-[#CBD5E1] text-[#334155]' },
  dispatched:       { label: 'Dispatched',        className: 'bg-[#EDE928] text-[#3a3600]' },
  in_transit:       { label: 'In Transit',        className: 'bg-[#86F705] text-[#1a3300]' },
  on_site_pickup:   { label: 'On Site - Pickup',  className: 'bg-[#0EA5E9] text-white' },
  picked_up:        { label: 'Picked Up',         className: 'bg-[#7C3AED] text-white' },
  on_site_delivery: { label: 'On Site - Delivery',className: 'bg-[#FF9D00] text-white' },
  delivered:        { label: 'Delivered',         className: 'bg-[#015C05] text-white' },
  tonu:             { label: 'TONU',              className: 'bg-[#EB00FF] text-white' },
  cancelled:        { label: 'Canceled',          className: 'bg-[#F70515] text-white' },
  // Factoring statuses
  pending_factoring: { label: 'Pending', className: 'bg-[hsl(38,92%,50%)] text-white' },
  in_progress_factoring: { label: 'In Progress', className: 'bg-[#266aad] text-white' },
  ready_factoring: { label: 'Ready', className: 'bg-[hsl(152,60%,40%)] text-white' },
  // Other statuses for drivers/trucks
  available: { label: 'Disponible', className: 'bg-[hsl(152,60%,40%)] text-white' },
  assigned: { label: 'Asignado', className: 'bg-[#266aad] text-white' },
  resting: { label: 'Descanso', className: 'bg-[hsl(38,92%,50%)] text-white' },
  inactive: { label: 'Inactivo', className: 'bg-[hsl(0,72%,51%)] text-white' },
  on_route: { label: 'En Ruta', className: 'bg-[#266aad] text-white' },
  maintenance: { label: 'Mantenimiento', className: 'bg-[hsl(38,92%,50%)] text-white' },
  active: { label: 'Activo', className: 'bg-[hsl(152,60%,40%)] text-white' },
  pending: { label: 'Pendiente', className: 'bg-[hsl(38,92%,50%)] text-white' },
  in_process: { label: 'In Process', className: 'bg-[#266aad] text-white' },
  paid: { label: 'Pagada', className: 'bg-[hsl(152,60%,40%)] text-white' },
  processing: { label: 'Procesando', className: 'bg-[#266aad] text-white' },
  overdue: { label: 'Vencida', className: 'bg-[hsl(0,72%,51%)] text-white' },
  // Invoice statuses
  invoice_pending: { label: 'Pending', className: 'bg-[hsl(38,92%,50%)] text-white' },
  invoice_sent: { label: 'Sent', className: 'bg-[#266aad] text-white' },
  invoice_paid: { label: 'Paid', className: 'bg-[hsl(152,60%,40%)] text-white' },
  // Document statuses
  completed: { label: 'Completado', className: 'bg-[hsl(152,60%,40%)] text-white' },
};

export const StatusBadge = ({ status, className: extraClass }: { status: string; className?: string }) => {
  const config = statusConfig[status] || { label: status, className: 'bg-muted text-muted-foreground' };
  return <span className={`inline-flex items-center justify-center rounded-md px-3 py-1 text-xs font-bold uppercase tracking-wide shadow-sm w-[140px] ${config.className} ${extraClass || ''}`}>{config.label}</span>;
};
