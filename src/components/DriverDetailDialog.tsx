import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { StatusBadge } from '@/components/StatusBadge';
import { DbDriver } from '@/hooks/useDrivers';
import { FileText, ExternalLink, Loader2 } from 'lucide-react';
import { formatDate } from '@/lib/dateUtils';
import { supabase } from '@/integrations/supabase/client';

interface DriverDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  driver: DbDriver | null;
  truckLabel?: string | null;
  dispatcherName?: string | null;
  getDocSignedUrl?: (storedUrl: string) => Promise<string | null>;
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
  { key: 'service_agreement_url', label: 'Service Agreement' },
  { key: 'employment_contract_url', label: 'Employment Contract' },
];

export function DriverDetailDialog({ open, onOpenChange, driver, truckLabel, dispatcherName, getDocSignedUrl }: DriverDetailDialogProps) {
  const [loadingDoc, setLoadingDoc] = useState<string | null>(null);
  const [leasingDocs, setLeasingDocs] = useState<Array<{ id: string; company_name: string; file_url: string }>>([]);
  const [leasingLoading, setLeasingLoading] = useState(false);

  useEffect(() => {
    if (!driver) return;
    setLeasingLoading(true);
    supabase
      .from('driver_leasing_agreements' as any)
      .select('id, company_name, file_url')
      .eq('driver_id', driver.id)
      .order('company_name')
      .then(({ data, error }) => {
        if (error) console.error('[DriverDetailDialog] driver_leasing_agreements query error:', error);
        setLeasingDocs((data as any) || []);
        setLeasingLoading(false);
      });
  }, [driver?.id]);

  if (!driver) return null;

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
          <DialogTitle className="flex items-center gap-3">
            {driver.name}
            <StatusBadge status={driver.status as any} />
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 mt-2">
          {/* Personal Information */}
          <section className="space-y-2">
            <h3 className="font-semibold text-sm border-b pb-1">Personal Information</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-3">
              <Info label="Email">{driver.email}</Info>
              <Info label="Phone">{driver.phone}</Info>
              <Info label="Birthday">{formatDate((driver as any).birthday) || '—'}</Info>
              <Info label="Hire Date">{formatDate(driver.hire_date)}</Info>
              <Info label="Service Type">{driver.service_type?.replace(/_/g, ' ')}</Info>
            </div>
          </section>

          {/* Address */}
          <section className="space-y-2 border-t pt-4">
            <h3 className="font-semibold text-sm border-b pb-1">Address</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-3">
              <Info label="Address">{(driver as any).address || '—'}</Info>
              <Info label="City">{(driver as any).city || '—'}</Info>
              <Info label="State">{driver.state || '—'}</Info>
              <Info label="Zip">{(driver as any).zip || '—'}</Info>
            </div>
          </section>

          {/* Emergency Contact */}
          <section className="space-y-2 border-t pt-4">
            <h3 className="font-semibold text-sm border-b pb-1">Emergency Contact</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-3">
              <Info label="Name">{(driver as any).emergency_contact_name || '—'}</Info>
              <Info label="Phone">{(driver as any).emergency_phone || '—'}</Info>
            </div>
          </section>

          {/* License & Medical */}
          <section className="space-y-2 border-t pt-4">
            <h3 className="font-semibold text-sm border-b pb-1">License & Medical Card</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-3">
              <Info label="Driver License #">{driver.license}{driver.state ? ` (${driver.state})` : ''}</Info>
              <Info label="License Expiry">{formatDate(driver.license_expiry)}</Info>
              <Info label="Medical Card Expiry">{formatDate(driver.medical_card_expiry)}</Info>
              <Info label="Factoring %">{driver.factoring_percentage ?? 2}%</Info>
            </div>
          </section>

          {/* Assignments */}
          <section className="space-y-2 border-t pt-4">
            <h3 className="font-semibold text-sm border-b pb-1">Assignments</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-3">
              <Info label="Dispatcher">{dispatcherName || 'Unassigned'}</Info>
              <Info label="Truck">{truckLabel || 'Unassigned'}</Info>
              <Info label="Investor">{driver.investor_name || '—'}</Info>
              <Info label="Investor Email">{(driver as any).investor_email || '—'}</Info>
            </div>
          </section>

          {/* Payments & Performance */}
          <section className="space-y-2 border-t pt-4">
            <h3 className="font-semibold text-sm border-b pb-1">Payments & Performance</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-3">
              <Info label="% Driver Pay">{driver.pay_percentage}%</Info>
              <Info label="% Investor Pay">{driver.investor_pay_percentage ?? '—'}%</Info>
              {(driver as any).service_type === 'dispatch_service' && (
                <Info label="% Dispatch Service">{(driver as any).dispatch_service_percentage ?? 0}%</Info>
              )}
              <Info label="Loads This Month">{driver.loads_this_month}</Info>
              <Info label="Earned This Month">${Number(driver.earnings_this_month).toLocaleString()}</Info>
            </div>
          </section>

          {/* Documents */}
          <section className="space-y-2 border-t pt-4">
            <h3 className="font-semibold text-sm border-b pb-1">Documents</h3>
            <div className="space-y-2">
              {docFields.map(doc => {
                const url = (driver as any)[doc.key];
                return (
                  <div key={doc.key} className="flex items-center gap-3 p-2 border rounded-md text-sm">
                    <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="font-medium flex-1">{doc.label}</span>
                    {url ? (
                      <button
                        onClick={() => handleViewDoc(url, doc.key)}
                        className="text-primary underline flex items-center gap-1 text-xs hover:text-primary/80"
                        disabled={loadingDoc === doc.key}
                      >
                        {loadingDoc === doc.key ? <Loader2 className="h-3 w-3 animate-spin" /> : <>View <ExternalLink className="h-3 w-3" /></>}
                      </button>
                    ) : (
                      <span className="text-xs text-muted-foreground">No file</span>
                    )}
                  </div>
                );
              })}

              {/* Legacy leasing fields (drivers onboarded before dynamic system) */}
              {(driver as any).leasing_agreement_url && (
                <div className="flex items-center gap-3 p-2 border rounded-md text-sm">
                  <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="font-medium flex-1">Leasing Agreement</span>
                  <button onClick={() => handleViewDoc((driver as any).leasing_agreement_url, 'leasing_agreement_url')} className="text-primary underline flex items-center gap-1 text-xs hover:text-primary/80" disabled={loadingDoc === 'leasing_agreement_url'}>
                    {loadingDoc === 'leasing_agreement_url' ? <Loader2 className="h-3 w-3 animate-spin" /> : <>View <ExternalLink className="h-3 w-3" /></>}
                  </button>
                </div>
              )}
              {(driver as any).leasing_agreement_venco_url && (
                <div className="flex items-center gap-3 p-2 border rounded-md text-sm">
                  <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="font-medium flex-1">Leasing Agreement (VENCO)</span>
                  <button onClick={() => handleViewDoc((driver as any).leasing_agreement_venco_url, 'leasing_agreement_venco_url')} className="text-primary underline flex items-center gap-1 text-xs hover:text-primary/80" disabled={loadingDoc === 'leasing_agreement_venco_url'}>
                    {loadingDoc === 'leasing_agreement_venco_url' ? <Loader2 className="h-3 w-3 animate-spin" /> : <>View <ExternalLink className="h-3 w-3" /></>}
                  </button>
                </div>
              )}
              {(driver as any).leasing_agreement_58_url && (
                <div className="flex items-center gap-3 p-2 border rounded-md text-sm">
                  <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="font-medium flex-1">Leasing Agreement (58 Logistics)</span>
                  <button onClick={() => handleViewDoc((driver as any).leasing_agreement_58_url, 'leasing_agreement_58_url')} className="text-primary underline flex items-center gap-1 text-xs hover:text-primary/80" disabled={loadingDoc === 'leasing_agreement_58_url'}>
                    {loadingDoc === 'leasing_agreement_58_url' ? <Loader2 className="h-3 w-3 animate-spin" /> : <>View <ExternalLink className="h-3 w-3" /></>}
                  </button>
                </div>
              )}

              {/* Dynamic Leasing Agreements (new system — one per carrier company) */}
              {leasingLoading && (
                <div className="flex items-center gap-2 p-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" /> Loading leasing agreements...
                </div>
              )}
              {!leasingLoading && leasingDocs.map(doc => (
                <div key={doc.id} className="flex items-center gap-3 p-2 border rounded-md text-sm">
                  <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="font-medium flex-1">Leasing Agreement ({doc.company_name})</span>
                  <button
                    onClick={() => handleViewDoc(doc.file_url, doc.id)}
                    className="text-primary underline flex items-center gap-1 text-xs hover:text-primary/80"
                    disabled={loadingDoc === doc.id}
                  >
                    {loadingDoc === doc.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <>View <ExternalLink className="h-3 w-3" /></>}
                  </button>
                </div>
              ))}
            </div>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}
