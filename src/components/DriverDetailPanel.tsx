import { useEldStatus, EldInfo } from '@/components/EldStatus';
import { DriverTaxInfo } from '@/components/DriverTaxSection';
import { useAuth } from '@/contexts/AuthContext';
import { useState, useEffect, useRef, Fragment } from 'react';
import { ServiceTypeBadge } from '@/components/ServiceTypeBadge';
import { DbDriver } from '@/hooks/useDrivers';
import { Loader2, Download, Plus, Mail, Phone, Cake, CalendarDays, Percent, MapPin, UserRound, PhoneCall, Landmark, Wallet, Hash, IdCard, HeartPulse, Truck as TruckIcon, Headset } from 'lucide-react';
import { formatDate } from '@/lib/dateUtils';
import { formatPhone } from '@/lib/phoneUtils';
import { Tile, ExpiryRing, DETAIL_CARD, DETAIL_TITLE } from '@/components/detail/DetailTiles';
import { cn } from '@/lib/utils';
import { generateOnboardingSummaryPdf } from '@/lib/onboardingDocPdf';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { DocCardGrid } from '@/components/DocCardGrid';
import { getTenantId } from '@/hooks/useTenantId';

const DRIVER_STATUS: Record<string, { label: string; cls: string }> = {
  available: { label: 'AVAILABLE', cls: 'bg-[#188038]' },
  active: { label: 'ACTIVE', cls: 'bg-[#188038]' },
  on_load: { label: 'ON LOAD', cls: 'bg-[#0b57d0]' },
  pending: { label: 'PENDING', cls: 'bg-[#e37400]' },
  inactive: { label: 'INACTIVE', cls: 'bg-[#d93025]' },
};

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
  onUpdateDriver?: (id: string, updates: Record<string, any>) => Promise<boolean>;
}

export function DriverDetailPanel({ driver, truckLabel, dispatcherName, getDocSignedUrl, truck, onUpdateDriver }: Props) {
  const { data: eldStatus = {} } = useEldStatus();
  const { role, profile } = useAuth();
  const canSeeTax = role === 'admin' || role === 'master_admin' || role === 'accounting' || profile?.is_master_admin === true;
  const [loadingDoc, setLoadingDoc] = useState<string | null>(null);
  const [termLetterDeleted, setTermLetterDeleted] = useState(false);
  const [leasingDocs, setLeasingDocs] = useState<Array<{ id: string; company_name: string; file_url: string }>>([]);
  const [leasingLoading, setLeasingLoading] = useState(true);
  const [addingLeasing, setAddingLeasing] = useState(false);
  const [newLeasingCompany, setNewLeasingCompany] = useState('');
  const [uploadingLeasing, setUploadingLeasing] = useState(false);
  const leasingFileRef = useRef<HTMLInputElement>(null);

  // Investors reales — vienen de driver_investors, no de los campos viejos en drivers
  const [investors, setInvestors] = useState<Array<{ investor_name: string; investor_email: string | null; pay_percentage: number }>>([]);
  const [investorsLoading, setInvestorsLoading] = useState(true);

  useEffect(() => {
    setInvestorsLoading(true);
    supabase
      .from('driver_investors' as any)
      .select('investor_name, investor_email, pay_percentage')
      .eq('driver_id', driver.id)
      .eq('is_active', true)
      .order('created_at')
      .then(({ data, error }) => {
        if (error) console.error('[DriverDetailPanel] driver_investors query error:', error);
        setInvestors((data as any) || []);
        setInvestorsLoading(false);
      });
  }, [driver.id]);

  useEffect(() => {
    setLeasingLoading(true);
    supabase
      .from('driver_leasing_agreements' as any)
      .select('id, company_name, file_url')
      .eq('driver_id', driver.id)
      .order('company_name')
      .then(({ data, error }) => {
        if (error) console.error('[DriverDetailPanel] driver_leasing_agreements query error:', error);
        setLeasingDocs((data as any) || []);
        setLeasingLoading(false);
      });
  }, [driver.id]);

  const handleDeleteTerminationLetter = async () => {
    try {
      // Borra el archivo del storage si es una ruta, no una URL externa
      const url = driver.termination_letter_url;
      if (url && !url.startsWith('http')) {
        await supabase.storage.from('driver-documents').remove([url]);
      }
      const { error } = await supabase
        .from('drivers' as any)
        .update({ termination_letter_url: null } as any)
        .eq('id', driver.id);
      if (error) throw error;
      setTermLetterDeleted(true);
      toast({ title: 'Termination letter deleted' });
    } catch (err: any) {
      toast({ title: 'Error deleting', description: err.message, variant: 'destructive' });
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

  const refreshLeasingDocs = () => {
    supabase
      .from('driver_leasing_agreements' as any)
      .select('id, company_name, file_url')
      .eq('driver_id', driver.id)
      .order('company_name')
      .then(({ data }) => setLeasingDocs((data as any) || []));
  };

  const handleAddLeasing = async (file: File) => {
    if (!newLeasingCompany.trim()) {
      toast({ title: 'Ingresa el nombre de la empresa', variant: 'destructive' });
      return;
    }
    if (!file || file.size === 0) {
      toast({ title: 'Archivo invalido', description: 'El PDF esta vacio o no se pudo leer', variant: 'destructive' });
      return;
    }
    setUploadingLeasing(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `${driver.id}/leasing_${Date.now()}.${ext}`;
      const { error: uploadError, data: uploadData } = await supabase.storage
        .from('driver-documents')
        .upload(path, file, { upsert: true });
      if (uploadError) throw uploadError;
      if (!uploadData?.path) throw new Error('Upload sin path devuelto — verifica permisos del bucket');

      const tenant_id = await getTenantId();
      const { error: insertError } = await supabase
        .from('driver_leasing_agreements' as any)
        .insert({
          driver_id: driver.id,
          company_name: newLeasingCompany.trim(),
          file_url: path,
          tenant_id,
        } as any);
      if (insertError) throw insertError;

      toast({ title: `Leasing (${newLeasingCompany.trim()}) agregado` });
      setNewLeasingCompany('');
      setAddingLeasing(false);
      refreshLeasingDocs();
    } catch (err: any) {
      toast({ title: 'Error subiendo leasing', description: err.message, variant: 'destructive' });
    } finally {
      setUploadingLeasing(false);
    }
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

  const d = driver as any;
  const status = DRIVER_STATUS[driver.status] ?? { label: String(driver.status ?? '').toUpperCase(), cls: 'bg-[#5f6368]' };
  const mask = (v: any) => (v ? (canSeeTax ? String(v) : `****${String(v).slice(-4)}`) : '—');
  const docs = [
    ...docFields.map(doc => {
      const isTermination = doc.key === 'termination_letter_url';
      const url = isTermination && termLetterDeleted ? null : d[doc.key];
      return {
        key: doc.key,
        label: doc.label,
        url,
        ...(isTermination && url ? { onDelete: handleDeleteTerminationLetter } : {}),
      };
    }),
    ...(d.leasing_agreement_url ? [{ key: 'leasing_agreement_url', label: 'Leasing Agreement', url: d.leasing_agreement_url }] : []),
    ...(d.leasing_agreement_venco_url ? [{ key: 'leasing_agreement_venco_url', label: 'Leasing (VENCO)', url: d.leasing_agreement_venco_url }] : []),
    ...(d.leasing_agreement_58_url ? [{ key: 'leasing_agreement_58_url', label: 'Leasing (58 Log)', url: d.leasing_agreement_58_url }] : []),
    ...leasingDocs.map(doc => ({
      key: doc.id,
      label: `Leasing (${doc.company_name})`,
      url: doc.file_url,
      onDelete: async () => {
        // Borrar archivo del storage (si existe) y luego la fila.
        if (doc.file_url && !doc.file_url.startsWith('http')) {
          await supabase.storage.from('driver-documents').remove([doc.file_url]);
        }
        const { data: deleted, error } = await supabase
          .from('driver_leasing_agreements' as any)
          .delete()
          .eq('id', doc.id)
          .select();
        if (error) {
          toast({ title: 'Error borrando leasing', description: error.message, variant: 'destructive' });
          return;
        }
        if (!deleted || (deleted as any[]).length === 0) {
          toast({
            title: 'No se pudo borrar',
            description: 'RLS bloqueo la operacion. Revisar politicas de driver_leasing_agreements.',
            variant: 'destructive',
          });
          return;
        }
        toast({ title: `Leasing (${doc.company_name}) borrado` });
        refreshLeasingDocs();
      },
    })),
  ];
  const docsLoaded = docs.filter(x => !!x.url).length;
  const address = [d.address, d.city, [driver.state, d.zip].filter(Boolean).join(' ')].filter(Boolean).join(', ');
  const PILL_BTN = 'h-8 rounded-full px-3 text-xs gap-1.5 shadow-none border-[#747775] dark:border-border text-[#0b57d0] dark:text-blue-300 hover:bg-[#e8f0fe] hover:text-[#0b57d0] font-medium';

  return (
    <div className="px-4 py-3 bg-[#f8fafd] dark:bg-background/60 border-t border-[#e3e3e3] dark:border-border animate-fade-in space-y-3">
      <div className="grid grid-cols-1 lg:grid-cols-[3fr_7fr] gap-3 items-start">
        {/* ═══ General Information ═══ */}
        <div className={DETAIL_CARD.replace('space-y-3', 'space-y-2')}>
          <h3 className={DETAIL_TITLE}>General Information</h3>
          <div className="grid grid-cols-2 gap-1.5">
            <div className="col-span-2"><Tile icon={Mail} tone="blue" label="Email" value={driver.email || '—'} copy={driver.email} /></div>
            <Tile icon={Phone} tone="green" label="Phone" value={formatPhone(driver.phone) || '—'} copy={driver.phone} />
            <Tile icon={Cake} tone="violet" label="Birthday" value={formatDate(d.birthday) || '—'} />
            <Tile icon={CalendarDays} tone="sky" label="Hire Date" value={formatDate(driver.hire_date) || '—'} />
            <ExpiryRing icon={HeartPulse} label="Medical Card" date={driver.medical_card_expiry} />
            <Tile icon={IdCard} tone="blue" label="Driver License #" value={<span className="font-mono text-[13px]">{driver.license || '—'}{driver.state ? ` (${driver.state})` : ''}</span>} copy={driver.license} />
            <ExpiryRing icon={IdCard} label="Driver License" date={driver.license_expiry} />
            <div className="col-span-2"><Tile icon={MapPin} tone="red" label="Address" value={address || '—'} copy={address || null} /></div>
          </div>

          <p className="text-[11px] uppercase tracking-wide text-[#444746] dark:text-muted-foreground">Emergency Contact</p>
          <div className="grid grid-cols-2 gap-1.5">
            <Tile icon={UserRound} tone="gray" label="Name" value={d.emergency_contact_name || '—'} />
            <Tile icon={PhoneCall} tone="gray" label="Phone" value={formatPhone(d.emergency_phone) || '—'} copy={d.emergency_phone} />
          </div>
          <div className="rounded-2xl bg-[#f8fafd] dark:bg-muted/40 px-3 pb-2 [&>div]:border-t-0">
            <EldInfo status={eldStatus[driver.id]} />
          </div>
        </div>

        {/* Columna derecha: Documents arriba, Payments debajo */}
        <div className="space-y-3">
          {/* ═══ Documents ═══ */}
          <div className={DETAIL_CARD}>
            <div className="flex items-center justify-between gap-2">
              <h3 className={DETAIL_TITLE}>Documents</h3>
              <span className="text-xs text-[#444746] dark:text-muted-foreground">{docsLoaded} de {docs.length} cargados</span>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" className={PILL_BTN} onClick={() => setAddingLeasing(v => !v)}>
                <Plus className="h-3 w-3" /> Add Leasing
              </Button>
              <Button variant="outline" size="sm" className={PILL_BTN} onClick={e => { e.stopPropagation(); handleDownloadPdf(); }}>
                <Download className="h-3.5 w-3.5" /> Download PDF
              </Button>
            </div>

            {/* Formulario para agregar nuevo leasing */}
            {addingLeasing && (
              <div className="p-3 rounded-2xl bg-[#e8f0fe] dark:bg-blue-950/40 space-y-2">
                <p className="text-xs font-medium text-muted-foreground">Nuevo Leasing Agreement</p>
                <Input
                  placeholder="Nombre de la empresa (ej: AG AR Transportation)"
                  value={newLeasingCompany}
                  onChange={e => setNewLeasingCompany(e.target.value)}
                  className="h-8 text-xs"
                />
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    className="h-7 text-xs gap-1"
                    disabled={!newLeasingCompany.trim() || uploadingLeasing}
                    onClick={() => leasingFileRef.current?.click()}
                  >
                    {uploadingLeasing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
                    {uploadingLeasing ? 'Subiendo...' : 'Seleccionar PDF'}
                  </Button>
                  <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => { setAddingLeasing(false); setNewLeasingCompany(''); }}>
                    Cancelar
                  </Button>
                </div>
                <input
                  ref={leasingFileRef}
                  type="file"
                  accept=".pdf,image/*"
                  className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleAddLeasing(f); }}
                />
              </div>
            )}

            <DocCardGrid
              variant="cards"
              docs={docs}
              getDocSignedUrl={getDocSignedUrl}
              allowUpload={!!onUpdateDriver}
              uploadBasePath={driver.id}
              onUpload={onUpdateDriver ? async (key, newUrl) => {
                await onUpdateDriver(driver.id, { [key + (key.endsWith('_url') ? '' : '_url')]: newUrl });
              } : undefined}
            />
            {leasingLoading && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" /> Loading leasing agreements...
              </div>
            )}
          </div>

          {/* ═══ Payments ═══ */}
          <div className={DETAIL_CARD}>
            <h3 className={DETAIL_TITLE}>Payments</h3>
            {/* Todo en una sola línea: % de pago, investors y datos bancarios */}
            <div className="grid grid-cols-[repeat(auto-fit,minmax(125px,1fr))] gap-1.5">
              <Tile icon={Percent} tone="green" label="% Driver Pay" value={`${driver.pay_percentage ?? 0}%`} />
              {driver.service_type === 'dispatch_service' && (
                <Tile icon={Percent} tone="sky" label="% Dispatch" value={`${d.dispatch_service_percentage ?? 0}%`} />
              )}
              {investorsLoading ? (
                <Tile icon={UserRound} tone="violet" label="Investor" value="…" />
              ) : investors.length === 0 ? (
                <Tile icon={UserRound} tone="violet" label="Investor" value="Sin investor" />
              ) : investors.map((inv, i) => (
                <Tile key={i} icon={UserRound} tone="violet" label={`Investor · ${inv.pay_percentage ?? 0}%`} value={<span title={inv.investor_email ?? ''}>{inv.investor_name || '—'}</span>} />
              ))}
              {(d.bank_name || d.routing_number || d.account_number) && (
                <>
                  <Tile icon={UserRound} tone="blue" label="Account Holder" value={d.account_holder_name || '—'} />
                  <Tile icon={Landmark} tone="sky" label="Bank" value={d.bank_name || '—'} />
                  <Tile icon={Wallet} tone="violet" label="Type" value={d.account_type ? d.account_type.charAt(0).toUpperCase() + d.account_type.slice(1) : '—'} />
                  <Tile icon={Hash} tone="gray" label="Routing #" value={<span className="font-mono text-[13px]">{mask(d.routing_number)}</span>} copy={canSeeTax && d.routing_number ? String(d.routing_number) : null} />
                  <Tile icon={Hash} tone="gray" label="Account #" value={<span className="font-mono text-[13px]">{mask(d.account_number)}</span>} copy={canSeeTax && d.account_number ? String(d.account_number) : null} />
                </>
              )}
            </div>

            {/* Datos fiscales del 1099 (solo admin y accounting) */}
            {canSeeTax && <DriverTaxInfo driverId={driver.id} />}
          </div>
        </div>
      </div>
    </div>
  );
}
