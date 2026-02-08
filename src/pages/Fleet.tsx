import { useState } from 'react';
import { useTrucks, DbTruck, TruckInput } from '@/hooks/useTrucks';
import { useDrivers } from '@/hooks/useDrivers';
import { TruckFormDialog } from '@/components/TruckFormDialog';
import { TruckDetailDialog } from '@/components/TruckDetailDialog';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, Truck as TruckIcon, Pencil, Trash2, Eye, User } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

const STATUS_OPTIONS = [
  { value: 'active', label: 'Active', bg: 'bg-green-600 text-white' },
  { value: 'inactive', label: 'Inactive', bg: 'bg-red-600 text-white' },
  { value: 'maintenance', label: 'Maintenance', bg: 'bg-orange-500 text-white' },
];

const getStatusStyle = (status: string) =>
  STATUS_OPTIONS.find(s => s.value === status)?.bg || '';

const Fleet = () => {
  const { trucks, loading, createTruck, updateTruck, deleteTruck, uploadDocument } = useTrucks();
  const { drivers } = useDrivers();
  const getDriverName = (truckId: string) => {
    const d = drivers.find(d => d.truck_id === truckId);
    return d?.name || null;
  };
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTruck, setEditTruck] = useState<DbTruck | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DbTruck | null>(null);
  const [detailTruck, setDetailTruck] = useState<DbTruck | null>(null);

  const openNew = () => { setEditTruck(null); setDialogOpen(true); };
  const openEdit = (t: DbTruck) => { setEditTruck(t); setDialogOpen(true); };

  const handleSave = async (input: TruckInput, files: Record<string, File>) => {
    let ok: boolean;
    const truckId = editTruck?.id || crypto.randomUUID();

    // Upload files first
    const docUpdates: Record<string, string> = {};
    for (const [key, file] of Object.entries(files)) {
      const url = await uploadDocument(file, truckId, key);
      if (url) docUpdates[`${key}_url`] = url;
    }

    if (editTruck) {
      ok = await updateTruck(editTruck.id, { ...input, ...docUpdates });
    } else {
      ok = await createTruck({ ...input, ...docUpdates } as any);
    }
    return ok;
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    await deleteTruck(deleteTarget.id);
    setDeleteTarget(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="page-header">Flota de Camiones</h1>
          <p className="page-description">Gestión y disponibilidad de vehículos</p>
        </div>
        <Button size="sm" className="gap-2" onClick={openNew}>
          <Plus className="h-4 w-4" /> Nuevo Camión
        </Button>
      </div>

      {loading ? (
        <p className="text-muted-foreground text-center py-12">Cargando camiones...</p>
      ) : trucks.length === 0 ? (
        <p className="text-muted-foreground text-center py-12">No hay camiones registrados. Crea el primero.</p>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {trucks.map(truck => (
            <Card key={truck.id} className="hover:shadow-md transition-shadow animate-fade-in">
              <CardContent className="p-3">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                      <TruckIcon className="h-4 w-4 text-primary" />
                    </div>
                    <h3 className="font-bold text-lg">Unit #{truck.unit_number}</h3>
                  </div>
                  <Select value={truck.status} onValueChange={v => updateTruck(truck.id, { status: v })}>
                    <SelectTrigger className={`w-auto h-6 text-[10px] gap-0.5 px-1.5 border-0 rounded-full ${getStatusStyle(truck.status)}`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-popover z-50">
                      {STATUS_OPTIONS.map(s => (
                        <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5 text-[15px]">
                  <Row label="Tipo" value={truck.truck_type} />
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Driver</span>
                    <span className="font-medium flex items-center gap-1">
                      {getDriverName(truck.id) ? (
                        <><User className="h-3 w-3 text-primary" />{getDriverName(truck.id)}</>
                      ) : (
                        <span className="text-muted-foreground italic">Sin asignar</span>
                      )}
                    </span>
                  </div>
                </div>

                <div className="flex gap-1.5 mt-3 pt-2 border-t">
                  <Button variant="outline" size="sm" className="flex-1 gap-1 h-7 text-xs px-1" onClick={() => setDetailTruck(truck)}>
                    <Eye className="h-3 w-3" /> Detalle
                  </Button>
                  <Button variant="outline" size="sm" className="flex-1 gap-1 h-7 text-xs px-1" onClick={() => openEdit(truck)}>
                    <Pencil className="h-3 w-3" /> Editar
                  </Button>
                  <Button variant="outline" size="sm" className="flex-1 gap-1 h-7 text-xs px-1 text-destructive hover:text-destructive" onClick={() => setDeleteTarget(truck)}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <TruckFormDialog open={dialogOpen} onOpenChange={setDialogOpen} truck={editTruck} onSave={handleSave} />
      <TruckDetailDialog open={!!detailTruck} onOpenChange={v => !v && setDetailTruck(null)} truck={detailTruck} />

      <AlertDialog open={!!deleteTarget} onOpenChange={v => !v && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar camión?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción eliminará el camión Unit #{deleteTarget?.unit_number} permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

const Row = ({ label, value }: { label: string; value: string }) => (
  <div className="flex justify-between text-[15px]">
    <span className="text-muted-foreground">{label}</span>
    <span className="font-medium">{value}</span>
  </div>
);

export default Fleet;
