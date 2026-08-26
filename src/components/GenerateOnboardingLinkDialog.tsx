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
import { useDispatchServiceClients } from '@/hooks/useDispatchServiceClients';
import { useInvestors } from '@/hooks/useInvestors';
import { useTrucks } from '@/hooks/useTrucks';
import { toast } from '@/hooks/use-toast';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  dispatchers: DbDispatcher[];
}

type ServiceType = 'owner_operator' | 'company_driver' | 'dispatch_service';

export function GenerateOnboardingLinkDialog({ open, onOpenChange, dispatchers }: Props) {
  const tenantId = useTenantId();
  const { clients: dispatchServiceClients, loading: clientsLoading } = useDispatchServiceClients();
  const { investors } = useInvestors();
  const { trucks } = useTrucks();
  const [driverName, setDriverName] = useState('');
  const [serviceType, setServiceType] = useState<ServiceType>('owner_operator');
  const [dispatcherId, setDispatcherId] = useState<string | null>(null);
  // Solo aplica cuando serviceType === 'dispatch_service'
  const [clientMode, setClientMode] = useState<'new' | 'existing'>('new');
  const [existingClientId, setExistingClientId] = useState<string | null>(null);
  // Solo aplica cuando serviceType === 'owner_operator'
  const [ooMode, setOoMode] = useState<'new' | 'add_driver'>('new');
  const [existingInvestorId, setExistingInvestorId] = useState<string | null>(null);
  const [existingTruckId, setExistingTruckId] = useState<string | null>(null);
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [copied, setCopied] = useState(false);

  const isDispatchService = serviceType === 'dispatch_service';
  const isOO = serviceType === 'owner_operator';
  const isAddDriverToOO = isOO && ooMode === 'add_driver';

  const handleGenerate = async () => {
    if (!tenantId) {
      toast({ title: 'Error', description: 'No tenant found', variant: 'destructive' });
      return;
    }
    if (isDispatchService && clientMode === 'existing' && !existingClientId) {
      toast({ title: 'Selecciona una empresa existente', variant: 'destructive' });
      return;
    }
    if (isAddDriverToOO && (!existingInvestorId || !existingTruckId)) {
      toast({ title: 'Selecciona el Owner Operator y el truck', variant: 'destructive' });
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
          dispatch_service_client_id: isDispatchService && clientMode === 'existing' ? existingClientId : null,
          existing_investor_id: isAddDriverToOO ? existingInvestorId : null,
          existing_truck_id: isAddDriverToOO ? existingTruckId : null,
        } as any)
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
      setClientMode('new');
      setExistingClientId(null);
      setOoMode('new');
      setExistingInvestorId(null);
      setExistingTruckId(null);
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
              <Select value={serviceType} onValueChange={v => setServiceType(v as ServiceType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="owner_operator">Owner Operator</SelectItem>
                  <SelectItem value="company_driver">Company Driver</SelectItem>
                  <SelectItem value="dispatch_service">Dispatch Service</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {isDispatchService && (
              <>
                <div className="space-y-2">
                  <Label>Empresa</Label>
                  <Select value={clientMode} onValueChange={v => setClientMode(v as 'new' | 'existing')}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="new">Nueva empresa</SelectItem>
                      <SelectItem value="existing">Empresa existente</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    {clientMode === 'new'
                      ? 'El onboarding pedira todos los datos de la empresa + firma del agreement.'
                      : 'El driver solo llenara sus datos personales. La empresa y el agreement ya estan registrados.'}
                  </p>
                </div>

                {clientMode === 'existing' && (
                  <div className="space-y-2">
                    <Label>Selecciona la empresa</Label>
                    <Select
                      value={existingClientId || ''}
                      onValueChange={v => setExistingClientId(v)}
                      disabled={clientsLoading}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={clientsLoading ? 'Cargando...' : 'Seleccionar empresa'} />
                      </SelectTrigger>
                      <SelectContent>
                        {dispatchServiceClients.map(c => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.legal_business_name}{c.mc_number ? ` (MC# ${c.mc_number})` : ''}
                          </SelectItem>
                        ))}
                        {dispatchServiceClients.length === 0 && !clientsLoading && (
                          <div className="px-2 py-1.5 text-xs text-muted-foreground">
                            No hay empresas registradas
                          </div>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </>
            )}

            {isOO && (
              <>
                <div className="space-y-2">
                  <Label>Modo de registro</Label>
                  <Select value={ooMode} onValueChange={v => setOoMode(v as 'new' | 'add_driver')}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="new">Nuevo Owner Operator</SelectItem>
                      <SelectItem value="add_driver">Agregar driver a OO existente</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    {ooMode === 'new'
                      ? 'Onboarding completo: datos del OO, truck, leasing agreement, etc.'
                      : 'Solo pide los datos personales del nuevo driver. El OO y el truck ya estan registrados.'}
                  </p>
                </div>

                {ooMode === 'add_driver' && (
                  <>
                    <div className="space-y-2">
                      <Label>Owner Operator (Investor)</Label>
                      <Select value={existingInvestorId || ''} onValueChange={v => setExistingInvestorId(v)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecciona el OO" />
                        </SelectTrigger>
                        <SelectContent>
                          {investors.map((inv: any) => (
                            <SelectItem key={inv.id} value={inv.id}>
                              {inv.name}{inv.email ? ` (${inv.email})` : ''}
                            </SelectItem>
                          ))}
                          {investors.length === 0 && (
                            <div className="px-2 py-1.5 text-xs text-muted-foreground">
                              No hay investors registrados
                            </div>
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Truck que va a manejar</Label>
                      <Select value={existingTruckId || ''} onValueChange={v => setExistingTruckId(v)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecciona el truck" />
                        </SelectTrigger>
                        <SelectContent>
                          {trucks.filter(t => t.status !== 'inactive').map(t => (
                            <SelectItem key={t.id} value={t.id}>
                              Unit #{t.unit_number}{t.truck_type ? ` — ${t.truck_type}` : ''}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </>
                )}
              </>
            )}

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
