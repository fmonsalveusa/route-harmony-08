import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, Upload, FileCheck, CheckCircle2, Truck, User, Send } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import logoImg from '@/assets/logo.png';
import { US_STATES } from '@/lib/usStates';
import DocumentSigningStep, { SignedDocs } from '@/components/onboarding/DocumentSigningStep';

const TRUCK_TYPES = ['Box Truck', 'Hotshot', 'Flatbed', 'Dry Van'];

const DRIVER_DOC_FIELDS = [
  { key: 'license_photo', label: 'License Photo' },
  { key: 'medical_card_photo', label: 'Medical Card Photo' },
];

const TRUCK_DOC_FIELDS = [
  { key: 'registration_photo', label: 'Registration Photo' },
  { key: 'insurance_photo', label: 'Insurance Photo' },
  { key: 'license_photo', label: 'License Photo' },
  { key: 'rear_truck_photo', label: 'Rear Truck Photo' },
  { key: 'truck_side_photo', label: 'Truck Side Photo' },
  { key: 'truck_plate_photo', label: 'Truck Plate Photo' },
  { key: 'cargo_area_photo', label: 'Cargo Area Photo' },
];

const STEP_LABELS = ['Driver Info', 'Truck Info', 'Documents', 'Review'];

export default function DriverOnboarding() {
  const { token } = useParams<{ token: string }>();
  const [step, setStep] = useState(1);
  const [validating, setValidating] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);
  const [tokenData, setTokenData] = useState<any>(null);
  const [submitting, setSubmitting] = useState(false);
  const [completed, setCompleted] = useState(false);

  // Driver form
  const [driver, setDriver] = useState({
    name: '', email: '', phone: '', license: '',
    state: null as string | null,
    license_expiry: null as string | null,
    medical_card_expiry: null as string | null,
  });
  const [driverFiles, setDriverFiles] = useState<Record<string, File>>({});

  // Truck form
  const [truck, setTruck] = useState({
    unit_number: '', truck_type: 'Dry Van', make: '', model: '',
    year: new Date().getFullYear(), max_payload_lbs: null as number | null,
    vin: '', license_plate: '',
    insurance_expiry: null as string | null,
    registration_expiry: null as string | null,
    cargo_length_ft: null as number | null,
    cargo_width_in: null as number | null,
    cargo_height_in: null as number | null,
    rear_door_width_in: null as number | null,
    rear_door_height_in: null as number | null,
    trailer_length_ft: null as number | null,
    mega_ramp: null as string | null,
  });
  const [truckFiles, setTruckFiles] = useState<Record<string, File>>({});

  // Signed documents
  const [signedDocs, setSignedDocs] = useState<SignedDocs>({ w9: null, leasing: null, service: null });

  useEffect(() => {
    if (!token) return;
    (async () => {
      const { data, error } = await supabase
        .from('onboarding_tokens')
        .select('*')
        .eq('token', token)
        .eq('status', 'pending')
        .single();
      
      if (error || !data) {
        setTokenValid(false);
      } else if (new Date(data.expires_at) < new Date()) {
        setTokenValid(false);
      } else {
        setTokenValid(true);
        setTokenData(data);
        if (data.driver_name) setDriver(d => ({ ...d, name: data.driver_name }));
        if ((data as any).driver_email) setDriver(d => ({ ...d, email: (data as any).driver_email }));
        if ((data as any).driver_phone) setDriver(d => ({ ...d, phone: (data as any).driver_phone }));
        if ((data as any).truck_type) setTruck(t => ({ ...t, truck_type: (data as any).truck_type }));
      }
      setValidating(false);
    })();
  }, [token]);

  const validateStep1 = () => {
    const missing: string[] = [];
    if (!driver.name.trim()) missing.push('Name');
    if (!driver.email.trim()) missing.push('Email');
    if (!driver.phone.trim()) missing.push('Phone');
    if (!driver.license.trim()) missing.push('Driver License #');
    if (missing.length) {
      toast.error(`Required fields: ${missing.join(', ')}`);
      return false;
    }
    return true;
  };

  const validateStep2 = () => {
    if (!truck.unit_number.trim()) {
      toast.error('Required field: Unit #');
      return false;
    }
    return true;
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('token', token!);
      formData.append('driver_data', JSON.stringify(driver));
      formData.append('truck_data', JSON.stringify(truck));

      // Append driver files
      for (const [key, file] of Object.entries(driverFiles)) {
        formData.append(`driver_${key}`, file);
      }
      // Append truck files
      for (const [key, file] of Object.entries(truckFiles)) {
        formData.append(`truck_${key}`, file);
      }

      // Append signed document PDFs
      if (signedDocs.w9) formData.append('driver_form_w9', signedDocs.w9, 'w9_signed.pdf');
      if (signedDocs.leasing) formData.append('driver_leasing_agreement', signedDocs.leasing, 'leasing_agreement_signed.pdf');
      if (signedDocs.service) formData.append('driver_service_agreement', signedDocs.service, 'service_agreement_signed.pdf');

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const res = await fetch(`${supabaseUrl}/functions/v1/driver-onboarding`, {
        method: 'POST',
        body: formData,
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Submission failed');

      setCompleted(true);
      toast.success('Onboarding completed successfully!');
    } catch (err: any) {
      toast.error(err.message || 'Error submitting form');
    } finally {
      setSubmitting(false);
    }
  };

  if (validating) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!tokenValid) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
        <Card className="max-w-md w-full text-center">
          <CardContent className="pt-8 pb-8 space-y-4">
            <div className="text-5xl">🔗</div>
            <h2 className="text-xl font-bold">Invalid or Expired Link</h2>
            <p className="text-muted-foreground text-sm">
              This onboarding link is no longer valid. Please contact your dispatcher for a new link.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (completed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
        <Card className="max-w-md w-full text-center">
          <CardContent className="pt-8 pb-8 space-y-4">
            <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto" />
            <h2 className="text-xl font-bold">Onboarding Complete!</h2>
            <p className="text-muted-foreground text-sm">
              Your information has been submitted successfully. Your dispatcher will review and get back to you.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30 py-6 px-4">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <img src={logoImg} alt="Logo" className="h-12 mx-auto" />
          <h1 className="text-2xl font-bold">Driver Onboarding</h1>
          <p className="text-sm text-muted-foreground">Complete the form below to register your profile and truck information.</p>
        </div>

        {/* Step indicator */}
        <div className="flex items-center justify-center gap-2">
          {[1, 2, 3, 4].map(s => (
            <div key={s} className="flex items-center gap-2">
              <div className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-colors",
                s === step ? "bg-primary text-primary-foreground" :
                s < step ? "bg-green-500 text-white" : "bg-muted text-muted-foreground"
              )}>
                {s < step ? '✓' : s}
              </div>
              {s < 4 && <div className={cn("w-8 h-0.5", s < step ? "bg-green-500" : "bg-muted")} />}
            </div>
          ))}
        </div>
        <div className="flex justify-center gap-4 text-xs text-muted-foreground">
          {STEP_LABELS.map(l => <span key={l}>{l}</span>)}
        </div>

        {/* Step 1: Driver Info */}
        {step === 1 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><User className="h-5 w-5" /> Personal Information</CardTitle>
              <CardDescription>Enter your personal and license details.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Full Name *</Label>
                  <Input value={driver.name} onChange={e => setDriver(d => ({ ...d, name: e.target.value }))} placeholder="John Smith" />
                </div>
                <div className="space-y-2">
                  <Label>Email *</Label>
                  <Input type="email" value={driver.email} onChange={e => setDriver(d => ({ ...d, email: e.target.value }))} placeholder="email@example.com" />
                </div>
                <div className="space-y-2">
                  <Label>Phone *</Label>
                  <Input value={driver.phone} onChange={e => setDriver(d => ({ ...d, phone: e.target.value }))} placeholder="555-0000" />
                </div>
                <div className="space-y-2">
                  <Label>Driver License # *</Label>
                  <Input value={driver.license} onChange={e => setDriver(d => ({ ...d, license: e.target.value }))} placeholder="CDL-A-XXXXX" />
                </div>
                <div className="space-y-2">
                  <Label>State</Label>
                  <Select value={driver.state || 'none'} onValueChange={v => setDriver(d => ({ ...d, state: v === 'none' ? null : v }))}>
                    <SelectTrigger><SelectValue placeholder="Select state" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">— Select —</SelectItem>
                      {US_STATES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <OnboardingDateField label="License Expiry" value={driver.license_expiry} onChange={v => setDriver(d => ({ ...d, license_expiry: v }))} />
                <OnboardingDateField label="Medical Card Expiry" value={driver.medical_card_expiry} onChange={v => setDriver(d => ({ ...d, medical_card_expiry: v }))} />
              </div>

              <div className="border-t pt-4">
                <Label className="text-base font-semibold">Documents</Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                  {DRIVER_DOC_FIELDS.map(doc => (
                    <OnboardingFileField
                      key={doc.key}
                      label={doc.label}
                      file={driverFiles[doc.key]}
                      onFileChange={f => setDriverFiles(prev => ({ ...prev, [doc.key]: f }))}
                    />
                  ))}
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <Button onClick={() => { if (validateStep1()) setStep(2); }}>
                  Next: Truck Info →
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 2: Truck Info */}
        {step === 2 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Truck className="h-5 w-5" /> Truck Information</CardTitle>
              <CardDescription>Enter the details of your truck.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Unit # *</Label>
                  <Input value={truck.unit_number} onChange={e => setTruck(t => ({ ...t, unit_number: e.target.value }))} placeholder="101" />
                </div>
                <div className="space-y-2">
                  <Label>Truck Type</Label>
                  <Select value={truck.truck_type} onValueChange={v => setTruck(t => ({ ...t, truck_type: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{TRUCK_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Make</Label>
                  <Input value={truck.make} onChange={e => setTruck(t => ({ ...t, make: e.target.value }))} placeholder="Freightliner" />
                </div>
                <div className="space-y-2">
                  <Label>Model</Label>
                  <Input value={truck.model} onChange={e => setTruck(t => ({ ...t, model: e.target.value }))} placeholder="Cascadia" />
                </div>
                <div className="space-y-2">
                  <Label>Year</Label>
                  <Input type="number" value={truck.year || ''} onChange={e => setTruck(t => ({ ...t, year: e.target.value ? parseInt(e.target.value) : new Date().getFullYear() }))} />
                </div>
                <div className="space-y-2">
                  <Label>Max Payload (lbs)</Label>
                  <Input type="number" value={truck.max_payload_lbs ?? ''} onChange={e => setTruck(t => ({ ...t, max_payload_lbs: e.target.value ? parseFloat(e.target.value) : null }))} />
                </div>
                <div className="space-y-2">
                  <Label>VIN</Label>
                  <Input value={truck.vin} onChange={e => setTruck(t => ({ ...t, vin: e.target.value }))} placeholder="Vehicle ID Number" />
                </div>
                <div className="space-y-2">
                  <Label>License Plate</Label>
                  <Input value={truck.license_plate} onChange={e => setTruck(t => ({ ...t, license_plate: e.target.value }))} placeholder="TX-4521" />
                </div>
                <OnboardingDateField label="Insurance Expiry" value={truck.insurance_expiry} onChange={v => setTruck(t => ({ ...t, insurance_expiry: v }))} />
                <OnboardingDateField label="Registration Expiry" value={truck.registration_expiry} onChange={v => setTruck(t => ({ ...t, registration_expiry: v }))} />
              </div>

              {/* Box Truck dimensions */}
              {truck.truck_type === 'Box Truck' && (
                <div className="border-t pt-4 space-y-2">
                  <Label className="text-base font-semibold">Box Truck Dimensions</Label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <NumField label="Cargo Length (ft)" value={truck.cargo_length_ft} onChange={v => setTruck(t => ({ ...t, cargo_length_ft: v }))} />
                    <NumField label="Cargo Width (in)" value={truck.cargo_width_in} onChange={v => setTruck(t => ({ ...t, cargo_width_in: v }))} />
                    <NumField label="Cargo Height (in)" value={truck.cargo_height_in} onChange={v => setTruck(t => ({ ...t, cargo_height_in: v }))} />
                    <NumField label="Rear Door Width (in)" value={truck.rear_door_width_in} onChange={v => setTruck(t => ({ ...t, rear_door_width_in: v }))} />
                    <NumField label="Rear Door Height (in)" value={truck.rear_door_height_in} onChange={v => setTruck(t => ({ ...t, rear_door_height_in: v }))} />
                  </div>
                </div>
              )}

              {/* Hotshot dimensions */}
              {truck.truck_type === 'Hotshot' && (
                <div className="border-t pt-4 space-y-2">
                  <Label className="text-base font-semibold">Hotshot Dimensions</Label>
                  <div className="grid grid-cols-2 gap-3">
                    <NumField label="Trailer Length (ft)" value={truck.trailer_length_ft} onChange={v => setTruck(t => ({ ...t, trailer_length_ft: v }))} />
                    <div className="space-y-1">
                      <Label className="text-xs">Mega Ramp</Label>
                      <Select value={truck.mega_ramp || ''} onValueChange={v => setTruck(t => ({ ...t, mega_ramp: v }))}>
                        <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="SI">YES</SelectItem>
                          <SelectItem value="NO">NO</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              )}

              {/* Truck documents */}
              <div className="border-t pt-4">
                <Label className="text-base font-semibold">Truck Documents & Photos</Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                  {TRUCK_DOC_FIELDS.map(doc => (
                    <OnboardingFileField
                      key={doc.key}
                      label={doc.label}
                      file={truckFiles[doc.key]}
                      onFileChange={f => setTruckFiles(prev => ({ ...prev, [doc.key]: f }))}
                    />
                  ))}
                </div>
              </div>

              <div className="flex justify-between pt-2">
                <Button variant="outline" onClick={() => setStep(1)}>← Back</Button>
                <Button onClick={() => { if (validateStep2()) setStep(3); }}>
                  Next: Documents →
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 3: Document Signing */}
        {step === 3 && (
          <DocumentSigningStep
            driverData={driver}
            truckData={truck}
            signedDocs={signedDocs}
            onSignedDocsChange={setSignedDocs}
            onNext={() => setStep(4)}
            onBack={() => setStep(2)}
          />
        )}

        {/* Step 4: Review */}
        {step === 4 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Send className="h-5 w-5" /> Review & Submit</CardTitle>
              <CardDescription>Please review your information before submitting.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-3">
                <h3 className="font-semibold flex items-center gap-2"><User className="h-4 w-4" /> Driver Information</h3>
                <div className="grid grid-cols-2 gap-2 text-sm bg-muted/50 p-4 rounded-lg">
                  <div><span className="text-muted-foreground">Name:</span> {driver.name}</div>
                  <div><span className="text-muted-foreground">Email:</span> {driver.email}</div>
                  <div><span className="text-muted-foreground">Phone:</span> {driver.phone}</div>
                  <div><span className="text-muted-foreground">License:</span> {driver.license}</div>
                  {driver.state && <div><span className="text-muted-foreground">State:</span> {driver.state}</div>}
                  {driver.license_expiry && <div><span className="text-muted-foreground">License Exp:</span> {driver.license_expiry}</div>}
                  {driver.medical_card_expiry && <div><span className="text-muted-foreground">Medical Card Exp:</span> {driver.medical_card_expiry}</div>}
                  <div className="col-span-2"><span className="text-muted-foreground">Documents:</span> {Object.keys(driverFiles).length} file(s)</div>
                </div>
              </div>

              <div className="space-y-3">
                <h3 className="font-semibold flex items-center gap-2"><Truck className="h-4 w-4" /> Truck Information</h3>
                <div className="grid grid-cols-2 gap-2 text-sm bg-muted/50 p-4 rounded-lg">
                  <div><span className="text-muted-foreground">Unit #:</span> {truck.unit_number}</div>
                  <div><span className="text-muted-foreground">Type:</span> {truck.truck_type}</div>
                  {truck.make && <div><span className="text-muted-foreground">Make:</span> {truck.make}</div>}
                  {truck.model && <div><span className="text-muted-foreground">Model:</span> {truck.model}</div>}
                  {truck.year && <div><span className="text-muted-foreground">Year:</span> {truck.year}</div>}
                  {truck.vin && <div><span className="text-muted-foreground">VIN:</span> {truck.vin}</div>}
                  {truck.license_plate && <div><span className="text-muted-foreground">Plate:</span> {truck.license_plate}</div>}
                  <div className="col-span-2"><span className="text-muted-foreground">Documents:</span> {Object.keys(truckFiles).length} file(s)</div>
                </div>
              </div>

              <div className="space-y-3">
                <h3 className="font-semibold">📝 Signed Documents</h3>
                <div className="grid grid-cols-1 gap-2 text-sm bg-muted/50 p-4 rounded-lg">
                  <div className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-green-500" /> W-9 Form</div>
                  <div className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-green-500" /> Leasing Agreement</div>
                  <div className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-green-500" /> Service Agreement</div>
                </div>
              </div>

              <div className="flex justify-between pt-2">
                <Button variant="outline" onClick={() => setStep(3)}>← Back</Button>
                <Button onClick={handleSubmit} disabled={submitting} className="gap-2">
                  {submitting ? 'Submitting...' : '✓ Submit Onboarding'}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function OnboardingDateField({ label, value, onChange }: { label: string; value: string | null; onChange: (v: string | null) => void }) {
  const date = value ? new Date(value + 'T00:00:00') : undefined;
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !date && "text-muted-foreground")}>
            <CalendarIcon className="mr-2 h-4 w-4" />
            {date ? format(date, 'MM/dd/yyyy') : 'Select date'}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar mode="single" selected={date} onSelect={d => onChange(d ? format(d, 'yyyy-MM-dd') : null)} initialFocus className="p-3 pointer-events-auto" />
        </PopoverContent>
      </Popover>
    </div>
  );
}

function NumField({ label, value, onChange }: { label: string; value: number | null; onChange: (v: number | null) => void }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Input type="number" value={value ?? ''} onChange={e => onChange(e.target.value ? parseFloat(e.target.value) : null)} />
    </div>
  );
}

function OnboardingFileField({ label, file, onFileChange }: { label: string; file?: File; onFileChange: (f: File) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <input ref={ref} type="file" accept="image/*,.pdf" className="hidden" onChange={e => { if (e.target.files?.[0]) onFileChange(e.target.files[0]); }} />
      <Button type="button" variant="outline" size="sm" className="w-full justify-start gap-2 text-xs" onClick={() => ref.current?.click()}>
        {file ? <FileCheck className="h-3.5 w-3.5 text-primary" /> : <Upload className="h-3.5 w-3.5" />}
        {file ? file.name : 'Upload file'}
      </Button>
    </div>
  );
}
