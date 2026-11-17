import type { DbTruck } from '@/hooks/useTrucks';
import {
  Factory, Car, CalendarDays, Truck as TruckIcon, Hash, RectangleHorizontal, User, Weight,
  Ruler, MoveHorizontal, MoveVertical, DoorOpen, Container, Wrench, ShieldCheck,
  FileBadge, ClipboardCheck, AlertTriangle,
} from 'lucide-react';
import { useTruckMaintenance } from '@/hooks/useTruckMaintenance';
import { DocCardGrid } from '@/components/DocCardGrid';
import { TruckCostsSection } from '@/components/TruckCostsSection';
import { cn } from '@/lib/utils';
import { Tile, ExpiryRing, daysUntil, DETAIL_CARD, DETAIL_TITLE } from '@/components/detail/DetailTiles';

const CARD = DETAIL_CARD;
const TITLE = DETAIL_TITLE;

const DOC_LABELS: { key: keyof DbTruck; label: string }[] = [
  { key: 'registration_photo_url', label: 'Registration' },
  { key: 'insurance_photo_url', label: 'Insurance' },
  { key: 'annual_inspection_photo_url', label: 'Annual Inspection' },
  { key: 'rear_truck_photo_url', label: 'Rear Photo' },
  { key: 'truck_side_photo_url', label: 'Side Photo' },
  { key: 'truck_plate_photo_url', label: 'Plate Photo' },
  { key: 'cargo_area_photo_url', label: 'Cargo Area' },
];

const STATUS: Record<string, { label: string; cls: string }> = {
  active: { label: 'ACTIVE', cls: 'bg-[#188038]' },
  maintenance: { label: 'MAINTENANCE', cls: 'bg-[#e37400]' },
  inactive: { label: 'INACTIVE', cls: 'bg-[#d93025]' },
};

interface Props {
  truck: DbTruck;
  driverName: string | null;
  getDocSignedUrl?: (storedUrl: string) => Promise<string | null>;
  onUpdateTruck?: (id: string, updates: Record<string, any>) => Promise<boolean>;
}

export function TruckDetailPanel({ truck, driverName, getDocSignedUrl, onUpdateTruck }: Props) {
  const { maintenanceItems } = useTruckMaintenance();
  const truckMaint = maintenanceItems.filter(m => m.truck_id === truck.id);
  const t = truck as any;
  const status = STATUS[truck.status] ?? { label: String(truck.status ?? '').toUpperCase(), cls: 'bg-[#5f6368]' };
  const subtitle = [truck.year, truck.make, truck.model].filter(Boolean).join(' ');
  const docsLoaded = DOC_LABELS.filter(d => !!truck[d.key]).length;

  return (
    <div className="px-4 py-3 bg-[#f8fafd] dark:bg-background/60 border-t border-[#e3e3e3] dark:border-border animate-fade-in space-y-3">
      {/* ═══ Encabezado del camión ═══ */}
      <div className="rounded-3xl bg-white dark:bg-card border border-[#e3e3e3] dark:border-border px-4 py-3 flex flex-wrap items-center gap-x-4 gap-y-3">
        <span className="h-12 w-12 shrink-0 rounded-2xl bg-[#d3e3fd] dark:bg-blue-900/40 text-[#041e49] dark:text-blue-200 flex items-center justify-center">
          <TruckIcon className="h-6 w-6" />
        </span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-[26px] leading-8 font-normal text-[#1f1f1f] dark:text-foreground">Unit {truck.unit_number}</h2>
            {truck.truck_type && (
              <span className="rounded-full bg-[#e8f0fe] dark:bg-blue-950/40 text-[#0b57d0] dark:text-blue-300 px-2.5 py-0.5 text-xs font-medium">{truck.truck_type}</span>
            )}
            <span className={cn('rounded-md px-2.5 py-0.5 text-[11px] font-bold tracking-wide text-white', status.cls)}>{status.label}</span>
          </div>
          {subtitle && <p className="text-sm text-[#444746] dark:text-muted-foreground">{subtitle}</p>}
        </div>
        <div className="ml-auto flex items-center gap-2.5 rounded-full bg-[#f0f4f9] dark:bg-muted/60 pl-1.5 pr-4 py-1.5">
          <span className={cn('h-9 w-9 rounded-full flex items-center justify-center text-sm font-medium text-white', driverName ? 'bg-[#0b57d0]' : 'bg-[#9aa0a6]')}>
            {driverName ? driverName.trim().charAt(0).toUpperCase() : <User className="h-4 w-4" />}
          </span>
          <div className="leading-tight">
            <p className="text-[10.5px] uppercase tracking-wide text-[#444746] dark:text-muted-foreground">Driver</p>
            <p className="text-sm text-[#1f1f1f] dark:text-foreground">{driverName || 'Sin asignar'}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 items-start">
        {/* ═══ General Information ═══ */}
        <div className={CARD}>
          <h3 className={TITLE}>General Information</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <Tile icon={Factory} tone="blue" label="Make" value={truck.make || '—'} />
            <Tile icon={Car} tone="sky" label="Model" value={truck.model || '—'} />
            <Tile icon={CalendarDays} tone="violet" label="Year" value={truck.year ?? '—'} />
            <Tile icon={TruckIcon} tone="green" label="Truck Type" value={truck.truck_type || '—'} />
            <div className="sm:col-span-2"><Tile icon={Hash} tone="gray" label="VIN" value={<span className="font-mono text-[13px]">{truck.vin || '—'}</span>} copy={truck.vin} /></div>
            <Tile icon={RectangleHorizontal} tone="amber" label="License Plate" value={truck.license_plate || '—'} copy={truck.license_plate} />
            <Tile icon={Weight} tone="red" label="Max Payload" value={truck.max_payload_lbs ? `${truck.max_payload_lbs.toLocaleString()} lbs` : '—'} />
          </div>

          {truck.truck_type === 'Box Truck' && (
            <>
              <p className="text-[11px] uppercase tracking-wide text-[#444746] dark:text-muted-foreground pt-1">Cargo Box</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <Tile icon={Ruler} tone="sky" label="Length (ft)" value={truck.cargo_length_ft ?? '—'} />
                <Tile icon={MoveHorizontal} tone="sky" label="Width (in)" value={truck.cargo_width_in ?? '—'} />
                <Tile icon={MoveVertical} tone="sky" label="Height (in)" value={truck.cargo_height_in ?? '—'} />
                <Tile icon={DoorOpen} tone="sky" label="Door W × H (in)" value={`${truck.rear_door_width_in ?? '—'} × ${truck.rear_door_height_in ?? '—'}`} />
              </div>
            </>
          )}
        </div>

        {/* ═══ Trailer + Maintenance ═══ */}
        <div className="space-y-3">
          <div className={CARD}>
            <h3 className={TITLE}>Trailer Information</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <Tile icon={Container} tone="violet" label="Trailer #" value={truck.trailer_number ?? '—'} copy={truck.trailer_number ? String(truck.trailer_number) : null} />
              <Tile icon={Ruler} tone="violet" label="Length (ft)" value={truck.trailer_length_ft ?? '—'} />
              <Tile icon={MoveVertical} tone="violet" label="Mega Ramp" value={truck.mega_ramp || '—'} />
            </div>
          </div>

          <div className={CARD}>
            <h3 className={cn(TITLE, 'flex items-center gap-2')}><Wrench className="h-4 w-4 text-[#0b57d0] dark:text-blue-300" /> Maintenance</h3>
            {truckMaint.length === 0 ? (
              <p className="text-sm text-[#444746] dark:text-muted-foreground">Sin mantenimientos programados.</p>
            ) : (
              <div className="space-y-2.5">
                {truckMaint.map(m => {
                  const byMiles = !!(m.interval_miles && m.interval_miles > 0);
                  const used = byMiles ? Math.min(1, m.miles_accumulated / m.interval_miles!) : null;
                  const leftMiles = byMiles ? m.interval_miles! - m.miles_accumulated : null;
                  const leftDays = daysUntil(m.next_due_date);
                  const color = m.status === 'due' ? '#d93025' : m.status === 'warning' ? '#f9ab00' : '#188038';
                  // Como la batería: llena cuando recién se hizo, se vacía al acercarse el servicio
                  const remaining = used !== null ? 1 - used : leftDays !== null ? Math.max(0, Math.min(1, leftDays / 90)) : 1;
                  const text = leftMiles !== null
                    ? (leftMiles <= 0 ? `Vencido por ${Math.abs(leftMiles).toLocaleString()} mi` : `Faltan ${leftMiles.toLocaleString()} mi`)
                    : leftDays !== null ? (leftDays < 0 ? `Vencido hace ${Math.abs(leftDays)} días` : `Faltan ${leftDays} días`) : '—';
                  return (
                    <div key={m.id}>
                      <div className="flex items-center justify-between gap-2 text-sm">
                        <span className="text-[#1f1f1f] dark:text-foreground truncate">{m.maintenance_type}</span>
                        <span className="shrink-0 text-xs font-medium flex items-center gap-1" style={{ color }}>
                          {m.status === 'due' && <AlertTriangle className="h-3.5 w-3.5" />}{text}
                        </span>
                      </div>
                      <div className="mt-1 h-2 rounded-full bg-[#e3e3e3] dark:bg-muted overflow-hidden">
                        <div className="h-full rounded-full transition-all" style={{ width: `${Math.max(4, remaining * 100)}%`, background: color }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ═══ Documents ═══ */}
        <div className={CARD}>
          <div className="flex items-center justify-between gap-2">
            <h3 className={TITLE}>Documents</h3>
            <span className="text-xs text-[#444746] dark:text-muted-foreground">{docsLoaded} de {DOC_LABELS.length} cargados</span>
          </div>
          <div className="space-y-2">
            <ExpiryRing icon={ShieldCheck} label="Insurance" date={truck.insurance_expiry} />
            <ExpiryRing icon={FileBadge} label="Registration" date={truck.registration_expiry} />
            <ExpiryRing icon={ClipboardCheck} label="Annual Inspection" date={t.annual_inspection_expiry} />
          </div>
          <DocCardGrid
            variant="tiles"
            docs={DOC_LABELS.map(doc => ({ key: String(doc.key), label: doc.label, url: truck[doc.key] as string | null }))}
            getDocSignedUrl={getDocSignedUrl}
            allowUpload={!!onUpdateTruck}
            uploadBasePath={`trucks/${truck.id}`}
            onUpload={onUpdateTruck ? async (key, newUrl) => {
              await onUpdateTruck(truck.id, { [key]: newUrl });
            } : undefined}
          />
        </div>
      </div>

      <TruckCostsSection truck={truck} />
    </div>
  );
}
