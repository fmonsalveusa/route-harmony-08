import type { DbTruck } from '@/hooks/useTrucks';
import { ExternalLink, FileText, Wrench } from 'lucide-react';
import { StatusBadge } from '@/components/StatusBadge';
import { formatDate } from '@/lib/dateUtils';
import { ExpiryBadge } from '@/components/ExpiryBadge';
import { useTruckMaintenance } from '@/hooks/useTruckMaintenance';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { getStatusColor } from '@/components/maintenance/maintenanceConstants';

function Info({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-muted-foreground text-xs">{label}</p>
      <div className="font-medium text-sm mt-0.5">{children}</div>
    </div>
  );
}

const DOC_LABELS: { key: keyof DbTruck; label: string }[] = [
  { key: 'registration_photo_url', label: 'Registration' },
  { key: 'insurance_photo_url', label: 'Insurance' },
  { key: 'license_photo_url', label: 'License' },
  { key: 'rear_truck_photo_url', label: 'Rear Photo' },
  { key: 'truck_side_photo_url', label: 'Side Photo' },
  { key: 'truck_plate_photo_url', label: 'Plate Photo' },
  { key: 'cargo_area_photo_url', label: 'Cargo Area' },
];

interface Props {
  truck: DbTruck;
  driverName: string | null;
}

export function TruckDetailPanel({ truck, driverName }: Props) {
  const { maintenanceItems } = useTruckMaintenance();
  const truckMaint = maintenanceItems.filter(m => m.truck_id === truck.id);

  return (
    <div className="p-5 bg-muted/20 border-t space-y-4 animate-fade-in">
      {/* Document Expiry Alerts */}
      {(truck.registration_expiry || truck.insurance_expiry) && (
        <div className="flex flex-wrap gap-2">
          <ExpiryBadge date={truck.registration_expiry} label="Registration" />
          <ExpiryBadge date={truck.insurance_expiry} label="Insurance" />
        </div>
      )}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-3">
        <Info label="Make / Model">{truck.make || '—'} {truck.model || ''}</Info>
        <Info label="Year">{truck.year ?? '—'}</Info>
        <Info label="VIN">{truck.vin || '—'}</Info>
        <Info label="License Plate">{truck.license_plate || '—'}</Info>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-3 border-t pt-3">
        <Info label="Driver">{driverName || 'Unassigned'}</Info>
        <Info label="Max Payload">{truck.max_payload_lbs ? `${truck.max_payload_lbs.toLocaleString()} lbs` : '—'}</Info>
        <Info label="Insurance Expiry">{formatDate(truck.insurance_expiry)}</Info>
        <Info label="Registration Expiry">{formatDate(truck.registration_expiry)}</Info>
      </div>

      {/* Box Truck dimensions */}
      {truck.truck_type === 'Box Truck' && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-x-6 gap-y-3 border-t pt-3">
          <Info label="Cargo Length (ft)">{truck.cargo_length_ft ?? '—'}</Info>
          <Info label="Cargo Width (in)">{truck.cargo_width_in ?? '—'}</Info>
          <Info label="Cargo Height (in)">{truck.cargo_height_in ?? '—'}</Info>
          <Info label="Door Width (in)">{truck.rear_door_width_in ?? '—'}</Info>
          <Info label="Door Height (in)">{truck.rear_door_height_in ?? '—'}</Info>
        </div>
      )}

      {/* Hotshot dimensions */}
      {truck.truck_type === 'Hotshot' && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-3 border-t pt-3">
          <Info label="Trailer Length (ft)">{truck.trailer_length_ft ?? '—'}</Info>
          <Info label="Mega Ramp">{truck.mega_ramp || '—'}</Info>
        </div>
      )}

      {/* Maintenance Summary */}
      {truckMaint.length > 0 && (
        <div className="border-t pt-3">
          <p className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1">
            <Wrench className="h-3.5 w-3.5" /> Maintenance
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {truckMaint.map(m => {
              const colors = getStatusColor(m.status);
              const pct = m.interval_miles && m.interval_miles > 0
                ? Math.min((m.miles_accumulated / m.interval_miles) * 100, 100) : null;
              return (
                <div key={m.id} className={`flex items-center gap-2 px-3 py-2 rounded-md border text-xs ${colors.border} ${colors.bg}`}>
                  <div className={`w-2 h-2 rounded-full ${colors.dot}`} />
                  <span className="font-medium flex-1">{m.maintenance_type}</span>
                  {pct !== null && (
                    <div className="w-16">
                      <Progress value={pct} className="h-1.5" />
                    </div>
                  )}
                  <Badge variant="outline" className={`${colors.text} text-[9px] px-1`}>{m.status.toUpperCase()}</Badge>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Documents */}
      <div className="border-t pt-3">
        <p className="text-xs font-semibold text-muted-foreground mb-2">Documents</p>
        <div className="flex flex-wrap gap-2">
          {DOC_LABELS.map(doc => {
            const url = truck[doc.key] as string | null;
            return (
              <div key={doc.key} className="flex items-center gap-1.5 px-2.5 py-1.5 border rounded-md text-xs bg-background">
                <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="font-medium">{doc.label}</span>
                {url ? (
                  <a href={url} target="_blank" rel="noopener" className="text-primary underline flex items-center gap-0.5" onClick={e => e.stopPropagation()}>
                    View <ExternalLink className="h-3 w-3" />
                  </a>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
