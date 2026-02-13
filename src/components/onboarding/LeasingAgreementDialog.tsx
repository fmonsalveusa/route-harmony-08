import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { format } from 'date-fns';
import SignaturePad from './SignaturePad';
import { generateLeasingPdf } from '@/lib/onboardingDocPdf';

interface LeasingAgreementDialogProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  driverName: string;
  truckData: { make: string; model: string; vin: string; year: number; unit_number: string };
  onSigned: (blob: Blob) => void;
}

export default function LeasingAgreementDialog({ open, onOpenChange, driverName, truckData, onSigned }: LeasingAgreementDialogProps) {
  const [companyName, setCompanyName] = useState('');
  const [signatures, setSignatures] = useState<{ contract: string | null; eld: string | null; hos: string | null }>({
    contract: null, eld: null, hos: null,
  });

  const handleSubmit = () => {
    if (!signatures.contract || !signatures.eld || !signatures.hos) {
      toast.error('All 3 signatures are required');
      return;
    }
    const blob = generateLeasingPdf({
      driverName,
      companyName,
      make: truckData.make,
      model: truckData.model,
      vin: truckData.vin,
      year: truckData.year,
      date: format(new Date(), 'MM/dd/yyyy'),
      signatures: signatures as { contract: string; eld: string; hos: string },
    });
    onSigned(blob);
    toast.success('Leasing Agreement signed');
  };

  const today = format(new Date(), 'MM/dd/yyyy');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Owner Operator Lease Agreement</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 text-sm">
          {/* Pre-filled info */}
          <div className="bg-muted/50 p-3 rounded-lg grid grid-cols-2 gap-2 text-xs">
            <div><span className="text-muted-foreground">Owner Operator:</span> {driverName}</div>
            <div><span className="text-muted-foreground">Vehicle:</span> {truckData.year} {truckData.make} {truckData.model}</div>
            <div><span className="text-muted-foreground">VIN:</span> {truckData.vin || 'N/A'}</div>
            <div><span className="text-muted-foreground">Date:</span> {today}</div>
          </div>

          <div className="space-y-2">
            <Label>Owner Operator Company Name</Label>
            <Input value={companyName} onChange={e => setCompanyName(e.target.value)} placeholder="Your company name (if applicable)" />
          </div>

          {/* Contract summary */}
          <div className="border rounded-lg p-4 space-y-3 text-xs leading-relaxed max-h-60 overflow-y-auto bg-white">
            <h3 className="font-bold text-sm">OWNER OPERATOR LEASE AGREEMENT</h3>
            <p>This Agreement is entered into by and between 58 Logistics LLC ("Carrier") and <strong>{driverName}</strong> ("Owner Operator") on {today}.</p>
            <p><strong>1. PURPOSE:</strong> Owner Operator agrees to lease the vehicle described above to Carrier for transportation services under Carrier's operating authority.</p>
            <p><strong>2. TERM:</strong> This agreement shall remain in effect until terminated by either party with written notice.</p>
            <p><strong>3. COMPENSATION:</strong> Owner Operator shall be compensated per the agreed pay percentage for each load completed.</p>
            <p><strong>4. EQUIPMENT:</strong> Owner Operator warrants that the vehicle is in good mechanical condition and meets all DOT requirements.</p>
            <p><strong>5. INSURANCE:</strong> Carrier will maintain liability and cargo insurance. Owner Operator is responsible for physical damage coverage.</p>
            <p><strong>6. MAINTENANCE:</strong> Owner Operator is responsible for all maintenance, fuel, tolls, and operational expenses.</p>
            <p><strong>7. COMPLIANCE:</strong> Both parties agree to comply with all applicable federal, state, and local regulations.</p>
            <p><strong>8. INDEPENDENT CONTRACTOR:</strong> Owner Operator is an independent contractor, not an employee of Carrier.</p>
            <p><strong>9. TERMINATION:</strong> Either party may terminate this agreement with 30 days written notice.</p>
          </div>

          <div className="space-y-2">
            <Label className="font-semibold">Signature — Lease Agreement *</Label>
            <SignaturePad onSignatureChange={s => setSignatures(prev => ({ ...prev, contract: s }))} />
          </div>

          <Separator />

          {/* ELD Policy */}
          <div className="border rounded-lg p-4 space-y-2 text-xs leading-relaxed max-h-48 overflow-y-auto bg-white">
            <h3 className="font-bold text-sm">ELD COMPLIANCE POLICY</h3>
            <p>As an Owner Operator leased to 58 Logistics LLC, I acknowledge and agree to comply with the FMCSA Electronic Logging Device (ELD) mandate.</p>
            <p><strong>Requirements:</strong></p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Maintain a functioning ELD in the vehicle at all times during operation.</li>
              <li>Ensure accurate recording of all driving hours and duty status changes.</li>
              <li>Make ELD records available for inspection by law enforcement upon request.</li>
              <li>Report any ELD malfunctions to Carrier within 24 hours.</li>
              <li>Not tamper with, disable, or falsify ELD records.</li>
            </ul>
            <p>Violations of this policy may result in immediate termination of the lease agreement.</p>
          </div>

          <div className="space-y-2">
            <Label className="font-semibold">Signature — ELD Policy *</Label>
            <SignaturePad onSignatureChange={s => setSignatures(prev => ({ ...prev, eld: s }))} />
          </div>

          <Separator />

          {/* HOS Policy */}
          <div className="border rounded-lg p-4 space-y-2 text-xs leading-relaxed max-h-48 overflow-y-auto bg-white">
            <h3 className="font-bold text-sm">HOURS OF SERVICE (HOS) POLICY</h3>
            <p>As an Owner Operator leased to 58 Logistics LLC, I acknowledge and agree to comply with the FMCSA Hours of Service regulations.</p>
            <p><strong>Key Rules:</strong></p>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>11-Hour Driving Limit:</strong> May drive a maximum of 11 hours after 10 consecutive hours off duty.</li>
              <li><strong>14-Hour Limit:</strong> May not drive beyond the 14th consecutive hour after coming on duty.</li>
              <li><strong>30-Minute Break:</strong> Must take a 30-minute break after 8 cumulative hours of driving.</li>
              <li><strong>60/70-Hour Limit:</strong> May not drive after 60/70 hours on duty in 7/8 consecutive days.</li>
              <li><strong>Sleeper Berth:</strong> May split the required 10-hour off-duty period as permitted by regulations.</li>
            </ul>
            <p>Violations of HOS regulations may result in fines, out-of-service orders, and termination of this agreement.</p>
          </div>

          <div className="space-y-2">
            <Label className="font-semibold">Signature — HOS Policy *</Label>
            <SignaturePad onSignatureChange={s => setSignatures(prev => ({ ...prev, hos: s }))} />
          </div>

          <Button onClick={handleSubmit} className="w-full">Confirm & Sign Leasing Agreement</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
