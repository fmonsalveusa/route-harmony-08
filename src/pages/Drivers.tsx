import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { StatusBadge } from '@/components/StatusBadge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Plus, Search, Phone, Truck as TruckIcon, Pencil, Trash2, Eye, Copy, Link2, ChevronDown, ChevronUp, Navigation, FileText } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useDrivers, DbDriver, DriverInput } from '@/hooks/useDrivers';
import { useTrucks } from '@/hooks/useTrucks';
import { useDispatchers } from '@/hooks/useDispatchers';
import { DriverFormDialog } from '@/components/DriverFormDialog';
import { DriverDetailDialog } from '@/components/DriverDetailDialog';
import { DriverDetailPanel } from '@/components/DriverDetailPanel';
import { GenerateOnboardingLinkDialog } from '@/components/GenerateOnboardingLinkDialog';
import { TerminationLetterDialog } from '@/components/TerminationLetterDialog';
import { toast } from '@/hooks/use-toast';
import { ExpiryIndicators } from '@/components/ExpiryIndicators';
import { supabase } from '@/integrations/supabase/client';

const driverStatusColor = (status: string) => {
  switch (status) {
    case 'available': return 'bg-green-600';
    case 'assigned': return 'bg-blue-600';
    case 'resting': return 'bg-orange-500';
    case 'inactive': return 'bg-red-600';
    case 'pending': return 'bg-yellow-500';
    default: return 'bg-gray-500';
  }
};

const PAGE_SIZES = [25, 50, 100];

const Drivers = () => {
  const { role, profile } = useAuth();
  const { drivers, loading, createDriver, updateDriver, deleteDriver, uploadDocument, getDocSignedUrl } = useDrivers();
  const { trucks } = useTrucks();
  const { dispatchers } = useDispatchers();
  const [search, setSearch] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editingDriver, setEditingDriver] = useState<DbDriver | null>(null);
  const [deletingDriver, setDeletingDriver] = useState<DbDriver | null>(null);
  const [detailDriver, setDetailDriver] = useState<DbDriver | null>(null);
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('active');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [dispatcherFilter, setDispatcherFilter] = useState<string>('all');
  const [activeDriverIds, setActiveDriverIds] = useState<Set<string>>(new Set());
  const [terminationDriver, setTerminationDriver] = useState<DbDriver | null>(null);
  const [tenantName, setTenantName] = useState('');

  // Fetch tenant name for termination letter
  useEffect(() => {
    const fetchTenant = async () => {
      const { data } = await supabase.from('tenants').select('name').limit(1).single();
      if (data) setTenantName((data as any).name);
    };
    fetchTenant();
  }, []);

  // Fetch driver_locations for GPS active indicator
  useEffect(() => {
    const fetchLocations = async () => {
      const { data } = await supabase.from('driver_locations').select('driver_id, updated_at');
      if (data) {
        const now = Date.now();
        const active = new Set(
          (data as any[]).filter(d => now - new Date(d.updated_at).getTime() < 5 * 60 * 1000).map(d => d.driver_id)
        );
        setActiveDriverIds(active);
      }
    };
    fetchLocations();

    const channel = supabase
      .channel('drivers-page-locations')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'driver_locations' }, () => {
        fetchLocations();
      })
      .subscribe();

    // Refresh every 60s to re-evaluate the 5-min window
    const interval = setInterval(fetchLocations, 60000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, []);

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
    toast({ title: 'Copied to clipboard' });
  };

  const isDispatcher = role === 'dispatcher';
  let filtered = drivers;

  if (dispatcherFilter && dispatcherFilter !== 'all') {
    filtered = filtered.filter(d => d.dispatcher_id === dispatcherFilter);
  }

  if (search) filtered = filtered.filter(d =>
    d.name.toLowerCase().includes(search.toLowerCase()) ||
    d.email.toLowerCase().includes(search.toLowerCase())
  );

  const getFilteredByTab = (tab: string) => {
    if (tab === 'active') return filtered.filter(d => d.status !== 'inactive');
    if (tab === 'inactive') return filtered.filter(d => d.status === 'inactive');
    return filtered;
  };

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

  const renderDriversTable = (driversList: DbDriver[]) => {
    const totalPages = Math.max(1, Math.ceil(driversList.length / pageSize));
    const paged = driversList.slice((page - 1) * pageSize, page * pageSize);
    return (
    <div className="glass-card">
      <div className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-[15px]">
            <thead>
              <tr className="border-b glass-table-header">
                <th className="w-8 p-3"></th>
                <th className="text-left p-3 font-medium text-muted-foreground">Driver</th>
                <th className="w-[60px] p-3"></th>
                <th className="text-left p-3 font-medium text-muted-foreground">Phone</th>
                <th className="text-left p-3 font-medium text-muted-foreground hidden md:table-cell">Truck</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Status</th>
                <th className="text-right p-3 font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {paged.map(driver => {
                const truckLabel = getTruckLabel(driver.truck_id);
                const initials = driver.name.split(' ').map(n => n[0]).join('');
                const isExpanded = expandedId === driver.id;
                const dispatcher = dispatchers.find(d => d.id === driver.dispatcher_id);
                return (
                  <>{/* Fragment needed for expand row */}
                    <tr key={driver.id} className={cn("border-b glass-row cursor-pointer", driver.status === 'pending' && "bg-yellow-50/50", isExpanded && "glass-row-expanded")} onClick={() => setExpandedId(isExpanded ? null : driver.id)}>
                      <td className="p-3 text-muted-foreground">
                        {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-9 w-9">
                            <AvatarFallback className="bg-primary/10 text-primary font-semibold text-sm">{initials}</AvatarFallback>
                          </Avatar>
                          <div className="flex flex-col items-start">
                            <span className="font-semibold flex items-center gap-1.5">
                              {driver.name}
                              {activeDriverIds.has(driver.id) && (
                                <Navigation className="h-3.5 w-3.5 text-[hsl(152,60%,40%)] animate-pulse" />
                              )}
                            </span>
                            <ExpiryIndicators items={[
                              { date: driver.license_expiry, label: 'License' },
                              { date: driver.medical_card_expiry, label: 'Medical' },
                            ]} />
                          </div>
                        </div>
                      </td>
                      <td className="p-3 pl-0" onClick={e => e.stopPropagation()}>
                        <Button variant="ghost" size="sm" className="glass-action-btn tint-blue" onClick={() => copyDriverInfo(driver)} title="Copy">
                          <Copy className="h-3 w-3" /> Copy
                        </Button>
                      </td>
                      <td className="p-3 text-muted-foreground">
                        <div className="flex items-center gap-1.5">
                          <Phone className="h-3.5 w-3.5" />{driver.phone}
                        </div>
                      </td>
                      <td className="p-3 hidden md:table-cell">
                        <div className="flex items-center gap-1.5">
                          <TruckIcon className="h-3.5 w-3.5 text-primary" />
                          <span>{truckLabel || <span className="text-muted-foreground italic">Unassigned</span>}</span>
                        </div>
                      </td>
                      <td className="p-3" onClick={e => e.stopPropagation()}>
                        <Select value={driver.status} onValueChange={v => updateDriver(driver.id, { status: v })}>
                          <SelectTrigger className="h-8 w-[155px] border-0 p-0 shadow-none focus:ring-0 [&>svg]:hidden bg-transparent">
                            <span className="flex items-center justify-between w-full gap-1">
                              <StatusBadge status={driver.status} className="text-[11px] px-3 py-1.5" />
                              <span className="inline-flex h-5 w-5 items-center justify-center rounded border border-border bg-muted/40 text-muted-foreground ml-auto">
                                <ChevronDown className="h-3 w-3 shrink-0" />
                              </span>
                            </span>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pending"><StatusBadge status="pending" /></SelectItem>
                            <SelectItem value="available"><StatusBadge status="available" /></SelectItem>
                            <SelectItem value="assigned"><StatusBadge status="assigned" /></SelectItem>
                            <SelectItem value="resting"><StatusBadge status="resting" /></SelectItem>
                            <SelectItem value="inactive"><StatusBadge status="inactive" /></SelectItem>
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="p-3" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1.5">
                          <Button variant="ghost" size="sm" className="glass-action-btn tint-green" onClick={() => setDetailDriver(driver)} title="Detail">
                            <Eye className="h-4 w-4" /> Detail
                          </Button>
                          {!isDispatcher && (
                            <>
                              <Button variant="ghost" size="sm" className="glass-action-btn tint-amber" onClick={() => { setEditingDriver(driver); setFormOpen(true); }} title="Edit">
                                <Pencil className="h-4 w-4" /> Edit
                              </Button>
                              <Button variant="ghost" size="sm" className="glass-action-btn" onClick={() => setTerminationDriver(driver)} title="Termination Letter">
                                <FileText className="h-4 w-4" /> Termination
                              </Button>
                              <Button variant="ghost" size="sm" className="glass-action-btn tint-red" onClick={async () => { if (window.confirm(`Delete driver ${driver.name}? This action is permanent.`)) { await deleteDriver(driver.id); } }} title="Delete">
                                <Trash2 className="h-4 w-4" /> Delete
                              </Button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr key={`${driver.id}-detail`}>
                        <td colSpan={7} className="p-0">
                          <DriverDetailPanel driver={driver} truckLabel={truckLabel} dispatcherName={dispatcher?.name || null} getDocSignedUrl={getDocSignedUrl} truck={getTruck(driver.truck_id)} />
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
            {driversList.length} drivers
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
          <div className="flex items-center gap-3">
            <h1 className="page-header">Drivers</h1>
            {(() => {
              const pendingCount = drivers.filter(d => d.status === 'pending').length;
              return pendingCount > 0 ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-yellow-100 text-yellow-800 text-sm font-semibold border border-yellow-300 animate-fade-in">
                  <span className="h-2 w-2 rounded-full bg-yellow-500 animate-pulse" />
                  {pendingCount} pending
                </span>
              ) : null;
            })()}
          </div>
          <p className="page-description">{isDispatcher ? 'Drivers under your management' : 'Complete driver management'}</p>
        </div>
        {!isDispatcher && (
           <div className="flex gap-2">
            <Button size="sm" variant="outline" className="gap-2" onClick={() => setOnboardingOpen(true)}>
              <Link2 className="h-4 w-4" /> Onboarding Link
            </Button>
            <Button size="sm" className="gap-2" onClick={() => { setEditingDriver(null); setFormOpen(true); }}>
              <Plus className="h-4 w-4" /> New Driver
            </Button>
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative w-[260px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search by name or email..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-8 text-xs" />
        </div>
        {!isDispatcher && (
          <Select value={dispatcherFilter} onValueChange={v => { setDispatcherFilter(v); setPage(1); }}>
            <SelectTrigger className="w-[180px] h-8 text-xs">
              <SelectValue placeholder="All Dispatchers" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Dispatchers</SelectItem>
              {dispatchers.map(d => (
                <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {loading ? (
        <p className="text-muted-foreground text-sm">Loading drivers...</p>
      ) : (
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="active" onClick={() => setPage(1)}>Active <span className={`text-xs rounded-full px-2 py-0.5 font-semibold ${activeTab === 'active' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>{filtered.filter(d => d.status !== 'inactive').length}</span></TabsTrigger>
            <TabsTrigger value="inactive" onClick={() => setPage(1)}>Inactive <span className={`text-xs rounded-full px-2 py-0.5 font-semibold ${activeTab === 'inactive' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>{filtered.filter(d => d.status === 'inactive').length}</span></TabsTrigger>
            <TabsTrigger value="all" onClick={() => setPage(1)}>All <span className={`text-xs rounded-full px-2 py-0.5 font-semibold ${activeTab === 'all' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>{filtered.length}</span></TabsTrigger>
          </TabsList>
          {['active', 'inactive', 'all'].map(tab => (
            <TabsContent key={tab} value={tab}>
              {getFilteredByTab(tab).length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No drivers found.</p>
              ) : (
                renderDriversTable(getFilteredByTab(tab))
              )}
            </TabsContent>
          ))}
        </Tabs>
      )}

      <DriverFormDialog open={formOpen} onOpenChange={setFormOpen} driver={editingDriver} onSubmit={handleSubmit} trucks={trucks} dispatchers={dispatchers} />
      <DriverDetailDialog open={!!detailDriver} onOpenChange={open => !open && setDetailDriver(null)} driver={detailDriver} truckLabel={detailDriver ? getTruckLabel(detailDriver.truck_id) : null} dispatcherName={detailDriver ? dispatchers.find(d => d.id === detailDriver.dispatcher_id)?.name || null : null} getDocSignedUrl={getDocSignedUrl} />
      <GenerateOnboardingLinkDialog open={onboardingOpen} onOpenChange={setOnboardingOpen} dispatchers={dispatchers} />
      <TerminationLetterDialog
        open={!!terminationDriver}
        onOpenChange={open => !open && setTerminationDriver(null)}
        driver={terminationDriver}
        truck={terminationDriver ? getTruck(terminationDriver.truck_id) : null}
        companyName={tenantName}
        onSuccess={() => { setTerminationDriver(null); }}
      />
    </div>
  );
};

export default Drivers;
