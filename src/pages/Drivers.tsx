import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { mockDispatchers, mockTrucks } from '@/data/mockData';
import { StatusBadge } from '@/components/StatusBadge';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Plus, Search, Phone, Mail, Truck as TruckIcon, Headphones, Pencil, Trash2 } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useDrivers, DbDriver, DriverInput } from '@/hooks/useDrivers';
import { DriverFormDialog } from '@/components/DriverFormDialog';

const Drivers = () => {
  const { user } = useAuth();
  const { drivers, loading, createDriver, updateDriver, deleteDriver, uploadDocument } = useDrivers();
  const [search, setSearch] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editingDriver, setEditingDriver] = useState<DbDriver | null>(null);
  const [deletingDriver, setDeletingDriver] = useState<DbDriver | null>(null);

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
            const truck = mockTrucks.find(t => t.id === driver.truck_id);
            const initials = driver.name.split(' ').map(n => n[0]).join('');
            return (
              <Card key={driver.id} className="hover:shadow-md transition-shadow animate-fade-in">
                <CardContent className="p-5">
                  <div className="flex items-start gap-4">
                    <Avatar className="h-12 w-12">
                      <AvatarFallback className="bg-primary/10 text-primary font-semibold">{initials}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <h3 className="font-semibold truncate">{driver.name}</h3>
                        <StatusBadge status={driver.status as any} />
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">CDL: {driver.license}</p>
                    </div>
                  </div>

                  <div className="mt-4 space-y-2 text-sm">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Phone className="h-3.5 w-3.5" />{driver.phone}
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Mail className="h-3.5 w-3.5" />{driver.email}
                    </div>
                    {dispatcher && (
                      <div className="flex items-center gap-2">
                        <Headphones className="h-3.5 w-3.5 text-info" />
                        <Badge variant="secondary" className="text-xs">{dispatcher.name}</Badge>
                      </div>
                    )}
                    {truck && (
                      <div className="flex items-center gap-2">
                        <TruckIcon className="h-3.5 w-3.5 text-primary" />
                        <span>{truck.plateNumber} · {truck.model}</span>
                      </div>
                    )}
                  </div>

                  <div className="mt-4 pt-3 border-t grid grid-cols-3 gap-2 text-center">
                    <div>
                      <p className="text-lg font-bold">{driver.loads_this_month}</p>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Cargas</p>
                    </div>
                    <div>
                      <p className="text-lg font-bold">${(driver.earnings_this_month / 1000).toFixed(1)}k</p>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Ganado</p>
                    </div>
                    <div>
                      <p className="text-lg font-bold">{driver.pay_percentage}%</p>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Pago</p>
                    </div>
                  </div>

                  {!isDispatcher && (
                    <div className="mt-3 pt-3 border-t flex justify-end gap-2">
                      <Button size="sm" variant="outline" onClick={() => { setEditingDriver(driver); setFormOpen(true); }}>
                        <Pencil className="h-3.5 w-3.5 mr-1" /> Editar
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => setDeletingDriver(driver)}>
                        <Trash2 className="h-3.5 w-3.5 mr-1" /> Borrar
                      </Button>
                    </div>
                  )}
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
