import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { Upload, FileText, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { mockDrivers } from '@/data/mockData';
import type { DbLoad, CreateLoadInput } from '@/hooks/useLoads';

interface LoadFormData {
  origin: string;
  destination: string;
  pickupDate: string;
  deliveryDate: string;
  weight: number;
  cargoType: string;
  totalRate: number;
  referenceNumber: string;
  brokerClient: string;
  miles: number;
  factoring: string;
}

interface LoadFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (input: CreateLoadInput & { status?: string }) => Promise<any>;
  editLoad?: DbLoad | null;
  dispatcherId?: string;
}

const emptyForm: LoadFormData = {
  origin: '', destination: '', pickupDate: '', deliveryDate: '',
  weight: 0, cargoType: '', totalRate: 0, referenceNumber: '', brokerClient: '',
  miles: 0, factoring: '',
};

export const LoadFormDialog = ({ open, onOpenChange, onSubmit, editLoad, dispatcherId }: LoadFormDialogProps) => {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [formData, setFormData] = useState<LoadFormData>(emptyForm);
  const [selectedDriver, setSelectedDriver] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('planned');
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractionStatus, setExtractionStatus] = useState<'idle' | 'uploading' | 'processing' | 'done' | 'error'>('idle');
  const [pdfFileName, setPdfFileName] = useState('');

  useEffect(() => {
    if (editLoad) {
      setFormData({
        origin: editLoad.origin,
        destination: editLoad.destination,
        pickupDate: editLoad.pickup_date || '',
        deliveryDate: editLoad.delivery_date || '',
        weight: editLoad.weight || 0,
        cargoType: editLoad.cargo_type || '',
        totalRate: editLoad.total_rate,
        referenceNumber: editLoad.reference_number,
        brokerClient: editLoad.broker_client || '',
        miles: editLoad.miles || 0,
        factoring: editLoad.factoring || '',
      });
      setSelectedDriver(editLoad.driver_id || '');
      setSelectedStatus(editLoad.status);
    } else {
      setFormData(emptyForm);
      setSelectedDriver('');
      setSelectedStatus('planned');
      setExtractionStatus('idle');
      setPdfFileName('');
    }
  }, [editLoad, open]);

  const updateField = (field: keyof LoadFormData, value: string | number) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== 'application/pdf') {
      toast({ title: 'Error', description: 'Solo se permiten archivos PDF', variant: 'destructive' });
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: 'Error', description: 'El archivo no puede superar 10MB', variant: 'destructive' });
      return;
    }
    setPdfFileName(file.name);
    setExtractionStatus('uploading');
    setIsExtracting(true);
    try {
      const buffer = await file.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      let binary = '';
      for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
      const base64 = btoa(binary);
      setExtractionStatus('processing');
      const { data, error } = await supabase.functions.invoke('extract-pdf', { body: { pdfBase64: base64 } });
      if (error) throw error;
      if (data?.success && data?.data) {
        const extracted = data.data;
        setFormData({
          origin: extracted.origin || '',
          destination: extracted.destination || '',
          pickupDate: extracted.pickupDate || '',
          deliveryDate: extracted.deliveryDate || '',
          weight: extracted.weight || 0,
          cargoType: extracted.cargoType || '',
          totalRate: extracted.totalRate || 0,
          referenceNumber: extracted.referenceNumber || '',
          brokerClient: extracted.brokerClient || '',
          miles: extracted.miles || 0,
          factoring: extracted.factoring || '',
        });
        setExtractionStatus('done');
        toast({ title: 'Extracción exitosa', description: 'Campos rellenados automáticamente.' });
      } else {
        throw new Error(data?.error || 'No se pudo extraer información');
      }
    } catch (err: any) {
      setExtractionStatus('error');
      toast({ title: 'Error al extraer PDF', description: err.message, variant: 'destructive' });
    } finally {
      setIsExtracting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const driverPay = formData.totalRate * 0.30;
  const investorPay = formData.totalRate * 0.15;
  const dispatcherPay = formData.totalRate * 0.08;
  const companyProfit = formData.totalRate - driverPay - investorPay - dispatcherPay;

  const handleSubmit = async () => {
    const payload: CreateLoadInput & { status?: string } = {
      reference_number: formData.referenceNumber || `RC-${Date.now()}`,
      origin: formData.origin,
      destination: formData.destination,
      pickup_date: formData.pickupDate || undefined,
      delivery_date: formData.deliveryDate || undefined,
      weight: formData.weight,
      cargo_type: formData.cargoType,
      total_rate: formData.totalRate,
      driver_id: selectedDriver || undefined,
      dispatcher_id: dispatcherId || 'd1',
      broker_client: formData.brokerClient,
      driver_pay_amount: driverPay,
      investor_pay_amount: investorPay,
      dispatcher_pay_amount: dispatcherPay,
      company_profit: companyProfit,
      miles: formData.miles || undefined,
      factoring: formData.factoring || undefined,
      status: selectedStatus,
    };
    await onSubmit(payload);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editLoad ? 'Editar Carga' : 'Crear Nueva Carga'}</DialogTitle>
        </DialogHeader>

        {/* PDF Upload */}
        {!editLoad && (
          <div className="mt-2 p-4 rounded-lg border-2 border-dashed border-primary/30 bg-primary/5">
            <div className="flex items-center gap-3 mb-3">
              <FileText className="h-5 w-5 text-primary" />
              <div>
                <h4 className="text-sm font-semibold">Extraer datos de PDF</h4>
                <p className="text-xs text-muted-foreground">Sube un rate confirmation o BOL</p>
              </div>
            </div>
            <input ref={fileInputRef} type="file" accept=".pdf" onChange={handlePdfUpload} className="hidden" />
            {extractionStatus === 'idle' && (
              <Button variant="outline" size="sm" className="w-full gap-2" onClick={() => fileInputRef.current?.click()}>
                <Upload className="h-4 w-4" /> Seleccionar PDF
              </Button>
            )}
            {(extractionStatus === 'uploading' || extractionStatus === 'processing') && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  <span>{extractionStatus === 'uploading' ? 'Subiendo...' : 'Extrayendo con IA...'}</span>
                </div>
                <Progress value={extractionStatus === 'uploading' ? 30 : 70} className="h-2" />
              </div>
            )}
            {extractionStatus === 'done' && (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-green-600">
                  <CheckCircle className="h-4 w-4" /><span>Datos extraídos de <strong>{pdfFileName}</strong></span>
                </div>
                <Button variant="ghost" size="sm" onClick={() => { setExtractionStatus('idle'); fileInputRef.current?.click(); }}>Cambiar PDF</Button>
              </div>
            )}
            {extractionStatus === 'error' && (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-destructive">
                  <AlertCircle className="h-4 w-4" /><span>Error. Completa manualmente.</span>
                </div>
                <Button variant="ghost" size="sm" onClick={() => { setExtractionStatus('idle'); fileInputRef.current?.click(); }}>Reintentar</Button>
              </div>
            )}
          </div>
        )}

        {/* Form Fields */}
        <div className="grid grid-cols-2 gap-4 mt-4">
          <div className="space-y-2">
            <Label>Origen</Label>
            <Input placeholder="Ciudad, Estado" value={formData.origin} onChange={e => updateField('origin', e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Destino</Label>
            <Input placeholder="Ciudad, Estado" value={formData.destination} onChange={e => updateField('destination', e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Fecha Recogida</Label>
            <Input type="date" value={formData.pickupDate} onChange={e => updateField('pickupDate', e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Fecha Entrega</Label>
            <Input type="date" value={formData.deliveryDate} onChange={e => updateField('deliveryDate', e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Peso (lbs)</Label>
            <Input type="number" placeholder="40000" value={formData.weight || ''} onChange={e => updateField('weight', Number(e.target.value))} />
          </div>
          <div className="space-y-2">
            <Label>Tipo de Carga</Label>
            <Select value={formData.cargoType} onValueChange={v => updateField('cargoType', v)}>
              <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="dry_van">Dry Van</SelectItem>
                <SelectItem value="reefer">Reefer</SelectItem>
                <SelectItem value="flatbed">Flatbed</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Tarifa Total ($)</Label>
            <Input type="number" placeholder="2500" value={formData.totalRate || ''} onChange={e => updateField('totalRate', Number(e.target.value))} />
          </div>
          <div className="space-y-2">
            <Label>Broker/Cliente</Label>
            <Input placeholder="Nombre del broker" value={formData.brokerClient} onChange={e => updateField('brokerClient', e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Conductor</Label>
            <Select value={selectedDriver} onValueChange={setSelectedDriver}>
              <SelectTrigger><SelectValue placeholder="Asignar driver" /></SelectTrigger>
              <SelectContent>
                {mockDrivers.filter(d => d.status === 'available').map(d => (
                  <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Nro. Referencia</Label>
            <Input placeholder="RC-2024-XXX" value={formData.referenceNumber} onChange={e => updateField('referenceNumber', e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Miles</Label>
            <Input type="number" placeholder="500" value={formData.miles || ''} onChange={e => updateField('miles', Number(e.target.value))} />
          </div>
          <div className="space-y-2">
            <Label>Factoring</Label>
            <Input placeholder="Factoring company" value={formData.factoring} onChange={e => updateField('factoring', e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Estado</Label>
            <Select value={selectedStatus} onValueChange={setSelectedStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="planned">Planned</SelectItem>
                <SelectItem value="dispatched">Dispatched</SelectItem>
                <SelectItem value="in_transit">In Transit</SelectItem>
                <SelectItem value="delivered">Delivered</SelectItem>
                <SelectItem value="tonu">TONU</SelectItem>
                <SelectItem value="cancelled">Canceled</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Payment Breakdown */}
        {formData.totalRate > 0 && (
          <div className="mt-4 p-4 rounded-lg bg-muted">
            <h4 className="text-sm font-semibold mb-3">Desglose de Pagos (estimado)</h4>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <span className="text-muted-foreground">Driver (30%):</span><span className="font-medium">${driverPay.toLocaleString()}</span>
              <span className="text-muted-foreground">Investor (15%):</span><span className="font-medium">${investorPay.toLocaleString()}</span>
              <span className="text-muted-foreground">Dispatcher (8%):</span><span className="font-medium">${dispatcherPay.toLocaleString()}</span>
              <span className="text-muted-foreground font-semibold">Utilidad Empresa:</span><span className="font-bold text-primary">${companyProfit.toLocaleString()}</span>
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSubmit}>{editLoad ? 'Guardar Cambios' : 'Crear Carga'}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
