import { useState, useEffect, useMemo } from 'react';
import { ServiceTypeBadge } from '@/components/ServiceTypeBadge';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useDispatcherDriverIds } from '@/hooks/useDispatcherDriverIds';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Plus, Search, Phone, Truck as TruckIcon, Pencil, Trash2, Eye, Copy, Link2, ChevronDown, ChevronUp, Navigation, FileText, Check, Users, UserCheck, UserX, Clock, MapPinOff } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useDrivers, DbDriver, DriverInput } from '@/hooks/useDrivers';
import { useTrucks } from '@/hooks/useTrucks';
import { useDispatchers } from '@/hooks/useDispatchers';
import { useInvestors } from '@/hooks/useInvestors';
import { DriverFormDialog } from '@/components/DriverFormDialog';
import { DriverDetailDialog } from '@/components/DriverDetailDialog';
import { DriverDetailPanel } from '@/components/DriverDetailPanel';
import { GenerateOnboardingLinkDialog } from '@/components/GenerateOnboardingLinkDialog';
import { DispatchServiceClientsSection } from '@/components/DispatchServiceClientsSection';
import { TerminationLetterDialog } from '@/components/TerminationLetterDialog';
import { CreateAccessButton } from '@/components/CreateAccessButton';
import { toast } from '@/hooks/use-toast';
import { ExpiryIndicators } from '@/components/ExpiryIndicators';
import { supabase } from '@/integrations/supabase/client';
import { formatPhone } from '@/lib/phoneUtils';

const driverStatusColor = (status: string) => {
  switch (status) {
    case 'available': return 'bg-green-600';
    case 'assigned': return 'bg-[#266aad]';
    case 'resting': return 'bg-orange-500';
    case 'inactive': return 'bg-red-600';
    case 'pending': return 'bg-yellow-500';
    default: return 'bg-gray-500';
  }
};

const DRIVER_STATUS_LABEL: Record<string, string> = {
  available: 'Available',
  assigned: 'Assigned',
  resting: 'Resting',
  inactive: 'Inactive',
  pending: 'Pending',
};

/** Estado del driver en etiqueta de color sólido, como en Tracking */
const DriverStatusPill = ({ status }: { status: string }) => (
  <span className={`inline-flex items-center rounded-md px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-white ${driverStatusColor(status)}`}>
    {DRIVER_STATUS_LABEL[status] ?? status}
  </span>
);

const PAGE_SIZES = [25, 50, 100];

const Drivers = () => {
  const { role, profile } = useAuth();
  const { drivers, loading, createDriver, updateDriver, deleteDriver, uploadDocument, getDocSignedUrl, refetch, addDriverInvestor, removeDriverInvestor, updateDriverInvestor } = useDrivers();
  const { trucks } = useTrucks();
  const { dispatchers } = useDispatchers();
  const { investors } = useInvestors();
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

  // Default dispatcher filter para fmonsalve.usa@gmail.com → Francisco Monsalve
  useEffect(() => {
    if (profile?.email?.toLowerCase() === 'fmonsalve.usa@gmail.com' && dispatchers.length > 0) {
      const francisco = dispatchers.find(d => d.name?.toLowerCase().includes('francisco monsalve'));
      if (francisco) setDispatcherFilter(francisco.id);
    }
  }, [profile?.email, dispatchers]);

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

    const truckLines = isHotshot
      ? `Truck #: ${truck?.unit_number || ''}\nTruck Type: Hotshot\nTrailer#: ${truck?.trailer_number || ''}\nTrailer (ft): ${truck?.trailer_length_ft || ''}`
      : `Truck #: ${truck?.unit_number || ''}\nTruck Type: Box Truck\nTrailer#: ${truck?.trailer_number || ''}\nBack Door: ${truck?.rear_door_width_in && truck?.rear_door_height_in ? `${truck.rear_door_width_in}" x ${truck.rear_door_height_in}"` : ''}`;

    const truckHtmlLines = isHotshot
      ? `Truck #: ${truck?.unit_number || ''}<br>Truck Type: Hotshot<br>Trailer#: ${truck?.trailer_number || ''}<br>Trailer (ft): ${truck?.trailer_length_ft || ''}`
      : `Truck #: ${truck?.unit_number || ''}<br>Truck Type: Box Truck<br>Trailer#: ${truck?.trailer_number || ''}<br>Back Door: ${truck?.rear_door_width_in && truck?.rear_door_height_in ? `${truck.rear_door_width_in}" x ${truck.rear_door_height_in}"` : ''}`;

    // Plain text for WhatsApp (*bold*)
    const plain = `*Driver Info:*\nDriver Name: ${driver.name}\nPhone Number: ${formatPhone(driver.phone)}\n\n*Truck Info:*\n${truckLines}\n\n*Dispatcher Info:*\nDispatcher Name: ${dispatcher?.name || ''}\nDispatcher Phone Number: ${formatPhone(dispatcher?.phone)}\n\nETA to Pick up: `;

    // HTML for email clients (<b>bold</b>)
    const html = `<b>Driver Info:</b><br>Driver Name: ${driver.name}<br>Phone Number: ${formatPhone(driver.phone)}<br><br><b>Truck Info:</b><br>${truckHtmlLines}<br><br><b>Dispatcher Info:</b><br>Dispatcher Name: ${dispatcher?.name || ''}<br>Dispatcher Phone Number: ${formatPhone(dispatcher?.phone)}<br><br>ETA to Pick up: `;

    try {
      navigator.clipboard.write([
        new ClipboardItem({
          'text/plain': new Blob([plain], { type: 'text/plain' }),
          'text/html': new Blob([html], { type: 'text/html' }),
        }),
      ]);
    } catch {
      navigator.clipboard.writeText(plain);
    }

    toast({ title: 'Copied to clipboard' });
  };

  const isDispatcher = role === 'dispatcher';

  // Resolve dispatcher scope via server-side SQL function (reliable, no JS email matching)
  const { driverIds: dispatcherDriverIds } = useDispatcherDriverIds();

  // Start with the full list; if the user is a dispatcher, restrict to their drivers
  let filtered = dispatcherDriverIds
    ? drivers.filter((d) => dispatcherDriverIds.has(d.id))
    : drivers;

  // Admin/accounting dispatcher dropdown filter (hidden for dispatcher role)
  if (!isDispatcher && dispatcherFilter && dispatcherFilter !== 'all') {
    filtered = filtered.filter(d => d.dispatcher_id === dispatcherFilter);
  }

  // El resumen de arriba no cambia al escribir en el buscador
  const scopedDrivers = filtered;

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
    <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
      <div className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-[15px]">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="w-8 p-3"></th>
                <th className="text-left p-3 font-medium text-muted-foreground">Driver</th>
                <th className="w-[60px] p-3"></th>
                <th className="text-left p-3 font-medium text-muted-foreground">Phone</th>
                <th className="text-left p-3 font-medium text-muted-foreground hidden md:table-cell">Truck</th>
                <th className="text-left p-3 font-medium text-muted-foreground hidden lg:table-cell">Servicio</th>
                <th className="text-left p-3 font-medium text-muted-foreground hidden lg:table-cell">Dispatcher</th>
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

                const statusBorder = driver.status === 'available'
                  ? 'border-l-4 border-l-green-600'
                  : driver.status === 'inactive'
                  ? 'border-l-4 border-l-red-600'
                  : 'border-l-4 border-l-yellow-500'; // pending

                const avatarBg = driver.status === 'available'
                  ? 'bg-[#639922]'
                  : driver.status === 'inactive'
                  ? 'bg-[#DC2626]'
                  : 'bg-[#EF9F27]';

                return (
                  <>{/* Fragment needed for expand row */}
                    <tr key={driver.id} className={cn("border-b cursor-pointer transition-colors hover:bg-muted/40", statusBorder, isExpanded && "bg-muted/40")} onClick={() => setExpandedId(isExpanded ? null : driver.id)}>
                      <td className="p-3 text-muted-foreground">
                        {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-3">
                          <div className={`h-9 w-9 rounded-full flex items-center justify-center text-white font-semibold text-sm flex-shrink-0 ${avatarBg}`}>
                            {initials.slice(0, 2).toUpperCase()}
                          </div>
                          <div className="flex flex-col items-start">
                            <span className="font-semibold flex items-center gap-1.5">
                              {driver.name}
                              {activeDriverIds.has(driver.id) && (
                                <span className="inline-flex items-center gap-1 rounded-md bg-blue-100 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700" title="GPS reportando en los últimos 5 minutos">
                                  <span className="h-1.5 w-1.5 rounded-full bg-blue-600 animate-pulse" /> GPS
                                </span>
                              )}
                              {(driver as any).gps_background_granted === false && driver.status !== 'inactive' && (
                                <span className="inline-flex items-center gap-1 rounded-md bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800" title="Sin permiso de ubicación en background — el GPS se apaga al cerrar la app">
                                  <MapPinOff className="h-3 w-3" /> NO BG
                                </span>
                              )}
                              <button
                                onClick={e => { e.stopPropagation(); navigator.clipboard.writeText(driver.name); }}
                                className="text-muted-foreground hover:text-foreground transition-colors ml-0.5"
                                title="Copiar nombre"
                              >
                                <Copy className="h-3 w-3" />
                              </button>
                            </span>
                            <ExpiryIndicators items={[
                              { date: driver.license_expiry, label: 'License' },
                              { date: driver.medical_card_expiry, label: 'Medical' },
                            ]} />
                          </div>
                        </div>
                      </td>
                      <td className="p-3 pl-0" onClick={e => e.stopPropagation()}>
                        <Button variant="ghost" size="sm" className="glass-action-btn tint-blue shadow-[0_2px_4px_rgba(0,0,0,0.25),0_-1px_0_rgba(0,0,0,0.1),inset_0_1px_0_rgba(255,255,255,0.15)] active:shadow-[0_1px_2px_rgba(0,0,0,0.2),inset_0_1px_3px_rgba(0,0,0,0.15)] active:translate-y-px transition-all" onClick={() => copyDriverInfo(driver)} title="Copy">
                          <Copy className="h-3 w-3" /> Copy
                        </Button>
                      </td>
                      <td className="p-3 text-muted-foreground">
                        <div className="flex items-center gap-1.5">
                          <Phone className="h-3.5 w-3.5" />{formatPhone(driver.phone)}
                          <button
                            onClick={e => { e.stopPropagation(); navigator.clipboard.writeText(driver.phone); }}
                            className="text-muted-foreground hover:text-foreground transition-colors"
                            title="Copiar teléfono"
                          >
                            <Copy className="h-3 w-3" />
                          </button>
                        </div>
                      </td>
                      <td className="p-3 hidden md:table-cell">
                        <div className="flex items-center gap-1.5">
                          <TruckIcon className="h-3.5 w-3.5 text-primary" />
                          <span>{truckLabel || <span className="text-muted-foreground italic">Unassigned</span>}</span>
                        </div>
                      </td>
                      <td className="p-3 hidden lg:table-cell">
                        <ServiceTypeBadge serviceType={driver.service_type} />
                      </td>
                      <td className="p-3 hidden lg:table-cell text-sm">
                        {dispatcher
                          ? <span className="font-medium">{dispatcher.name}</span>
                          : <span className="text-muted-foreground italic">Unassigned</span>
                        }
                      </td>
                      <td className="p-3" onClick={e => e.stopPropagation()}>
                        <Select value={driver.status} onValueChange={v => updateDriver(driver.id, { status: v })}>
                          <SelectTrigger className="h-8 w-[155px] border-0 p-0 shadow-none focus:ring-0 [&>svg]:hidden bg-transparent">
                            <span className="flex items-center justify-between w-full gap-1">
                              <DriverStatusPill status={driver.status} />
                              <span className="inline-flex h-5 w-5 items-center justify-center rounded border border-border bg-muted/40 text-muted-foreground ml-auto">
                                <ChevronDown className="h-3 w-3 shrink-0" />
                              </span>
                            </span>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pending"><DriverStatusPill status="pending" /></SelectItem>
                            <SelectItem value="available"><DriverStatusPill status="available" /></SelectItem>
                            <SelectItem value="inactive"><DriverStatusPill status="inactive" /></SelectItem>
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="p-4" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1 text-green-600 hover:text-green-700 hover:bg-green-50" onClick={() => setDetailDriver(driver)} title="Detail">
                            <Eye className="h-3.5 w-3.5" /> Detail
                          </Button>
                          {!isDispatcher && (
                            <>
                              <Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1 text-blue-600 hover:text-blue-700 hover:bg-blue-50" onClick={() => { setEditingDriver(driver); setFormOpen(true); }} title="Edit">
                                <Pencil className="h-3.5 w-3.5" /> Edit
                              </Button>
                              <CreateAccessButton name={driver.name} email={driver.email} phone={driver.phone} role="driver" />
                              <Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1 text-muted-foreground hover:text-foreground" onClick={() => setTerminationDriver(driver)} title="Termination Letter">
                                <FileText className="h-3.5 w-3.5" /> Termination
                              </Button>
                              <Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1 text-red-500 hover:text-red-600 hover:bg-red-50" onClick={async () => { if (window.confirm(`Delete driver ${driver.name}? This action is permanent.`)) { await deleteDriver(driver.id); } }} title="Delete">
                                <Trash2 className="h-3.5 w-3.5" /> Delete
                              </Button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr key={`${driver.id}-detail`}>
                        <td colSpan={9} className="p-0">
                          <DriverDetailPanel driver={driver} truckLabel={truckLabel} dispatcherName={dispatcher?.name || null} getDocSignedUrl={getDocSignedUrl} truck={getTruck(driver.truck_id)} onUpdateDriver={updateDriver} />
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
        <div className="flex gap-2">
          {!isDispatcher && (
            <Button size="sm" variant="outline" className="gap-2" onClick={() => setOnboardingOpen(true)}>
              <Link2 className="h-4 w-4" /> Onboarding Link
            </Button>
          )}
          <Button size="sm" className="gap-2" onClick={() => {
            setEditingDriver(null);
            setFormOpen(true);
          }}>
            <Plus className="h-4 w-4" /> New Driver
          </Button>
        </div>
      </div>

      {/* Resumen */}
      {(() => {
        const current = scopedDrivers.filter(d => d.status !== 'inactive');
        const tiles = [
          { label: 'Total Drivers', value: current.length, icon: Users, tint: 'bg-sky-100 text-sky-700' },
          { label: 'Available', value: current.filter(d => d.status === 'available').length, icon: UserCheck, tint: 'bg-emerald-100 text-emerald-700' },
          { label: 'Pending', value: current.filter(d => d.status === 'pending').length, icon: Clock, tint: 'bg-yellow-100 text-yellow-700' },
          { label: 'Inactive', value: scopedDrivers.filter(d => d.status === 'inactive').length, icon: UserX, tint: 'bg-red-100 text-red-700' },
          { label: 'GPS en vivo', value: current.filter(d => activeDriverIds.has(d.id)).length, icon: Navigation, tint: 'bg-blue-100 text-blue-700' },
          { label: 'Sin permiso GPS', value: current.filter(d => (d as any).gps_background_granted === false).length, icon: MapPinOff, tint: 'bg-amber-100 text-amber-700' },
        ];
        return (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {tiles.map(t => (
              <div key={t.label} className="flex items-center gap-3 rounded-xl border bg-card px-4 py-3 shadow-sm">
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${t.tint}`}>
                  <t.icon className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground truncate">{t.label}</p>
                  <p className="text-xl font-semibold leading-tight">{t.value}</p>
                </div>
              </div>
            ))}
          </div>
        );
      })()}

      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search by name or email..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10 h-10 rounded-full bg-card shadow-sm" />
        </div>
        {!isDispatcher && (
          <Select value={dispatcherFilter} onValueChange={v => { setDispatcherFilter(v); setPage(1); }}>
            <SelectTrigger className="w-[200px] h-10 rounded-full bg-card shadow-sm">
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
            <TabsTrigger value="active" onClick={() => setPage(1)}>Active <span className={`text-xs rounded-full px-2 py-0.5 font-semibold ${filtered.filter(d => d.status !== 'inactive').length > 0 ? 'bg-destructive text-destructive-foreground' : activeTab === 'active' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>{filtered.filter(d => d.status !== 'inactive').length}</span></TabsTrigger>
            <TabsTrigger value="inactive" onClick={() => setPage(1)}>Inactive <span className={`text-xs rounded-full px-2 py-0.5 font-semibold ${activeTab === 'inactive' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>{filtered.filter(d => d.status === 'inactive').length}</span></TabsTrigger>
            <TabsTrigger value="all" onClick={() => setPage(1)}>All <span className={`text-xs rounded-full px-2 py-0.5 font-semibold ${activeTab === 'all' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>{filtered.length}</span></TabsTrigger>
            <TabsTrigger value="dispatch_clients">Dispatch Clients</TabsTrigger>
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
          <TabsContent value="dispatch_clients">
            <DispatchServiceClientsSection />
          </TabsContent>
        </Tabs>
      )}

      <DriverFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        driver={editingDriver}
        onSubmit={handleSubmit}
        trucks={trucks}
        dispatchers={dispatchers}
        investors={investors}
        onAddInvestor={addDriverInvestor}
        onRemoveInvestor={removeDriverInvestor}
        onUpdateInvestor={updateDriverInvestor}
      />
      <DriverDetailDialog open={!!detailDriver} onOpenChange={open => !open && setDetailDriver(null)} driver={detailDriver} truckLabel={detailDriver ? getTruckLabel(detailDriver.truck_id) : null} dispatcherName={detailDriver ? dispatchers.find(d => d.id === detailDriver.dispatcher_id)?.name || null : null} getDocSignedUrl={getDocSignedUrl} />
      <GenerateOnboardingLinkDialog open={onboardingOpen} onOpenChange={setOnboardingOpen} dispatchers={dispatchers} />
      <TerminationLetterDialog
        open={!!terminationDriver}
        onOpenChange={open => !open && setTerminationDriver(null)}
        driver={terminationDriver}
        truck={terminationDriver ? getTruck(terminationDriver.truck_id) : null}
        companyName={tenantName}
        onSuccess={() => { refetch(); setTerminationDriver(null); }}
      />
    </div>
  );
};

export default Drivers;
