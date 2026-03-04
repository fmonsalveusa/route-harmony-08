import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, FileText } from 'lucide-react';
import { DbDriver } from '@/hooks/useDrivers';
import { generateTerminationLetterPdf } from '@/lib/onboardingDocPdf';
import SignaturePad from '@/components/onboarding/SignaturePad';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { format } from 'date-fns';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  driver: DbDriver | null;
  truck: any;
  companyName: string;
  onSuccess: (driverId: string, url: string) => void;
}

export function TerminationLetterDialog({ open, onOpenChange, driver, truck: truckProp, companyName, onSuccess }: Props) {
  const [loading, setLoading] = useState(false);
  const [representative, setRepresentative] = useState('');
  const [signature, setSignature] = useState<string | null>(null);
  const [fetchedTruck, setFetchedTruck] = useState<any>(null);

  useEffect(() => {
    if (open) {
      setRepresentative('');
      setSignature(null);
      setFetchedTruck(null);
      // Always fetch the truck directly from DB using the driver's truck_id
      if (driver?.truck_id) {
        supabase.from('trucks' as any).select('*').eq('id', driver.truck_id).maybeSingle()
          .then(({ data }) => { if (data) setFetchedTruck(data); });
      }
    }
  }, [open, driver?.truck_id]);

  if (!driver) return null;

  const truck = fetchedTruck || truckProp;

  const handleGenerate = async () => {
    if (!representative.trim()) {
      toast({ title: 'Please enter the representative name', variant: 'destructive' });
      return;
    }
    if (!signature) {
      toast({ title: 'Please sign before generating', variant: 'destructive' });
      return;
    }

    setLoading(true);
    try {
      const dateStr = format(new Date(), 'MM/dd/yyyy');
      const blob = generateTerminationLetterPdf({
        driverName: driver.name,
        companyName: companyName || 'Company',
        year: truck?.year ? String(truck.year) : '',
        make: truck?.make || '',
        model: truck?.model || '',
        vin: truck?.vin || '',
        licensePlate: truck?.license_plate || '',
        representativeName: representative,
        date: dateStr,
        signature: signature || undefined,
      });

      const path = `${driver.id}/termination_letter_${Date.now()}.pdf`;
      const { error: uploadError } = await supabase.storage.from('driver-documents').upload(path, blob, { contentType: 'application/pdf' });
      if (uploadError) throw uploadError;

      const { error: updateError } = await supabase.from('drivers' as any).update({ termination_letter_url: path } as any).eq('id', driver.id);
      if (updateError) throw updateError;

      toast({ title: 'Termination letter generated and saved' });
      onSuccess(driver.id, path);
      onOpenChange(false);
    } catch (err: any) {
      toast({ title: 'Error generating letter', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><FileText className="h-5 w-5" /> Termination Letter</DialogTitle>
          <DialogDescription>Generate a lease termination letter for {driver.name}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div><span className="text-muted-foreground text-xs">Driver</span><p className="font-medium">{driver.name}</p></div>
            <div><span className="text-muted-foreground text-xs">Company</span><p className="font-medium">{companyName || '—'}</p></div>
          </div>

          {truck ? (
            <div className="grid grid-cols-2 gap-3 text-sm border-t pt-3">
              <div><span className="text-muted-foreground text-xs">Year</span><p className="font-medium">{truck.year || '—'}</p></div>
              <div><span className="text-muted-foreground text-xs">Make</span><p className="font-medium">{truck.make || '—'}</p></div>
              <div><span className="text-muted-foreground text-xs">Model</span><p className="font-medium">{truck.model || '—'}</p></div>
              <div><span className="text-muted-foreground text-xs">VIN</span><p className="font-medium">{truck.vin || '—'}</p></div>
              <div><span className="text-muted-foreground text-xs">License Plate</span><p className="font-medium">{truck.license_plate || '—'}</p></div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground border-t pt-3">No truck assigned — vehicle fields will be blank.</p>
          )}

          <div className="border-t pt-3">
            <Label htmlFor="representative">Authorized Representative Name</Label>
            <Input id="representative" value={representative} onChange={e => setRepresentative(e.target.value)} placeholder="e.g. Francisco Monsalve" className="mt-1" />
          </div>

          <div className="border-t pt-3">
            <Label>Signature</Label>
            <SignaturePad onSignatureChange={setSignature} height={120} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>Cancel</Button>
          <Button onClick={handleGenerate} disabled={loading}>
            {loading ? <><Loader2 className="h-4 w-4 animate-spin mr-1" /> Generating...</> : 'Generate & Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
