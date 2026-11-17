import type { DbTruck } from '@/hooks/useTrucks';
import {
  Factory, Car, CalendarDays, Truck as TruckIcon, Hash, RectangleHorizontal, User, Weight,
  Ruler, MoveHorizontal, MoveVertical, DoorOpen, Container, Wrench, ShieldCheck,
  FileBadge, ClipboardCheck, AlertTriangle,
} from 'lucide-react';
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
  const t = truck as any;
  const status = STATUS[truck.status] ?? { label: String(truck.status ?? '').toUpperCase(), cls: 'bg-[#5f6368]' };
  const subtitle = [truck.year, truck.make, truck.model].filter(Boolean).join(' ');
  const docsLoaded = DOC_LABELS.filter(d => !!truck[d.key]).length;

  return (
    <div className="px-4 py-3 bg-[#f8fafd] dark:bg-background/60 border-t border-[#e3e3e3] dark:border-border animate-fade-in space-y-3">
      <div className="grid grid-cols-1 lg:grid-cols-[3fr_7fr] gap-3 items-start">
        {/* Columna izquierda: General Information y Trailer Information */}
        <div className="space-y-3">
          <div className={CARD.replace('space-y-3', 'space-y-2')}>
            <h3 className={TITLE}>General Information</h3>
            <div className="grid grid-cols-2 gap-1.5">
              <Tile icon={Factory} tone="blue" label="Make" value={truck.make || '—'} />
              <Tile icon={Car} tone="sky" label="Model" value={truck.model || '—'} />
              <Tile icon={CalendarDays} tone="violet" label="Year" value={truck.year ?? '—'} />
              <Tile icon={Weight} tone="red" label="Max Payload" value={truck.max_payload_lbs ? `${truck.max_payload_lbs.toLocaleString()} lbs` : '—'} />
              <div className="col-span-2"><Tile icon={Hash} tone="gray" label="VIN" value={<span className="font-mono text-[13px]">{truck.vin || '—'}</span>} copy={truck.vin} /></div>
              <Tile icon={RectangleHorizontal} tone="amber" label="License Plate" value={truck.license_plate || '—'} copy={truck.license_plate} />
              <ExpiryRing icon={FileBadge} label="Registration" date={truck.registration_expiry} />
              <ExpiryRing icon={ShieldCheck} label="Insurance" date={truck.insurance_expiry} />
              <ExpiryRing icon={ClipboardCheck} label="Annual Inspection" date={t.annual_inspection_expiry} />
            </div>

            {truck.truck_type === 'Box Truck' && (
              <>
                <p className="text-[11px] uppercase tracking-wide text-[#444746] dark:text-muted-foreground">Cargo Box</p>
                <div className="grid grid-cols-2 gap-1.5">
                  <Tile icon={Ruler} tone="sky" label="Length (ft)" value={truck.cargo_length_ft ?? '—'} />
                  <Tile icon={MoveHorizontal} tone="sky" label="Width (in)" value={truck.cargo_width_in ?? '—'} />
                  <Tile icon={MoveVertical} tone="sky" label="Height (in)" value={truck.cargo_height_in ?? '—'} />
                  <Tile icon={DoorOpen} tone="sky" label="Door W × H (in)" value={`${truck.rear_door_width_in ?? '—'} × ${truck.rear_door_height_in ?? '—'}`} />
                </div>
              </>
            )}
          </div>

          <div className={CARD.replace('space-y-3', 'space-y-2')}>
            <h3 className={TITLE}>Trailer Information</h3>
            <div className="grid grid-cols-2 gap-1.5">
              <Tile icon={Container} tone="violet" label="Trailer #" value={truck.trailer_number ?? '—'} copy={truck.trailer_number ? String(truck.trailer_number) : null} />
              <Tile icon={Ruler} tone="violet" label="Length (ft)" value={truck.trailer_length_ft ?? '—'} />
              <Tile icon={MoveVertical} tone="violet" label="Mega Ramp" value={truck.mega_ramp || '—'} />
            </div>
          </div>
        </div>

        {/* Columna derecha: Documents */}
        <div className={CARD}>
          <div className="flex items-center justify-between gap-2">
            <h3 className={TITLE}>Documents</h3>
            <span className="text-xs text-[#444746] dark:text-muted-foreground">{docsLoaded} de {DOC_LABELS.length} cargados</span>
          </div>
          <DocCardGrid
            variant="cards"
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
