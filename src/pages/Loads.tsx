import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { mockDrivers, mockDispatchers } from '@/data/mockData';
import { StatusBadge } from '@/components/StatusBadge';
import { useLoads } from '@/hooks/useLoads';
import { LoadFormDialog } from '@/components/LoadFormDialog';
import { LoadDetailPanel } from '@/components/LoadDetailPanel';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Plus, Search, Filter, Package, Pencil, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import type { DbLoad } from '@/hooks/useLoads';

const Loads = () => {
  const { user } = useAuth();
  const { loads: dbLoads, loading: loadsLoading, createLoad, updateLoad, deleteLoad } = useLoads();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showForm, setShowForm] = useState(false);
  const [editLoad, setEditLoad] = useState<DbLoad | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DbLoad | null>(null);

  const isDispatcher = user?.role === 'dispatcher';
  let loads = isDispatcher
    ? dbLoads.filter(l => l.dispatcher_id === (user?.dispatcherId || 'd1'))
    : dbLoads;

  if (statusFilter !== 'all') loads = loads.filter(l => l.status === statusFilter);
  if (search) loads = loads.filter(l =>
    l.reference_number.toLowerCase().includes(search.toLowerCase()) ||
    l.origin.toLowerCase().includes(search.toLowerCase()) ||
    l.destination.toLowerCase().includes(search.toLowerCase()) ||
    (l.broker_client || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="page-header">Gestión de Cargas</h1>
          <p className="page-description">Administra todas las cargas y asignaciones</p>
        </div>
        <Button size="sm" className="gap-2" onClick={() => { setEditLoad(null); setShowForm(true); }}>
          <Plus className="h-4 w-4" /> Nueva Carga
        </Button>
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
            <SelectItem value="planned">Planned</SelectItem>
            <SelectItem value="dispatched">Dispatched</SelectItem>
            <SelectItem value="in_transit">In Transit</SelectItem>
            <SelectItem value="delivered">Delivered</SelectItem>
            <SelectItem value="tonu">TONU</SelectItem>
            <SelectItem value="cancelled">Canceled</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b bg-muted/50">
                <th className="w-8 p-3"></th>
                <th className="text-left p-3 font-medium text-muted-foreground">Load #</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Broker</th>
                <th className="text-left p-3 font-medium text-muted-foreground hidden md:table-cell">Driver/Truck</th>
                <th className="text-left p-3 font-medium text-muted-foreground hidden md:table-cell">Origin</th>
                <th className="text-left p-3 font-medium text-muted-foreground hidden md:table-cell">Destination</th>
                <th className="text-left p-3 font-medium text-muted-foreground hidden lg:table-cell">Pickup</th>
                <th className="text-left p-3 font-medium text-muted-foreground hidden lg:table-cell">Delivery</th>
                <th className="text-right p-3 font-medium text-muted-foreground">Rate</th>
                <th className="text-right p-3 font-medium text-muted-foreground hidden md:table-cell">Miles</th>
                <th className="text-right p-3 font-medium text-muted-foreground hidden md:table-cell">RPM</th>
                <th className="text-left p-3 font-medium text-muted-foreground hidden lg:table-cell">Dispatcher</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Status</th>
                <th className="text-left p-3 font-medium text-muted-foreground hidden lg:table-cell">Delivered</th>
                <th className="text-left p-3 font-medium text-muted-foreground hidden lg:table-cell">Factoring</th>
                <th className="text-right p-3 font-medium text-muted-foreground">Acciones</th>
              </tr></thead>
              <tbody>
                {loads.map(load => {
                  const driver = mockDrivers.find(d => d.id === load.driver_id);
                  const dispatcher = mockDispatchers.find(d => d.id === load.dispatcher_id);
                  const isExpanded = expandedId === load.id;
                  return (
                    <>
                      <tr
                        key={load.id}
                        className={`border-b last:border-0 hover:bg-muted/30 cursor-pointer transition-colors ${isExpanded ? 'bg-muted/20' : ''}`}
                        onClick={() => setExpandedId(isExpanded ? null : load.id)}
                      >
                        <td className="p-3 text-muted-foreground">
                          {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </td>
                        <td className="p-3 font-medium text-primary">{load.reference_number}</td>
                        <td className="p-3 text-foreground">{load.broker_client || '—'}</td>
                        <td className="p-3 hidden md:table-cell">
                          <div className="text-foreground">{driver?.name || <span className="text-muted-foreground italic">Sin asignar</span>}</div>
                          <div className="text-muted-foreground text-xs">{load.truck_id || '—'}</div>
                        </td>
                        <td className="p-3 hidden md:table-cell text-foreground">{load.origin}</td>
                        <td className="p-3 hidden md:table-cell text-foreground">{load.destination}</td>
                        <td className="p-3 hidden lg:table-cell text-muted-foreground">{load.pickup_date || '—'}</td>
                        <td className="p-3 hidden lg:table-cell text-muted-foreground">{load.delivery_date || '—'}</td>
                        <td className="p-3 text-right font-semibold">${Number(load.total_rate).toLocaleString()}</td>
                        <td className="p-3 text-right hidden md:table-cell text-muted-foreground">{Number(load.miles || 0).toLocaleString()}</td>
                        <td className="p-3 text-right hidden md:table-cell text-muted-foreground">
                          {load.miles && load.miles > 0 ? `$${(Number(load.total_rate) / Number(load.miles)).toFixed(2)}` : '—'}
                        </td>
                        <td className="p-3 hidden lg:table-cell">{dispatcher?.name || '—'}</td>
                        <td className="p-3" onClick={e => e.stopPropagation()}>
                          <Select value={load.status} onValueChange={async (val) => {
                            const updates: any = { status: val };
                            if (val === 'delivered' && !load.delivery_date) {
                              updates.delivery_date = new Date().toISOString().split('T')[0];
                            }
                            await updateLoad(load.id, updates);
                          }}>
                            <SelectTrigger className="h-7 w-[130px] border-0 p-0 shadow-none focus:ring-0 [&>svg]:ml-1">
                              <StatusBadge status={load.status} />
                            </SelectTrigger>
                            <SelectContent>
                              {[
                                { value: 'planned', label: 'Planned' },
                                { value: 'dispatched', label: 'Dispatched' },
                                { value: 'in_transit', label: 'In Transit' },
                                { value: 'delivered', label: 'Delivered' },
                                { value: 'tonu', label: 'TONU' },
                                { value: 'cancelled', label: 'Canceled' },
                              ].map(s => (
                                <SelectItem key={s.value} value={s.value}>
                                  <StatusBadge status={s.value} />
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="p-3 hidden lg:table-cell text-muted-foreground">
                          {load.status === 'delivered' ? (load.delivery_date || '—') : '—'}
                        </td>
                        <td className="p-3 hidden lg:table-cell" onClick={e => e.stopPropagation()}>
                          <Select value={load.factoring || ''} onValueChange={async (val) => {
                            await updateLoad(load.id, { factoring: val });
                          }}>
                            <SelectTrigger className="h-7 w-[120px] border-0 p-0 shadow-none focus:ring-0 [&>svg]:ml-1">
                              {load.factoring ? <StatusBadge status={`${load.factoring}_factoring`} /> : <span className="text-muted-foreground">—</span>}
                            </SelectTrigger>
                            <SelectContent>
                              {[
                                { value: 'pending', label: 'Pending' },
                                { value: 'in_progress', label: 'In Progress' },
                                { value: 'ready', label: 'Ready' },
                              ].map(s => (
                                <SelectItem key={s.value} value={s.value}>
                                  <StatusBadge status={`${s.value}_factoring`} />
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="p-3 text-right" onClick={e => e.stopPropagation()}>
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditLoad(load); setShowForm(true); }}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => setDeleteTarget(load)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr key={`${load.id}-detail`}>
                          <td colSpan={16} className="p-0">
                            <LoadDetailPanel
                              load={load}
                              onMilesCalculated={async (loadId, miles) => {
                                await updateLoad(loadId, { miles });
                              }}
                            />
                          </td>
                        </tr>
                      )}
                    </>
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

      {/* Form Dialog */}
      <LoadFormDialog
        open={showForm}
        onOpenChange={(open) => { setShowForm(open); if (!open) setEditLoad(null); }}
        editLoad={editLoad}
        dispatcherId={user?.dispatcherId || 'd1'}
        onSubmit={async (input) => {
          if (editLoad) {
            await updateLoad(editLoad.id, input);
          } else {
            await createLoad(input);
          }
        }}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar carga?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción eliminará la carga <strong>{deleteTarget?.reference_number}</strong> permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={async () => {
              if (deleteTarget) await deleteLoad(deleteTarget.id);
              setDeleteTarget(null);
            }}>Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Loads;
