export const SERVICE_LABELS: Record<string, string> = {
  company_driver: 'Company Driver',
  owner_operator: 'Owner Operator',
  dispatch_service: 'Dispatch Service',
};

const SERVICE_COLORS: Record<string, string> = {
  company_driver: '#16A34A',   // verde
  owner_operator: '#EA580C',   // naranja
  dispatch_service: '#2563EB', // azul
};

/** Tipo de servicio del driver, con su color */
export function ServiceTypeBadge({ serviceType, className = '' }: { serviceType?: string | null; className?: string }) {
  const type = serviceType || '';
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold text-white whitespace-nowrap ${className}`}
      style={{ backgroundColor: SERVICE_COLORS[type] || '#94A3B8' }}
    >
      {SERVICE_LABELS[type] || type.replace(/_/g, ' ') || '—'}
    </span>
  );
}
