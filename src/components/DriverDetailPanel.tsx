import { useState, useEffect } from 'react';
import { DbDriver } from '@/hooks/useDrivers';
import { FileText, ExternalLink, Loader2, Download, Trash2 } from 'lucide-react';
import { formatDate } from '@/lib/dateUtils';
import { ExpiryBadge } from '@/components/ExpiryBadge';
import { generateOnboardingSummaryPdf } from '@/lib/onboardingDocPdf';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { format } from 'date-fns';

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
  { key: 'termination_letter_url', label: 'Termination Letter' },
];

interface Props {
  driver: DbDriver;
  truckLabel: string | null;
  dispatcherName: string | null;
  getDocSignedUrl?: (storedUrl: string) => Promise<string | null>;
  truck?: any;
}

export function DriverDetailPanel({ driver, truckLabel, dispatcherName, getDocSignedUrl, truck }: Props) {
  const [loadingDoc, setLoadingDoc] = useState<string | null>(null);
  const [deletingTermination, setDeletingTermination] = useState(false);
  const [termLetterDeleted, setTermLetterDeleted] = useState(false);
  const [leasingDocs, setLeasingDocs] = useState<Array<{ id: string; company_name: string; file_url: string }>>([]);

  useEffect(() => {
    supabase
      .from('driver_leasing_agreements' as any)
      .select('id, company_name, file_url')
      .eq('driver_id', driver.id)
      .order('company_name')
      .then(({ data }) => setLeasingDocs((data as any) || []));
  }, [driver.id]);

  const handleDeleteTerminationLetter = async () => {
    if (!confirm('Are you sure you want to delete the termination letter?')) return;
    setDeletingTermination(true);
    try {
      // Remove file from storage if it's a path
      const url = driver.termination_letter_url;
      if (url && !url.startsWith('http')) {
        await supabase.storage.from('driver-documents').remove([url]);
      }
      await supabase.from('drivers' as any).update({ termination_letter_url: null } as any).eq('id', driver.id);
      setTermLetterDeleted(true);
      toast({ title: 'Termination letter deleted' });
    } catch (err: any) {
      toast({ title: 'Error deleting', description: err.message, variant: 'destructive' });
    } finally {
      setDeletingTermination(false);
    }
  };

  const handleDownloadPdf = () => {
    const driverDocs: string[] = [];
    if (driver.license_photo_url) driverDocs.push('License Photo');
    if (driver.medical_card_photo_url) driverDocs.push('Medical Card Photo');

    const truckDocs: string[] = [];
    if (truck?.registration_photo_url) truckDocs.push('Registration');
    if (truck?.insurance_photo_url) truckDocs.push('Insurance');
    if (truck?.license_photo_url) truckDocs.push('License Plate Photo');
    if (truck?.truck_side_photo_url) truckDocs.push('Truck Side Photo');
    if (truck?.rear_truck_photo_url) truckDocs.push('Rear Photo');
    if (truck?.cargo_area_photo_url) truckDocs.push('Cargo Area Photo');
    if (truck?.truck_plate_photo_url) truckDocs.push('Plate Photo');

    const blob = generateOnboardingSummaryPdf({
      driverData: {
        name: driver.name,
        email: driver.email,
        phone: driver.phone,
        license: driver.license,
        state: driver.state,
        license_expiry: driver.license_expiry,
        medical_card_expiry: driver.medical_card_expiry,
      },
      truckData: truck ? {
        unit_number: truck.unit_number,
        truck_type: truck.truck_type,
        make: truck.make,
        model: truck.model,
        year: truck.year,
        vin: truck.vin,
        license_plate: truck.license_plate,
        max_payload_lbs: truck.max_payload_lbs,
        insurance_expiry: truck.insurance_expiry,
        registration_expiry: truck.registration_expiry,
        cargo_length_ft: truck.cargo_length_ft,
        cargo_width_in: truck.cargo_width_in,
        cargo_height_in: truck.cargo_height_in,
        rear_door_width_in: truck.rear_door_width_in,
        rear_door_height_in: truck.rear_door_height_in,
        trailer_length_ft: truck.trailer_length_ft,
        mega_ramp: truck.mega_ramp,
      } : { unit_number: '', truck_type: '' },
      driverDocs,
      truckDocs,
      signedDocs: {
        w9: !!driver.form_w9_url,
        leasing: !!driver.leasing_agreement_url,
        service: !!driver.service_agreement_url,
      },
      date: driver.hire_date ? format(new Date(driver.hire_date + 'T00:00:00'), 'MM/dd/yyyy') : format(new Date(), 'MM/dd/yyyy'),
    });

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${driver.name.replace(/\s+/g, '_')}_Summary.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  };

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
    <div className="p-5 bg-muted/20 border-t space-y-4 animate-fade-in">
      {/* Document Expiry Alerts */}
      {(driver.license_expiry || driver.medical_card_expiry) && (
        <div className="flex flex-wrap gap-2">
          <ExpiryBadge date={driver.license_expiry} label="Driver License" />
          <ExpiryBadge date={driver.medical_card_expiry} label="Medical Card" />
        </div>
      )}

      {/* Personal Info */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-3">
        <Info label="Email">{driver.email}</Info>
        <Info label="Phone">{driver.phone}</Info>
        <Info label="Birthday">{formatDate((driver as any).birthday) || '—'}</Info>
        <Info label="Hire Date">{formatDate(driver.hire_date)}</Info>
        <Info label="Service Type">{driver.service_type?.replace(/_/g, ' ')}</Info>
      </div>

      {/* Address */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-3 border-t pt-3">
        <Info label="Address">{(driver as any).address || '—'}</Info>
        <Info label="City">{(driver as any).city || '—'}</Info>
        <Info label="State">{driver.state || '—'}</Info>
        <Info label="Zip">{(driver as any).zip || '—'}</Info>
      </div>

      {/* Emergency Contact */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-3 border-t pt-3">
        <Info label="Emergency Contact">{(driver as any).emergency_contact_name || '—'}</Info>
        <Info label="Emergency Phone">{(driver as any).emergency_phone || '—'}</Info>
      </div>

      {/* License & Medical */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-3 border-t pt-3">
        <Info label="Driver License #">{driver.license}{driver.state ? ` (${driver.state})` : ''}</Info>
        <Info label="License Expiry">{formatDate(driver.license_expiry)}</Info>
        <Info label="Medical Card Expiry">{formatDate(driver.medical_card_expiry)}</Info>
        <Info label="Factoring %">{driver.factoring_percentage}%</Info>
      </div>

      {/* Assignments */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-3 border-t pt-3">
        <Info label="Dispatcher">{dispatcherName || 'Unassigned'}</Info>
        <Info label="Truck">{truckLabel || 'Unassigned'}</Info>
        <Info label="Investor">{driver.investor_name || '—'}</Info>
        <Info label="Investor Email">{(driver as any).investor_email || '—'}</Info>
        <Info label="% Investor Pay">{driver.investor_pay_percentage ?? '—'}%</Info>
      </div>

      {/* Pay & Performance */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-3 border-t pt-3">
        <Info label="% Driver Pay">{driver.pay_percentage}%</Info>
        {driver.service_type === 'dispatch_service' && (
          <Info label="% Dispatch Service">{(driver as any).dispatch_service_percentage ?? 0}%</Info>
        )}
        <Info label="Loads This Month">{driver.loads_this_month}</Info>
        <Info label="Earned This Month">${Number(driver.earnings_this_month).toLocaleString()}</Info>
      </div>

      {/* Documents */}
      <div className="border-t pt-3">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold text-muted-foreground">Documents</p>
          <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5" onClick={e => { e.stopPropagation(); handleDownloadPdf(); }}>
            <Download className="h-3.5 w-3.5" /> Download PDF
          </Button>
        </div>
        <div className="flex flex-wrap gap-2">
          {docFields.map(doc => {
            const isTermination = doc.key === 'termination_letter_url';
            const url = isTermination && termLetterDeleted ? null : (driver as any)[doc.key];
            return (
              <div key={doc.key} className="flex items-center gap-1.5 px-2.5 py-1.5 border rounded-md text-xs bg-background">
                <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="font-medium">{doc.label}</span>
                {url ? (
                  <>
                    <button
                      onClick={e => { e.stopPropagation(); handleViewDoc(url, doc.key); }}
                      className="text-primary underline flex items-center gap-0.5 hover:text-primary/80"
                      disabled={loadingDoc === doc.key}
                    >
                      {loadingDoc === doc.key ? <Loader2 className="h-3 w-3 animate-spin" /> : <>View <ExternalLink className="h-3 w-3" /></>}
                    </button>
                    {isTermination && (
                      <button
                        onClick={e => { e.stopPropagation(); handleDeleteTerminationLetter(); }}
                        className="text-destructive hover:text-destructive/80 ml-1"
                        disabled={deletingTermination}
                        title="Delete termination letter"
                      >
                        {deletingTermination ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                      </button>
                    )}
                  </>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </div>
            );
          })}

          {/* Dynamic Leasing Agreements (per carrier company) */}
          {leasingDocs.map(doc => (
            <div key={doc.id} className="flex items-center gap-1.5 px-2.5 py-1.5 border rounded-md text-xs bg-background">
              <FileText className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="font-medium">Leasing Agreement ({doc.company_name})</span>
              <button
                onClick={e => { e.stopPropagation(); handleViewDoc(doc.file_url, doc.id); }}
                className="text-primary underline flex items-center gap-0.5 hover:text-primary/80"
                disabled={loadingDoc === doc.id}
              >
                {loadingDoc === doc.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <>View <ExternalLink className="h-3 w-3" /></>}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
