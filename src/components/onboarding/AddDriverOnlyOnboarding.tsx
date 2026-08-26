import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { User, FileCheck, CheckCircle2, Upload, ArrowLeft, ArrowRight, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { US_STATES } from '@/lib/usStates';
import { toast } from 'sonner';
import logoImg from '@/assets/logo.png';

interface Props {
  token: string;
  tokenData: any;
  onCompleted: () => void;
}

export default function AddDriverOnlyOnboarding({ token, tokenData, onCompleted }: Props) {
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const totalSteps = 2;

  const PLACEHOLDERS = new Set(['Pending', 'pending@onboarding.local', '000-000-0000']);
  const clean = (v: any) => (v && !PLACEHOLDERS.has(v) ? v : '');

  const [driver, setDriver] = useState({
    name: clean(tokenData?.driver_name),
    email: clean(tokenData?.driver_email),
    phone: clean(tokenData?.driver_phone),
    license: '',
    state: null as string | null,
    license_expiry: null as string | null,
    medical_card_expiry: null as string | null,
    address: '',
    city: '',
    zip: '',
    birthday: null as string | null,
    emergency_contact_name: '',
    emergency_phone: '',
  });
  const [licensePhoto, setLicensePhoto] = useState<File | undefined>(undefined);
  const [medicalCardPhoto, setMedicalCardPhoto] = useState<File | undefined>(undefined);

  const validate = () => {
    const missing: string[] = [];
    if (!driver.name.trim()) missing.push('Name');
    if (!driver.email.trim()) missing.push('Email');
    if (!driver.phone.trim()) missing.push('Phone');
    if (!driver.license.trim()) missing.push('License #');
    if (!driver.license_expiry) missing.push('License Expiry');
    if (!driver.medical_card_expiry) missing.push('Medical Card Expiry');
    if (missing.length) { toast.error(`Faltan: ${missing.join(', ')}`); return false; }
    return true;
  };

  const next = () => {
    if (step === 1 && !validate()) return;
    setStep(s => Math.min(s + 1, totalSteps));
  };
  const prev = () => setStep(s => Math.max(1, s - 1));

  const handleSubmit = async () => {
    if (!validate()) return;
    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('token', token);
      formData.append('service_type', 'add_driver_only');
      formData.append('driver_data', JSON.stringify(driver));
      if (licensePhoto) formData.append('driver_license_photo', licensePhoto);
      if (medicalCardPhoto) formData.append('driver_medical_card_photo', medicalCardPhoto);

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const res = await fetch(`${supabaseUrl}/functions/v1/driver-onboarding`, {
        method: 'POST',
        body: formData,
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Submission failed');
      toast.success('Driver registrado exitosamente!');
      onCompleted();
    } catch (err: any) {
      toast.error(err.message || 'Error al registrar');
    } finally {
      setSubmitting(false);
    }
  };

  const FileUploadBox = ({ label, file, onChange }: { label: string; file?: File; onChange: (f: File | undefined) => void }) => (
    <div className="space-y-1">
      <Label>{label}</Label>
      <div className={cn('border-2 border-dashed rounded-lg p-3 text-center transition-colors', file ? 'border-primary/40 bg-primary/5' : 'border-muted-foreground/30 hover:border-primary/40')}>
        {file ? (
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs truncate flex-1">{file.name}</span>
            <Button variant="ghost" size="sm" onClick={() => onChange(undefined)} className="h-6 text-xs">Remover</Button>
          </div>
        ) : (
          <label className="cursor-pointer flex flex-col items-center gap-1 py-2">
            <Upload className="h-5 w-5 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Click para subir</span>
            <input type="file" accept="image/*,.pdf" className="hidden" onChange={e => onChange(e.target.files?.[0])} />
          </label>
        )}
      </div>
    </div>
  );

  const renderStepper = () => {
    const labels = ['Driver Info', 'Review'];
    const icons = [User, CheckCircle2];
    return (
      <div className="flex items-center justify-between mb-6 gap-1">
        {labels.map((label, i) => {
          const num = i + 1;
          const Icon = icons[i];
          const isDone = step > num;
          const isCurrent = step === num;
          return (
            <div key={num} className="flex items-center flex-1 min-w-0">
              <div className={cn('flex items-center gap-1.5 min-w-0', isCurrent ? 'text-primary' : isDone ? 'text-muted-foreground' : 'text-muted-foreground/50')}>
                <div className={cn(
                  'flex items-center justify-center w-7 h-7 rounded-full shrink-0 border-2',
                  isCurrent ? 'bg-primary text-primary-foreground border-primary' :
                  isDone ? 'bg-primary/20 text-primary border-primary/50' :
                  'bg-muted border-muted-foreground/30'
                )}>
                  <Icon className="h-3.5 w-3.5" />
                </div>
                <span className="text-xs font-medium truncate hidden sm:inline">{label}</span>
              </div>
              {i < labels.length - 1 && <div className={cn('h-0.5 flex-1 mx-1', isDone ? 'bg-primary/50' : 'bg-muted')} />}
            </div>
          );
        })}
      </div>
    );
  };

  const renderDriverStep = () => (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold flex items-center gap-2"><User className="h-5 w-5 text-primary" /> Driver Info</h3>
        <p className="text-sm text-muted-foreground">Solo llenamos tus datos personales. Tu Owner Operator ya está registrado con nosotros.</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="space-y-1"><Label>Full Name *</Label><Input value={driver.name} onChange={e => setDriver({...driver, name: e.target.value})} /></div>
        <div className="space-y-1"><Label>Email *</Label><Input type="email" value={driver.email} onChange={e => setDriver({...driver, email: e.target.value})} /></div>
        <div className="space-y-1"><Label>Phone *</Label><Input value={driver.phone} onChange={e => setDriver({...driver, phone: e.target.value})} /></div>
        <div className="space-y-1"><Label>Birthday</Label><Input type="date" value={driver.birthday || ''} onChange={e => setDriver({...driver, birthday: e.target.value || null})} /></div>
        <div className="space-y-1"><Label>Driver License # *</Label><Input value={driver.license} onChange={e => setDriver({...driver, license: e.target.value})} /></div>
        <div className="space-y-1">
          <Label>License State</Label>
          <Select value={driver.state || ''} onValueChange={v => setDriver({...driver, state: v})}>
            <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
            <SelectContent>{US_STATES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-1"><Label>License Expiry *</Label><Input type="date" value={driver.license_expiry || ''} onChange={e => setDriver({...driver, license_expiry: e.target.value || null})} /></div>
        <div className="space-y-1"><Label>Medical Card Expiry *</Label><Input type="date" value={driver.medical_card_expiry || ''} onChange={e => setDriver({...driver, medical_card_expiry: e.target.value || null})} /></div>
        <div className="space-y-1 md:col-span-2"><Label>Address</Label><Input value={driver.address} onChange={e => setDriver({...driver, address: e.target.value})} /></div>
        <div className="space-y-1"><Label>City</Label><Input value={driver.city} onChange={e => setDriver({...driver, city: e.target.value})} /></div>
        <div className="space-y-1"><Label>Zip</Label><Input value={driver.zip} onChange={e => setDriver({...driver, zip: e.target.value})} /></div>
        <div className="space-y-1"><Label>Emergency Contact Name</Label><Input value={driver.emergency_contact_name} onChange={e => setDriver({...driver, emergency_contact_name: e.target.value})} /></div>
        <div className="space-y-1"><Label>Emergency Contact Phone</Label><Input value={driver.emergency_phone} onChange={e => setDriver({...driver, emergency_phone: e.target.value})} /></div>
      </div>

      <div className="pt-2">
        <h4 className="text-sm font-semibold mb-2 flex items-center gap-1.5"><FileCheck className="h-4 w-4 text-primary" /> Documents</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <FileUploadBox label="License Photo" file={licensePhoto} onChange={setLicensePhoto} />
          <FileUploadBox label="Medical Card Photo" file={medicalCardPhoto} onChange={setMedicalCardPhoto} />
        </div>
      </div>
    </div>
  );

  const renderReviewStep = () => (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold flex items-center gap-2"><CheckCircle2 className="h-5 w-5 text-primary" /> Review</h3>
        <p className="text-sm text-muted-foreground">Confirma los datos antes de enviar.</p>
      </div>
      <div className="border rounded-lg p-3 text-sm space-y-1">
        <div><span className="text-muted-foreground">Name:</span> <span className="font-medium">{driver.name}</span></div>
        <div><span className="text-muted-foreground">Email:</span> <span className="font-medium">{driver.email}</span></div>
        <div><span className="text-muted-foreground">Phone:</span> <span className="font-medium">{driver.phone}</span></div>
        <div><span className="text-muted-foreground">License #:</span> <span className="font-medium">{driver.license} ({driver.state || '—'})</span></div>
        <div><span className="text-muted-foreground">License Expiry:</span> <span className="font-medium">{driver.license_expiry}</span></div>
        <div><span className="text-muted-foreground">Medical Card Expiry:</span> <span className="font-medium">{driver.medical_card_expiry}</span></div>
      </div>
      <div className="border rounded-lg p-3 text-sm">
        <p className="font-semibold text-muted-foreground uppercase text-xs mb-1">Documentos</p>
        <ul className="space-y-0.5">
          <li>{licensePhoto ? '✓' : '✗'} License Photo</li>
          <li>{medicalCardPhoto ? '✓' : '✗'} Medical Card Photo</li>
        </ul>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-muted/30 py-6 px-4">
      <div className="max-w-3xl mx-auto space-y-4">
        <div className="flex items-center justify-center">
          <img src={logoImg} alt="Dispatch Up" className="h-12" />
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">
              Registro de Nuevo Driver
              <span className="ml-2 text-sm font-normal text-muted-foreground">— Owner Operator existente</span>
            </CardTitle>
            <CardDescription>Paso {step} de {totalSteps}</CardDescription>
          </CardHeader>
          <CardContent>
            {renderStepper()}
            {step === 1 ? renderDriverStep() : renderReviewStep()}

            <div className="flex justify-between mt-6 pt-4 border-t">
              <Button variant="outline" onClick={prev} disabled={step === 1 || submitting} className="gap-1">
                <ArrowLeft className="h-4 w-4" /> Back
              </Button>
              {step < totalSteps ? (
                <Button onClick={next} disabled={submitting} className="gap-1">
                  Next <ArrowRight className="h-4 w-4" />
                </Button>
              ) : (
                <Button onClick={handleSubmit} disabled={submitting} className="gap-1">
                  {submitting ? <><Loader2 className="h-4 w-4 animate-spin" /> Submitting...</> : <>Submit <CheckCircle2 className="h-4 w-4" /></>}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
