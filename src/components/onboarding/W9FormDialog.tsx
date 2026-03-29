import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { format } from 'date-fns';
import SignaturePad from './SignaturePad';
import { generateW9Pdf } from '@/lib/onboardingDocPdf';

const TAX_CLASSIFICATIONS = [
  'Individual/sole proprietor',
  'C Corporation',
  'S Corporation',
  'Partnership',
  'Trust/estate',
  'LLC',
  'Other',
];

interface W9FormDialogProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  driverName: string;
  onSigned: (blob: Blob) => void;
}

export default function W9FormDialog({ open, onOpenChange, driverName, onSigned }: W9FormDialogProps) {
  const [form, setForm] = useState({
    name: driverName,
    businessName: '',
    taxClassification: '' as string,
    exemptions: '',
    address: '',
    cityStateZip: '',
    ssn: '',
    ein: '',
  });
  const [signature, setSignature] = useState<string | null>(null);

  const handleSubmit = () => {
    if (!form.name.trim()) { toast.error('Name is required'); return; }
    if (!form.taxClassification) { toast.error('Select a tax classification'); return; }
    if (!form.address.trim()) { toast.error('Address is required'); return; }
    if (!form.ssn.trim() && !form.ein.trim()) { toast.error('SSN or EIN is required'); return; }
    if (!signature) { toast.error('Signature is required'); return; }

    const blob = generateW9Pdf({ ...form, date: format(new Date(), 'MM/dd/yyyy'), signature });
    onSigned(blob);
    toast.success('W-9 Form signed');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>W-9 Form — Request for Taxpayer Identification Number</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 text-sm">
          <div className="space-y-2">
            <Label>1. Name (as shown on your income tax return) *</Label>
            <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
          </div>
          <div className="space-y-2">
            <Label>2. Business name / disregarded entity name</Label>
            <Input value={form.businessName} onChange={e => setForm(f => ({ ...f, businessName: e.target.value }))} />
          </div>
          <div className="space-y-2">
            <Label>3. Federal tax classification *</Label>
            <div className="grid grid-cols-2 gap-2">
              {TAX_CLASSIFICATIONS.map(tc => (
                <label key={tc} className="flex items-center gap-2 text-xs cursor-pointer">
                  <Checkbox checked={form.taxClassification === tc} onCheckedChange={() => setForm(f => ({ ...f, taxClassification: tc }))} />
                  {tc}
                </label>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Label>4. Exemptions (if applicable)</Label>
            <Input value={form.exemptions} onChange={e => setForm(f => ({ ...f, exemptions: e.target.value }))} placeholder="Exempt payee code / FATCA code" />
          </div>
          <div className="space-y-2">
            <Label>5. Address *</Label>
            <Input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} placeholder="Number, street, apt/suite" />
          </div>
          <div className="space-y-2">
            <Label>6. City, State, ZIP code *</Label>
            <Input value={form.cityStateZip} onChange={e => setForm(f => ({ ...f, cityStateZip: e.target.value }))} placeholder="Houston, TX 77001" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>SSN</Label>
              <Input value={form.ssn} onChange={e => setForm(f => ({ ...f, ssn: e.target.value }))} placeholder="XXX-XX-XXXX" />
            </div>
            <div className="space-y-2">
              <Label>EIN</Label>
              <Input value={form.ein} onChange={e => setForm(f => ({ ...f, ein: e.target.value }))} placeholder="XX-XXXXXXX" />
            </div>
          </div>

          <div className="border-t pt-4 space-y-2">
            <Label className="font-semibold">Signature *</Label>
            <p className="text-xs text-muted-foreground">Under penalties of perjury, I certify that the information provided is correct.</p>
            <SignaturePad onSignatureChange={setSignature} />
            <p className="text-xs text-muted-foreground">Date: {format(new Date(), 'MM/dd/yyyy')}</p>
          </div>

          <Button onClick={handleSubmit} className="w-full">Confirm & Sign W-9</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
