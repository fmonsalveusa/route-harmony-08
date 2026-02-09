import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Plus, Search, Phone, Truck as TruckIcon, Pencil, Trash2, Eye, Copy, Link2 } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useDrivers, DbDriver, DriverInput } from '@/hooks/useDrivers';
import { useTrucks } from '@/hooks/useTrucks';
import { useDispatchers } from '@/hooks/useDispatchers';
import { DriverFormDialog } from '@/components/DriverFormDialog';
import { DriverDetailDialog } from '@/components/DriverDetailDialog';
import { GenerateOnboardingLinkDialog } from '@/components/GenerateOnboardingLinkDialog';
import { toast } from '@/hooks/use-toast';

const driverStatusColor = (status: string) => {
  switch (status) {
    case 'available': return 'bg-green-600';
    case 'assigned': return 'bg-blue-600';
    case 'resting': return 'bg-orange-500';
    case 'inactive': return 'bg-red-600';
    default: return 'bg-gray-500';
  }
};

const Drivers = () => {
  const { role, profile } = useAuth();
  const { drivers, loading, createDriver, updateDriver, deleteDriver, uploadDocument } = useDrivers();
  const { trucks } = useTrucks();
  const { dispatchers } = useDispatchers();
  const [search, setSearch] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editingDriver, setEditingDriver] = useState<DbDriver | null>(null);
  const [deletingDriver, setDeletingDriver] = useState<DbDriver | null>(null);
  const [detailDriver, setDetailDriver] = useState<DbDriver | null>(null);
  const [onboardingOpen, setOnboardingOpen] = useState(false);

  const getTruckLabel = (id: string | null) => {
    if (!id) return null;
    const t = trucks.find(t => t.id === id);
    return t ? `Unit #${t.unit_number} · ${t.truck_type}` : null;
  };

  const getTruck = (id: string | null) => {
    if (!id) return null;
    return trucks.find(t => t.id === id) || null;
  };

  const getDispatcher = (id: string | null) => {
    if (!id) return null;
    return dispatchers.find(d => d.id === id) || null;
  };

  const copyDriverInfo = (driver: DbDriver) => {
    const truck = getTruck(driver.truck_id);
    const dispatcher = getDispatcher(driver.dispatcher_id);
    const truckType = truck?.truck_type || '';
    const isHotshot = truckType.toLowerCase().includes('hotshot');

    let text = '';
    if (isHotshot) {
      text = `Driver Name: ${driver.name}\nPhone Number: ${driver.phone}\nTruck #: ${truck?.unit_number || ''}\nTruck Type: Hotshot\nTrailer (ft): ${truck?.trailer_length_ft || ''}\nDispatcher Name: ${dispatcher?.name || ''}\nDispatcher Phone Number: ${dispatcher?.phone || ''}\nETA to Pick up: `;
    } else {
      text = `Driver Name: ${driver.name}\nPhone Number: ${driver.phone}\nTruck #: ${truck?.unit_number || ''}\nTruck Type: Box Truck\nBack Door: ${truck?.rear_door_width_in && truck?.rear_door_height_in ? `${truck.rear_door_width_in}" x ${truck.rear_door_height_in}"` : ''}\nDispatcher Name: ${dispatcher?.name || ''}\nDispatcher Phone Number: ${dispatcher?.phone || ''}\nETA to Pick up: `;
    }

    navigator.clipboard.writeText(text);
    toast({ title: 'Copiado al portapapeles' });
  };

  const isDispatcher = role === 'dispatcher';
  let filtered = isDispatcher
    ? drivers.filter(d => d.dispatcher_id === ((profile as any)?.dispatcher_id || 'd1'))
    : drivers;

  if (search) filtered = filtered.filter(d =>
    d.name.toLowerCase().includes(search.toLowerCase()) ||
    d.email.toLowerCase().includes(search.toLowerCase())
  );

  const handleSubmit = async (data: DriverInput, files: Record<string, File | null>) => {
    let docUrls: Record<string, string> = {};
    const driverId = editingDriver?.id || 'new-' + Date.now();

    for (const [key, file] of Object.entries(files)) {
      if (file) {
        const url = await uploadDocument(file, driverId, key);
        if (url) docUrls[key + '_url'] = url;
      }
    }

    if (editingDriver) {
      await updateDriver(editingDriver.id, { ...data, ...docUrls });
    } else {
      await createDriver({ ...data, ...docUrls } as any);
    }
    setEditingDriver(null);
  };

  const handleDelete = async () => {
    if (deletingDriver) {
      await deleteDriver(deletingDriver.id);
      setDeletingDriver(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="page-header">Conductores</h1>
          <p className="page-description">{isDispatcher ? 'Drivers bajo tu gestión' : 'Gestión completa de conductores'}</p>
        </div>
        {!isDispatcher && (
          <div className="flex gap-2">
            <Button size="sm" variant="outline" className="gap-2" onClick={() => setOnboardingOpen(true)}>
              <Link2 className="h-4 w-4" /> Onboarding Link
            </Button>
            <Button size="sm" className="gap-2" onClick={() => { setEditingDriver(null); setFormOpen(true); }}>
              <Plus className="h-4 w-4" /> Nuevo Driver
            </Button>
          </div>
        )}
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Buscar por nombre o email..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
      </div>

      {loading ? (
        <p className="text-muted-foreground text-sm">Cargando drivers...</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(driver => {
            const dispatcher = dispatchers.find(d => d.id === driver.dispatcher_id);
            const truckLabel = getTruckLabel(driver.truck_id);
            const initials = driver.name.split(' ').map(n => n[0]).join('');
            return (
              <Card key={driver.id} className="hover:shadow-md transition-shadow animate-fade-in">
                <CardContent className="p-5">
                  <div className="flex items-start gap-4">
                    <Avatar className="h-12 w-12">
                      <AvatarFallback className="bg-primary/10 text-primary font-semibold">{initials}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold truncate text-xl">{driver.name}</h3>
                    </div>
                    <Select value={driver.status} onValueChange={v => updateDriver(driver.id, { status: v })}>
                      <SelectTrigger className={`w-auto h-7 text-xs font-semibold text-white border-0 rounded-full px-3 gap-1 ${driverStatusColor(driver.status)}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="available">Disponible</SelectItem>
                        <SelectItem value="assigned">Asignado</SelectItem>
                        <SelectItem value="resting">Descansando</SelectItem>
                        <SelectItem value="inactive">Inactivo</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="mt-4 space-y-2 text-[15px]">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Phone className="h-3.5 w-3.5" />{driver.phone}
                    </div>
                    <div className="flex items-center gap-2">
                      <TruckIcon className="h-3.5 w-3.5 text-primary" />
                      <span>{truckLabel || <span className="text-muted-foreground italic">Sin asignar</span>}</span>
                    </div>
                  </div>

                  <div className="mt-3 pt-3 border-t flex items-center gap-1.5">
                    <Button variant="outline" size="icon" className="h-8 w-10 border-sky-300 bg-sky-50 text-sky-600 hover:bg-sky-100 hover:text-sky-700" onClick={() => copyDriverInfo(driver)} title="Copiar">
                      <Copy className="h-4 w-4" />
                    </Button>
                    <div className="flex-1" />
                    <Button variant="outline" size="icon" className="h-8 w-10 border-emerald-300 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 hover:text-emerald-700" onClick={() => setDetailDriver(driver)} title="Detalle">
                      <Eye className="h-4 w-4" />
                    </Button>
                    {!isDispatcher && (
                      <>
                        <Button variant="outline" size="icon" className="h-8 w-10 border-amber-300 bg-amber-50 text-amber-600 hover:bg-amber-100 hover:text-amber-700" onClick={() => { setEditingDriver(driver); setFormOpen(true); }} title="Editar">
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="outline" size="icon" className="h-8 w-10 border-red-300 bg-red-50 text-red-600 hover:bg-red-100 hover:text-red-700" onClick={async () => { if (window.confirm(`¿Eliminar driver ${driver.name}? Esta acción es permanente.`)) { await deleteDriver(driver.id); } }} title="Eliminar">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <DriverFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        driver={editingDriver}
        onSubmit={handleSubmit}
        trucks={trucks}
        dispatchers={dispatchers}
      />

      <DriverDetailDialog
        open={!!detailDriver}
        onOpenChange={open => !open && setDetailDriver(null)}
        driver={detailDriver}
        truckLabel={detailDriver ? getTruckLabel(detailDriver.truck_id) : null}
        dispatcherName={detailDriver ? dispatchers.find(d => d.id === detailDriver.dispatcher_id)?.name || null : null}
      />

      <GenerateOnboardingLinkDialog
        open={onboardingOpen}
        onOpenChange={setOnboardingOpen}
        dispatchers={dispatchers}
      />
    </div>
  );
};

export default Drivers;
