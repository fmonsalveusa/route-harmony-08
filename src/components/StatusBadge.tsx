import { Badge } from '@/components/ui/badge';

const statusConfig: Record<string, { label: string; className: string }> = {
  planned:          { label: 'Planned',          className: 'bg-[#94A3B8] text-white' },
  dispatched:       { label: 'Dispatched',        className: 'bg-[#2563EB] text-white' },
  in_transit:       { label: 'In Transit',        className: 'bg-[#65A30D] text-white' },
  on_site_pickup:   { label: 'On Site - Pickup',  className: 'bg-[#06B6D4] text-white' },
  picked_up:        { label: 'Picked Up',         className: 'bg-[#D946EF] text-white' },
  on_site_delivery: { label: 'On Site - Delivery',className: 'bg-[#F97316] text-white' },
  delivered:        { label: 'Delivered',         className: 'bg-[#178504] text-white' },
  tonu:             { label: 'TONU',              className: 'bg-[#B45309] text-white' },
  cancelled:        { label: 'Canceled',          className: 'bg-[#DC2626] text-white' },
  // Factoring statuses
  pending_factoring: { label: 'Pending', className: 'bg-[hsl(38,92%,50%)] text-white' },
  in_progress_factoring: { label: 'In Progress', className: 'bg-[#266aad] text-white' },
  ready_factoring: { label: 'Ready', className: 'bg-[#178504] text-white' },
  // Driver statuses
  available: { label: 'Available', className: 'bg-[#178504] text-white' },
  inactive: { label: 'Inactive', className: 'bg-[#DC2626] text-white' },
  pending: { label: 'Pending', className: 'bg-[hsl(38,92%,50%)] text-white' },
  // Payment statuses
  paid:       { label: 'Paid',        className: 'bg-[#178504] text-white' },
  in_process: { label: 'In Progress', className: 'bg-[#266aad] text-white' },
  // Truck statuses
  active: { label: 'Active', className: 'bg-[#178504] text-white' },
  maintenance: { label: 'Maintenance', className: 'bg-[hsl(38,92%,50%)] text-white' },
  // Invoice statuses
  invoice_pending: { label: 'Pending', className: 'bg-[hsl(38,92%,50%)] text-white' },
  invoice_sent: { label: 'Sent', className: 'bg-[#266aad] text-white' },
  invoice_paid: { label: 'Paid', className: 'bg-[#178504] text-white' },
  // Document statuses
  completed: { label: 'Completed', className: 'bg-[#178504] text-white' },
};

export const StatusBadge = ({ status, className: extraClass }: { status: string; className?: string }) => {
  const config = statusConfig[status] || { label: status, className: 'bg-muted text-muted-foreground' };
  return <span className={`inline-flex items-center justify-center rounded-md px-3 py-1 text-xs font-bold uppercase tracking-wide shadow-sm w-[140px] ${config.className} ${extraClass || ''}`}>{config.label}</span>;
};
