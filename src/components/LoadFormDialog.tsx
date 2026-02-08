import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { Upload, FileText, Loader2, CheckCircle, AlertCircle, Eye, Download, X, Plus, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useTrucks } from '@/hooks/useTrucks';
import { useDrivers } from '@/hooks/useDrivers';
import { useDispatchers } from '@/hooks/useDispatchers';
import { useLoadStops } from '@/hooks/useLoadStops';
import type { DbLoad, CreateLoadInput } from '@/hooks/useLoads';

interface StopEntry {
  stop_type: 'pickup' | 'delivery';
  address: string;
  date: string;
}

interface LoadFormData {
  origin: string;
  destination: string;
  pickupDate: string;
  deliveryDate: string;
  weight: number;
  totalRate: number;
  referenceNumber: string;
  brokerClient: string;
  miles: number;
  notes: string;
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
  weight: 0, totalRate: 0, referenceNumber: '', brokerClient: '',
  miles: 0, notes: '',
};

export const LoadFormDialog = ({ open, onOpenChange, onSubmit, editLoad, dispatcherId }: LoadFormDialogProps) => {
  const { toast } = useToast();
  const { trucks } = useTrucks();
  const { drivers } = useDrivers();
  const { dispatchers } = useDispatchers();
  const { stops: existingStops, fetchStops, saveStops } = useLoadStops(editLoad?.id);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [formData, setFormData] = useState<LoadFormData>(emptyForm);
  const [selectedDriver, setSelectedDriver] = useState('');
  const [selectedTruck, setSelectedTruck] = useState('');
  const [selectedDispatcher, setSelectedDispatcher] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('planned');
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractionStatus, setExtractionStatus] = useState<'idle' | 'uploading' | 'processing' | 'done' | 'error'>('idle');
  const [pdfFileName, setPdfFileName] = useState('');
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);
  const [stopEntries, setStopEntries] = useState<StopEntry[]>([
    { stop_type: 'pickup', address: '', date: '' },
    { stop_type: 'delivery', address: '', date: '' },
  ]);

  useEffect(() => {
    if (editLoad) {
      setFormData({
        origin: editLoad.origin,
        destination: editLoad.destination,
        pickupDate: editLoad.pickup_date || '',
        deliveryDate: editLoad.delivery_date || '',
        weight: editLoad.weight || 0,
        totalRate: editLoad.total_rate,
        referenceNumber: editLoad.reference_number,
        brokerClient: editLoad.broker_client || '',
        miles: editLoad.miles || 0,
        notes: editLoad.notes || '',
      });
      setSelectedDriver(editLoad.driver_id || '');
      setSelectedTruck(editLoad.truck_id || '');
      setSelectedDispatcher(editLoad.dispatcher_id || '');
      setSelectedStatus(editLoad.status);
      setPdfPreviewUrl(editLoad.pdf_url || null);

      // Load existing stops
      if (existingStops.length > 0) {
        setStopEntries(existingStops.map(s => ({
          stop_type: s.stop_type as 'pickup' | 'delivery',
          address: s.address,
          date: s.date || '',
        })));
      } else {
        setStopEntries([
          { stop_type: 'pickup', address: editLoad.origin, date: editLoad.pickup_date || '' },
          { stop_type: 'delivery', address: editLoad.destination, date: editLoad.delivery_date || '' },
        ]);
      }
    } else {
      setFormData(emptyForm);
      setSelectedDriver('');
      setSelectedTruck('');
      setSelectedDispatcher('');
      setSelectedStatus('planned');
      setExtractionStatus('idle');
      setPdfFileName('');
      setPdfFile(null);
      setPdfPreviewUrl(null);
      setStopEntries([
        { stop_type: 'pickup', address: '', date: '' },
        { stop_type: 'delivery', address: '', date: '' },
      ]);
    }
  }, [editLoad, open, existingStops]);

  useEffect(() => {
    return () => {
      if (pdfPreviewUrl && pdfPreviewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(pdfPreviewUrl);
      }
    };
  }, [pdfPreviewUrl]);

  const updateField = (field: keyof LoadFormData, value: string | number) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const updateStop = (index: number, field: keyof StopEntry, value: string) => {
    setStopEntries(prev => prev.map((s, i) => i === index ? { ...s, [field]: value } : s));
  };

  const addStop = (type: 'pickup' | 'delivery') => {
    setStopEntries(prev => [...prev, { stop_type: type, address: '', date: '' }]);
  };

  const removeStop = (index: number) => {
    if (stopEntries.length <= 2) return; // Keep at least 1 pickup + 1 delivery
    setStopEntries(prev => prev.filter((_, i) => i !== index));
  };

  // Sync origin/destination from stops
  useEffect(() => {
    const pickups = stopEntries.filter(s => s.stop_type === 'pickup');
    const deliveries = stopEntries.filter(s => s.stop_type === 'delivery');
    const firstPickup = pickups[0];
    const lastDelivery = deliveries[deliveries.length - 1];

    if (firstPickup?.address) {
      setFormData(prev => ({ ...prev, origin: firstPickup.address, pickupDate: firstPickup.date || prev.pickupDate }));
    }
    if (lastDelivery?.address) {
      setFormData(prev => ({ ...prev, destination: lastDelivery.address, deliveryDate: lastDelivery.date || prev.deliveryDate }));
    }
  }, [stopEntries]);

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
    setPdfFile(file);
    setPdfPreviewUrl(URL.createObjectURL(file));
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
        setFormData(prev => ({
          ...prev,
          origin: extracted.origin || prev.origin,
          destination: extracted.destination || prev.destination,
          pickupDate: extracted.pickupDate || prev.pickupDate,
          deliveryDate: extracted.deliveryDate || prev.deliveryDate,
          weight: extracted.weight || prev.weight,
          totalRate: extracted.totalRate || prev.totalRate,
          referenceNumber: extracted.referenceNumber || prev.referenceNumber,
          brokerClient: extracted.brokerClient || prev.brokerClient,
          miles: extracted.miles || prev.miles,
        }));
        // Update stop entries from extracted multi-stop data
        if (extracted.stops && Array.isArray(extracted.stops) && extracted.stops.length > 0) {
          setStopEntries(extracted.stops.map((s: any) => ({
            stop_type: s.stop_type || 'delivery',
            address: s.address || '',
            date: s.date || '',
          })));
        } else if (extracted.origin || extracted.destination) {
          setStopEntries([
            { stop_type: 'pickup', address: extracted.origin || '', date: extracted.pickupDate || '' },
            { stop_type: 'delivery', address: extracted.destination || '', date: extracted.deliveryDate || '' },
          ]);
        }
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

  const removePdf = () => {
    if (pdfPreviewUrl && pdfPreviewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(pdfPreviewUrl);
    }
    setPdfFile(null);
    setPdfFileName('');
    setPdfPreviewUrl(null);
    setExtractionStatus('idle');
  };

  const driverPay = formData.totalRate * 0.30;
  const investorPay = formData.totalRate * 0.15;
  const dispatcherPay = formData.totalRate * 0.08;
  const companyProfit = formData.totalRate - driverPay - investorPay - dispatcherPay;

  const handleSubmit = async () => {
    if (!selectedDriver) {
      toast({ title: 'Campo requerido', description: 'Debes seleccionar un conductor.', variant: 'destructive' });
      return;
    }
    // Derive origin/destination from stops
    const pickups = stopEntries.filter(s => s.stop_type === 'pickup');
    const deliveries = stopEntries.filter(s => s.stop_type === 'delivery');
    const origin = pickups[0]?.address || formData.origin;
    const destination = deliveries[deliveries.length - 1]?.address || formData.destination;
    const pickupDate = pickups[0]?.date || formData.pickupDate;
    const deliveryDate = deliveries[deliveries.length - 1]?.date || formData.deliveryDate;

    let pdfUrl: string | undefined = editLoad?.pdf_url || undefined;

    if (pdfFile) {
      const fileName = `loads/${Date.now()}_${pdfFile.name}`;
      const { error: uploadError } = await supabase.storage.from('driver-documents').upload(fileName, pdfFile, { contentType: 'application/pdf' });
      if (uploadError) {
        toast({ title: 'Error', description: 'No se pudo subir el PDF', variant: 'destructive' });
      } else {
        const { data: urlData } = supabase.storage.from('driver-documents').getPublicUrl(fileName);
        pdfUrl = urlData.publicUrl;
      }
    }

    const payload: CreateLoadInput & { status?: string } = {
      reference_number: formData.referenceNumber || `RC-${Date.now()}`,
      origin,
      destination,
      pickup_date: pickupDate || undefined,
      delivery_date: deliveryDate || undefined,
      weight: formData.weight,
      total_rate: formData.totalRate,
      driver_id: selectedDriver || undefined,
      truck_id: selectedTruck || undefined,
      dispatcher_id: selectedDispatcher || dispatcherId || undefined,
      broker_client: formData.brokerClient,
      driver_pay_amount: driverPay,
      investor_pay_amount: investorPay,
      dispatcher_pay_amount: dispatcherPay,
      company_profit: companyProfit,
      miles: formData.miles || undefined,
      pdf_url: pdfUrl,
      notes: formData.notes || undefined,
      status: selectedStatus,
    };

    const result = await onSubmit(payload);

    // Save stops to load_stops table
    const loadId = editLoad?.id || result?.id;
    if (loadId && stopEntries.some(s => s.address)) {
      const validStops = stopEntries.filter(s => s.address.trim());
      await saveStops(loadId, validStops.map((s, i) => ({
        stop_type: s.stop_type,
        address: s.address,
        stop_order: i,
        date: s.date || undefined,
      })));
    }

    // Clear cached route since stops changed
    if (editLoad?.id) {
      await supabase.from('loads').update({ route_geometry: null, miles: 0 } as any).eq('id', editLoad.id);
    }

    onOpenChange(false);
  };

  const activeTrucks = trucks.filter(t => t.status === 'active');

  const pickupStops = stopEntries.map((s, i) => ({ ...s, originalIndex: i })).filter(s => s.stop_type === 'pickup');
  const deliveryStops = stopEntries.map((s, i) => ({ ...s, originalIndex: i })).filter(s => s.stop_type === 'delivery');

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

        {/* PDF Preview */}
        {pdfPreviewUrl && (
          <div className="mt-2 p-3 rounded-lg border bg-muted/50">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 text-sm font-medium">
                <FileText className="h-4 w-4 text-primary" />
                <span>{pdfFileName || 'PDF Original'}</span>
              </div>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" asChild>
                  <a href={pdfPreviewUrl} target="_blank" rel="noopener noreferrer">
                    <Eye className="h-3.5 w-3.5" /> Ver
                  </a>
                </Button>
                <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" asChild>
                  <a href={pdfPreviewUrl} download={pdfFileName || 'document.pdf'}>
                    <Download className="h-3.5 w-3.5" /> Descargar
                  </a>
                </Button>
                {!editLoad && (
                  <Button variant="ghost" size="sm" className="h-7 text-xs text-destructive" onClick={removePdf}>
                    <X className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </div>
            <div className="rounded border bg-background h-40 overflow-hidden">
              <iframe src={pdfPreviewUrl} className="w-full h-full" title="PDF Preview" />
            </div>
          </div>
        )}

        {/* Form Fields */}
        <div className="grid grid-cols-2 gap-4 mt-4">
          <div className="space-y-2">
            <Label>Load #</Label>
            <Input placeholder="RC-2024-XXX" value={formData.referenceNumber} onChange={e => updateField('referenceNumber', e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Broker/Cliente</Label>
            <Input placeholder="Nombre del broker" value={formData.brokerClient} onChange={e => updateField('brokerClient', e.target.value)} />
          </div>
        </div>

        {/* Multi-Stop Section */}
        <div className="mt-4 space-y-3">
          <h4 className="text-sm font-semibold">Paradas de Recogida (Pick Up)</h4>
          {pickupStops.map((stop, idx) => (
            <div key={stop.originalIndex} className="flex items-center gap-2">
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-[hsl(152,60%,40%)] flex items-center justify-center text-[10px] font-bold text-white">P{idx + 1}</div>
              <Input
                placeholder="Dirección de recogida"
                value={stop.address}
                onChange={e => updateStop(stop.originalIndex, 'address', e.target.value)}
                className="flex-1"
              />
              <Input
                type="date"
                value={stop.date}
                onChange={e => updateStop(stop.originalIndex, 'date', e.target.value)}
                className="w-36"
              />
              {pickupStops.length > 1 && (
                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => removeStop(stop.originalIndex)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          ))}
          <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => addStop('pickup')}>
            <Plus className="h-3.5 w-3.5" /> Agregar Pick Up
          </Button>

          <h4 className="text-sm font-semibold pt-2">Paradas de Entrega (Delivery)</h4>
          {deliveryStops.map((stop, idx) => (
            <div key={stop.originalIndex} className="flex items-center gap-2">
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-[hsl(0,72%,51%)] flex items-center justify-center text-[10px] font-bold text-white">D{idx + 1}</div>
              <Input
                placeholder="Dirección de entrega"
                value={stop.address}
                onChange={e => updateStop(stop.originalIndex, 'address', e.target.value)}
                className="flex-1"
              />
              <Input
                type="date"
                value={stop.date}
                onChange={e => updateStop(stop.originalIndex, 'date', e.target.value)}
                className="w-36"
              />
              {deliveryStops.length > 1 && (
                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => removeStop(stop.originalIndex)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          ))}
          <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => addStop('delivery')}>
            <Plus className="h-3.5 w-3.5" /> Agregar Delivery
          </Button>
        </div>

        {/* Rest of fields */}
        <div className="grid grid-cols-2 gap-4 mt-4">
          <div className="space-y-2">
            <Label>Peso (lbs)</Label>
            <Input type="number" placeholder="40000" value={formData.weight || ''} onChange={e => updateField('weight', Number(e.target.value))} />
          </div>
          <div className="space-y-2">
            <Label>Tarifa Total ($)</Label>
            <Input type="number" placeholder="2500" value={formData.totalRate || ''} onChange={e => updateField('totalRate', Number(e.target.value))} />
          </div>
          <div className="space-y-2">
            <Label>Conductor <span className="text-destructive">*</span></Label>
            <Select value={selectedDriver} onValueChange={(val) => {
              setSelectedDriver(val);
              const driver = drivers.find(d => d.id === val);
              if (driver?.truck_id) {
                setSelectedTruck(driver.truck_id);
              } else {
                setSelectedTruck('');
              }
              if (driver?.dispatcher_id) {
                setSelectedDispatcher(driver.dispatcher_id);
              } else {
                setSelectedDispatcher('');
              }
            }}>
              <SelectTrigger><SelectValue placeholder="Seleccionar driver" /></SelectTrigger>
              <SelectContent>
                {drivers.filter(d => d.status !== 'inactive').map(d => (
                  <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Truck #</Label>
            <Select value={selectedTruck} onValueChange={setSelectedTruck}>
              <SelectTrigger><SelectValue placeholder="Asignar truck" /></SelectTrigger>
              <SelectContent>
                {activeTrucks.map(t => (
                  <SelectItem key={t.id} value={t.id}>{t.unit_number} - {t.truck_type}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Dispatcher</Label>
            <Select value={selectedDispatcher} onValueChange={setSelectedDispatcher}>
              <SelectTrigger><SelectValue placeholder="Seleccionar dispatcher" /></SelectTrigger>
              <SelectContent>
                {dispatchers.filter(d => d.status === 'active').map(d => (
                  <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Miles</Label>
            <Input type="number" placeholder="500" value={formData.miles || ''} onChange={e => updateField('miles', Number(e.target.value))} />
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
          <div className="col-span-2 space-y-2">
            <Label>Notes</Label>
            <Textarea placeholder="Notas adicionales sobre la carga..." value={formData.notes} onChange={e => updateField('notes', e.target.value)} rows={3} />
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSubmit}>{editLoad ? 'Guardar Cambios' : 'Crear Carga'}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
