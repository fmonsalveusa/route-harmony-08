import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Building2, User, Truck as TruckIcon, FileSignature, FileCheck, CheckCircle2, Eye, EyeOff, Upload, ArrowLeft, ArrowRight, Loader2, Plus, Trash2, Edit2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { US_STATES } from '@/lib/usStates';
import { toast } from 'sonner';
import logoImg from '@/assets/logo.png';
import SignaturePad from './SignaturePad';
import { DispatchDriverTruckForm } from './DispatchDriverTruckForm';
import { DispatchAgreementFullText } from './DispatchAgreementFullText';
import { generateDispatchAgreementPdf } from '@/lib/dispatchAgreementPdf';

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
  email_password: string;
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
  bank_name?: string;
  account_holder_name?: string;
  routing_number?: string;
  account_number?: string;
  account_type?: string;
  license_photo?: File;
  medical_card_photo?: File;
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
  truck_registration?: File;
  truck_insurance?: File;
  truck_plate_photo?: File;
  truck_side_photo?: File;
  truck_rear_photo?: File;
  cargo_area_photo?: File;
  is_owner?: boolean;
}

export const emptyDriverEntry = (): DispatchDriverEntry => ({
  name: '', email: '', phone: '', license: '',
  state: null, license_expiry: null, medical_card_expiry: null,
  address: '', city: '', zip: '', birthday: null,
  emergency_contact_name: '', emergency_phone: '',
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
  const isExistingCompany = !!tokenData?.dispatch_service_client_id;

  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);

  // Estado empresa (empresa nueva)
  // Filtrar placeholders enviados por la landing cuando el card se hace directo sin form.
  const PLACEHOLDERS = new Set(['Pending', 'pending@onboarding.local', '000-000-0000']);
  const initEmail = tokenData?.driver_email && !PLACEHOLDERS.has(tokenData.driver_email) ? tokenData.driver_email : '';
  const initName = tokenData?.driver_name && !PLACEHOLDERS.has(tokenData.driver_name) ? tokenData.driver_name : '';

  const [company, setCompany] = useState<DispatchCompanyData>({
    legal_business_name: '', dba: '', mc_number: '', dot_number: '', ein: '',
    address: '', city: '', state: '', zip: '',
    phone: '', email: initEmail, email_password: '',
    owner_full_name: initName,
  });
  const [showEmailPassword, setShowEmailPassword] = useState(false);
  const [factoring, setFactoring] = useState<DispatchFactoringData>({
    factoring_company_name: '', factoring_username: '', factoring_password: '',
  });
  const [insurance, setInsurance] = useState<DispatchInsuranceData>({
    insurance_company_name: '', insurance_policy_number: '', insurance_expiry_date: '',
  });
  const [companyDocs, setCompanyDocs] = useState<{ mc_authority?: File; insurance_cert?: File; w9?: File; noa?: File }>({});
  const [showFactPassword, setShowFactPassword] = useState(false);

  // Firma del agreement
  const [agreementSignature, setAgreementSignature] = useState<string | null>(null);
  const [signerName, setSignerName] = useState('');
  const [showFullAgreement, setShowFullAgreement] = useState(false);

  // Loop de drivers
  const [drivers, setDrivers] = useState<DispatchDriverEntry[]>([]);
  const [currentDriver, setCurrentDriver] = useState<DispatchDriverEntry>(emptyDriverEntry());
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  // Empresa nueva: 6 pasos. Empresa existente: 3 pasos (Driver+Truck, Review, sin Sign Agreement).
  const totalSteps = isExistingCompany ? 3 : 6;

  // ── Validaciones ──────────────────────────────────────────────────────
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
  const validateCompanyDocs = () => {
    const missing: string[] = [];
    if (!companyDocs.mc_authority) missing.push('MC/DOT Authority');
    if (!companyDocs.insurance_cert) missing.push('Insurance Certificate');
    if (!companyDocs.w9) missing.push('W9 Form');
    if (!companyDocs.noa) missing.push('NOA (Notice of Assignment)');
    if (missing.length) { toast.error(`Faltan documentos: ${missing.join(', ')}`); return false; }
    return true;
  };
  const validateAgreement = () => {
    if (!signerName.trim()) { toast.error('Ingresa el nombre completo del firmante'); return false; }
    if (!agreementSignature) { toast.error('Debes firmar el agreement'); return false; }
    return true;
  };
  const validateDriverEntry = (d: DispatchDriverEntry): boolean => {
    const missing: string[] = [];
    if (!d.name.trim()) missing.push('Driver Name');
    if (!d.email.trim()) missing.push('Email');
    if (!d.phone.trim()) missing.push('Phone');
    if (!d.license.trim()) missing.push('License #');
    if (!d.license_expiry) missing.push('License Expiry');
    if (!d.medical_card_expiry) missing.push('Medical Card Expiry');
    if (!d.truck.unit_number.trim()) missing.push('Truck Unit #');
    if (missing.length) { toast.error(`Faltan: ${missing.join(', ')}`); return false; }
    return true;
  };

  // ── Navegacion ────────────────────────────────────────────────────────
  const next = () => {
    if (!isExistingCompany) {
      if (step === 1 && !validateCompany()) return;
      if (step === 3 && !validateCompanyDocs()) return;
      if (step === 4 && !validateAgreement()) return;
      if (step === 5 && drivers.length === 0) {
        toast.error('Agrega al menos un driver');
        return;
      }
    } else {
      // Empresa existente: step 1 es Driver+Truck form
      if (step === 1 && !validateDriverEntry(currentDriver)) return;
    }
    setStep(s => Math.min(s + 1, totalSteps));
  };
  const prev = () => setStep(s => Math.max(1, s - 1));

  // ── Loop de drivers (empresa nueva) ───────────────────────────────────
  const saveCurrentDriver = (): boolean => {
    if (!validateDriverEntry(currentDriver)) return false;
    if (editingIndex !== null) {
      setDrivers(prev => prev.map((d, i) => i === editingIndex ? currentDriver : d));
      setEditingIndex(null);
    } else {
      setDrivers(prev => [...prev, currentDriver]);
    }
    return true;
  };
  const handleSaveAndAddAnother = () => {
    if (saveCurrentDriver()) {
      setCurrentDriver(emptyDriverEntry());
      toast.success('Driver agregado. Puedes agregar otro.');
    }
  };
  const handleSaveAndContinue = () => {
    if (saveCurrentDriver()) {
      setCurrentDriver(emptyDriverEntry());
      setStep(6);
    }
  };
  const handleEditDriver = (idx: number) => {
    setCurrentDriver(drivers[idx]);
    setEditingIndex(idx);
  };
  const handleRemoveDriver = (idx: number) => {
    if (!confirm('¿Eliminar este driver?')) return;
    setDrivers(prev => prev.filter((_, i) => i !== idx));
    if (editingIndex === idx) {
      setEditingIndex(null);
      setCurrentDriver(emptyDriverEntry());
    }
  };

  // ── Submit final ──────────────────────────────────────────────────────
  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      // Para empresa existente, guardar el driver actual antes de submitear
      let finalDrivers = drivers;
      if (isExistingCompany) {
        if (!validateDriverEntry(currentDriver)) { setSubmitting(false); return; }
        finalDrivers = [currentDriver];
      }

      const formData = new FormData();
      formData.append('token', token);
      formData.append('service_type', 'dispatch_service');
      formData.append('is_existing_company', JSON.stringify(isExistingCompany));

      if (!isExistingCompany) {
        formData.append('company_data', JSON.stringify(company));
        formData.append('factoring_data', JSON.stringify(factoring));
        formData.append('insurance_data', JSON.stringify(insurance));
        formData.append('signer_name', signerName);
        if (agreementSignature) formData.append('agreement_signature', agreementSignature);
        if (companyDocs.mc_authority) formData.append('company_mc_authority', companyDocs.mc_authority);
        if (companyDocs.insurance_cert) formData.append('company_insurance_cert', companyDocs.insurance_cert);
        if (companyDocs.w9) formData.append('company_w9', companyDocs.w9);
        if (companyDocs.noa) formData.append('company_noa', companyDocs.noa);
        // Generar PDF del agreement firmado y adjuntarlo
        if (agreementSignature) {
          try {
            const pdfBlob = generateDispatchAgreementPdf({ company, signerName, signatureDataUrl: agreementSignature });
            if (!pdfBlob || pdfBlob.size === 0) throw new Error('PDF vacio');
            formData.append('company_agreement_pdf', pdfBlob, 'dispatch_service_agreement_signed.pdf');
          } catch (e: any) {
            console.error('Error generating agreement PDF:', e);
            toast.error(`Error generando el PDF del agreement: ${e?.message || 'unknown'}`);
            setSubmitting(false);
            return;
          }
        } else {
          toast.error('No hay firma capturada. Volvé al step de Sign Agreement.');
          setSubmitting(false);
          return;
        }
      }

      // Serializar drivers (sin archivos)
      const driversData = finalDrivers.map(d => {
        const { license_photo, medical_card_photo, truck_registration, truck_insurance, truck_plate_photo, truck_side_photo, truck_rear_photo, cargo_area_photo, ...rest } = d;
        return rest;
      });
      formData.append('drivers_data', JSON.stringify(driversData));

      // Adjuntar archivos con prefijo del indice
      finalDrivers.forEach((d, idx) => {
        if (d.license_photo) formData.append(`driver_${idx}_license_photo`, d.license_photo);
        if (d.medical_card_photo) formData.append(`driver_${idx}_medical_card_photo`, d.medical_card_photo);
        if (d.truck_registration) formData.append(`driver_${idx}_truck_registration`, d.truck_registration);
        if (d.truck_insurance) formData.append(`driver_${idx}_truck_insurance`, d.truck_insurance);
        if (d.truck_plate_photo) formData.append(`driver_${idx}_truck_plate_photo`, d.truck_plate_photo);
        if (d.truck_side_photo) formData.append(`driver_${idx}_truck_side_photo`, d.truck_side_photo);
        if (d.truck_rear_photo) formData.append(`driver_${idx}_truck_rear_photo`, d.truck_rear_photo);
        if (d.cargo_area_photo) formData.append(`driver_${idx}_cargo_area_photo`, d.cargo_area_photo);
      });

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const res = await fetch(`${supabaseUrl}/functions/v1/driver-onboarding`, {
        method: 'POST',
        body: formData,
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Submission failed');

      toast.success('Onboarding completado exitosamente!');
      onCompleted();
    } catch (err: any) {
      toast.error(err.message || 'Error al enviar');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Stepper visual ────────────────────────────────────────────────────
  const stepLabels = isExistingCompany
    ? ['Driver & Truck', 'Review']
    : ['Company', 'Factoring & Insurance', 'Company Docs', 'Sign Agreement', 'Drivers & Trucks', 'Review'];
  const stepIcons = isExistingCompany
    ? [User, CheckCircle2]
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

  // ── Renders de cada step ───────────────────────────────────────────────
  const FileUploadBox = ({ label, file, onChange, accept = '.pdf,image/*' }: any) => (
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

  const renderCompanyStep = () => (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold flex items-center gap-2"><Building2 className="h-5 w-5 text-primary" /> Company Information</h3>
        <p className="text-sm text-muted-foreground">Datos legales de tu empresa.</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="space-y-1 md:col-span-2"><Label>Legal Business Name *</Label><Input value={company.legal_business_name} onChange={e => setCompany({...company, legal_business_name: e.target.value})} /></div>
        <div className="space-y-1"><Label>DBA (opcional)</Label><Input value={company.dba} onChange={e => setCompany({...company, dba: e.target.value})} /></div>
        <div className="space-y-1"><Label>EIN</Label><Input value={company.ein} onChange={e => setCompany({...company, ein: e.target.value})} /></div>
        <div className="space-y-1"><Label>MC # *</Label><Input value={company.mc_number} onChange={e => setCompany({...company, mc_number: e.target.value})} /></div>
        <div className="space-y-1"><Label>DOT # *</Label><Input value={company.dot_number} onChange={e => setCompany({...company, dot_number: e.target.value})} /></div>
        <div className="space-y-1"><Label>Phone *</Label><Input value={company.phone} onChange={e => setCompany({...company, phone: e.target.value})} /></div>
        <div className="space-y-1"><Label>Email *</Label><Input type="email" value={company.email} onChange={e => setCompany({...company, email: e.target.value})} /></div>
        <div className="space-y-1 md:col-span-2">
          <Label>Email Password (opcional)</Label>
          <div className="relative">
            <Input
              type={showEmailPassword ? 'text' : 'password'}
              value={company.email_password}
              onChange={e => setCompany({...company, email_password: e.target.value})}
              className="pr-9"
              placeholder="Solo si nos das acceso al email para gestionar cargas"
            />
            <button type="button" onClick={() => setShowEmailPassword(v => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground">
              {showEmailPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>
        <div className="space-y-1 md:col-span-2"><Label>Address</Label><Input value={company.address} onChange={e => setCompany({...company, address: e.target.value})} /></div>
        <div className="space-y-1"><Label>City</Label><Input value={company.city} onChange={e => setCompany({...company, city: e.target.value})} /></div>
        <div className="space-y-1">
          <Label>State</Label>
          <Select value={company.state || ''} onValueChange={v => setCompany({...company, state: v})}>
            <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
            <SelectContent>{US_STATES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-1"><Label>Zip</Label><Input value={company.zip} onChange={e => setCompany({...company, zip: e.target.value})} /></div>
        <div className="space-y-1 md:col-span-2"><Label>Owner / Authorized Representative *</Label><Input value={company.owner_full_name} onChange={e => setCompany({...company, owner_full_name: e.target.value})} placeholder="Quien firma el agreement" /></div>
      </div>
    </div>
  );

  const renderFactoringInsuranceStep = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold flex items-center gap-2"><FileCheck className="h-5 w-5 text-primary" /> Factoring & Insurance</h3>
        <p className="text-sm text-muted-foreground">Opcional pero recomendado.</p>
      </div>
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

  const renderCompanyDocsStep = () => (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold flex items-center gap-2"><FileCheck className="h-5 w-5 text-primary" /> Company Documents</h3>
        <p className="text-sm text-muted-foreground">Sube los documentos oficiales de tu empresa.</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <FileUploadBox label="MC/DOT Authority *" file={companyDocs.mc_authority} onChange={(f: any) => setCompanyDocs({...companyDocs, mc_authority: f})} />
        <FileUploadBox label="Insurance Certificate *" file={companyDocs.insurance_cert} onChange={(f: any) => setCompanyDocs({...companyDocs, insurance_cert: f})} />
        <FileUploadBox label="W9 Form *" file={companyDocs.w9} onChange={(f: any) => setCompanyDocs({...companyDocs, w9: f})} />
        <FileUploadBox label="NOA (Notice of Assignment) *" file={companyDocs.noa} onChange={(f: any) => setCompanyDocs({...companyDocs, noa: f})} />
      </div>
    </div>
  );

  const renderSignAgreementStep = () => (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold flex items-center gap-2"><FileSignature className="h-5 w-5 text-primary" /> Sign Dispatch Service Agreement</h3>
        <p className="text-sm text-muted-foreground">Al firmar aceptas los términos del contrato de servicios de dispatch (8% comisión sobre gross rate).</p>
      </div>
      <div className="bg-muted/30 border rounded-lg p-4 text-xs space-y-2">
        <p className="font-semibold">Resumen del contrato:</p>
        <ul className="list-disc pl-4 space-y-1 text-muted-foreground">
          <li>58 Logistics LLC actúa como dispatcher independiente para tu empresa.</li>
          <li>Comisión: <strong>8% del gross rate</strong> por cada carga aceptada/reservada.</li>
          <li>Facturación semanal (Net 7).</li>
          <li>Tú mantienes control operacional total: seguros, permisos, FMCSA/DOT, ELD, HOS.</li>
          <li>Exclusividad durante la vigencia del contrato.</li>
          <li>Cualquier parte puede terminar en cualquier momento, sin penalización.</li>
          <li>Ley aplicable: North Carolina, USA.</li>
        </ul>
      </div>

      {/* Vista expandible del contrato completo */}
      <div className="border rounded-lg overflow-hidden">
        <button
          type="button"
          onClick={() => setShowFullAgreement(v => !v)}
          className="w-full flex items-center justify-between px-4 py-2.5 bg-primary/5 hover:bg-primary/10 transition-colors text-sm font-semibold text-primary"
        >
          <span className="flex items-center gap-2">
            <FileCheck className="h-4 w-4" />
            {showFullAgreement ? 'Ocultar contrato completo' : 'Ver contrato completo (bilingüe)'}
          </span>
          <span className="text-xs">{showFullAgreement ? '▲' : '▼'}</span>
        </button>
        {showFullAgreement && (
          <div className="p-4 max-h-[500px] overflow-y-auto bg-white border-t">
            <DispatchAgreementFullText company={company} signerName={signerName} />
          </div>
        )}
      </div>

      <p className="text-[11px] italic text-muted-foreground">
        Al firmar, confirmas que leíste y aceptas la versión completa del agreement bilingüe.
      </p>
      <div className="space-y-2">
        <div className="space-y-1">
          <Label>Nombre completo del firmante *</Label>
          <Input value={signerName} onChange={e => setSignerName(e.target.value)} placeholder="Owner / Representante autorizado" />
          <p className="text-[10px] text-muted-foreground">Debe ser el Owner o representante autorizado de la empresa.</p>
        </div>
        <div className="space-y-1">
          <Label>Firma *</Label>
          <div className="border rounded-lg p-2 bg-white">
            <SignaturePad onSignatureChange={setAgreementSignature} width={600} height={180} />
          </div>
        </div>
      </div>
    </div>
  );

  const renderAddDriversStep = () => (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold flex items-center gap-2"><User className="h-5 w-5 text-primary" /> Drivers & Trucks</h3>
        <p className="text-sm text-muted-foreground">Agrega uno o más drivers con sus respectivos camiones.</p>
      </div>

      {/* Lista de drivers ya agregados */}
      {drivers.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Drivers agregados ({drivers.length})</p>
          {drivers.map((d, i) => (
            <div key={i} className="flex items-center gap-2 p-2 rounded-md border bg-card">
              <div className="p-1.5 rounded-full bg-primary/10"><User className="h-3.5 w-3.5 text-primary" /></div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">
                  {d.name} {d.is_owner && <span className="text-[10px] text-primary font-semibold">(Owner)</span>}
                </p>
                <p className="text-xs text-muted-foreground truncate">Unit #{d.truck.unit_number} • {d.truck.truck_type} • {d.phone}</p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => handleEditDriver(i)} className="h-7 px-2 text-xs" disabled={editingIndex === i}>
                <Edit2 className="h-3 w-3 mr-1" /> Editar
              </Button>
              <Button variant="ghost" size="sm" onClick={() => handleRemoveDriver(i)} className="h-7 px-2 text-xs text-destructive hover:text-destructive">
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Formulario del driver actual */}
      <div className="border rounded-lg p-3 bg-muted/10">
        <p className="text-sm font-semibold mb-3">
          {editingIndex !== null ? `Editando driver #${editingIndex + 1}` : `Nuevo driver #${drivers.length + 1}`}
        </p>
        <DispatchDriverTruckForm
          entry={currentDriver}
          onChange={(u) => setCurrentDriver(prev => ({ ...prev, ...u }))}
          onFileChange={(k, f) => setCurrentDriver(prev => ({ ...prev, [k]: f }))}
          ownerFullName={company.owner_full_name}
          showOwnerCheckbox
        />
        <div className="flex flex-wrap gap-2 mt-4 pt-3 border-t">
          <Button variant="outline" size="sm" onClick={handleSaveAndAddAnother} className="gap-1">
            <Plus className="h-3.5 w-3.5" /> Guardar y agregar otro
          </Button>
          <Button size="sm" onClick={handleSaveAndContinue} className="gap-1">
            {editingIndex !== null ? 'Guardar cambios' : 'Guardar y continuar'} <ArrowRight className="h-3.5 w-3.5" />
          </Button>
          {editingIndex !== null && (
            <Button variant="ghost" size="sm" onClick={() => { setEditingIndex(null); setCurrentDriver(emptyDriverEntry()); }} className="gap-1">
              Cancelar edicion
            </Button>
          )}
        </div>
      </div>

      {/* Si ya hay drivers guardados, permitir avanzar al review sin agregar mas */}
      {drivers.length > 0 && editingIndex === null && (
        <div className="flex justify-end">
          <Button
            variant="default"
            size="sm"
            onClick={() => {
              // Si el form actual tiene datos, confirmar antes de descartarlos
              const hasData = currentDriver.name.trim() || currentDriver.email.trim() || currentDriver.truck.unit_number.trim();
              if (hasData) {
                if (!confirm('Tienes datos sin guardar en el formulario actual. ¿Continuar al Review sin guardarlos?')) return;
              }
              setCurrentDriver(emptyDriverEntry());
              setStep(6);
            }}
            className="gap-1"
          >
            Continuar al Review ({drivers.length} driver{drivers.length !== 1 ? 's' : ''}) <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}
    </div>
  );

  const renderReviewStep = () => (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold flex items-center gap-2"><CheckCircle2 className="h-5 w-5 text-primary" /> Review & Submit</h3>
        <p className="text-sm text-muted-foreground">Revisa todos los datos antes de enviar.</p>
      </div>

      {!isExistingCompany && (
        <>
          <div className="border rounded-lg p-3">
            <p className="text-xs font-semibold uppercase text-muted-foreground mb-1.5">Empresa</p>
            <div className="text-sm grid grid-cols-2 gap-1">
              <div><span className="text-muted-foreground">Legal:</span> <span className="font-medium">{company.legal_business_name}</span></div>
              {company.dba && <div><span className="text-muted-foreground">DBA:</span> <span className="font-medium">{company.dba}</span></div>}
              <div><span className="text-muted-foreground">MC#:</span> <span className="font-medium">{company.mc_number}</span></div>
              <div><span className="text-muted-foreground">DOT#:</span> <span className="font-medium">{company.dot_number}</span></div>
              <div><span className="text-muted-foreground">Owner:</span> <span className="font-medium">{company.owner_full_name}</span></div>
              <div><span className="text-muted-foreground">Email:</span> <span className="font-medium">{company.email}</span></div>
            </div>
          </div>
          <div className="border rounded-lg p-3">
            <p className="text-xs font-semibold uppercase text-muted-foreground mb-1.5">Documentos y Firma</p>
            <ul className="text-sm space-y-0.5 text-muted-foreground">
              <li>{companyDocs.mc_authority ? '✓' : '✗'} MC/DOT Authority</li>
              <li>{companyDocs.insurance_cert ? '✓' : '✗'} Insurance Certificate</li>
              <li>{companyDocs.w9 ? '✓' : '✗'} W9 Form</li>
              <li>{companyDocs.noa ? '✓' : '✗'} NOA (Notice of Assignment)</li>
              <li>{agreementSignature ? '✓' : '✗'} Agreement firmado por {signerName || '—'}</li>
            </ul>
          </div>
        </>
      )}

      <div className="border rounded-lg p-3">
        <p className="text-xs font-semibold uppercase text-muted-foreground mb-1.5">
          Drivers ({isExistingCompany ? 1 : drivers.length})
        </p>
        {isExistingCompany ? (
          <div className="text-sm">
            <p className="font-medium">{currentDriver.name}</p>
            <p className="text-xs text-muted-foreground">Unit #{currentDriver.truck.unit_number} • {currentDriver.truck.truck_type}</p>
          </div>
        ) : (
          <ul className="text-sm space-y-1">
            {drivers.map((d, i) => (
              <li key={i} className="flex items-center gap-2">
                <span className="font-medium">{d.name}</span>
                <span className="text-xs text-muted-foreground">Unit #{d.truck.unit_number}</span>
                {d.is_owner && <span className="text-[10px] text-primary font-semibold">(Owner)</span>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );

  const renderExistingCompanyDriverStep = () => (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold flex items-center gap-2"><User className="h-5 w-5 text-primary" /> Driver & Truck Info</h3>
        <p className="text-sm text-muted-foreground">Llena tus datos personales y los del camión. La empresa y el agreement ya están registrados.</p>
      </div>
      <DispatchDriverTruckForm
        entry={currentDriver}
        onChange={(u) => setCurrentDriver(prev => ({ ...prev, ...u }))}
        onFileChange={(k, f) => setCurrentDriver(prev => ({ ...prev, [k]: f }))}
      />
    </div>
  );

  const renderCurrentStep = () => {
    if (isExistingCompany) {
      switch (step) {
        case 1: return renderExistingCompanyDriverStep();
        case 2: return renderReviewStep();
        default: return null;
      }
    }
    switch (step) {
      case 1: return renderCompanyStep();
      case 2: return renderFactoringInsuranceStep();
      case 3: return renderCompanyDocsStep();
      case 4: return renderSignAgreementStep();
      case 5: return renderAddDriversStep();
      case 6: return renderReviewStep();
      default: return null;
    }
  };

  // En el step de "Add Drivers", los botones de navegacion los maneja el form (Save & Continue).
  const isDriversLoopStep = !isExistingCompany && step === 5;

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
            <CardDescription>Paso {step} de {totalSteps}</CardDescription>
          </CardHeader>
          <CardContent>
            {renderStepper()}
            {renderCurrentStep()}

            {!isDriversLoopStep && (
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
            )}
            {isDriversLoopStep && (
              <div className="flex justify-between mt-6 pt-4 border-t">
                <Button variant="outline" onClick={prev} disabled={submitting} className="gap-1">
                  <ArrowLeft className="h-4 w-4" /> Back
                </Button>
                <p className="text-xs text-muted-foreground self-center">Usa los botones del formulario para guardar y avanzar.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
