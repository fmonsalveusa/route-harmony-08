import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Wrench, Plus, AlertTriangle, CheckCircle, Clock, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useTruckMaintenance, DbTruckMaintenance } from '@/hooks/useTruckMaintenance';
import { useTrucks } from '@/hooks/useTrucks';
import { MaintenanceFormDialog } from '@/components/maintenance/MaintenanceFormDialog';
import { MaintenanceCard } from '@/components/maintenance/MaintenanceCard';
import { LogServiceDialog } from '@/components/maintenance/LogServiceDialog';
import { StatCard } from '@/components/StatCard';

const Maintenance = () => {
  const { maintenanceItems, loading, createMaintenance, updateMaintenance, deleteMaintenance, recalculateMiles, logNewService } = useTruckMaintenance();
  const { trucks } = useTrucks();
  const [formOpen, setFormOpen] = useState(false);
  const [editItem, setEditItem] = useState<DbTruckMaintenance | null>(null);
  const [logItem, setLogItem] = useState<DbTruckMaintenance | null>(null);
  const [filterTruck, setFilterTruck] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [recalculating, setRecalculating] = useState(false);

  // Recalculate miles on mount for all trucks that have maintenance
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

  const totalSchedules = maintenanceItems.length;
  const warningCount = maintenanceItems.filter(m => m.status === 'warning').length;
  const dueCount = maintenanceItems.filter(m => m.status === 'due').length;

  const getTruckLabel = (id: string) => {
    const t = trucks.find(t => t.id === id);
    return t ? `${t.unit_number} — ${t.make || ''} ${t.model || ''}` : id;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Wrench className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Truck Maintenance</h1>
            <p className="text-sm text-muted-foreground">Track and schedule maintenance for your fleet</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleRecalcAll} disabled={recalculating}>
            <RefreshCw className={`h-4 w-4 mr-1 ${recalculating ? 'animate-spin' : ''}`} />
            Recalculate
          </Button>
          <Button onClick={() => { setEditItem(null); setFormOpen(true); }}>
            <Plus className="h-4 w-4 mr-1" /> Add Maintenance
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard title="Total Schedules" value={totalSchedules} icon={CheckCircle} />
        <StatCard title="Approaching Due" value={warningCount} icon={Clock} iconClassName="bg-amber-500/10 text-amber-500" />
        <StatCard title="Overdue" value={dueCount} icon={AlertTriangle} iconClassName="bg-destructive/10 text-destructive" />
      </div>

      {/* Filters */}
      <div className="flex gap-3">
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

      {/* Grouped Cards */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      ) : Object.keys(grouped).length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Wrench className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p>No maintenance schedules yet. Click "Add Maintenance" to get started.</p>
          </CardContent>
        </Card>
      ) : (
        Object.entries(grouped).map(([truckId, items]) => (
          <motion.div
            key={truckId}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Card>
              <div className="px-5 py-3 border-b bg-muted/30">
                <h3 className="font-semibold text-sm">{getTruckLabel(truckId)}</h3>
              </div>
              <CardContent className="p-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {items.map(item => (
                  <MaintenanceCard
                    key={item.id}
                    item={item}
                    onEdit={() => { setEditItem(item); setFormOpen(true); }}
                    onDelete={() => deleteMaintenance(item.id)}
                    onLogService={() => setLogItem(item)}
                  />
                ))}
              </CardContent>
            </Card>
          </motion.div>
        ))
      )}

      {/* Dialogs */}
      <MaintenanceFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        trucks={trucks}
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
    </div>
  );
};

export default Maintenance;
