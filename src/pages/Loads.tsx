import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { mockLoads, mockDrivers, mockDispatchers } from '@/data/mockData';
import { StatusBadge } from '@/components/StatusBadge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Plus, Search, Upload, Filter, Package } from 'lucide-react';

const Loads = () => {
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showCreate, setShowCreate] = useState(false);

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
          <Button variant="outline" size="sm" className="gap-2">
            <Upload className="h-4 w-4" /> Subir PDF
          </Button>
          <Dialog open={showCreate} onOpenChange={setShowCreate}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-2"><Plus className="h-4 w-4" /> Nueva Carga</Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle>Crear Nueva Carga</DialogTitle></DialogHeader>
              <div className="grid grid-cols-2 gap-4 mt-4">
                <div className="space-y-2"><Label>Origen</Label><Input placeholder="Ciudad, Estado" /></div>
                <div className="space-y-2"><Label>Destino</Label><Input placeholder="Ciudad, Estado" /></div>
                <div className="space-y-2"><Label>Fecha Recogida</Label><Input type="date" /></div>
                <div className="space-y-2"><Label>Fecha Entrega</Label><Input type="date" /></div>
                <div className="space-y-2"><Label>Peso (lbs)</Label><Input type="number" placeholder="40000" /></div>
                <div className="space-y-2"><Label>Tipo de Carga</Label>
                  <Select><SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="dry_van">Dry Van</SelectItem>
                      <SelectItem value="reefer">Reefer</SelectItem>
                      <SelectItem value="flatbed">Flatbed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2"><Label>Tarifa Total ($)</Label><Input type="number" placeholder="2500" /></div>
                <div className="space-y-2"><Label>Broker/Cliente</Label><Input placeholder="Nombre del broker" /></div>
                <div className="space-y-2"><Label>Conductor</Label>
                  <Select><SelectTrigger><SelectValue placeholder="Asignar driver" /></SelectTrigger>
                    <SelectContent>
                      {mockDrivers.filter(d => d.status === 'available').map(d => (
                        <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2"><Label>Nro. Referencia</Label><Input placeholder="RC-2024-XXX" /></div>
              </div>
              <div className="mt-4 p-4 rounded-lg bg-muted">
                <h4 className="text-sm font-semibold mb-3">Desglose de Pagos (estimado)</h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <span className="text-muted-foreground">Driver (30%):</span><span className="font-medium">$750</span>
                  <span className="text-muted-foreground">Investor (15%):</span><span className="font-medium">$375</span>
                  <span className="text-muted-foreground">Dispatcher (8%):</span><span className="font-medium">$200</span>
                  <span className="text-muted-foreground font-semibold">Utilidad Empresa:</span><span className="font-bold text-success">$1,175</span>
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-4">
                <Button variant="outline" onClick={() => setShowCreate(false)}>Cancelar</Button>
                <Button onClick={() => setShowCreate(false)}>Crear Carga</Button>
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
