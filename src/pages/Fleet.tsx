import { useState, useMemo, useEffect, useRef } from 'react';
import { FilterChip, ClearFiltersButton, SEARCH_PILL } from '@/components/FilterChip';
import { useTrucks, DbTruck, TruckInput } from '@/hooks/useTrucks';
import { useDrivers } from '@/hooks/useDrivers';
import { useDispatchers } from '@/hooks/useDispatchers';
import { useAuth } from '@/contexts/AuthContext';
import { StatTiles, SolidStatusPill, PILL_INPUT, TABLE_CARD, TABLE_HEAD_ROW, TABLE_ROW } from '@/components/StatTiles';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { StatusChipSelect, CHIP_TONE, initialsOf, type StatusChipOption } from '@/components/StatusChipSelect';
import { TruckFormDialog } from '@/components/TruckFormDialog';
import { TruckDetailDialog } from '@/components/TruckDetailDialog';
import { TruckDetailPanel } from '@/components/TruckDetailPanel';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Truck as TruckIcon, Pencil, Trash2, Eye, User, ChevronDown, ChevronUp, Search, CheckCircle2, Wrench, XCircle, UserX, AlertTriangle, Truck } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ExpiryIndicators } from '@/components/ExpiryIndicators';
import { useSearchParams } from 'react-router-dom';

const STATUS_OPTIONS = [
  { value: 'active', label: 'Active', bg: 'bg-green-600 text-white' },
  { value: 'inactive', label: 'Inactive', bg: 'bg-red-600 text-white' },
  { value: 'maintenance', label: 'Maintenance', bg: 'bg-orange-500 text-white' },
];

const statusPill = (status: string) => {
  const opt = STATUS_OPTIONS.find(s => s.value === status);
  return <SolidStatusPill label={opt?.label ?? status} color={opt ? opt.bg.replace(' text-white', '') : 'bg-gray-500'} />;
};

// VIN válido: 17 caracteres, sin I, O ni Q
const isValidVin = (vin: string | null | undefined) => !!vin && /^[A-HJ-NPR-Z0-9]{17}$/.test(vin.toUpperCase());

const TRUCK_STATUS_CHIPS: StatusChipOption[] = [
  { value: 'active', label: 'Active', hint: 'Trabajando', icon: CheckCircle2, ...CHIP_TONE.green },
  { value: 'maintenance', label: 'Maintenance', hint: 'En el taller', icon: Wrench, ...CHIP_TONE.amber },
  { value: 'inactive', label: 'Inactive', hint: 'Fuera de servicio', icon: XCircle, ...CHIP_TONE.red },
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
  const [dispatcherFilter, setDispatcherFilter] = useState('all');

  const { dispatchers } = useDispatchers();
  const { profile } = useAuth();

  // Enlace desde el buscador global: ?openTruck=<id> abre esa unidad
  const [searchParams, setSearchParams] = useSearchParams();
  const openedFromLink = useRef(!!searchParams.get('openTruck'));
  useEffect(() => {
    const openId = searchParams.get('openTruck');
    if (!openId) return;
    const truck = trucks.find(t => t.id === openId);
    if (!truck) {
      if (!loading) setSearchParams({}, { replace: true });
      return;
    }
    setDispatcherFilter('all');
    setVinFilter('all');
    setPlateFilter('all');
    setActiveTab(truck.status === 'inactive' ? 'inactive' : 'active');
    setSearchQuery(truck.unit_number);
    setExpandedId(truck.id);
    setPage(1);
    setSearchParams({}, { replace: true });
  }, [searchParams, trucks, loading, setSearchParams]);

  // Default dispatcher filter para fmonsalve.usa@gmail.com → Francisco Monsalve
  useEffect(() => {
    if (openedFromLink.current) return;
    if (profile?.email?.toLowerCase() === 'fmonsalve.usa@gmail.com' && dispatchers.length > 0) {
      const francisco = dispatchers.find(d => d.name?.toLowerCase().includes('francisco monsalve'));
      if (francisco) setDispatcherFilter(francisco.id);
    }
  }, [profile?.email, dispatchers]);

  // Camiones que pertenecen al dispatcher seleccionado (vía el driver que los tiene asignados)
  const dispatcherTruckIds = useMemo(() => {
    if (dispatcherFilter === 'all') return null;
    return new Set(
      drivers.filter(d => d.dispatcher_id === dispatcherFilter && d.truck_id).map(d => d.truck_id as string)
    );
  }, [dispatcherFilter, drivers]);

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
    if (dispatcherTruckIds) {
      filtered = filtered.filter(t => dispatcherTruckIds.has(t.id));
    }
    return filtered;
  };

  const renderTrucksTable = (trucksList: DbTruck[]) => {
    const filtered = applyFilters(trucksList);
    const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
    const paged = filtered.slice((page - 1) * pageSize, page * pageSize);
    const colSpan = 8;
    return (
    <div className={cn(TABLE_CARD, 'mt-3')}>
      <div className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className={TABLE_HEAD_ROW}>
                <th className="w-8 p-3"></th>
                <th className="text-left px-3 py-2.5 text-xs font-medium text-[#444746] dark:text-muted-foreground">Unit #</th>
                <th className="text-left px-3 py-2.5 text-xs font-medium text-[#444746] dark:text-muted-foreground hidden md:table-cell">Driver</th>
                <th className="text-left px-3 py-2.5 text-xs font-medium text-[#444746] dark:text-muted-foreground hidden lg:table-cell">Make / Model</th>
                <th className="text-left px-3 py-2.5 text-xs font-medium text-[#444746] dark:text-muted-foreground hidden lg:table-cell">VIN</th>
                <th className="text-left px-3 py-2.5 text-xs font-medium text-[#444746] dark:text-muted-foreground hidden md:table-cell">License Plate</th>
                <th className="text-left px-3 py-2.5 text-xs font-medium text-[#444746] dark:text-muted-foreground">Status</th>
                <th className="text-right px-3 py-2.5 text-xs font-medium text-[#444746] dark:text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {paged.length === 0 ? (
                <tr><td colSpan={colSpan} className="text-center text-muted-foreground py-8">No trucks match the filters.</td></tr>
              ) : paged.map(truck => {
                const isExpanded = expandedId === truck.id;
                const driverName = getDriverName(truck.id);

                const statusBorder = truck.status === 'active'
                  ? 'border-l-4 border-l-[#188038]'
                  : truck.status === 'inactive'
                  ? 'border-l-4 border-l-[#d93025]'
                  : 'border-l-4 border-l-[#e37400]'; // maintenance

                const iconBg = truck.status === 'active'
                  ? 'bg-[#e6f4ea] text-[#188038] dark:bg-emerald-900/40 dark:text-emerald-300'
                  : truck.status === 'inactive'
                  ? 'bg-[#fce8e6] text-[#d93025] dark:bg-red-900/40 dark:text-red-300'
                  : 'bg-[#feefe3] text-[#e37400] dark:bg-orange-900/40 dark:text-orange-300';

                return (
                  <>
                    <tr key={truck.id} className={`${TABLE_ROW} cursor-pointer ${statusBorder} ${isExpanded ? 'bg-[#f0f4f9] dark:bg-muted/50 hover:bg-[#f0f4f9]' : ''}`} onClick={() => setExpandedId(isExpanded ? null : truck.id)}>
                      <td className="px-3 py-2 text-muted-foreground">
                        {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${iconBg}`}>
                            <TruckIcon className="h-4 w-4" />
                          </div>
                          <div className="flex flex-col items-start">
                            <span className="flex flex-wrap items-center gap-1.5">
                              <span className="text-[15px] leading-6 font-normal text-[#1f1f1f] dark:text-foreground whitespace-nowrap">Unit #{truck.unit_number}</span>
                              {truck.truck_type && <span className="rounded-full bg-[#e8f0fe] dark:bg-blue-950/40 text-[#0b57d0] dark:text-blue-300 px-2.5 py-0.5 text-xs font-medium">{truck.truck_type}</span>}
                            </span>
                            <ExpiryIndicators items={[
                              { date: truck.registration_expiry, label: 'Registration' },
                              { date: truck.insurance_expiry, label: 'Insurance' },
                              { date: (truck as any).annual_inspection_expiry, label: 'Annual Insp.' },
                            ]} />
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2 hidden md:table-cell">
                        {(() => {
                          const drv = drivers.find(x => x.truck_id === truck.id);
                          const disp = drv ? dispatchers.find(x => x.id === drv.dispatcher_id) : null;
                          return (
                            <span className="inline-flex items-center gap-2 rounded-full bg-[#f0f4f9] dark:bg-muted/60 pl-1.5 pr-3 py-1.5 whitespace-nowrap">
                              <span className="h-9 w-9 rounded-full flex items-center justify-center shrink-0 text-sm font-medium text-white" style={{ background: drv ? (disp?.color || '#0b57d0') : '#9aa0a6' }}>
                                {drv ? initialsOf(drv.name) : <User className="h-4 w-4" />}
                              </span>
                              <span className={cn('text-sm', drv ? 'text-[#1f1f1f] dark:text-foreground' : 'text-[#b3261e]')}>{drv?.name || 'Sin asignar'}</span>
                            </span>
                          );
                        })()}
                      </td>
                      <td className="px-3 py-2 hidden lg:table-cell">
                        <span className="text-sm">{[truck.make, truck.model].filter(Boolean).join(' ') || '—'}</span>
                        {truck.year && <span className="text-xs text-muted-foreground ml-1">({truck.year})</span>}
                      </td>
                      <td className="px-3 py-2 hidden lg:table-cell">
                        <span className="text-sm font-mono">{truck.vin || '—'}</span>
                      </td>
                      <td className="px-3 py-2 hidden md:table-cell">
                        <span className="text-sm">{truck.license_plate || '—'}</span>
                      </td>
                      <td className="px-3 py-2" onClick={e => e.stopPropagation()}>
                        <StatusChipSelect value={truck.status} options={TRUCK_STATUS_CHIPS} onChange={v => updateTruck(truck.id, { status: v })} />
                      </td>
                      <td className="px-3 py-2" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="sm" className="h-8 rounded-full px-3 text-xs gap-1 text-[#188038] hover:text-[#188038] hover:bg-[#e6f4ea] font-medium" onClick={() => setDetailTruck(truck)} title="Detail">
                            <Eye className="h-3.5 w-3.5" /> Detail
                          </Button>
                          <Button variant="ghost" size="sm" className="h-8 px-2.5 gap-1 rounded-full text-xs font-medium rounded-full text-[#0b57d0] hover:text-[#0b57d0] hover:bg-[#e8f0fe]" onClick={() => openEdit(truck)} title="Edit">
                            <Pencil className="h-4 w-4" /> Editar
                          </Button>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0 rounded-full text-[#b3261e] hover:text-[#b3261e] hover:bg-[#fce8e6]" onClick={async () => { if (window.confirm(`Delete truck Unit #${truck.unit_number}? This action is permanent.`)) { await deleteTruck(truck.id); } }} title="Delete">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr key={`${truck.id}-detail`}>
                        <td colSpan={colSpan} className="p-0">
                          <TruckDetailPanel truck={truck} driverName={driverName} getDocSignedUrl={getDocSignedUrl} onUpdateTruck={updateTruck} />
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
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between px-4 py-2.5 border-t border-[#e3e3e3] dark:border-border">
          <div className="text-sm text-[#444746] dark:text-muted-foreground">
            {filtered.length} trucks
          </div>
          <div className="flex items-center gap-3 mt-2 sm:mt-0">
            <Select value={String(pageSize)} onValueChange={v => { setPageSize(Number(v)); setPage(1); }}>
              <SelectTrigger className="w-[100px] h-8 text-xs rounded-lg shadow-none font-medium bg-white dark:bg-card border-[#c4c7c5] dark:border-border text-[#444746] dark:text-muted-foreground"><SelectValue /></SelectTrigger>
              <SelectContent>
                {PAGE_SIZES.map(s => <SelectItem key={s} value={String(s)}>{s}/page</SelectItem>)}
              </SelectContent>
            </Select>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="sm" className="h-8 rounded-full px-3 text-[#0b57d0] hover:text-[#0b57d0] hover:bg-[#e8f0fe] dark:text-blue-300 font-medium" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Prev</Button>
              <span className="text-sm px-2 text-[#444746] dark:text-muted-foreground">{page} de {totalPages}</span>
              <Button variant="ghost" size="sm" className="h-8 rounded-full px-3 text-[#0b57d0] hover:text-[#0b57d0] hover:bg-[#e8f0fe] dark:text-blue-300 font-medium" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Next</Button>
            </div>
          </div>
        </div>
      </div>
    </div>
    );
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="h-10 w-10 rounded-full bg-[#d3e3fd] dark:bg-blue-900/40 text-[#041e49] dark:text-blue-200 flex items-center justify-center shrink-0">
            <TruckIcon className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-[24px] leading-8 font-normal text-[#1f1f1f] dark:text-foreground">Truck Fleet</h1>
            <p className="text-sm text-[#444746] dark:text-muted-foreground">Vehicle management and availability</p>
          </div>
        </div>
        <Button className="h-10 rounded-2xl px-5 gap-2 bg-[#c2e7ff] hover:bg-[#b3dcf5] text-[#001d35] font-medium shadow-[0_1px_2px_rgba(60,64,67,.3),0_1px_3px_1px_rgba(60,64,67,.15)]" onClick={openNew}>
          <Plus className="h-5 w-5" /> New Truck
        </Button>
      </div>

      {/* Resumen: respeta el filtro de dispatcher, no la búsqueda */}
      {(() => {
        const scoped = dispatcherTruckIds ? trucks.filter(t => dispatcherTruckIds.has(t.id)) : trucks;
        const current = scoped.filter(t => t.status !== 'inactive');
        return (
          <StatTiles tiles={[
            { label: 'Total Trucks', value: current.length, icon: TruckIcon, tint: 'bg-[#d3e3fd] text-[#041e49] dark:bg-blue-900/40 dark:text-blue-200' },
            { label: 'Active', value: current.filter(t => t.status === 'active').length, icon: CheckCircle2, tint: 'bg-[#c4eed0] text-[#072711] dark:bg-emerald-900/40 dark:text-emerald-200' },
            { label: 'Maintenance', value: current.filter(t => t.status === 'maintenance').length, icon: Wrench, tint: 'bg-[#ffdcc1] text-[#2f1500] dark:bg-orange-900/40 dark:text-orange-200' },
            { label: 'Inactive', value: scoped.filter(t => t.status === 'inactive').length, icon: XCircle, tint: 'bg-[#f9dedc] text-[#410e0b] dark:bg-red-900/40 dark:text-red-200' },
            { label: 'Sin driver', value: current.filter(t => !getDriverName(t.id)).length, icon: UserX, tint: 'bg-[#e3e3e3] text-[#1f1f1f] dark:bg-muted dark:text-foreground' },
            { label: 'VIN pendiente', value: current.filter(t => !isValidVin(t.vin)).length, icon: AlertTriangle, tint: 'bg-[#feefc3] text-[#3d2a00] dark:bg-amber-900/40 dark:text-amber-200' },
          ]} />
        );
      })()}

      {/* Search & Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-[#444746] dark:text-muted-foreground" />
          <Input
            placeholder="Search unit, make, model, VIN..."
            value={searchQuery}
            onChange={e => { setSearchQuery(e.target.value); setPage(1); }}
            className={`pl-10 ${PILL_INPUT}`}
          />
        </div>
        <FilterChip value={dispatcherFilter} onValueChange={v => { setDispatcherFilter(v); setPage(1); }} label="Dispatcher">
            <SelectItem value="all">All Dispatchers</SelectItem>
            {dispatchers.filter(d => d.status !== 'inactive').map(d => (
              <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
            ))}
        </FilterChip>
        <FilterChip value={vinFilter} onValueChange={v => { setVinFilter(v); setPage(1); }} label="VIN">
            <SelectItem value="all">All VINs</SelectItem>
            {uniqueVins.map(vin => (
              <SelectItem key={vin} value={vin}>
                <span className="font-mono text-xs">{vin}</span>
              </SelectItem>
            ))}
        </FilterChip>
        <FilterChip value={plateFilter} onValueChange={v => { setPlateFilter(v); setPage(1); }} label="Plate">
            <SelectItem value="all">All Plates</SelectItem>
            {uniquePlates.map(plate => (
              <SelectItem key={plate} value={plate}>{plate}</SelectItem>
            ))}
        </FilterChip>
        {(dispatcherFilter !== 'all' || vinFilter !== 'all' || plateFilter !== 'all') && (
          <ClearFiltersButton onClick={() => { setDispatcherFilter('all'); setVinFilter('all'); setPlateFilter('all'); setPage(1); }} />
        )}
      </div>

      {loading ? (
        <p className="text-muted-foreground text-center py-12">Loading trucks...</p>
      ) : (
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full justify-start rounded-none sm:rounded-none border-x-0 border-t-0 flex-nowrap border-b border-[#e3e3e3] dark:border-border bg-transparent h-12 p-0 px-1 overflow-x-auto overflow-y-hidden">
            <TabsTrigger className="h-12 rounded-none border-b-[3px] border-transparent px-4 gap-2 text-sm font-medium text-[#444746] dark:text-muted-foreground data-[state=active]:border-[#0b57d0] data-[state=active]:text-[#0b57d0] dark:data-[state=active]:text-blue-300 data-[state=active]:shadow-none data-[state=active]:bg-transparent" value="active" onClick={() => setPage(1)}>Active <span className={`text-xs rounded-full px-2 py-0.5 font-semibold ${trucks.filter(t => t.status !== 'inactive').length > 0 ? 'bg-destructive text-destructive-foreground' : activeTab === 'active' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>{trucks.filter(t => t.status !== 'inactive').length}</span></TabsTrigger>
            <TabsTrigger className="h-12 rounded-none border-b-[3px] border-transparent px-4 gap-2 text-sm font-medium text-[#444746] dark:text-muted-foreground data-[state=active]:border-[#0b57d0] data-[state=active]:text-[#0b57d0] dark:data-[state=active]:text-blue-300 data-[state=active]:shadow-none data-[state=active]:bg-transparent" value="inactive" onClick={() => setPage(1)}>Inactive <span className={`text-xs rounded-full px-2 py-0.5 font-semibold ${activeTab === 'inactive' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>{trucks.filter(t => t.status === 'inactive').length}</span></TabsTrigger>
            <TabsTrigger className="h-12 rounded-none border-b-[3px] border-transparent px-4 gap-2 text-sm font-medium text-[#444746] dark:text-muted-foreground data-[state=active]:border-[#0b57d0] data-[state=active]:text-[#0b57d0] dark:data-[state=active]:text-blue-300 data-[state=active]:shadow-none data-[state=active]:bg-transparent" value="all" onClick={() => setPage(1)}>All <span className={`text-xs rounded-full px-2 py-0.5 font-semibold ${activeTab === 'all' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>{trucks.length}</span></TabsTrigger>
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
