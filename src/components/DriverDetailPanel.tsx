import { useState } from 'react';
import { DbDriver } from '@/hooks/useDrivers';
import { FileText, ExternalLink, Loader2 } from 'lucide-react';
import { formatDate } from '@/lib/dateUtils';
import { ExpiryBadge } from '@/components/ExpiryBadge';

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

interface Props {
  driver: DbDriver;
  truckLabel: string | null;
  dispatcherName: string | null;
  getDocSignedUrl?: (storedUrl: string) => Promise<string | null>;
}

export function DriverDetailPanel({ driver, truckLabel, dispatcherName, getDocSignedUrl }: Props) {
  const [loadingDoc, setLoadingDoc] = useState<string | null>(null);

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
    <div className="p-5 bg-muted/20 border-t space-y-4 animate-fade-in">
      {/* Document Expiry Alerts */}
      {(driver.license_expiry || driver.medical_card_expiry) && (
        <div className="flex flex-wrap gap-2">
          <ExpiryBadge date={driver.license_expiry} label="Driver License" />
          <ExpiryBadge date={driver.medical_card_expiry} label="Medical Card" />
        </div>
      )}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-3">
        <Info label="Email">{driver.email}</Info>
        <Info label="Phone">{driver.phone}</Info>
        <Info label="Hire Date">{formatDate(driver.hire_date)}</Info>
        <Info label="Service Type">{driver.service_type}</Info>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-3 border-t pt-3">
        <Info label="Driver License #">{driver.license}{driver.state ? ` (${driver.state})` : ''}</Info>
        <Info label="License Expiry">{formatDate(driver.license_expiry)}</Info>
        <Info label="Medical Card Expiry">{formatDate(driver.medical_card_expiry)}</Info>
        <Info label="Factoring %">{driver.factoring_percentage}%</Info>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-3 border-t pt-3">
        <Info label="Dispatcher">{dispatcherName || 'Unassigned'}</Info>
        <Info label="Truck">{truckLabel || 'Unassigned'}</Info>
        <Info label="Investor">{driver.investor_name || '—'}</Info>
        <Info label="% Investor Pay">{driver.investor_pay_percentage ?? '—'}%</Info>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-3 border-t pt-3">
        <Info label="% Driver Pay">{driver.pay_percentage}%</Info>
        <Info label="Loads This Month">{driver.loads_this_month}</Info>
        <Info label="Earned This Month">${Number(driver.earnings_this_month).toLocaleString()}</Info>
      </div>

      {/* Documents */}
      <div className="border-t pt-3">
        <p className="text-xs font-semibold text-muted-foreground mb-2">Documents</p>
        <div className="flex flex-wrap gap-2">
          {docFields.map(doc => {
            const url = (driver as any)[doc.key];
            return (
              <div key={doc.key} className="flex items-center gap-1.5 px-2.5 py-1.5 border rounded-md text-xs bg-background">
                <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="font-medium">{doc.label}</span>
                {url ? (
                  <button
                    onClick={e => { e.stopPropagation(); handleViewDoc(url, doc.key); }}
                    className="text-primary underline flex items-center gap-0.5 hover:text-primary/80"
                    disabled={loadingDoc === doc.key}
                  >
                    {loadingDoc === doc.key ? <Loader2 className="h-3 w-3 animate-spin" /> : <>View <ExternalLink className="h-3 w-3" /></>}
                  </button>
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
