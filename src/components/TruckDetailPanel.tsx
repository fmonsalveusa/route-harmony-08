import { useState } from 'react';
import type { DbTruck } from '@/hooks/useTrucks';
import { ExternalLink, FileText, Wrench, Loader2, Download } from 'lucide-react';
import { formatDate } from '@/lib/dateUtils';
import { ExpiryBadge } from '@/components/ExpiryBadge';
import { useTruckMaintenance } from '@/hooks/useTruckMaintenance';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { getStatusColor } from '@/components/maintenance/maintenanceConstants';
import { DocCardGrid } from '@/components/DocCardGrid';

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
  { key: 'annual_inspection_photo_url', label: 'Annual Inspection' },
  { key: 'rear_truck_photo_url', label: 'Rear Photo' },
  { key: 'truck_side_photo_url', label: 'Side Photo' },
  { key: 'truck_plate_photo_url', label: 'Plate Photo' },
  { key: 'cargo_area_photo_url', label: 'Cargo Area' },
];

interface Props {
  truck: DbTruck;
  driverName: string | null;
  getDocSignedUrl?: (storedUrl: string) => Promise<string | null>;
  onUpdateTruck?: (id: string, updates: Record<string, any>) => Promise<boolean>;
}

export function TruckDetailPanel({ truck, driverName, getDocSignedUrl, onUpdateTruck }: Props) {
  const { maintenanceItems } = useTruckMaintenance();
  const truckMaint = maintenanceItems.filter(m => m.truck_id === truck.id);
  const [loadingDoc, setLoadingDoc] = useState<string | null>(null);

  const handleViewDoc = async (url: string, key: string) => {
    const newWindow = window.open('about:blank', '_blank');
    if (!getDocSignedUrl) {
      if (newWindow) newWindow.location.href = url;
      return;
    }
    setLoadingDoc(key);
    try {
      const signedUrl = await getDocSignedUrl(url);
      if (newWindow) newWindow.location.href = signedUrl || url;
    } catch {
      if (newWindow) newWindow.location.href = url;
    } finally {
      setLoadingDoc(null);
    }
  };

  return (
    <div className="p-5 bg-muted/20 border-t animate-fade-in">
      {/* Document Expiry Alerts */}
      {(truck.registration_expiry || truck.insurance_expiry || (truck as any).annual_inspection_expiry) && (
        <div className="flex flex-wrap gap-2 mb-4">
          <ExpiryBadge date={truck.registration_expiry} label="Registration" />
          <ExpiryBadge date={truck.insurance_expiry} label="Insurance" />
          <ExpiryBadge date={(truck as any).annual_inspection_expiry} label="Annual Inspection" />
        </div>
      )}

      {/* Grid de 3 columnas con separadores verticales */}
      <div className="grid grid-cols-1 lg:grid-cols-3 lg:divide-x lg:divide-border gap-y-6">

        {/* ═══ COLUMNA 1 — General Information ═══ */}
        <div className="lg:pr-6 space-y-4">
          <h3 className="text-lg font-bold uppercase tracking-wide text-foreground border-b pb-2">
            General Information
          </h3>

          <div className="grid grid-cols-2 gap-x-4 gap-y-3">
            <Info label="Make">{truck.make || '—'}</Info>
            <Info label="Model">{truck.model || '—'}</Info>
            <Info label="Year">{truck.year ?? '—'}</Info>
            <Info label="Truck Type">{truck.truck_type || '—'}</Info>
            <Info label="VIN">{truck.vin || '—'}</Info>
            <Info label="License Plate">{truck.license_plate || '—'}</Info>
            <Info label="Driver">{driverName || 'Unassigned'}</Info>
            <Info label="Max Payload">{truck.max_payload_lbs ? `${truck.max_payload_lbs.toLocaleString()} lbs` : '—'}</Info>
          </div>

          {/* Trailer Info */}
          <div className="grid grid-cols-2 gap-x-4 gap-y-3 border-t pt-3">
            <Info label="Trailer #">{truck.trailer_number ?? '—'}</Info>
            {truck.truck_type === 'Hotshot' && (
              <>
                <Info label="Trailer Length (ft)">{truck.trailer_length_ft ?? '—'}</Info>
                <Info label="Mega Ramp">{truck.mega_ramp || '—'}</Info>
              </>
            )}
          </div>

          {/* Box Truck dimensions */}
          {truck.truck_type === 'Box Truck' && (
            <div className="grid grid-cols-2 gap-x-4 gap-y-3 border-t pt-3">
              <Info label="Cargo Length (ft)">{truck.cargo_length_ft ?? '—'}</Info>
              <Info label="Cargo Width (in)">{truck.cargo_width_in ?? '—'}</Info>
              <Info label="Cargo Height (in)">{truck.cargo_height_in ?? '—'}</Info>
              <Info label="Door Width (in)">{truck.rear_door_width_in ?? '—'}</Info>
              <Info label="Door Height (in)">{truck.rear_door_height_in ?? '—'}</Info>
            </div>
          )}
        </div>

        {/* ═══ COLUMNA 2 — Expiry & Maintenance ═══ */}
        <div className="lg:px-6 space-y-4">
          <h3 className="text-lg font-bold uppercase tracking-wide text-foreground border-b pb-2">
            Expiry & Maintenance
          </h3>

          <div className="grid grid-cols-2 gap-x-4 gap-y-3">
            <Info label="Insurance Expiry">{formatDate(truck.insurance_expiry)}</Info>
            <Info label="Registration Expiry">{formatDate(truck.registration_expiry)}</Info>
            {(truck as any).annual_inspection_expiry && (
              <Info label="Annual Inspection Expiry">{formatDate((truck as any).annual_inspection_expiry)}</Info>
            )}
          </div>

          {/* Maintenance Summary */}
          {truckMaint.length > 0 && (
            <div className="border-t pt-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Maintenance Items</p>
              <div className="space-y-2">
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
        </div>

        {/* ═══ COLUMNA 3 — Documents ═══ */}
        <div className="lg:pl-6 space-y-4">
          <h3 className="text-lg font-bold uppercase tracking-wide text-foreground border-b pb-2">
            Documents
          </h3>

          <DocCardGrid
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
    </div>
  );
}
