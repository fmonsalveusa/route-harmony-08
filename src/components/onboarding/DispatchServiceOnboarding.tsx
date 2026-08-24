import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Building2, User, Truck as TruckIcon, FileSignature, FileCheck, CheckCircle2, Eye, EyeOff, Upload, ArrowLeft, ArrowRight, Loader2, Plus, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { US_STATES } from '@/lib/usStates';
import { toast } from 'sonner';
import logoImg from '@/assets/logo.png';

// Tipos internos del flow
export interface DispatchCompanyData {
  legal_business_name: string;
  dba: string;
  mc_number: string;
  dot_number: string;
  ein: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  phone: string;
  email: string;
  owner_full_name: string;
}

export interface DispatchFactoringData {
  factoring_company_name: string;
  factoring_username: string;
  factoring_password: string;
}

export interface DispatchInsuranceData {
  insurance_company_name: string;
  insurance_policy_number: string;
  insurance_expiry_date: string;
}

export interface DispatchDriverEntry {
  // Datos personales del driver
  name: string;
  email: string;
  phone: string;
  license: string;
  state: string | null;
  license_expiry: string | null;
  medical_card_expiry: string | null;
  address: string;
  city: string;
  zip: string;
  birthday: string | null;
  emergency_contact_name: string;
  emergency_phone: string;
  bank_name: string;
  account_holder_name: string;
  routing_number: string;
  account_number: string;
  account_type: string;
  // Documentos del driver
  license_photo?: File;
  medical_card_photo?: File;
  // Datos del camion
  truck: {
    unit_number: string;
    truck_type: string;
    make: string;
    model: string;
    year: number;
    vin: string;
    license_plate: string;
    insurance_expiry: string | null;
    registration_expiry: string | null;
    annual_inspection_expiry: string | null;
  };
  // Documentos del camion
  truck_registration?: File;
  truck_insurance?: File;
  truck_plate_photo?: File;
  truck_side_photo?: File;
  truck_rear_photo?: File;
  cargo_area_photo?: File;
  // Flag: es el owner de la empresa?
  is_owner?: boolean;
}

const TRUCK_TYPES = ['Box Truck', 'Hotshot', 'Flatbed', 'Dry Van'];

const emptyDriverEntry = (): DispatchDriverEntry => ({
  name: '', email: '', phone: '', license: '',
  state: null, license_expiry: null, medical_card_expiry: null,
  address: '', city: '', zip: '', birthday: null,
  emergency_contact_name: '', emergency_phone: '',
  bank_name: '', account_holder_name: '', routing_number: '', account_number: '',
  account_type: 'checking',
  truck: {
    unit_number: '', truck_type: 'Box Truck', make: '', model: '',
    year: new Date().getFullYear(), vin: '', license_plate: '',
    insurance_expiry: null, registration_expiry: null, annual_inspection_expiry: null,
  },
});

interface Props {
  token: string;
  tokenData: any;
  onCompleted: () => void;
}

export default function DispatchServiceOnboarding({ token, tokenData, onCompleted }: Props) {
  // Si el token viene con dispatch_service_client_id, es empresa existente.
  const isExistingCompany = !!tokenData?.dispatch_service_client_id;

  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);

  // Estado empresa (solo para nueva empresa)
  const [company, setCompany] = useState<DispatchCompanyData>({
    legal_business_name: '', dba: '', mc_number: '', dot_number: '', ein: '',
    address: '', city: '', state: '', zip: '',
    phone: '', email: '', owner_full_name: '',
  });
  const [factoring, setFactoring] = useState<DispatchFactoringData>({
    factoring_company_name: '', factoring_username: '', factoring_password: '',
  });
  const [insurance, setInsurance] = useState<DispatchInsuranceData>({
    insurance_company_name: '', insurance_policy_number: '', insurance_expiry_date: '',
  });
  const [companyDocs, setCompanyDocs] = useState<{ mc_authority?: File; insurance_cert?: File; w9?: File }>({});
  const [showFactPassword, setShowFactPassword] = useState(false);

  // Firma del agreement (canvas image data URL) — se completa en Fase 3B
  const [agreementSignature, setAgreementSignature] = useState<string | null>(null);

  // Loop de drivers (para empresa nueva) o un solo driver (empresa existente)
  const [drivers, setDrivers] = useState<DispatchDriverEntry[]>([]);
  const [currentDriver, setCurrentDriver] = useState<DispatchDriverEntry>(emptyDriverEntry());

  // Total de pasos segun flow
  // Empresa nueva: 1 Company, 2 Factoring/Insurance, 3 Company Docs, 4 Sign Agreement, 5 Drivers/Trucks, 6 Review
  // Empresa existente: 1 Driver Info, 2 Truck Info, 3 Docs, 4 Review
  const totalSteps = isExistingCompany ? 4 : 6;

  // ── Validaciones por step ─────────────────────────────────────────────
  const validateCompany = () => {
    const missing: string[] = [];
    if (!company.legal_business_name.trim()) missing.push('Legal Business Name');
    if (!company.mc_number.trim()) missing.push('MC #');
    if (!company.dot_number.trim()) missing.push('DOT #');
    if (!company.owner_full_name.trim()) missing.push('Owner Name');
    if (!company.email.trim()) missing.push('Email');
    if (!company.phone.trim()) missing.push('Phone');
    if (missing.length) { toast.error(`Faltan: ${missing.join(', ')}`); return false; }
    return true;
  };

  const validateFactoringInsurance = () => {
    // Opcional pero recomendado; no bloqueamos
    return true;
  };

  const validateCompanyDocs = () => {
    const missing: string[] = [];
    if (!companyDocs.mc_authority) missing.push('MC/DOT Authority PDF');
    if (!companyDocs.insurance_cert) missing.push('Insurance Certificate PDF');
    if (!companyDocs.w9) missing.push('W9 Form');
    if (missing.length) { toast.error(`Faltan documentos: ${missing.join(', ')}`); return false; }
    return true;
  };

  // ── Navegacion ────────────────────────────────────────────────────────
  const next = () => {
    if (!isExistingCompany) {
      if (step === 1 && !validateCompany()) return;
      if (step === 2 && !validateFactoringInsurance()) return;
      if (step === 3 && !validateCompanyDocs()) return;
    }
    setStep(s => Math.min(s + 1, totalSteps));
  };
  const prev = () => setStep(s => Math.max(1, s - 1));

  // ── Handler de submit final ───────────────────────────────────────────
  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      // Sera implementado en Fase 3C. Por ahora solo notificamos.
      toast.info('Submit pendiente — se implementa en Fase 3C');
      // onCompleted();
    } catch (err: any) {
      toast.error(err.message || 'Error al enviar');
    } finally {
      setSubmitting(false);
    }
  };

  // ── UI de step tracker ────────────────────────────────────────────────
  const stepLabels = isExistingCompany
    ? ['Driver Info', 'Truck Info', 'Documents', 'Review']
    : ['Company', 'Factoring & Insurance', 'Company Docs', 'Sign Agreement', 'Drivers & Trucks', 'Review'];

  const stepIcons = isExistingCompany
    ? [User, TruckIcon, FileCheck, CheckCircle2]
    : [Building2, FileCheck, FileCheck, FileSignature, User, CheckCircle2];

  const renderStepper = () => (
    <div className="flex items-center justify-between mb-6 gap-1">
      {stepLabels.map((label, i) => {
        const num = i + 1;
        const Icon = stepIcons[i];
        const isDone = step > num;
        const isCurrent = step === num;
        return (
          <div key={num} className="flex items-center flex-1 min-w-0">
            <div className={cn(
              'flex items-center gap-1.5 min-w-0',
              isCurrent ? 'text-primary' : isDone ? 'text-muted-foreground' : 'text-muted-foreground/50'
            )}>
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
            {i < stepLabels.length - 1 && (
              <div className={cn('h-0.5 flex-1 mx-1', isDone ? 'bg-primary/50' : 'bg-muted')} />
            )}
          </div>
        );
      })}
    </div>
  );

  // ── Steps de Empresa NUEVA ─────────────────────────────────────────────
  const renderCompanyStep = () => (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Building2 className="h-5 w-5 text-primary" /> Company Information
        </h3>
        <p className="text-sm text-muted-foreground">Datos legales de tu empresa de transporte.</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="space-y-1 md:col-span-2">
          <Label>Legal Business Name *</Label>
          <Input value={company.legal_business_name} onChange={e => setCompany({...company, legal_business_name: e.target.value})} />
        </div>
        <div className="space-y-1"><Label>DBA (opcional)</Label><Input value={company.dba} onChange={e => setCompany({...company, dba: e.target.value})} /></div>
        <div className="space-y-1"><Label>EIN</Label><Input value={company.ein} onChange={e => setCompany({...company, ein: e.target.value})} /></div>
        <div className="space-y-1"><Label>MC # *</Label><Input value={company.mc_number} onChange={e => setCompany({...company, mc_number: e.target.value})} /></div>
        <div className="space-y-1"><Label>DOT # *</Label><Input value={company.dot_number} onChange={e => setCompany({...company, dot_number: e.target.value})} /></div>
        <div className="space-y-1"><Label>Phone *</Label><Input value={company.phone} onChange={e => setCompany({...company, phone: e.target.value})} /></div>
        <div className="space-y-1"><Label>Email *</Label><Input type="email" value={company.email} onChange={e => setCompany({...company, email: e.target.value})} /></div>
        <div className="space-y-1 md:col-span-2"><Label>Address</Label><Input value={company.address} onChange={e => setCompany({...company, address: e.target.value})} /></div>
        <div className="space-y-1"><Label>City</Label><Input value={company.city} onChange={e => setCompany({...company, city: e.target.value})} /></div>
        <div className="space-y-1">
          <Label>State</Label>
          <Select value={company.state || ''} onValueChange={v => setCompany({...company, state: v})}>
            <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
            <SelectContent>
              {US_STATES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1"><Label>Zip</Label><Input value={company.zip} onChange={e => setCompany({...company, zip: e.target.value})} /></div>
        <div className="space-y-1 md:col-span-2">
          <Label>Owner / Authorized Representative *</Label>
          <Input value={company.owner_full_name} onChange={e => setCompany({...company, owner_full_name: e.target.value})} placeholder="Quien firma el agreement" />
        </div>
      </div>
    </div>
  );

  const renderFactoringInsuranceStep = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <FileCheck className="h-5 w-5 text-primary" /> Factoring & Insurance
        </h3>
        <p className="text-sm text-muted-foreground">Datos para tu factoring company y tu poliza de seguro.</p>
      </div>

      {/* Factoring */}
      <div>
        <p className="text-sm font-semibold uppercase text-muted-foreground tracking-wide mb-2">Factoring</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="space-y-1"><Label>Factoring Company</Label><Input value={factoring.factoring_company_name} onChange={e => setFactoring({...factoring, factoring_company_name: e.target.value})} /></div>
          <div className="space-y-1"><Label>Username</Label><Input value={factoring.factoring_username} onChange={e => setFactoring({...factoring, factoring_username: e.target.value})} /></div>
          <div className="space-y-1">
            <Label>Password</Label>
            <div className="relative">
              <Input type={showFactPassword ? 'text' : 'password'} value={factoring.factoring_password} onChange={e => setFactoring({...factoring, factoring_password: e.target.value})} className="pr-9" />
              <button type="button" onClick={() => setShowFactPassword(v => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground">
                {showFactPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Insurance */}
      <div>
        <p className="text-sm font-semibold uppercase text-muted-foreground tracking-wide mb-2">Insurance</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="space-y-1"><Label>Company</Label><Input value={insurance.insurance_company_name} onChange={e => setInsurance({...insurance, insurance_company_name: e.target.value})} /></div>
          <div className="space-y-1"><Label>Policy #</Label><Input value={insurance.insurance_policy_number} onChange={e => setInsurance({...insurance, insurance_policy_number: e.target.value})} /></div>
          <div className="space-y-1"><Label>Expires</Label><Input type="date" value={insurance.insurance_expiry_date} onChange={e => setInsurance({...insurance, insurance_expiry_date: e.target.value})} /></div>
        </div>
      </div>
    </div>
  );

  const FileUploadBox = ({ label, file, onChange, accept = '.pdf,image/*' }: { label: string; file?: File; onChange: (f: File | undefined) => void; accept?: string }) => (
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
            <input type="file" accept={accept} className="hidden" onChange={e => onChange(e.target.files?.[0])} />
          </label>
        )}
      </div>
    </div>
  );

  const renderCompanyDocsStep = () => (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <FileCheck className="h-5 w-5 text-primary" /> Company Documents
        </h3>
        <p className="text-sm text-muted-foreground">Sube los documentos oficiales de tu empresa.</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <FileUploadBox label="MC/DOT Authority *" file={companyDocs.mc_authority} onChange={f => setCompanyDocs({...companyDocs, mc_authority: f})} />
        <FileUploadBox label="Insurance Certificate *" file={companyDocs.insurance_cert} onChange={f => setCompanyDocs({...companyDocs, insurance_cert: f})} />
        <FileUploadBox label="W9 Form *" file={companyDocs.w9} onChange={f => setCompanyDocs({...companyDocs, w9: f})} />
      </div>
    </div>
  );

  // ── Placeholder para steps siguientes (Fase 3B) ───────────────────────
  const renderPlaceholder = (label: string) => (
    <div className="space-y-4">
      <div className="border-2 border-dashed border-primary/30 rounded-lg p-8 text-center bg-primary/5">
        <h3 className="text-lg font-semibold text-primary">{label}</h3>
        <p className="text-sm text-muted-foreground mt-2">
          Este paso se implementa en Fase 3B — muy pronto.
        </p>
      </div>
    </div>
  );

  const renderCurrentStep = () => {
    if (isExistingCompany) {
      // Flow empresa existente: Driver Info -> Truck Info -> Docs -> Review
      switch (step) {
        case 1: return renderPlaceholder('Driver Info (Fase 3B)');
        case 2: return renderPlaceholder('Truck Info (Fase 3B)');
        case 3: return renderPlaceholder('Documents (Fase 3B)');
        case 4: return renderPlaceholder('Review (Fase 3B)');
        default: return null;
      }
    }
    // Flow empresa nueva
    switch (step) {
      case 1: return renderCompanyStep();
      case 2: return renderFactoringInsuranceStep();
      case 3: return renderCompanyDocsStep();
      case 4: return renderPlaceholder('Sign Dispatch Service Agreement (Fase 3B)');
      case 5: return renderPlaceholder('Add Drivers & Trucks (Fase 3B)');
      case 6: return renderPlaceholder('Review & Submit (Fase 3B)');
      default: return null;
    }
  };

  return (
    <div className="min-h-screen bg-muted/30 py-6 px-4">
      <div className="max-w-4xl mx-auto space-y-4">
        <div className="flex items-center justify-center">
          <img src={logoImg} alt="Dispatch Up" className="h-12" />
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">
              Dispatch Service Onboarding
              {isExistingCompany && <span className="ml-2 text-sm font-normal text-muted-foreground">— Empresa existente</span>}
            </CardTitle>
            <CardDescription>
              Paso {step} de {totalSteps}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {renderStepper()}
            {renderCurrentStep()}

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
