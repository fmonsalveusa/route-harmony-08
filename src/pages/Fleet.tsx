import { useState } from 'react';
import { useTrucks, DbTruck, TruckInput } from '@/hooks/useTrucks';
import { useDrivers } from '@/hooks/useDrivers';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { TruckFormDialog } from '@/components/TruckFormDialog';
import { TruckDetailDialog } from '@/components/TruckDetailDialog';
import { TruckDetailPanel } from '@/components/TruckDetailPanel';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, Truck as TruckIcon, Pencil, Trash2, Eye, User, ChevronDown, ChevronUp } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ExpiryIndicators } from '@/components/ExpiryIndicators';

const STATUS_OPTIONS = [
  { value: 'active', label: 'Active', bg: 'bg-green-600 text-white' },
  { value: 'inactive', label: 'Inactive', bg: 'bg-red-600 text-white' },
  { value: 'maintenance', label: 'Maintenance', bg: 'bg-orange-500 text-white' },
];

const getStatusStyle = (status: string) =>
  STATUS_OPTIONS.find(s => s.value === status)?.bg || '';

const PAGE_SIZES = [25, 50, 100];

const Fleet = () => {
  const { trucks, loading, createTruck, updateTruck, deleteTruck, uploadDocument } = useTrucks();
  const { drivers } = useDrivers();
  const getDriverName = (truckId: string) => {
    const d = drivers.find(d => d.truck_id === truckId);
    return d?.name || null;
  };
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTruck, setEditTruck] = useState<DbTruck | null>(null);
  const [detailTruck, setDetailTruck] = useState<DbTruck | null>(null);
  const [activeTab, setActiveTab] = useState('active');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const openNew = () => { setEditTruck(null); setDialogOpen(true); };
  const openEdit = (t: DbTruck) => { setEditTruck(t); setDialogOpen(true); };

  const handleSave = async (input: TruckInput, files: Record<string, File>) => {
    let ok: boolean;
    const truckId = editTruck?.id || crypto.randomUUID();
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

  const getFilteredByTab = (tab: string) => {
    if (tab === 'active') return trucks.filter(t => t.status !== 'inactive');
    if (tab === 'inactive') return trucks.filter(t => t.status === 'inactive');
    return trucks;
  };

  const renderTrucksTable = (trucksList: DbTruck[]) => {
    const totalPages = Math.max(1, Math.ceil(trucksList.length / pageSize));
    const paged = trucksList.slice((page - 1) * pageSize, page * pageSize);
    return (
    <Card>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-[15px]">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="w-8 p-3"></th>
                <th className="text-left p-3 font-medium text-muted-foreground">Unit #</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Type</th>
                <th className="text-left p-3 font-medium text-muted-foreground hidden md:table-cell">Driver</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Status</th>
                <th className="text-right p-3 font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {paged.map(truck => {
                const isExpanded = expandedId === truck.id;
                const driverName = getDriverName(truck.id);
                return (
                  <>
                    <tr key={truck.id} className={`border-b hover:bg-muted/30 cursor-pointer transition-colors ${isExpanded ? 'bg-muted/20' : ''}`} onClick={() => setExpandedId(isExpanded ? null : truck.id)}>
                      <td className="p-3 text-muted-foreground">
                        {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                            <TruckIcon className="h-4 w-4 text-primary" />
                          </div>
                          <div className="flex flex-col">
                            <span className="font-bold text-base">#{truck.unit_number}</span>
                            <ExpiryIndicators items={[
                              { date: truck.registration_expiry, label: 'Registration' },
                              { date: truck.insurance_expiry, label: 'Insurance' },
                            ]} />
                          </div>
                        </div>
                      </td>
                      <td className="p-3">{truck.truck_type}</td>
                      <td className="p-3 hidden md:table-cell">
                        <span className="flex items-center gap-1">
                          {driverName ? (
                            <><User className="h-3 w-3 text-primary" />{driverName}</>
                          ) : (
                            <span className="text-muted-foreground italic">Unassigned</span>
                          )}
                        </span>
                      </td>
                      <td className="p-3" onClick={e => e.stopPropagation()}>
                        <Select value={truck.status} onValueChange={v => updateTruck(truck.id, { status: v })}>
                          <SelectTrigger className={`w-auto h-7 text-xs gap-1 px-2.5 border-0 rounded-full ${getStatusStyle(truck.status)}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-popover z-50">
                            {STATUS_OPTIONS.map(s => (
                              <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="p-3" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1.5">
                          <Button variant="outline" size="sm" className="h-8 px-2 text-xs border-emerald-400 bg-white text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700 gap-1" onClick={() => setDetailTruck(truck)} title="Detail">
                            <Eye className="h-4 w-4" /> Detail
                          </Button>
                          <Button variant="outline" size="sm" className="h-8 px-2 text-xs border-amber-400 bg-white text-amber-600 hover:bg-amber-50 hover:text-amber-700 gap-1" onClick={() => openEdit(truck)} title="Edit">
                            <Pencil className="h-4 w-4" /> Edit
                          </Button>
                          <Button variant="outline" size="sm" className="h-8 px-2 text-xs border-red-400 bg-white text-red-600 hover:bg-red-50 hover:text-red-700 gap-1" onClick={async () => { if (window.confirm(`Delete truck Unit #${truck.unit_number}? This action is permanent.`)) { await deleteTruck(truck.id); } }} title="Delete">
                            <Trash2 className="h-4 w-4" /> Delete
                          </Button>
                        </div>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr key={`${truck.id}-detail`}>
                        <td colSpan={6} className="p-0">
                          <TruckDetailPanel truck={truck} driverName={driverName} />
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-4 border-t">
          <div className="text-sm text-muted-foreground">
            {trucksList.length} trucks
          </div>
          <div className="flex items-center gap-3 mt-2 sm:mt-0">
            <Select value={String(pageSize)} onValueChange={v => { setPageSize(Number(v)); setPage(1); }}>
              <SelectTrigger className="w-[80px] h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {PAGE_SIZES.map(s => <SelectItem key={s} value={String(s)}>{s}/page</SelectItem>)}
              </SelectContent>
            </Select>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="sm" className="h-8" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Prev</Button>
              <span className="text-sm px-2">{page}/{totalPages}</span>
              <Button variant="outline" size="sm" className="h-8" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Next</Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="page-header">Truck Fleet</h1>
          <p className="page-description">Vehicle management and availability</p>
        </div>
        <Button size="sm" className="gap-2" onClick={openNew}>
          <Plus className="h-4 w-4" /> New Truck
        </Button>
      </div>

      {loading ? (
        <p className="text-muted-foreground text-center py-12">Loading trucks...</p>
      ) : (
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="active" onClick={() => setPage(1)}>Active <span className={`text-xs rounded-full px-2 py-0.5 font-semibold ${activeTab === 'active' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>{trucks.filter(t => t.status !== 'inactive').length}</span></TabsTrigger>
            <TabsTrigger value="inactive" onClick={() => setPage(1)}>Inactive <span className={`text-xs rounded-full px-2 py-0.5 font-semibold ${activeTab === 'inactive' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>{trucks.filter(t => t.status === 'inactive').length}</span></TabsTrigger>
            <TabsTrigger value="all" onClick={() => setPage(1)}>All <span className={`text-xs rounded-full px-2 py-0.5 font-semibold ${activeTab === 'all' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>{trucks.length}</span></TabsTrigger>
          </TabsList>
          {['active', 'inactive', 'all'].map(tab => (
            <TabsContent key={tab} value={tab}>
              {getFilteredByTab(tab).length === 0 ? (
                <p className="text-muted-foreground text-center py-12">No trucks found.</p>
              ) : (
                renderTrucksTable(getFilteredByTab(tab))
              )}
            </TabsContent>
          ))}
        </Tabs>
      )}

      <TruckFormDialog open={dialogOpen} onOpenChange={setDialogOpen} truck={editTruck} onSave={handleSave} />
      <TruckDetailDialog open={!!detailTruck} onOpenChange={v => !v && setDetailTruck(null)} truck={detailTruck} />
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
