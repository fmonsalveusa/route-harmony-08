import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Wrench, Plus, RefreshCw, List, Truck, Gauge, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useTruckMaintenance, DbTruckMaintenance } from '@/hooks/useTruckMaintenance';
import { useTrucks } from '@/hooks/useTrucks';
import { useDrivers } from '@/hooks/useDrivers';
import { MaintenanceFormDialog } from '@/components/maintenance/MaintenanceFormDialog';
import { MaintenanceCard } from '@/components/maintenance/MaintenanceCard';
import { AllServicesTable } from '@/components/maintenance/AllServicesTable';
import { LogServiceDialog } from '@/components/maintenance/LogServiceDialog';
import { ServiceHistoryDialog } from '@/components/maintenance/ServiceHistoryDialog';

// Formatea cuánto hace que se leyó el odómetro: "5 min", "2 h", "3 d"
const formatOdometerAge = (iso: string): string => {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} h ago`;
  return `${Math.round(hrs / 24)} d ago`;
};

const Maintenance = () => {
  const { maintenanceItems, loading, createMaintenance, updateMaintenance, deleteMaintenance, recalculateMiles, updateTruckOdometer, logNewService } = useTruckMaintenance();
  const { trucks } = useTrucks();
  const { drivers } = useDrivers();
  const [formOpen, setFormOpen] = useState(false);
  const [editItem, setEditItem] = useState<DbTruckMaintenance | null>(null);
  const [logItem, setLogItem] = useState<DbTruckMaintenance | null>(null);
  const [historyItem, setHistoryItem] = useState<DbTruckMaintenance | null>(null);
  const [filterTruck, setFilterTruck] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [recalculating, setRecalculating] = useState(false);
  // Modal "Update Odometers": guarda { truckId: valorEscrito } mientras el usuario llena
  const [odoModalOpen, setOdoModalOpen] = useState(false);
  const [odoDrafts, setOdoDrafts] = useState<Record<string, string>>({});
  const [savingOdo, setSavingOdo] = useState(false);
  // Edición individual: qué camión se está editando inline y su valor temporal
  const [editingOdoTruck, setEditingOdoTruck] = useState<string | null>(null);
  const [editingOdoValue, setEditingOdoValue] = useState('');

  // Guarda un odómetro individual (edición inline en la tarjeta) y recalcula ese camión.
  const saveIndividualOdo = async (truckId: string) => {
    const val = Number(editingOdoValue.replace(/,/g, ''));
    const ok = await updateTruckOdometer(truckId, val);
    if (ok) {
      await recalculateMiles(truckId);
      setEditingOdoTruck(null);
      setEditingOdoValue('');
    }
  };

  // Guarda todos los odómetros escritos en el modal y recalcula los camiones tocados.
  const saveAllOdometers = async () => {
    setSavingOdo(true);
    const entries = Object.entries(odoDrafts).filter(([, v]) => v.trim() !== '');
    for (const [truckId, raw] of entries) {
      const val = Number(raw.replace(/,/g, ''));
      if (val > 0) {
        const ok = await updateTruckOdometer(truckId, val);
        if (ok) await recalculateMiles(truckId);
      }
    }
    setSavingOdo(false);
    setOdoDrafts({});
    setOdoModalOpen(false);
  };

  // Días desde la última actualización del odómetro (para el aviso de dato viejo >2 días)
  const odoAgeDays = (updatedAt: string | null): number | null => {
    if (!updatedAt) return null;
    return (Date.now() - new Date(updatedAt).getTime()) / 86400000;
  };

  // Al montar: recalcula millas de todos los camiones con el odómetro manual guardado.
  useEffect(() => {
    if (!loading && maintenanceItems.length > 0) {
      const truckIds = [...new Set(maintenanceItems.map(m => m.truck_id))];
      truckIds.forEach(id => recalculateMiles(id));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  const handleRecalcAll = async () => {
    setRecalculating(true);
    const truckIds = [...new Set(maintenanceItems.map(m => m.truck_id))];
    for (const id of truckIds) await recalculateMiles(id);
    setRecalculating(false);
  };

  const filtered = maintenanceItems.filter(m => {
    if (filterTruck !== 'all' && m.truck_id !== filterTruck) return false;
    if (filterStatus !== 'all' && m.status !== filterStatus) return false;
    return true;
  });

  // Group by truck
  const grouped = filtered.reduce<Record<string, DbTruckMaintenance[]>>((acc, m) => {
    (acc[m.truck_id] = acc[m.truck_id] || []).push(m);
    return acc;
  }, {});

  const getTruckLabel = (id: string) => {
    const t = trucks.find(t => t.id === id);
    return t ? `${t.unit_number} — ${t.make || ''} ${t.model || ''}` : id;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Wrench className="h-5 w-5 text-muted-foreground" />
          <div>
            <h1 className="text-lg font-semibold">Truck Maintenance</h1>
            <p className="text-xs text-muted-foreground">Fleet maintenance tracker</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => { setOdoDrafts({}); setOdoModalOpen(true); }}>
            <Gauge className="h-3.5 w-3.5 mr-1.5" />
            Update Odometers
          </Button>
          <Button variant="outline" size="sm" onClick={handleRecalcAll} disabled={recalculating}>
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${recalculating ? 'animate-spin' : ''}`} />
            Recalculate
          </Button>
          <Button size="sm" onClick={() => { setEditItem(null); setFormOpen(true); }}>
            <Plus className="h-3.5 w-3.5 mr-1.5" /> Add Maintenance
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="by-truck">
        <TabsList>
          <TabsTrigger value="by-truck"><Truck className="h-4 w-4" /> By Truck</TabsTrigger>
          <TabsTrigger value="all-services"><List className="h-4 w-4" /> All Services</TabsTrigger>
        </TabsList>

        {/* Filters (shared) */}
        <div className="flex gap-3 mt-4">
          <Select value={filterTruck} onValueChange={setFilterTruck}>
            <SelectTrigger className="w-48"><SelectValue placeholder="All Trucks" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Trucks</SelectItem>
              {trucks.map(t => (
                <SelectItem key={t.id} value={t.id}>{t.unit_number}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-36"><SelectValue placeholder="All Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="ok">OK</SelectItem>
              <SelectItem value="warning">Warning</SelectItem>
              <SelectItem value="due">Due</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Tab: By Truck */}
        <TabsContent value="by-truck">
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : Object.keys(grouped).length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              <Wrench className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No maintenance schedules yet. Click "Add Maintenance" to get started.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {Object.entries(grouped)
                .sort(([a], [b]) => {
                  const truckA = trucks.find(t => t.id === a);
                  const truckB = trucks.find(t => t.id === b);
                  return (truckA?.unit_number || '').localeCompare(truckB?.unit_number || '', undefined, { numeric: true });
                })
                .map(([truckId, items]) => {
                  const recurringItems = items.filter(i => i.interval_miles || i.interval_days);
                  const dueItems = recurringItems.filter(i => i.status === 'due').length;
                  const warnItems = recurringItems.filter(i => i.status === 'warning').length;
                  const truck = trucks.find(t => t.id === truckId);

                  return (
                    <motion.div
                      key={truckId}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                    >
                      {/* Truck header */}
                      <div className="flex items-center gap-2 px-3 py-2 bg-muted/40 rounded-lg mb-2">
                        <Truck className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium">{truck?.unit_number}</span>
                        <span className="text-sm text-muted-foreground">— {truck?.make || ''} {truck?.model || ''}</span>
                        {/* Odómetro manual: click para editar inline */}
                        {editingOdoTruck === truckId ? (
                          <span className="inline-flex items-center gap-1">
                            <Input
                              autoFocus
                              value={editingOdoValue}
                              onChange={(e) => setEditingOdoValue(e.target.value)}
                              onKeyDown={(e) => { if (e.key === 'Enter') saveIndividualOdo(truckId); if (e.key === 'Escape') setEditingOdoTruck(null); }}
                              placeholder="Odometer"
                              className="h-6 w-28 text-xs"
                            />
                            <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => saveIndividualOdo(truckId)}>
                              <Check className="h-3.5 w-3.5 text-[#3B6D11]" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setEditingOdoTruck(null)}>
                              <X className="h-3.5 w-3.5 text-muted-foreground" />
                            </Button>
                          </span>
                        ) : (
                          (() => {
                            const age = odoAgeDays(truck?.odometer_updated_at ?? null);
                            const stale = age != null && age > 2; // aviso si >2 días
                            const hasOdo = truck?.current_odometer != null && truck.current_odometer > 0;
                            return (
                              <button
                                onClick={() => {
                                  setEditingOdoTruck(truckId);
                                  setEditingOdoValue(hasOdo ? String(Math.round(truck!.current_odometer!)) : '');
                                }}
                                title={truck?.odometer_updated_at ? `Odometer updated ${formatOdometerAge(truck.odometer_updated_at)}` : 'No odometer yet — click to add'}
                                className={`inline-flex items-center gap-1 text-[11px] border rounded px-1.5 py-0.5 hover:bg-muted transition-colors ${
                                  stale ? 'text-[#854F0B] bg-[#FAEEDA] border-[#854F0B]/30'
                                  : hasOdo ? 'text-muted-foreground bg-background'
                                  : 'text-[#A32D2D] bg-[#FCEBEB] border-[#A32D2D]/30'
                                }`}
                              >
                                <Gauge className="h-3 w-3" />
                                {hasOdo ? `${Math.round(truck!.current_odometer!).toLocaleString()} mi` : 'Add odometer'}
                                {stale && ' · stale'}
                              </button>
                            );
                          })()
                        )}
                        <div className="ml-auto flex gap-1.5">
                          {dueItems > 0 && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-sm bg-[#FCEBEB] text-[#A32D2D]">
                              {dueItems} due
                            </span>
                          )}
                          {warnItems > 0 && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-sm bg-[#FAEEDA] text-[#854F0B]">
                              {warnItems} warning
                            </span>
                          )}
                          {dueItems === 0 && warnItems === 0 && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-sm bg-[#EAF3DE] text-[#3B6D11]">OK</span>
                          )}
                        </div>
                      </div>

                      {/* Cards grid */}
                      {recurringItems.length > 0 ? (
                        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                          {recurringItems.map(item => (
                            <MaintenanceCard
                              key={item.id}
                              item={item}
                              onEdit={() => { setEditItem(item); setFormOpen(true); }}
                              onDelete={() => deleteMaintenance(item.id)}
                              onLogService={() => setLogItem(item)}
                              onViewHistory={() => setHistoryItem(item)}
                            />
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground text-center py-3">No recurring maintenance for this truck.</p>
                      )}
                    </motion.div>
                  );
                })}
            </div>
          )}
        </TabsContent>

        {/* Tab: All Services */}
        <TabsContent value="all-services">
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : (
            <AllServicesTable
              items={filtered}
              getTruckLabel={getTruckLabel}
              onEdit={(item) => { setEditItem(item); setFormOpen(true); }}
              onDelete={(id) => deleteMaintenance(id)}
              onLogService={(item) => setLogItem(item)}
              onViewHistory={(item) => setHistoryItem(item)}
            />
          )}
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      <MaintenanceFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        trucks={trucks}
        drivers={drivers}
        editItem={editItem}
        onSubmit={async (input) => {
          if (editItem) {
            return await updateMaintenance(editItem.id, input);
          }
          return await createMaintenance(input);
        }}
      />

      {logItem && (
        <LogServiceDialog
          open={!!logItem}
          onOpenChange={(open) => { if (!open) setLogItem(null); }}
          maintenanceType={logItem.maintenance_type}
          onSubmit={(data) => logNewService(logItem.id, data)}
        />
      )}

      <ServiceHistoryDialog
        open={!!historyItem}
        onOpenChange={(open) => { if (!open) setHistoryItem(null); }}
        maintenanceId={historyItem?.id ?? null}
        maintenanceType={historyItem?.maintenance_type ?? ''}
      />

      {/* Modal: actualizar odómetros de todos los camiones de una sentada */}
      <Dialog open={odoModalOpen} onOpenChange={setOdoModalOpen}>
        <DialogContent className="sm:max-w-md max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Update Odometers</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground">
            Enter the current odometer for any truck. Leave blank to keep the current value.
          </p>
          <div className="flex-1 overflow-y-auto space-y-2 py-2">
            {[...new Set(maintenanceItems.map(m => m.truck_id))]
              .map(id => trucks.find(t => t.id === id))
              .filter(Boolean)
              .sort((a, b) => (a!.unit_number || '').localeCompare(b!.unit_number || '', undefined, { numeric: true }))
              .map((t) => {
                const age = odoAgeDays(t!.odometer_updated_at ?? null);
                const stale = age != null && age > 2;
                return (
                  <div key={t!.id} className="flex items-center gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{t!.unit_number}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {t!.current_odometer != null && t!.current_odometer > 0
                          ? `${Math.round(t!.current_odometer).toLocaleString()} mi`
                          : 'No reading yet'}
                        {t!.odometer_updated_at && ` · ${formatOdometerAge(t!.odometer_updated_at)}`}
                        {stale && ' · stale'}
                      </p>
                    </div>
                    <Input
                      value={odoDrafts[t!.id] ?? ''}
                      onChange={(e) => setOdoDrafts(prev => ({ ...prev, [t!.id]: e.target.value }))}
                      placeholder="New odometer"
                      className="h-8 w-32 text-sm"
                    />
                  </div>
                );
              })}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOdoModalOpen(false)}>Cancel</Button>
            <Button onClick={saveAllOdometers} disabled={savingOdo}>
              {savingOdo ? 'Saving…' : 'Save odometers'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Maintenance;
