import { useState, useMemo } from 'react';
import { useTrucks, DbTruck, TruckInput } from '@/hooks/useTrucks';
import { useDrivers } from '@/hooks/useDrivers';
import { StatusBadge } from '@/components/StatusBadge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { TruckFormDialog } from '@/components/TruckFormDialog';
import { TruckDetailDialog } from '@/components/TruckDetailDialog';
import { TruckDetailPanel } from '@/components/TruckDetailPanel';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Truck as TruckIcon, Pencil, Trash2, Eye, User, ChevronDown, ChevronUp, Search } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ExpiryIndicators } from '@/components/ExpiryIndicators';

const STATUS_OPTIONS = [
  { value: 'active', label: 'Active', bg: 'bg-green-600 text-white' },
  { value: 'inactive', label: 'Inactive', bg: 'bg-red-600 text-white' },
  { value: 'maintenance', label: 'Maintenance', bg: 'bg-orange-500 text-white' },
];

const PAGE_SIZES = [25, 50, 100];

const Fleet = () => {
  const { trucks, loading, createTruck, updateTruck, deleteTruck, uploadDocument, getDocSignedUrl } = useTrucks();
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
  const [searchQuery, setSearchQuery] = useState('');
  const [vinFilter, setVinFilter] = useState('all');
  const [plateFilter, setPlateFilter] = useState('all');

  // Build unique VIN and plate lists from ALL trucks (any status)
  const uniqueVins = useMemo(() => {
    const vins = trucks.map(t => t.vin).filter(Boolean) as string[];
    return [...new Set(vins)].sort();
  }, [trucks]);

  const uniquePlates = useMemo(() => {
    const plates = trucks.map(t => t.license_plate).filter(Boolean) as string[];
    return [...new Set(plates)].sort();
  }, [trucks]);

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

  const applyFilters = (list: DbTruck[]) => {
    let filtered = list;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(t =>
        t.unit_number.toLowerCase().includes(q) ||
        (t.make && t.make.toLowerCase().includes(q)) ||
        (t.model && t.model.toLowerCase().includes(q)) ||
        (t.vin && t.vin.toLowerCase().includes(q)) ||
        (t.license_plate && t.license_plate.toLowerCase().includes(q)) ||
        t.truck_type.toLowerCase().includes(q)
      );
    }
    if (vinFilter !== 'all') {
      filtered = filtered.filter(t => t.vin === vinFilter);
    }
    if (plateFilter !== 'all') {
      filtered = filtered.filter(t => t.license_plate === plateFilter);
    }
    return filtered;
  };

  const renderTrucksTable = (trucksList: DbTruck[]) => {
    const filtered = applyFilters(trucksList);
    const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
    const paged = filtered.slice((page - 1) * pageSize, page * pageSize);
    const colSpan = 9;
    return (
    <div className="glass-card overflow-hidden">
      <div className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-[15px]">
            <thead>
              <tr className="border-b glass-table-header">
                <th className="w-8 p-3"></th>
                <th className="text-left p-3 font-medium text-muted-foreground">Unit #</th>
                <th className="text-left p-3 font-medium text-muted-foreground hidden md:table-cell">Driver</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Type</th>
                <th className="text-left p-3 font-medium text-muted-foreground hidden lg:table-cell">Make / Model</th>
                <th className="text-left p-3 font-medium text-muted-foreground hidden lg:table-cell">VIN</th>
                <th className="text-left p-3 font-medium text-muted-foreground hidden md:table-cell">License Plate</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Status</th>
                <th className="text-right p-3 font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {paged.length === 0 ? (
                <tr><td colSpan={colSpan} className="text-center text-muted-foreground py-8">No trucks match the filters.</td></tr>
              ) : paged.map(truck => {
                const isExpanded = expandedId === truck.id;
                const driverName = getDriverName(truck.id);
                return (
                  <>
                    <tr key={truck.id} className={`border-b glass-row cursor-pointer ${isExpanded ? 'glass-row-expanded' : ''}`} onClick={() => setExpandedId(isExpanded ? null : truck.id)}>
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
                      <td className="p-3 hidden md:table-cell">
                        <span className="flex items-center gap-1">
                          {driverName ? (
                            <><User className="h-3 w-3 text-primary" />{driverName}</>
                          ) : (
                            <span className="text-destructive font-medium">Unassigned</span>
                          )}
                        </span>
                      </td>
                      <td className="p-3">{truck.truck_type}</td>
                      <td className="p-3 hidden lg:table-cell">
                        <span className="text-sm">{[truck.make, truck.model].filter(Boolean).join(' ') || '—'}</span>
                        {truck.year && <span className="text-xs text-muted-foreground ml-1">({truck.year})</span>}
                      </td>
                      <td className="p-3 hidden lg:table-cell">
                        <span className="text-sm font-mono">{truck.vin || '—'}</span>
                      </td>
                      <td className="p-3 hidden md:table-cell">
                        <span className="text-sm">{truck.license_plate || '—'}</span>
                      </td>
                      <td className="p-3" onClick={e => e.stopPropagation()}>
                        <Select value={truck.status} onValueChange={v => updateTruck(truck.id, { status: v })}>
                          <SelectTrigger className="h-8 w-[155px] border-0 p-0 shadow-none focus:ring-0 [&>svg]:hidden bg-transparent">
                            <span className="flex items-center justify-between w-full gap-1">
                              <StatusBadge status={truck.status} className="text-[11px] px-3 py-1.5" />
                              <span className="inline-flex h-5 w-5 items-center justify-center rounded border border-border bg-muted/40 text-muted-foreground ml-auto">
                                <ChevronDown className="h-3 w-3 shrink-0" />
                              </span>
                            </span>
                          </SelectTrigger>
                          <SelectContent className="bg-popover z-50">
                            {STATUS_OPTIONS.map(s => (
                              <SelectItem key={s.value} value={s.value}><StatusBadge status={s.value} /></SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="p-3" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1.5">
                          <button className="glass-action-btn tint-green inline-flex items-center" onClick={() => setDetailTruck(truck)} title="Detail">
                            <Eye className="h-4 w-4" /> Detail
                          </button>
                          <button className="glass-action-btn tint-amber inline-flex items-center" onClick={() => openEdit(truck)} title="Edit">
                            <Pencil className="h-4 w-4" /> Edit
                          </button>
                          <button className="glass-action-btn tint-red inline-flex items-center" onClick={async () => { if (window.confirm(`Delete truck Unit #${truck.unit_number}? This action is permanent.`)) { await deleteTruck(truck.id); } }} title="Delete">
                            <Trash2 className="h-4 w-4" /> Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr key={`${truck.id}-detail`}>
                        <td colSpan={colSpan} className="p-0">
                          <TruckDetailPanel truck={truck} driverName={driverName} getDocSignedUrl={getDocSignedUrl} />
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
            {filtered.length} trucks
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
      </div>
    </div>
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

      {/* Search & Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search unit, make, model, VIN..."
            value={searchQuery}
            onChange={e => { setSearchQuery(e.target.value); setPage(1); }}
            className="pl-9 h-9"
          />
        </div>
        <Select value={vinFilter} onValueChange={v => { setVinFilter(v); setPage(1); }}>
          <SelectTrigger className="h-9 w-full sm:w-52">
            <SelectValue placeholder="Filter by VIN" />
          </SelectTrigger>
          <SelectContent className="max-h-60">
            <SelectItem value="all">All VINs</SelectItem>
            {uniqueVins.map(vin => (
              <SelectItem key={vin} value={vin}>
                <span className="font-mono text-xs">{vin}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={plateFilter} onValueChange={v => { setPlateFilter(v); setPage(1); }}>
          <SelectTrigger className="h-9 w-full sm:w-44">
            <SelectValue placeholder="Filter by Plate" />
          </SelectTrigger>
          <SelectContent className="max-h-60">
            <SelectItem value="all">All Plates</SelectItem>
            {uniquePlates.map(plate => (
              <SelectItem key={plate} value={plate}>{plate}</SelectItem>
            ))}
          </SelectContent>
        </Select>
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
              {getFilteredByTab(tab).length === 0 && !searchQuery && vinFilter === 'all' && plateFilter === 'all' ? (
                <p className="text-muted-foreground text-center py-12">No trucks found.</p>
              ) : (
                renderTrucksTable(getFilteredByTab(tab))
              )}
            </TabsContent>
          ))}
        </Tabs>
      )}

      <TruckFormDialog open={dialogOpen} onOpenChange={setDialogOpen} truck={editTruck} onSave={handleSave} />
      <TruckDetailDialog open={!!detailTruck} onOpenChange={v => !v && setDetailTruck(null)} truck={detailTruck} getDocSignedUrl={getDocSignedUrl} />
    </div>
  );
};

export default Fleet;
