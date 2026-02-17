import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { StatusBadge } from '@/components/StatusBadge';
import { Button } from '@/components/ui/button';
import { ExternalLink, Truck as TruckIcon, Loader2 } from 'lucide-react';
import type { DbTruck } from '@/hooks/useTrucks';
import { formatDate } from '@/lib/dateUtils';

const DOC_LABELS: { key: keyof DbTruck; label: string }[] = [
  { key: 'registration_photo_url', label: 'Registration Photo' },
  { key: 'insurance_photo_url', label: 'Insurance Photo' },
  { key: 'license_photo_url', label: 'License Photo' },
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
    if (!getDocSignedUrl) {
      window.open(url, '_blank');
      return;
    }
    setLoadingDoc(key);
    try {
      const signedUrl = await getDocSignedUrl(url);
      window.open(signedUrl || url, '_blank');
    } finally {
      setLoadingDoc(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <TruckIcon className="h-5 w-5 text-primary" />
            </div>
            <div>
              <DialogTitle>Unit #{truck.unit_number}</DialogTitle>
              <DialogDescription>{truck.truck_type} — {truck.make} {truck.model}</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* General info */}
          <section className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-3 text-sm">
            <Info label="Status"><StatusBadge status={truck.status} /></Info>
            <Info label="Year">{truck.year ?? '—'}</Info>
            <Info label="Max Payload">{truck.max_payload_lbs ? `${truck.max_payload_lbs.toLocaleString()} lbs` : '—'}</Info>
            <Info label="VIN">{truck.vin || '—'}</Info>
            <Info label="License Plate">{truck.license_plate || '—'}</Info>
            <Info label="Insurance Expiry">{formatDate(truck.insurance_expiry)}</Info>
            <Info label="Registration Expiry">{formatDate(truck.registration_expiry)}</Info>
          </section>

          {/* Box Truck dimensions */}
          {truck.truck_type === 'Box Truck' && (truck.cargo_length_ft || truck.cargo_width_in || truck.cargo_height_in || truck.rear_door_width_in || truck.rear_door_height_in) && (
            <section className="border-t pt-4 space-y-2">
              <h3 className="font-semibold text-sm">Dimensiones Box Truck</h3>
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
          {truck.truck_type === 'Hotshot' && (truck.trailer_length_ft || truck.mega_ramp) && (
            <section className="border-t pt-4 space-y-2">
              <h3 className="font-semibold text-sm">Dimensiones Hotshot</h3>
              <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                <Info label="Trailer Length (ft)">{truck.trailer_length_ft ?? '—'}</Info>
                <Info label="Mega Ramp">{truck.mega_ramp || '—'}</Info>
              </div>
            </section>
          )}

          {/* Documents */}
          <section className="border-t pt-4 space-y-3">
            <h3 className="font-semibold text-sm">Documentos y Fotos</h3>
            {docs.length === 0 ? (
              <p className="text-muted-foreground text-sm">No hay documentos cargados.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {docs.map(d => {
                  const url = truck[d.key] as string;
                  return (
                    <div key={d.key} className="border rounded-lg overflow-hidden">
                      <div className="h-40 flex items-center justify-center bg-muted">
                        <span className="text-muted-foreground text-xs">Click to view</span>
                      </div>
                      <div className="p-2 flex items-center justify-between">
                        <span className="text-xs font-medium">{d.label}</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          disabled={loadingDoc === d.key}
                          onClick={() => handleViewDoc(url, d.key)}
                        >
                          {loadingDoc === d.key ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ExternalLink className="h-3.5 w-3.5" />}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Info({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-muted-foreground text-xs">{label}</p>
      <div className="font-medium mt-0.5">{children}</div>
    </div>
  );
}