import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, ArrowRight, CheckCircle2, FileSignature, Loader2, Truck, Upload, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { US_STATES } from '@/lib/usStates';
import { toast } from 'sonner';
import logoImg from '@/assets/logo.png';
import LeasingAgreementDialog, { type LeasingBlobsArray } from './LeasingAgreementDialog';

/**
 * Owner Operator que ya trabaja con nosotros (link de la landing con su email):
 *  • add_driver: elige uno de sus camiones y llena solo los datos del driver nuevo.
 *  • add_truck:  datos y documentos del camión nuevo, el driver que lo maneja (suyo o nuevo) y el leasing firmado.
 */
interface Props { token: string; tokenData: any; onCompleted: () => void }

const TRUCK_TYPES = ['Box Truck', 'Hotshot', 'Flatbed', 'Dry Van'];
const TRUCK_DOCS = [
  { key: 'registration_photo', label: 'Registration *' },
  { key: 'insurance_photo', label: 'Insurance *' },
  { key: 'annual_inspection_photo', label: 'Annual Inspection' },
  { key: 'rear_truck_photo', label: 'Rear Truck Photo' },
  { key: 'truck_side_photo', label: 'Truck Side Photo' },
  { key: 'truck_plate_photo', label: 'Truck Plate Photo' },
  { key: 'cargo_area_photo', label: 'Cargo Area Photo' },
];
const emptyDriver = {
  name: '', email: '', phone: '', license: '', state: null as string | null,
  license_expiry: '', medical_card_expiry: '', address: '', city: '', zip: '', birthday: '',
  emergency_contact_name: '', emergency_phone: '',
};

function FileBox({ label, file, onChange }: { label: string; file?: File; onChange: (f?: File) => void }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <div className={cn('border-2 border-dashed rounded-lg p-2 text-center', file ? 'border-primary/40 bg-primary/5' : 'border-muted-foreground/30')}>
        {file ? (
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs truncate">{file.name}</span>
            <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => onChange(undefined)}>Quitar</Button>
          </div>
        ) : (
          <label className="cursor-pointer flex flex-col items-center gap-1 py-1">
            <Upload className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Subir foto o PDF</span>
            <input type="file" accept="image/*,.pdf" className="hidden" onChange={(e) => onChange(e.target.files?.[0])} />
          </label>
        )}
      </div>
    </div>
  );
}

function Field({ label, value, onChange, type = 'text', placeholder }: { label: string; value: any; onChange: (v: string) => void; type?: string; placeholder?: string }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Input type={type} value={value ?? ''} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

export default function ExistingOwnerOnboarding({ token, tokenData, onCompleted }: Props) {
  const mode: 'add_driver' | 'add_truck' = tokenData?.oo_mode === 'add_truck' ? 'add_truck' : 'add_driver';
  const [ctx, setCtx] = useState<{ owner: { name: string }; trucks: any[]; drivers: any[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);

  const [truckId, setTruckId] = useState<string>('');
  const [driver, setDriver] = useState(emptyDriver);
  const [driverFiles, setDriverFiles] = useState<{ license?: File; medical?: File }>({});
  const [driverMode, setDriverMode] = useState<'existing' | 'new'>('existing');
  const [existingDriverId, setExistingDriverId] = useState('');
  const [truck, setTruck] = useState({
    unit_number: '', truck_type: 'Box Truck', make: '', model: '', year: new Date().getFullYear(),
    vin: '', license_plate: '', max_payload_lbs: '', insurance_expiry: '', registration_expiry: '', annual_inspection_expiry: '',
    cargo_length_ft: '', cargo_width_in: '', cargo_height_in: '', rear_door_width_in: '', rear_door_height_in: '', trailer_length_ft: '',
  });
  const [truckFiles, setTruckFiles] = useState<Record<string, File>>({});
  const [leasing, setLeasing] = useState<LeasingBlobsArray | null>(null);
  const [leasingOpen, setLeasingOpen] = useState(false);

  useEffect(() => {
    const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/onboarding-oo`;
    fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'context', token }) })
      .then((r) => r.json())
      .then((d) => {
        if (d.error) { setError(d.error); return; }
        setCtx(d);
        if (d.drivers?.length) setExistingDriverId(d.drivers[0].id); else setDriverMode('new');
      })
      .catch(() => setError('No se pudo cargar la información. Intenta de nuevo.'));
  }, [token]);

  const setD = (k: keyof typeof emptyDriver) => (v: string) => setDriver((d) => ({ ...d, [k]: v }));
  const setT = (k: keyof typeof truck) => (v: string) => setTruck((t) => ({ ...t, [k]: v }));
  const newDriverNeeded = mode === 'add_driver' || driverMode === 'new';
  const driverName = newDriverNeeded ? driver.name : ctx?.drivers.find((d) => d.id === existingDriverId)?.name ?? '';

  const validDriver = () => {
    const miss = [!driver.name.trim() && 'Nombre', !driver.email.trim() && 'Email', !driver.phone.trim() && 'Teléfono',
      !driver.license.trim() && 'Licencia', !driver.license_expiry && 'Vencimiento licencia', !driver.medical_card_expiry && 'Vencimiento medical card'].filter(Boolean);
    if (miss.length) { toast.error(`Faltan: ${miss.join(', ')}`); return false; }
    return true;
  };
  const validTruck = () => {
    const miss = [!truck.unit_number.trim() && 'Unit #', !truck.vin.trim() && 'VIN', !truck.make.trim() && 'Marca', !truck.model.trim() && 'Modelo',
      !truckFiles.registration_photo && 'Registration', !truckFiles.insurance_photo && 'Insurance'].filter(Boolean);
    if (miss.length) { toast.error(`Faltan: ${miss.join(', ')}`); return false; }
    return true;
  };

  const steps = mode === 'add_driver' ? ['Driver', 'Revisar'] : ['Camión', 'Driver', 'Leasing', 'Revisar'];
  const next = () => {
    if (mode === 'add_driver' && step === 1) { if (!truckId) return toast.error('Elige el camión'); if (!validDriver()) return; }
    if (mode === 'add_truck' && step === 1 && !validTruck()) return;
    if (mode === 'add_truck' && step === 2) { if (driverMode === 'new' ? !validDriver() : !existingDriverId) { if (driverMode === 'existing') toast.error('Elige el driver'); return; } }
    if (mode === 'add_truck' && step === 3 && !leasing) return toast.error('Firma el Leasing Agreement');
    setStep((s) => Math.min(s + 1, steps.length));
  };

  const submit = async () => {
    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append('action', 'submit');
      fd.append('token', token);
      fd.append('mode', mode);
      if (newDriverNeeded) {
        fd.append('driver_data', JSON.stringify(driver));
        if (driverFiles.license) fd.append('driver_license_photo', driverFiles.license);
        if (driverFiles.medical) fd.append('driver_medical_card_photo', driverFiles.medical);
      }
      if (mode === 'add_driver') fd.append('truck_id', truckId);
      if (mode === 'add_truck') {
        const num = (v: string) => (v === '' ? null : Number(v));
        fd.append('truck_data', JSON.stringify({
          ...truck, year: num(String(truck.year)), max_payload_lbs: num(truck.max_payload_lbs),
          cargo_length_ft: num(truck.cargo_length_ft), cargo_width_in: num(truck.cargo_width_in), cargo_height_in: num(truck.cargo_height_in),
          rear_door_width_in: num(truck.rear_door_width_in), rear_door_height_in: num(truck.rear_door_height_in), trailer_length_ft: num(truck.trailer_length_ft),
          insurance_expiry: truck.insurance_expiry || null, registration_expiry: truck.registration_expiry || null, annual_inspection_expiry: truck.annual_inspection_expiry || null,
        }));
        for (const [k, f] of Object.entries(truckFiles)) fd.append(`truck_${k}`, f);
        fd.append('driver_mode', driverMode);
        if (driverMode === 'existing') fd.append('driver_id', existingDriverId);
        for (const l of leasing ?? []) fd.append(`leasing_${l.companyId}`, l.blob, `leasing_${l.companyName.replace(/\s+/g, '_')}.pdf`);
      }
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/onboarding-oo`, { method: 'POST', body: fd });
      const r = await res.json();
      if (!res.ok || r.error) throw new Error(r.error || 'No se pudo enviar');
      toast.success(mode === 'add_driver' ? 'Driver registrado' : 'Camión registrado');
      onCompleted();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (error) return <div className="min-h-screen flex items-center justify-center p-6 text-center"><p className="text-destructive">{error}</p></div>;
  if (!ctx) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  const driverForm = (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Nombre completo *" value={driver.name} onChange={setD('name')} />
        <Field label="Email *" type="email" value={driver.email} onChange={setD('email')} />
        <Field label="Teléfono *" value={driver.phone} onChange={setD('phone')} />
        <Field label="Licencia (CDL / DL #) *" value={driver.license} onChange={setD('license')} />
        <div className="space-y-1">
          <Label className="text-xs">Estado de la licencia</Label>
          <Select value={driver.state ?? 'none'} onValueChange={(v) => setDriver((d) => ({ ...d, state: v === 'none' ? null : v }))}>
            <SelectTrigger><SelectValue placeholder="Estado" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">—</SelectItem>
              {US_STATES.map((s: any) => { const v = typeof s === 'string' ? s : s.value ?? s.code; const l = typeof s === 'string' ? s : s.label ?? s.name ?? v; return <SelectItem key={v} value={v}>{l}</SelectItem>; })}
            </SelectContent>
          </Select>
        </div>
        <Field label="Fecha de nacimiento" type="date" value={driver.birthday} onChange={setD('birthday')} />
        <Field label="Vence licencia *" type="date" value={driver.license_expiry} onChange={setD('license_expiry')} />
        <Field label="Vence medical card *" type="date" value={driver.medical_card_expiry} onChange={setD('medical_card_expiry')} />
        <Field label="Dirección" value={driver.address} onChange={setD('address')} />
        <Field label="Ciudad" value={driver.city} onChange={setD('city')} />
        <Field label="ZIP" value={driver.zip} onChange={setD('zip')} />
        <Field label="Contacto de emergencia" value={driver.emergency_contact_name} onChange={setD('emergency_contact_name')} />
        <Field label="Teléfono de emergencia" value={driver.emergency_phone} onChange={setD('emergency_phone')} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <FileBox label="Foto de la licencia" file={driverFiles.license} onChange={(f) => setDriverFiles((x) => ({ ...x, license: f }))} />
        <FileBox label="Foto de la medical card" file={driverFiles.medical} onChange={(f) => setDriverFiles((x) => ({ ...x, medical: f }))} />
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-muted/30 py-8 px-4">
      <div className="max-w-2xl mx-auto space-y-4">
        <div className="flex flex-col items-center gap-2 text-center">
          <img src={logoImg} alt="Dispatch Up" className="h-12" />
          <h1 className="text-xl font-bold">{mode === 'add_driver' ? 'Agregar un driver nuevo' : 'Agregar un camión nuevo'}</h1>
          <p className="text-sm text-muted-foreground">Owner Operator: <b>{ctx.owner.name}</b></p>
        </div>

        <div className="flex gap-1">
          {steps.map((s, i) => (
            <div key={s} className={cn('flex-1 rounded-full py-1 text-center text-xs font-medium', step === i + 1 ? 'bg-primary text-primary-foreground' : step > i + 1 ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground')}>{s}</div>
          ))}
        </div>

        <Card>
          <CardContent className="pt-6 space-y-4">
            {/* ── Driver nuevo para un camión existente ── */}
            {mode === 'add_driver' && step === 1 && (
              <>
                <div className="space-y-1">
                  <Label>¿Qué camión va a manejar? *</Label>
                  {ctx.trucks.length === 0 ? (
                    <p className="text-sm text-amber-700">No encontramos camiones a tu nombre. Usa la opción "Agregar un camión nuevo".</p>
                  ) : (
                    <Select value={truckId} onValueChange={setTruckId}>
                      <SelectTrigger><SelectValue placeholder="Elige el camión" /></SelectTrigger>
                      <SelectContent>
                        {ctx.trucks.map((t) => <SelectItem key={t.id} value={t.id}>Unit #{t.unit_number} · {[t.year, t.make, t.model].filter(Boolean).join(' ')}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  )}
                </div>
                <CardTitle className="text-base flex items-center gap-2 pt-2"><User className="h-4 w-4" /> Datos del driver</CardTitle>
                {driverForm}
              </>
            )}

            {/* ── Camión nuevo: datos y documentos ── */}
            {mode === 'add_truck' && step === 1 && (
              <>
                <CardTitle className="text-base flex items-center gap-2"><Truck className="h-4 w-4" /> Datos del camión</CardTitle>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Unit # *" value={truck.unit_number} onChange={setT('unit_number')} placeholder="101" />
                  <div className="space-y-1">
                    <Label className="text-xs">Tipo *</Label>
                    <Select value={truck.truck_type} onValueChange={setT('truck_type')}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{TRUCK_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <Field label="Marca *" value={truck.make} onChange={setT('make')} placeholder="Ford" />
                  <Field label="Modelo *" value={truck.model} onChange={setT('model')} placeholder="F-350" />
                  <Field label="Año *" type="number" value={truck.year} onChange={setT('year')} />
                  <Field label="VIN *" value={truck.vin} onChange={setT('vin')} />
                  <Field label="Placa" value={truck.license_plate} onChange={setT('license_plate')} />
                  <Field label="Carga máxima (lbs)" type="number" value={truck.max_payload_lbs} onChange={setT('max_payload_lbs')} />
                  <Field label="Vence seguro" type="date" value={truck.insurance_expiry} onChange={setT('insurance_expiry')} />
                  <Field label="Vence registro" type="date" value={truck.registration_expiry} onChange={setT('registration_expiry')} />
                  <Field label="Vence inspección anual" type="date" value={truck.annual_inspection_expiry} onChange={setT('annual_inspection_expiry')} />
                  {truck.truck_type === 'Box Truck' && (
                    <>
                      <Field label="Largo de carga (ft)" type="number" value={truck.cargo_length_ft} onChange={setT('cargo_length_ft')} />
                      <Field label="Ancho de carga (in)" type="number" value={truck.cargo_width_in} onChange={setT('cargo_width_in')} />
                      <Field label="Alto de carga (in)" type="number" value={truck.cargo_height_in} onChange={setT('cargo_height_in')} />
                      <Field label="Ancho puerta trasera (in)" type="number" value={truck.rear_door_width_in} onChange={setT('rear_door_width_in')} />
                      <Field label="Alto puerta trasera (in)" type="number" value={truck.rear_door_height_in} onChange={setT('rear_door_height_in')} />
                    </>
                  )}
                  {truck.truck_type === 'Hotshot' && <Field label="Largo del trailer (ft)" type="number" value={truck.trailer_length_ft} onChange={setT('trailer_length_ft')} />}
                </div>
                <CardDescription>Documentos del camión</CardDescription>
                <div className="grid gap-3 sm:grid-cols-2">
                  {TRUCK_DOCS.map((d) => <FileBox key={d.key} label={d.label} file={truckFiles[d.key]} onChange={(f) => setTruckFiles((x) => { const n = { ...x }; if (f) n[d.key] = f; else delete n[d.key]; return n; })} />)}
                </div>
              </>
            )}

            {/* ── Camión nuevo: driver ── */}
            {mode === 'add_truck' && step === 2 && (
              <>
                <CardTitle className="text-base flex items-center gap-2"><User className="h-4 w-4" /> ¿Quién va a manejar este camión?</CardTitle>
                <div className="grid gap-2 sm:grid-cols-2">
                  <Button type="button" variant={driverMode === 'existing' ? 'default' : 'outline'} disabled={!ctx.drivers.length} onClick={() => setDriverMode('existing')}>Uno de mis drivers</Button>
                  <Button type="button" variant={driverMode === 'new' ? 'default' : 'outline'} onClick={() => setDriverMode('new')}>Un driver nuevo</Button>
                </div>
                {driverMode === 'existing' ? (
                  <div className="space-y-1">
                    <Select value={existingDriverId} onValueChange={setExistingDriverId}>
                      <SelectTrigger><SelectValue placeholder="Elige el driver" /></SelectTrigger>
                      <SelectContent>{ctx.drivers.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">El driver pasa a este camión nuevo.</p>
                  </div>
                ) : driverForm}
              </>
            )}

            {/* ── Camión nuevo: leasing ── */}
            {mode === 'add_truck' && step === 3 && (
              <div className="space-y-3 text-center">
                <FileSignature className="h-10 w-10 mx-auto text-primary" />
                <p className="text-sm">Firma el <b>Leasing Agreement</b> del Unit #{truck.unit_number} ({[truck.year, truck.make, truck.model].filter(Boolean).join(' ')}, VIN {truck.vin}) con el driver <b>{driverName}</b>.</p>
                <Button onClick={() => setLeasingOpen(true)} variant={leasing ? 'outline' : 'default'}>
                  {leasing ? <><CheckCircle2 className="h-4 w-4 mr-1 text-green-600" /> Firmado · volver a firmar</> : 'Leer y firmar el Leasing Agreement'}
                </Button>
                <LeasingAgreementDialog
                  open={leasingOpen}
                  onOpenChange={setLeasingOpen}
                  driverName={driverName && driverName !== ctx.owner.name ? `${ctx.owner.name} (Driver: ${driverName})` : ctx.owner.name}
                  tenantId={tokenData.tenant_id}
                  truckData={{ make: truck.make, model: truck.model, vin: truck.vin, year: Number(truck.year), unit_number: truck.unit_number }}
                  onSigned={(b) => { setLeasing(b); setLeasingOpen(false); }}
                />
              </div>
            )}

            {/* ── Revisar ── */}
            {step === steps.length && (
              <div className="space-y-2 text-sm">
                <CardTitle className="text-base flex items-center gap-2"><CheckCircle2 className="h-4 w-4" /> Revisa y envía</CardTitle>
                {mode === 'add_truck' && <p><b>Camión:</b> Unit #{truck.unit_number} · {[truck.year, truck.make, truck.model].filter(Boolean).join(' ')} · VIN {truck.vin} · {Object.keys(truckFiles).length} documento(s)</p>}
                {mode === 'add_driver' && <p><b>Camión:</b> Unit #{ctx.trucks.find((t) => t.id === truckId)?.unit_number}</p>}
                <p><b>Driver:</b> {driverName}{newDriverNeeded ? ` · ${driver.phone} · ${driver.email}` : ' (ya registrado)'}</p>
                {mode === 'add_truck' && <p><b>Leasing Agreement:</b> firmado ({leasing?.length ?? 0} copia(s))</p>}
              </div>
            )}

            <div className="flex justify-between pt-2">
              <Button variant="outline" onClick={() => setStep((s) => Math.max(1, s - 1))} disabled={step === 1 || submitting}><ArrowLeft className="h-4 w-4 mr-1" /> Atrás</Button>
              {step < steps.length
                ? <Button onClick={next}>Siguiente <ArrowRight className="h-4 w-4 ml-1" /></Button>
                : <Button onClick={submit} disabled={submitting}>{submitting && <Loader2 className="h-4 w-4 animate-spin mr-1" />} Enviar</Button>}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
