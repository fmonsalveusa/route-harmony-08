import { Badge } from '@/components/ui/badge';

const statusConfig: Record<string, { label: string; className: string }> = {
  pending: { label: 'Pendiente', className: 'status-pending' },
  in_transit: { label: 'En Tránsito', className: 'status-transit' },
  delivered: { label: 'Entregada', className: 'status-delivered' },
  paid: { label: 'Pagada', className: 'status-paid' },
  cancelled: { label: 'Cancelada', className: 'status-cancelled' },
  available: { label: 'Disponible', className: 'status-active' },
  assigned: { label: 'Asignado', className: 'status-transit' },
  resting: { label: 'Descanso', className: 'status-pending' },
  inactive: { label: 'Inactivo', className: 'status-cancelled' },
  on_route: { label: 'En Ruta', className: 'status-transit' },
  maintenance: { label: 'Mantenimiento', className: 'status-pending' },
  active: { label: 'Activo', className: 'status-active' },
  processing: { label: 'Procesando', className: 'status-transit' },
  overdue: { label: 'Vencida', className: 'status-cancelled' },
};

export const StatusBadge = ({ status }: { status: string }) => {
  const config = statusConfig[status] || { label: status, className: '' };
  return <span className={`status-badge ${config.className}`}>{config.label}</span>;
};
