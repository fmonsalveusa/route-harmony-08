import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle2, FileText, PenLine } from 'lucide-react';
import { cn } from '@/lib/utils';
import W9FormDialog from './W9FormDialog';
import LeasingAgreementDialog from './LeasingAgreementDialog';
import ServiceAgreementDialog from './ServiceAgreementDialog';
import EmploymentContractDialog from './EmploymentContractDialog';

export interface SignedDocs {
  w9: Blob | null;
  leasing: Blob | null;
  service: Blob | null;
  employment: Blob | null;
}

interface DocumentSigningStepProps {
  serviceType: 'owner_operator' | 'company_driver';
  driverData: { name: string; email: string; phone: string; license: string; state: string | null };
  truckData: { make: string; model: string; vin: string; year: number; unit_number: string };
  signedDocs: SignedDocs;
  onSignedDocsChange: (docs: SignedDocs) => void;
  onNext: () => void;
  onBack: () => void;
}

const OO_DOCS = [
  { key: 'w9' as const, title: 'W-9 Form', desc: 'Federal tax classification form' },
  { key: 'leasing' as const, title: 'Leasing Agreement', desc: 'Owner Operator lease + ELD & HOS policies' },
  { key: 'service' as const, title: 'Service Agreement', desc: 'Dispatch services contract (Bilingual)' },
];

const CD_DOCS = [
  { key: 'employment' as const, title: 'Employment Contract', desc: 'Bilingual employment agreement' },
];

export default function DocumentSigningStep({ serviceType, driverData, truckData, signedDocs, onSignedDocsChange, onNext, onBack }: DocumentSigningStepProps) {
  const [openDialog, setOpenDialog] = useState<'w9' | 'leasing' | 'service' | 'employment' | null>(null);

  const isOO = serviceType === 'owner_operator';
  const docs = isOO ? OO_DOCS : CD_DOCS;
  const allSigned = isOO
    ? (signedDocs.w9 && signedDocs.leasing && signedDocs.service)
    : !!signedDocs.employment;

  const handleSigned = (key: 'w9' | 'leasing' | 'service' | 'employment', blob: Blob) => {
    onSignedDocsChange({ ...signedDocs, [key]: blob });
    setOpenDialog(null);
  };

  return (
    <Card>
      <CardContent className="pt-6 space-y-4">
        <div className="text-center mb-2">
          <h2 className="text-lg font-semibold flex items-center justify-center gap-2"><PenLine className="h-5 w-5" /> Document Signing</h2>
          <p className="text-sm text-muted-foreground">
            Review and sign {isOO ? 'all 3 documents' : 'the employment contract'} to continue.
          </p>
        </div>

        <div className="space-y-3">
          {docs.map(doc => {
            const signed = !!signedDocs[doc.key];
            return (
              <div key={doc.key} className={cn(
                "flex items-center justify-between p-4 rounded-lg border transition-colors",
                signed ? "bg-green-50 border-green-200" : "bg-muted/30"
              )}>
                <div className="flex items-center gap-3">
                  {signed ? <CheckCircle2 className="h-5 w-5 text-green-600" /> : <FileText className="h-5 w-5 text-muted-foreground" />}
                  <div>
                    <p className="font-medium text-sm">{doc.title}</p>
                    <p className="text-xs text-muted-foreground">{doc.desc}</p>
                  </div>
                </div>
                <Button size="sm" variant={signed ? "outline" : "default"} onClick={() => setOpenDialog(doc.key)}>
                  {signed ? 'Re-sign' : 'Review & Sign'}
                </Button>
              </div>
            );
          })}
        </div>

        <div className="flex justify-between pt-4">
          <Button variant="outline" onClick={onBack}>← Back</Button>
          <Button onClick={onNext} disabled={!allSigned}>Next: Review →</Button>
        </div>

        {/* Owner Operator dialogs */}
        <W9FormDialog
          open={openDialog === 'w9'}
          onOpenChange={o => !o && setOpenDialog(null)}
          driverName={driverData.name}
          onSigned={blob => handleSigned('w9', blob)}
        />
        <LeasingAgreementDialog
          open={openDialog === 'leasing'}
          onOpenChange={o => !o && setOpenDialog(null)}
          driverName={driverData.name}
          truckData={truckData}
          onSigned={blob => handleSigned('leasing', blob)}
        />
        <ServiceAgreementDialog
          open={openDialog === 'service'}
          onOpenChange={o => !o && setOpenDialog(null)}
          driverName={driverData.name}
          onSigned={blob => handleSigned('service', blob)}
        />
        {/* Company Driver dialog */}
        <EmploymentContractDialog
          open={openDialog === 'employment'}
          onOpenChange={o => !o && setOpenDialog(null)}
          driverName={driverData.name}
          onSigned={blob => handleSigned('employment', blob)}
        />
      </CardContent>
    </Card>
  );
}
