import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { StatusBadge } from '@/components/StatusBadge';
import { Button } from '@/components/ui/button';
import { Truck as TruckIcon } from 'lucide-react';
import { DocCardGrid } from '@/components/DocCardGrid';
import type { DbTruck } from '@/hooks/useTrucks';
import { formatDate } from '@/lib/dateUtils';

const DOC_LABELS: { key: keyof DbTruck; label: string }[] = [
  { key: 'registration_photo_url', label: 'Registration Photo' },
  { key: 'insurance_photo_url', label: 'Insurance Photo' },
  { key: 'annual_inspection_photo_url' as keyof DbTruck, label: 'Annual Inspection Photo' },
  { key: 'rear_truck_photo_url', label: 'Rear Truck Photo' },
  { key: 'truck_side_photo_url', label: 'Truck Side Photo' },
  { key: 'truck_plate_photo_url', label: 'Truck Plate Photo' },
  { key: 'cargo_area_photo_url', label: 'Cargo Area Photo' },
];

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  truck: DbTruck | null;
  getDocSignedUrl?: (storedUrl: string) => Promise<string | null>;
}

export function TruckDetailDialog({ open, onOpenChange, truck, getDocSignedUrl }: Props) {
  const [loadingDoc, setLoadingDoc] = useState<string | null>(null);

  if (!truck) return null;

  const docs = DOC_LABELS.filter(d => truck[d.key]);

  const handleViewDoc = async (url: string, key: string) => {
    // Open window synchronously to avoid popup blocker
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto rounded-[28px] border-0 bg-[#f8fafd] dark:bg-background">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-full bg-[#d3e3fd] dark:bg-blue-900/40 text-[#041e49] dark:text-blue-200 flex items-center justify-center">
              <TruckIcon className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-[22px] font-normal text-[#1f1f1f] dark:text-foreground">Unit #{truck.unit_number}</DialogTitle>
              <DialogDescription className="text-[#444746] dark:text-muted-foreground">{truck.truck_type} — {truck.make} {truck.model}</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-3 py-2">
          {/* General info */}
          <section className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-3 text-sm rounded-3xl bg-white dark:bg-card border border-[#e3e3e3] dark:border-border p-4">
            <Info label="Status"><StatusBadge status={truck.status} /></Info>
            <Info label="Year">{truck.year ?? '—'}</Info>
            <Info label="Max Payload">{truck.max_payload_lbs ? `${truck.max_payload_lbs.toLocaleString()} lbs` : '—'}</Info>
            <Info label="VIN">{truck.vin || '—'}</Info>
            <Info label="License Plate">{truck.license_plate || '—'}</Info>
            <Info label="Insurance Expiry">{formatDate(truck.insurance_expiry)}</Info>
            <Info label="Registration Expiry">{formatDate(truck.registration_expiry)}</Info>
            {(truck as any).annual_inspection_expiry && (
              <Info label="Annual Inspection Expiry">{formatDate((truck as any).annual_inspection_expiry)}</Info>
            )}
          </section>

          {/* Box Truck dimensions */}
          {truck.truck_type === 'Box Truck' && (truck.cargo_length_ft || truck.cargo_width_in || truck.cargo_height_in || truck.rear_door_width_in || truck.rear_door_height_in) && (
            <section className="rounded-3xl bg-white dark:bg-card border border-[#e3e3e3] dark:border-border p-4 space-y-2">
              <h3 className="text-[15px] font-medium text-[#1f1f1f] dark:text-foreground">Dimensiones Box Truck</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-3 text-sm">
                <Info label="Cargo Length (ft)">{truck.cargo_length_ft ?? '—'}</Info>
                <Info label="Cargo Width (in)">{truck.cargo_width_in ?? '—'}</Info>
                <Info label="Cargo Height (in)">{truck.cargo_height_in ?? '—'}</Info>
                <Info label="Rear Door Width (in)">{truck.rear_door_width_in ?? '—'}</Info>
                <Info label="Rear Door Height (in)">{truck.rear_door_height_in ?? '—'}</Info>
              </div>
            </section>
          )}

          {/* Hotshot dimensions */}
          {truck.truck_type === 'Hotshot' && (truck.trailer_number || truck.trailer_length_ft || truck.mega_ramp) && (
            <section className="rounded-3xl bg-white dark:bg-card border border-[#e3e3e3] dark:border-border p-4 space-y-2">
              <h3 className="text-[15px] font-medium text-[#1f1f1f] dark:text-foreground">Dimensiones Hotshot</h3>
              <div className="grid grid-cols-3 gap-x-6 gap-y-3 text-sm">
                <Info label="Trailer #">{truck.trailer_number ?? '—'}</Info>
                <Info label="Trailer Length (ft)">{truck.trailer_length_ft ?? '—'}</Info>
                <Info label="Mega Ramp">{truck.mega_ramp || '—'}</Info>
              </div>
            </section>
          )}

          {/* Documents */}
          <section className="rounded-3xl bg-white dark:bg-card border border-[#e3e3e3] dark:border-border p-4 space-y-3">
            <h3 className="text-[15px] font-medium text-[#1f1f1f] dark:text-foreground">Documentos y Fotos</h3>
            <DocCardGrid
              docs={DOC_LABELS.map(d => ({ key: String(d.key), label: d.label, url: truck[d.key] as string | null }))}
              getDocSignedUrl={getDocSignedUrl}
            />
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Info({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-[#444746] dark:text-muted-foreground">{label}</p>
      <div className="font-medium mt-0.5 text-[#1f1f1f] dark:text-foreground [overflow-wrap:anywhere]">{children}</div>
    </div>
  );
}