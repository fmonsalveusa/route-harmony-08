import { useState } from 'react';
import { useDispatchers, DbDispatcher, DispatcherInput } from '@/hooks/useDispatchers';
import { DispatcherFormDialog } from '@/components/DispatcherFormDialog';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Plus, Phone, Mail, Percent, Pencil, Trash2 } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';

const dispatcherStatusColor = (status: string) => {
  switch (status) {
    case 'active': return 'bg-green-600';
    case 'inactive': return 'bg-red-600';
    default: return 'bg-gray-500';
  }
};

const Dispatchers = () => {
  const { dispatchers, loading, createDispatcher, updateDispatcher, deleteDispatcher } = useDispatchers();
  const [formOpen, setFormOpen] = useState(false);
  const [editingDispatcher, setEditingDispatcher] = useState<DbDispatcher | null>(null);
  const [deletingDispatcher, setDeletingDispatcher] = useState<DbDispatcher | null>(null);

  const handleSubmit = async (data: DispatcherInput) => {
    if (editingDispatcher) {
      await updateDispatcher(editingDispatcher.id, data);
    } else {
      await createDispatcher(data);
    }
    setEditingDispatcher(null);
  };

  const handleDelete = async () => {
    if (deletingDispatcher) {
      await deleteDispatcher(deletingDispatcher.id);
      setDeletingDispatcher(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="page-header">Dispatchers</h1>
          <p className="page-description">Gestión de dispatchers y comisiones</p>
        </div>
        <Button size="sm" className="gap-2" onClick={() => { setEditingDispatcher(null); setFormOpen(true); }}>
          <Plus className="h-4 w-4" /> Nuevo Dispatcher
        </Button>
      </div>

      {loading ? (
        <p className="text-muted-foreground text-sm">Cargando dispatchers...</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {dispatchers.map(d => {
            const initials = d.name.split(' ').map(n => n[0]).join('');
            return (
              <Card key={d.id} className="hover:shadow-md transition-shadow animate-fade-in">
                <CardContent className="p-5">
                  <div className="flex items-start gap-4">
                    <Avatar className="h-12 w-12">
                      <AvatarFallback className="bg-info/15 text-info font-semibold">{initials}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold truncate">{d.name}</h3>
                    </div>
                    <Select value={d.status} onValueChange={v => updateDispatcher(d.id, { status: v })}>
                      <SelectTrigger className={`w-auto h-7 text-xs font-semibold text-white border-0 rounded-full px-3 gap-1 ${dispatcherStatusColor(d.status)}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Activo</SelectItem>
                        <SelectItem value="inactive">Inactivo</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="mt-4 space-y-2 text-sm">
                    <div className="flex items-center gap-2 text-muted-foreground"><Mail className="h-3.5 w-3.5" />{d.email}</div>
                    <div className="flex items-center gap-2 text-muted-foreground"><Phone className="h-3.5 w-3.5" />{d.phone}</div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Percent className="h-3.5 w-3.5" />
                      <span>Comisión: {d.commission_percentage}%</span>
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Percent className="h-3.5 w-3.5" />
                      <span>Dispatch Service: {d.dispatch_service_percentage}%</span>
                    </div>
                  </div>

                  <div className="mt-3 pt-3 border-t flex justify-end gap-1.5">
                    <Button variant="outline" size="icon" className="h-8 w-10 border-amber-300 bg-amber-50 text-amber-600 hover:bg-amber-100 hover:text-amber-700" onClick={() => { setEditingDispatcher(d); setFormOpen(true); }} title="Editar">
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="icon" className="h-8 w-10 border-red-300 bg-red-50 text-red-600 hover:bg-red-100 hover:text-red-700" onClick={() => setDeletingDispatcher(d)} title="Eliminar">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <DispatcherFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        dispatcher={editingDispatcher}
        onSubmit={handleSubmit}
      />

      <Dialog open={!!deletingDispatcher} onOpenChange={open => !open && setDeletingDispatcher(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Eliminar dispatcher?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Esta acción eliminará permanentemente a <strong>{deletingDispatcher?.name}</strong>. No se puede deshacer.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeletingDispatcher(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleDelete}>Eliminar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Dispatchers;
