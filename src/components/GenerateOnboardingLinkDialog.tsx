import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Copy, Check, Link2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useTenantId } from '@/hooks/useTenantId';
import { DbDispatcher } from '@/hooks/useDispatchers';
import { toast } from '@/hooks/use-toast';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  dispatchers: DbDispatcher[];
}

export function GenerateOnboardingLinkDialog({ open, onOpenChange, dispatchers }: Props) {
  const tenantId = useTenantId();
  const [driverName, setDriverName] = useState('');
  const [serviceType, setServiceType] = useState<'owner_operator' | 'company_driver'>('owner_operator');
  const [dispatcherId, setDispatcherId] = useState<string | null>(null);
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleGenerate = async () => {
    if (!tenantId) {
      toast({ title: 'Error', description: 'No tenant found', variant: 'destructive' });
      return;
    }
    setCreating(true);
    try {
      const { data, error } = await supabase
        .from('onboarding_tokens')
        .insert({
          tenant_id: tenantId,
          driver_name: driverName.trim() || null,
          service_type: serviceType,
          dispatcher_id: dispatcherId,
        })
        .select('token')
        .single();

      if (error) throw error;

      const link = `${window.location.origin}/onboarding/${data.token}`;
      setGeneratedLink(link);
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setCreating(false);
    }
  };

  const handleCopy = () => {
    if (generatedLink) {
      navigator.clipboard.writeText(generatedLink);
      setCopied(true);
      toast({ title: 'Link copiado al portapapeles' });
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleClose = (v: boolean) => {
    if (!v) {
      setDriverName('');
      setServiceType('owner_operator');
      setDispatcherId(null);
      setGeneratedLink(null);
      setCopied(false);
    }
    onOpenChange(v);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5" /> Generate Onboarding Link
          </DialogTitle>
          <DialogDescription>
            Create a unique link for a new driver to complete their onboarding.
          </DialogDescription>
        </DialogHeader>

        {!generatedLink ? (
          <div className="space-y-4 mt-2">
            <div className="space-y-2">
              <Label>Driver Name (optional)</Label>
              <Input
                value={driverName}
                onChange={e => setDriverName(e.target.value)}
                placeholder="e.g. John Smith"
              />
            </div>
            <div className="space-y-2">
              <Label>Service Type</Label>
              <Select value={serviceType} onValueChange={v => setServiceType(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="owner_operator">Owner Operator</SelectItem>
                  <SelectItem value="company_driver">Company Driver</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Pre-assign Dispatcher (optional)</Label>
              <Select value={dispatcherId || 'none'} onValueChange={v => setDispatcherId(v === 'none' ? null : v)}>
                <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {dispatchers.map(d => (
                    <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => handleClose(false)}>Cancel</Button>
              <Button onClick={handleGenerate} disabled={creating}>
                {creating ? 'Generating...' : 'Generate Link'}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4 mt-2">
            <p className="text-sm text-muted-foreground">
              Share this link with the driver. It expires in 7 days.
            </p>
            <div className="flex items-center gap-2">
              <Input readOnly value={generatedLink} className="text-xs" />
              <Button size="icon" variant="outline" onClick={handleCopy}>
                {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
            <div className="flex justify-end">
              <Button variant="outline" onClick={() => handleClose(false)}>Done</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
