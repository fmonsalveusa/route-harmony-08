import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { StatusBadge } from '@/components/StatusBadge';
import { DbDriver } from '@/hooks/useDrivers';
import { FileText, ExternalLink } from 'lucide-react';
import { formatDate } from '@/lib/dateUtils';

interface DriverDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  driver: DbDriver | null;
  truckLabel?: string | null;
  dispatcherName?: string | null;
}

function Info({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium text-sm">{children}</p>
    </div>
  );
}

const docFields = [
  { key: 'license_photo_url', label: 'License Photo' },
  { key: 'medical_card_photo_url', label: 'Medical Card Photo' },
  { key: 'form_w9_url', label: 'Form W9' },
  { key: 'leasing_agreement_url', label: 'Leasing Agreement' },
  { key: 'service_agreement_url', label: 'Service Agreement' },
];

export function DriverDetailDialog({ open, onOpenChange, driver, truckLabel, dispatcherName }: DriverDetailDialogProps) {
  if (!driver) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            {driver.name}
            <StatusBadge status={driver.status as any} />
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 mt-2">
          {/* Información Personal */}
          <section className="space-y-2">
            <h3 className="font-semibold text-sm border-b pb-1">Información Personal</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-3">
              <Info label="Email">{driver.email}</Info>
              <Info label="Teléfono">{driver.phone}</Info>
              <Info label="Fecha de Contratación">{formatDate(driver.hire_date)}</Info>
            </div>
          </section>

          {/* Licencia & Medical */}
          <section className="space-y-2 border-t pt-4">
            <h3 className="font-semibold text-sm border-b pb-1">Licencia & Medical Card</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-3">
              <Info label="Driver License #">{driver.license}</Info>
              <Info label="License Expiry">{formatDate(driver.license_expiry)}</Info>
              <Info label="Medical Card Expiry">{formatDate(driver.medical_card_expiry)}</Info>
            </div>
          </section>

          {/* Asignaciones */}
          <section className="space-y-2 border-t pt-4">
            <h3 className="font-semibold text-sm border-b pb-1">Asignaciones</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-3">
              <Info label="Dispatcher">{dispatcherName || 'Sin asignar'}</Info>
              <Info label="Camión">{truckLabel || 'Sin asignar'}</Info>
              <Info label="Investor">{driver.investor_name || '—'}</Info>
            </div>
          </section>

          {/* Pagos & Rendimiento */}
          <section className="space-y-2 border-t pt-4">
            <h3 className="font-semibold text-sm border-b pb-1">Pagos & Rendimiento</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-3">
              <Info label="% Pago Driver">{driver.pay_percentage}%</Info>
              <Info label="% Pago Investor">{driver.investor_pay_percentage ?? '—'}%</Info>
              <Info label="Cargas este mes">{driver.loads_this_month}</Info>
              <Info label="Ganado este mes">${Number(driver.earnings_this_month).toLocaleString()}</Info>
            </div>
          </section>

          {/* Documentos */}
          <section className="space-y-2 border-t pt-4">
            <h3 className="font-semibold text-sm border-b pb-1">Documentos</h3>
            <div className="space-y-2">
              {docFields.map(doc => {
                const url = (driver as any)[doc.key];
                return (
                  <div key={doc.key} className="flex items-center gap-3 p-2 border rounded-md text-sm">
                    <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="font-medium flex-1">{doc.label}</span>
                    {url ? (
                      <a href={url} target="_blank" rel="noopener" className="text-primary underline flex items-center gap-1 text-xs">
                        Ver <ExternalLink className="h-3 w-3" />
                      </a>
                    ) : (
                      <span className="text-xs text-muted-foreground">Sin archivo</span>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}
