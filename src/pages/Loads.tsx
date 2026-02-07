import { useState, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { mockLoads, mockDrivers, mockDispatchers } from '@/data/mockData';
import { StatusBadge } from '@/components/StatusBadge';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Plus, Search, Upload, Filter, Package, FileText, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface ExtractedData {
  origin: string;
  destination: string;
  pickupDate: string;
  deliveryDate: string;
  weight: number;
  cargoType: string;
  totalRate: number;
  referenceNumber: string;
  brokerClient: string;
}

const Loads = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showCreate, setShowCreate] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form state
  const [formData, setFormData] = useState<ExtractedData>({
    origin: '', destination: '', pickupDate: '', deliveryDate: '',
    weight: 0, cargoType: '', totalRate: 0, referenceNumber: '', brokerClient: '',
  });
  const [selectedDriver, setSelectedDriver] = useState('');
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractionStatus, setExtractionStatus] = useState<'idle' | 'uploading' | 'processing' | 'done' | 'error'>('idle');
  const [pdfFileName, setPdfFileName] = useState('');

  const updateField = (field: keyof ExtractedData, value: string | number) => {
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
      // Convert to base64
      const buffer = await file.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      let binary = '';
      for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      const base64 = btoa(binary);

      setExtractionStatus('processing');

      const { data, error } = await supabase.functions.invoke('extract-pdf', {
        body: { pdfBase64: base64 },
      });

      if (error) throw error;

      if (data?.success && data?.data) {
        const extracted = data.data as ExtractedData;
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
        });
        setExtractionStatus('done');
        toast({ title: 'Extracción exitosa', description: 'Los campos se han rellenado automáticamente. Revisa y edita si es necesario.' });
      } else {
        throw new Error(data?.error || 'No se pudo extraer información');
      }
    } catch (err: any) {
      console.error('PDF extraction error:', err);
      setExtractionStatus('error');
      toast({
        title: 'Error al extraer PDF',
        description: err.message || 'Ocurrió un error procesando el archivo',
        variant: 'destructive',
      });
    } finally {
      setIsExtracting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const resetForm = () => {
    setFormData({ origin: '', destination: '', pickupDate: '', deliveryDate: '', weight: 0, cargoType: '', totalRate: 0, referenceNumber: '', brokerClient: '' });
    setSelectedDriver('');
    setExtractionStatus('idle');
    setPdfFileName('');
  };

  const driverPay = formData.totalRate * 0.30;
  const investorPay = formData.totalRate * 0.15;
  const dispatcherPay = formData.totalRate * 0.08;
  const companyProfit = formData.totalRate - driverPay - investorPay - dispatcherPay;

  const isDispatcher = user?.role === 'dispatcher';
  let loads = isDispatcher
    ? mockLoads.filter(l => l.dispatcherId === (user?.dispatcherId || 'd1'))
    : mockLoads;

  if (statusFilter !== 'all') loads = loads.filter(l => l.status === statusFilter);
  if (search) loads = loads.filter(l =>
    l.referenceNumber.toLowerCase().includes(search.toLowerCase()) ||
    l.origin.toLowerCase().includes(search.toLowerCase()) ||
    l.destination.toLowerCase().includes(search.toLowerCase()) ||
    l.brokerClient.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="page-header">Gestión de Cargas</h1>
          <p className="page-description">Administra todas las cargas y asignaciones</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={showCreate} onOpenChange={(open) => { setShowCreate(open); if (!open) resetForm(); }}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-2"><Plus className="h-4 w-4" /> Nueva Carga</Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle>Crear Nueva Carga</DialogTitle></DialogHeader>

              {/* PDF Upload Section */}
              <div className="mt-2 p-4 rounded-lg border-2 border-dashed border-primary/30 bg-primary/5">
                <div className="flex items-center gap-3 mb-3">
                  <FileText className="h-5 w-5 text-primary" />
                  <div>
                    <h4 className="text-sm font-semibold">Extraer datos de PDF</h4>
                    <p className="text-xs text-muted-foreground">Sube un rate confirmation o BOL y la IA completará los campos automáticamente</p>
                  </div>
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf"
                  onChange={handlePdfUpload}
                  className="hidden"
                />

                {extractionStatus === 'idle' && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full gap-2"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload className="h-4 w-4" /> Seleccionar PDF
                  </Button>
                )}

                {(extractionStatus === 'uploading' || extractionStatus === 'processing') && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm">
                      <Loader2 className="h-4 w-4 animate-spin text-primary" />
                      <span>{extractionStatus === 'uploading' ? 'Subiendo archivo...' : 'Extrayendo información con IA...'}</span>
                    </div>
                    <Progress value={extractionStatus === 'uploading' ? 30 : 70} className="h-2" />
                    {pdfFileName && <p className="text-xs text-muted-foreground">{pdfFileName}</p>}
                  </div>
                )}

                {extractionStatus === 'done' && (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm text-green-600">
                      <CheckCircle className="h-4 w-4 text-primary" />
                      <span>Datos extraídos de <strong>{pdfFileName}</strong></span>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => { setExtractionStatus('idle'); fileInputRef.current?.click(); }}>
                      Cambiar PDF
                    </Button>
                  </div>
                )}

                {extractionStatus === 'error' && (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm text-destructive">
                      <AlertCircle className="h-4 w-4" />
                      <span>Error al extraer. Completa los campos manualmente.</span>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => { setExtractionStatus('idle'); fileInputRef.current?.click(); }}>
                      Reintentar
                    </Button>
                  </div>
                )}
              </div>

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
                <Button variant="outline" onClick={() => setShowCreate(false)}>Cancelar</Button>
                <Button onClick={() => { setShowCreate(false); resetForm(); }}>Crear Carga</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar por referencia, ruta o cliente..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-44"><Filter className="h-4 w-4 mr-2" /><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los estados</SelectItem>
            <SelectItem value="pending">Pendiente</SelectItem>
            <SelectItem value="in_transit">En Tránsito</SelectItem>
            <SelectItem value="delivered">Entregada</SelectItem>
            <SelectItem value="paid">Pagada</SelectItem>
            <SelectItem value="cancelled">Cancelada</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b bg-muted/50">
                <th className="text-left p-3 font-medium text-muted-foreground">Referencia</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Origen → Destino</th>
                <th className="text-left p-3 font-medium text-muted-foreground hidden md:table-cell">Fecha</th>
                <th className="text-left p-3 font-medium text-muted-foreground hidden lg:table-cell">Driver</th>
                <th className="text-left p-3 font-medium text-muted-foreground hidden lg:table-cell">Dispatcher</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Estado</th>
                <th className="text-right p-3 font-medium text-muted-foreground">Tarifa</th>
              </tr></thead>
              <tbody>
                {loads.map(load => {
                  const driver = mockDrivers.find(d => d.id === load.driverId);
                  const dispatcher = mockDispatchers.find(d => d.id === load.dispatcherId);
                  return (
                    <tr key={load.id} className="border-b last:border-0 hover:bg-muted/30 cursor-pointer">
                      <td className="p-3 font-medium text-primary">{load.referenceNumber}</td>
                      <td className="p-3">
                        <div className="text-foreground">{load.origin}</div>
                        <div className="text-muted-foreground text-xs">→ {load.destination}</div>
                      </td>
                      <td className="p-3 text-muted-foreground hidden md:table-cell">{load.pickupDate}</td>
                      <td className="p-3 hidden lg:table-cell">{driver?.name || <span className="text-muted-foreground italic">Sin asignar</span>}</td>
                      <td className="p-3 hidden lg:table-cell text-muted-foreground">{dispatcher?.name || '—'}</td>
                      <td className="p-3"><StatusBadge status={load.status} /></td>
                      <td className="p-3 text-right font-semibold">${load.totalRate.toLocaleString()}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {loads.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Package className="h-10 w-10 mb-3 opacity-50" />
              <p>No se encontraron cargas</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Loads;
