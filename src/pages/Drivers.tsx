import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { mockDispatchers } from '@/data/mockData';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Plus, Search, Phone, Truck as TruckIcon, Pencil, Trash2, Eye } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useDrivers, DbDriver, DriverInput } from '@/hooks/useDrivers';
import { useTrucks } from '@/hooks/useTrucks';
import { DriverFormDialog } from '@/components/DriverFormDialog';
import { DriverDetailDialog } from '@/components/DriverDetailDialog';

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
  const { user } = useAuth();
  const { drivers, loading, createDriver, updateDriver, deleteDriver, uploadDocument } = useDrivers();
  const { trucks } = useTrucks();
  const [search, setSearch] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editingDriver, setEditingDriver] = useState<DbDriver | null>(null);
  const [deletingDriver, setDeletingDriver] = useState<DbDriver | null>(null);
  const [detailDriver, setDetailDriver] = useState<DbDriver | null>(null);

  const getTruckLabel = (id: string | null) => {
    if (!id) return null;
    const t = trucks.find(t => t.id === id);
    return t ? `Unit #${t.unit_number} · ${t.truck_type}` : null;
  };

  const isDispatcher = user?.role === 'dispatcher';
  let filtered = isDispatcher
    ? drivers.filter(d => d.dispatcher_id === (user?.dispatcherId || 'd1'))
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
          <Button size="sm" className="gap-2" onClick={() => { setEditingDriver(null); setFormOpen(true); }}>
            <Plus className="h-4 w-4" /> Nuevo Driver
          </Button>
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
            const dispatcher = mockDispatchers.find(d => d.id === driver.dispatcher_id);
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
                      <h3 className="font-semibold truncate">{driver.name}</h3>
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

                  <div className="mt-4 space-y-2 text-sm">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Phone className="h-3.5 w-3.5" />{driver.phone}
                    </div>
                    <div className="flex items-center gap-2">
                      <TruckIcon className="h-3.5 w-3.5 text-primary" />
                      <span>{truckLabel || <span className="text-muted-foreground italic">Sin asignar</span>}</span>
                    </div>
                  </div>

                  <div className="mt-3 pt-3 border-t flex justify-end gap-2">
                    <Button size="sm" variant="outline" onClick={() => setDetailDriver(driver)}>
                      <Eye className="h-3.5 w-3.5 mr-1" /> Detalle
                    </Button>
                    {!isDispatcher && (
                      <>
                        <Button size="sm" variant="outline" onClick={() => { setEditingDriver(driver); setFormOpen(true); }}>
                          <Pencil className="h-3.5 w-3.5 mr-1" /> Editar
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => setDeletingDriver(driver)}>
                          <Trash2 className="h-3.5 w-3.5 mr-1" /> Borrar
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
      />

      <DriverDetailDialog
        open={!!detailDriver}
        onOpenChange={open => !open && setDetailDriver(null)}
        driver={detailDriver}
        truckLabel={detailDriver ? getTruckLabel(detailDriver.truck_id) : null}
        dispatcherName={detailDriver ? mockDispatchers.find(d => d.id === detailDriver.dispatcher_id)?.name || null : null}
      />

      <AlertDialog open={!!deletingDriver} onOpenChange={open => !open && setDeletingDriver(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar driver?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción eliminará permanentemente a <strong>{deletingDriver?.name}</strong>. No se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Drivers;
