import { useState, useEffect, useRef, useMemo, Fragment } from 'react';
import { DbDriver } from '@/hooks/useDrivers';
import { FileText, ExternalLink, Loader2, Download, Plus } from 'lucide-react';
import { formatDate } from '@/lib/dateUtils';
import { formatPhone } from '@/lib/phoneUtils';
import { ExpiryBadge } from '@/components/ExpiryBadge';
import { generateOnboardingSummaryPdf } from '@/lib/onboardingDocPdf';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { format, startOfMonth, endOfMonth, parseISO } from 'date-fns';
import { DocCardGrid } from '@/components/DocCardGrid';
import { getTenantId } from '@/hooks/useTenantId';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { StatusBadge } from '@/components/StatusBadge';

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

// ── Sub-componentes de las pestanas Trips y Payroll ──────────────────────

function DriverTripsTab({ driverId }: { driverId: string }) {
  const [loads, setLoads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [monthOffset, setMonthOffset] = useState(0); // 0 = mes actual, -1 = mes pasado, +1 = mes siguiente

  const targetDate = useMemo(() => {
    const d = new Date();
    d.setMonth(d.getMonth() + monthOffset);
    return d;
  }, [monthOffset]);

  const rangeLabel = format(targetDate, 'MMMM yyyy');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const start = format(startOfMonth(targetDate), 'yyyy-MM-dd');
      const end = format(endOfMonth(targetDate), 'yyyy-MM-dd');
      const { data, error } = await supabase
        .from('loads')
        .select('id, reference_number, origin, destination, pickup_date, delivery_date, total_rate, driver_pay_amount, status, factoring')
        .eq('driver_id', driverId)
        .gte('delivery_date', start)
        .lte('delivery_date', end)
        .order('delivery_date', { ascending: false });
      if (cancelled) return;
      if (error) console.error('[Trips] error:', error);
      setLoads((data as any[]) || []);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [driverId, targetDate]);

  const totalPay = loads.reduce((s, l) => s + Number(l.driver_pay_amount || 0), 0);
  const totalRate = loads.reduce((s, l) => s + Number(l.total_rate || 0), 0);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setMonthOffset(o => o - 1)} className="h-7 text-xs">← Prev</Button>
          <span className="text-sm font-semibold capitalize">{rangeLabel}</span>
          <Button variant="outline" size="sm" onClick={() => setMonthOffset(o => o + 1)} disabled={monthOffset >= 0} className="h-7 text-xs">Next →</Button>
          {monthOffset !== 0 && (
            <Button variant="ghost" size="sm" onClick={() => setMonthOffset(0)} className="h-7 text-xs">Mes actual</Button>
          )}
        </div>
        <div className="text-xs text-muted-foreground">
          <span className="font-semibold text-foreground">{loads.length}</span> cargas ·
          Rate total: <span className="font-semibold text-foreground">${totalRate.toLocaleString()}</span> ·
          Pay total: <span className="font-semibold text-emerald-600">${totalPay.toLocaleString()}</span>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : loads.length === 0 ? (
        <p className="text-center text-muted-foreground py-8 text-sm">No hay cargas en {rangeLabel}.</p>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b bg-muted/40 text-left">
                <th className="p-2 font-medium text-muted-foreground">Ref #</th>
                <th className="p-2 font-medium text-muted-foreground">Origen → Destino</th>
                <th className="p-2 font-medium text-muted-foreground">Delivery Date</th>
                <th className="p-2 font-medium text-muted-foreground text-right">Rate</th>
                <th className="p-2 font-medium text-muted-foreground text-right">Paid Amount</th>
                <th className="p-2 font-medium text-muted-foreground">Status</th>
              </tr>
            </thead>
            <tbody>
              {loads.map(l => (
                <tr key={l.id} className="border-b last:border-0 hover:bg-muted/20">
                  <td className="p-2 font-medium text-primary">{l.reference_number}</td>
                  <td className="p-2">
                    <div className="truncate max-w-[280px]" title={`${l.origin} → ${l.destination}`}>
                      {l.origin} → {l.destination}
                    </div>
                  </td>
                  <td className="p-2 text-muted-foreground">{l.delivery_date ? format(parseISO(l.delivery_date), 'MMM dd, yyyy') : '—'}</td>
                  <td className="p-2 text-right font-semibold">${Number(l.total_rate || 0).toLocaleString()}</td>
                  <td className="p-2 text-right font-semibold text-emerald-600">${Number(l.driver_pay_amount || 0).toLocaleString()}</td>
                  <td className="p-2"><StatusBadge status={l.status} className="text-[10px] px-2 py-0.5" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function DriverPayrollTab({ driverName, driverId }: { driverName: string; driverId: string }) {
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [monthOffset, setMonthOffset] = useState(0);

  const targetDate = useMemo(() => {
    const d = new Date();
    d.setMonth(d.getMonth() + monthOffset);
    return d;
  }, [monthOffset]);
  const rangeLabel = format(targetDate, 'MMMM yyyy');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const start = format(startOfMonth(targetDate), 'yyyy-MM-dd');
      const end = format(endOfMonth(targetDate), 'yyyy-MM-dd');
      // Filtrar por driver_id (recipient_id) O por nombre (backup para pagos legacy).
      const { data, error } = await supabase
        .from('payments')
        .select('id, load_reference, amount, percentage_applied, total_rate, status, payment_date, created_at, recipient_id, recipient_name')
        .eq('recipient_type', 'driver')
        .or(`recipient_id.eq.${driverId},recipient_name.eq.${driverName}`)
        .gte('created_at', `${start}T00:00:00`)
        .lte('created_at', `${end}T23:59:59`)
        .order('created_at', { ascending: false });
      if (cancelled) return;
      if (error) console.error('[Payroll] error:', error);
      setPayments((data as any[]) || []);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [driverId, driverName, targetDate]);

  const totalAmount = payments.reduce((s, p) => s + Number(p.amount || 0), 0);
  const paidAmount = payments.filter(p => p.status === 'paid').reduce((s, p) => s + Number(p.amount || 0), 0);
  const pendingAmount = payments.filter(p => p.status === 'pending').reduce((s, p) => s + Number(p.amount || 0), 0);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setMonthOffset(o => o - 1)} className="h-7 text-xs">← Prev</Button>
          <span className="text-sm font-semibold capitalize">{rangeLabel}</span>
          <Button variant="outline" size="sm" onClick={() => setMonthOffset(o => o + 1)} disabled={monthOffset >= 0} className="h-7 text-xs">Next →</Button>
          {monthOffset !== 0 && (
            <Button variant="ghost" size="sm" onClick={() => setMonthOffset(0)} className="h-7 text-xs">Mes actual</Button>
          )}
        </div>
        <div className="text-xs text-muted-foreground">
          <span className="font-semibold text-foreground">{payments.length}</span> pagos ·
          Total: <span className="font-semibold text-foreground">${totalAmount.toLocaleString()}</span> ·
          Pagado: <span className="font-semibold text-emerald-600">${paidAmount.toLocaleString()}</span> ·
          Pendiente: <span className="font-semibold text-amber-600">${pendingAmount.toLocaleString()}</span>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : payments.length === 0 ? (
        <p className="text-center text-muted-foreground py-8 text-sm">No hay pagos en {rangeLabel}.</p>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b bg-muted/40 text-left">
                <th className="p-2 font-medium text-muted-foreground">Fecha creado</th>
                <th className="p-2 font-medium text-muted-foreground">Load Ref</th>
                <th className="p-2 font-medium text-muted-foreground text-right">Total Rate</th>
                <th className="p-2 font-medium text-muted-foreground text-right">%</th>
                <th className="p-2 font-medium text-muted-foreground text-right">Amount</th>
                <th className="p-2 font-medium text-muted-foreground">Status</th>
                <th className="p-2 font-medium text-muted-foreground">Payment Date</th>
              </tr>
            </thead>
            <tbody>
              {payments.map(p => (
                <tr key={p.id} className="border-b last:border-0 hover:bg-muted/20">
                  <td className="p-2 text-muted-foreground">{p.created_at ? format(parseISO(p.created_at), 'MMM dd') : '—'}</td>
                  <td className="p-2 font-medium text-primary">{p.load_reference || '—'}</td>
                  <td className="p-2 text-right">${Number(p.total_rate || 0).toLocaleString()}</td>
                  <td className="p-2 text-right text-muted-foreground">{p.percentage_applied}%</td>
                  <td className="p-2 text-right font-semibold text-emerald-600">${Number(p.amount || 0).toLocaleString()}</td>
                  <td className="p-2">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                      p.status === 'paid' ? 'bg-emerald-500/15 text-emerald-600' : 'bg-amber-500/15 text-amber-600'
                    }`}>
                      {p.status?.toUpperCase() || 'PENDING'}
                    </span>
                  </td>
                  <td className="p-2 text-muted-foreground">{p.payment_date ? format(parseISO(p.payment_date), 'MMM dd, yyyy') : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

interface Props {
  driver: DbDriver;
  truckLabel: string | null;
  dispatcherName: string | null;
  getDocSignedUrl?: (storedUrl: string) => Promise<string | null>;
  truck?: any;
  onUpdateDriver?: (id: string, updates: Record<string, any>) => Promise<boolean>;
}

export function DriverDetailPanel({ driver, truckLabel, dispatcherName, getDocSignedUrl, truck, onUpdateDriver }: Props) {
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

  return (
    <div className="p-5 bg-muted/20 border-t animate-fade-in">
      <Tabs defaultValue="general" className="w-full">
        <TabsList className="w-full justify-start bg-transparent border-b rounded-none p-0 h-auto mb-4">
          <TabsTrigger value="general" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 py-2 font-semibold">
            General Information
          </TabsTrigger>
          <TabsTrigger value="trips" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 py-2 font-semibold">
            Trips
          </TabsTrigger>
          <TabsTrigger value="payroll" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 py-2 font-semibold">
            Payroll
          </TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="space-y-4 mt-0">
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
        <Info label="Phone">{formatPhone(driver.phone)}</Info>
        <Info label="Birthday">{formatDate((driver as any).birthday) || '—'}</Info>
        <Info label="Hire Date">{formatDate(driver.hire_date)}</Info>
        <Info label="Service Type">{driver.service_type?.replace(/_/g, ' ')}</Info>
      </div>

      {/* Address */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-3">
        <Info label="Address">{(driver as any).address || '—'}</Info>
        <Info label="City">{(driver as any).city || '—'}</Info>
        <Info label="State">{driver.state || '—'}</Info>
        <Info label="Zip">{(driver as any).zip || '—'}</Info>
      </div>

      {/* Emergency Contact */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-3 border-t pt-3">
        <Info label="Emergency Contact">{(driver as any).emergency_contact_name || '—'}</Info>
        <Info label="Emergency Phone">{formatPhone((driver as any).emergency_phone)}</Info>
      </div>

      {/* License & Medical */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-3 border-t pt-3">
        <Info label="Driver License #">{driver.license}{driver.state ? ` (${driver.state})` : ''}</Info>
        <Info label="License Expiry">{formatDate(driver.license_expiry)}</Info>
        <Info label="Medical Card Expiry">{formatDate(driver.medical_card_expiry)}</Info>
        <Info label="Factoring %">{driver.factoring_percentage}%</Info>
      </div>

      {/* Assignments — Dispatcher + Truck */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-3 border-t pt-3">
        <Info label="Dispatcher">{dispatcherName || 'Unassigned'}</Info>
        <Info label="Truck">{truckLabel || 'Unassigned'}</Info>
        {driver.service_type === 'dispatch_service' && (
          <Info label="% Dispatch Service">{(driver as any).dispatch_service_percentage ?? 0}%</Info>
        )}
      </div>

      {/* Investor(s) + Pay Percentages — una linea por investor con %Driver Pay solo en la primera */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-3">
        {investorsLoading ? (
          <Info label="Investor">Loading...</Info>
        ) : investors.length === 0 ? (
          <>
            <Info label="Investor">—</Info>
            <Info label="Investor Email">—</Info>
            <Info label="% Investor Pay">—</Info>
            <Info label="% Driver Pay">{driver.pay_percentage}%</Info>
          </>
        ) : (
          investors.map((inv, i) => (
            <Fragment key={i}>
              <Info label={investors.length > 1 ? `Investor ${i + 1}` : 'Investor'}>{inv.investor_name || '—'}</Info>
              <Info label="Investor Email">{inv.investor_email || '—'}</Info>
              <Info label="% Investor Pay">{inv.pay_percentage ?? '—'}%</Info>
              {i === 0 ? <Info label="% Driver Pay">{driver.pay_percentage}%</Info> : <div />}
            </Fragment>
          ))
        )}
      </div>

      {/* Banking Information */}
      {((driver as any).bank_name || (driver as any).routing_number || (driver as any).account_number) && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-3 border-t pt-3">
          <div className="sm:col-span-4">
            <p className="text-xs font-semibold text-muted-foreground mb-2">Banking Information (ACH)</p>
          </div>
          <Info label="Account Holder">{(driver as any).account_holder_name || '—'}</Info>
          <Info label="Bank Name">{(driver as any).bank_name || '—'}</Info>
          <Info label="Account Type">
            {(driver as any).account_type
              ? (driver as any).account_type.charAt(0).toUpperCase() + (driver as any).account_type.slice(1)
              : '—'}
          </Info>
          <Info label="Routing Number">
            {(driver as any).routing_number ? `****${String((driver as any).routing_number).slice(-4)}` : '—'}
          </Info>
          <Info label="Account Number">
            {(driver as any).account_number ? `****${String((driver as any).account_number).slice(-4)}` : '—'}
          </Info>
        </div>
      )}

      {/* Documents */}
      <div className="border-t pt-3">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold text-muted-foreground">Documents</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5" onClick={() => setAddingLeasing(v => !v)}>
              <Plus className="h-3 w-3" /> Add Leasing
            </Button>
            <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5" onClick={e => { e.stopPropagation(); handleDownloadPdf(); }}>
              <Download className="h-3.5 w-3.5" /> Download PDF
            </Button>
          </div>
        </div>

        {/* Formulario para agregar nuevo leasing */}
        {addingLeasing && (
          <div className="mb-3 p-3 rounded-lg border border-dashed border-primary/40 bg-primary/5 space-y-2">
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
          docs={[
            ...docFields.map(doc => {
              const isTermination = doc.key === 'termination_letter_url';
              const url = isTermination && termLetterDeleted ? null : (driver as any)[doc.key];
              return { key: doc.key, label: doc.label, url };
            }),
            ...((driver as any).leasing_agreement_url ? [{ key: 'leasing_agreement_url', label: 'Leasing Agreement', url: (driver as any).leasing_agreement_url }] : []),
            ...((driver as any).leasing_agreement_venco_url ? [{ key: 'leasing_agreement_venco_url', label: 'Leasing (VENCO)', url: (driver as any).leasing_agreement_venco_url }] : []),
            ...((driver as any).leasing_agreement_58_url ? [{ key: 'leasing_agreement_58_url', label: 'Leasing (58 Log)', url: (driver as any).leasing_agreement_58_url }] : []),
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
          ]}
          getDocSignedUrl={getDocSignedUrl}
          allowUpload={!!onUpdateDriver}
          uploadBasePath={driver.id}
          onUpload={onUpdateDriver ? async (key, newUrl) => {
            await onUpdateDriver(driver.id, { [key + (key.endsWith('_url') ? '' : '_url')]: newUrl });
          } : undefined}
        />
        {leasingLoading && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1">
            <Loader2 className="h-3 w-3 animate-spin" /> Loading leasing agreements...
          </div>
        )}
      </div>
        </TabsContent>

        <TabsContent value="trips" className="mt-0">
          <DriverTripsTab driverId={driver.id} />
        </TabsContent>

        <TabsContent value="payroll" className="mt-0">
          <DriverPayrollTab driverId={driver.id} driverName={driver.name} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
