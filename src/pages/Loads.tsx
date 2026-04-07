import { useState, useRef, useMemo, Fragment, useEffect, useCallback } from 'react';

import { formatDate, todayET } from '@/lib/dateUtils';
import { useAuth } from '@/contexts/AuthContext';
import { mockDrivers, mockDispatchers } from '@/data/mockData';
import { StatusBadge } from '@/components/StatusBadge';
import { useLoads } from '@/hooks/useLoads';
import { usePodDocuments } from '@/hooks/usePodDocuments';
import { useDrivers } from '@/hooks/useDrivers';
import { useTrucks } from '@/hooks/useTrucks';
import { useDispatchers } from '@/hooks/useDispatchers';
import { useCompanies } from '@/hooks/useCompanies';
import { useInvoices } from '@/hooks/useInvoices';
import { generatePaymentsForLoad, deletePaymentsForLoad } from '@/hooks/usePayments';
import { generateInvoicePdf } from '@/lib/invoicePdf';
import { supabase } from '@/integrations/supabase/client';
import { LoadFormDialog } from '@/components/LoadFormDialog';
import { LoadDetailPanel } from '@/components/LoadDetailPanel';
import { LoadImportWizard } from '@/components/loads/LoadImportWizard';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { PodUploadSection } from '@/components/PodUploadSection';
import { Plus, Search, Package, Pencil, Trash2, ChevronDown, ChevronUp, MapPin, Upload, ExternalLink, Filter, FileText, Download } from 'lucide-react';
import { toast } from 'sonner';
import type { DbLoad } from '@/hooks/useLoads';

// Hidden file input for POD uploads from action buttons
const InlinePodInput = ({ loadId, inputRefMap }: { loadId: string; inputRefMap: React.MutableRefObject<Record<string, HTMLInputElement | null>> }) => {
  const { uploadPod } = usePodDocuments(loadId);
  const handleFiles = async (files: FileList | null) => {
    if (!files) return;
    for (let i = 0; i < files.length; i++) {
      await uploadPod(files[i]);
    }
  };
  return (
    <input
      ref={el => { inputRefMap.current[loadId] = el; }}
      type="file"
      accept="image/*,.pdf"
      multiple
      className="hidden"
      onChange={e => handleFiles(e.target.files)}
    />
  );
};

const PAGE_SIZES = [25, 50, 100];

const Loads = () => {
  // Extract city and state from a full address string
  const extractCityState = (address: string): { city: string; state: string } => {
    if (!address) return { city: '—', state: '' };
    // Normalize: remove zip codes and extra whitespace
    const cleaned = address.replace(/\b\d{5}(-\d{4})?\b/g, '').replace(/,\s*,/g, ',').replace(/,\s*$/, '').trim();
    const parts = cleaned.split(',').map(p => p.trim()).filter(Boolean);
    if (parts.length >= 2) {
      // State is typically the last part (2-letter abbrev or name), city is second to last
      const state = parts[parts.length - 1];
      const city = parts[parts.length - 2];
      // Skip if "state" looks like a street address (has numbers at start)
      if (state && !/^\d/.test(state)) return { city, state };
    }
    return { city: address, state: '' };
  };
  const { user, role, profile } = useAuth();
  const { loads: dbLoads, loading: loadsLoading, createLoad, updateLoad, deleteLoad, fetchLoads, createLoadsBulk } = useLoads();
  const { drivers } = useDrivers();
  const { trucks } = useTrucks();
  const { dispatchers } = useDispatchers();
  const { companies } = useCompanies();
  const { createInvoice } = useInvoices();
  const inputRefMap = useRef<Record<string, HTMLInputElement | null>>({});
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'active' | 'delivered' | 'cancelled'>('active');
  const [filterDriver, setFilterDriver] = useState<string>('all');
  const [filterTruck, setFilterTruck] = useState<string>('all');
  const [filterDispatcher, setFilterDispatcher] = useState<string>('all');
  const [filterWeek, setFilterWeek] = useState<string>('all');
  const [filterMonth, setFilterMonth] = useState<string>('all');
  const [filterBroker, setFilterBroker] = useState<string>('all');
  const [filterFactoring, setFilterFactoring] = useState<string>('all');
  const [showForm, setShowForm] = useState(false);
  const [editLoad, setEditLoad] = useState<DbLoad | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DbLoad | null>(null);
  const [podUploadLoadId, setPodUploadLoadId] = useState<string | null>(null);
  const [showImportWizard, setShowImportWizard] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const handleGenerateInvoice = async (load: DbLoad) => {
    if (!load.broker_client) { toast.error('Esta carga no tiene broker asignado'); return; }
    const company = load.company_id ? companies.find(c => c.id === load.company_id) || (companies.length > 0 ? companies[0] : null) : (companies.length > 0 ? companies[0] : null);
    const invoiceNumber = `INV-${load.reference_number}`;
    await createInvoice({
      load_id: load.id,
      invoice_number: invoiceNumber,
      broker_name: load.broker_client,
      company_id: company?.id || null,
      company_name: company?.name || null,
      amount: Number(load.total_rate),
      status: 'pending',
      pdf_url: null,
      notes: null,
    });
    await generateInvoicePdf({
      invoiceNumber,
      brokerName: load.broker_client,
      loadRef: load.reference_number,
      origin: load.origin,
      destination: load.destination,
      pickupDate: load.pickup_date,
      deliveryDate: load.delivery_date,
      miles: load.miles ? Number(load.miles) : null,
      totalRate: Number(load.total_rate),
      company,
      createdAt: new Date().toISOString(),
    });
  };

  const isDispatcher = role === 'dispatcher';
  // RLS already filters loads for dispatchers at the database level
  let baseLoads = dbLoads;

  if (search) baseLoads = baseLoads.filter(l =>
    l.reference_number.toLowerCase().includes(search.toLowerCase()) ||
    l.origin.toLowerCase().includes(search.toLowerCase()) ||
    l.destination.toLowerCase().includes(search.toLowerCase()) ||
    (l.broker_client || '').toLowerCase().includes(search.toLowerCase())
  );

  // Apply filters
  if (filterDriver !== 'all') baseLoads = baseLoads.filter(l => l.driver_id === filterDriver);
  if (filterTruck !== 'all') baseLoads = baseLoads.filter(l => l.truck_id === filterTruck);
  if (filterDispatcher !== 'all') baseLoads = baseLoads.filter(l => l.dispatcher_id === filterDispatcher);
  if (filterBroker !== 'all') baseLoads = baseLoads.filter(l => l.broker_client === filterBroker);
  if (filterFactoring !== 'all') baseLoads = baseLoads.filter(l => (l.factoring || '') === filterFactoring);
  if (filterMonth !== 'all') {
    const monthIdx = parseInt(filterMonth);
    const year = new Date().getFullYear();
    const startOfMonth = new Date(year, monthIdx, 1);
    const endOfMonth = new Date(year, monthIdx + 1, 1);
    baseLoads = baseLoads.filter(l => {
      const d = l.pickup_date ? new Date(l.pickup_date) : null;
      return d && d >= startOfMonth && d < endOfMonth;
    });
  }
  if (filterWeek !== 'all') {
    const weekNum = parseInt(filterWeek);
    const year = new Date().getFullYear();
    const jan4 = new Date(year, 0, 4);
    const mondayOfWeek1 = new Date(jan4);
    mondayOfWeek1.setDate(jan4.getDate() - ((jan4.getDay() + 6) % 7));
    const startOfWeek = new Date(mondayOfWeek1);
    startOfWeek.setDate(mondayOfWeek1.getDate() + (weekNum - 1) * 7);
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 7);
    baseLoads = baseLoads.filter(l => {
      const d = l.pickup_date ? new Date(l.pickup_date) : null;
      return d && d >= startOfWeek && d < endOfWeek;
    });
  }

  const activeLoads = baseLoads.filter(l => !['delivered', 'tonu', 'cancelled'].includes(l.status));
  const deliveredLoads = baseLoads.filter(l => ['delivered', 'tonu'].includes(l.status));
  const cancelledLoads = baseLoads.filter(l => l.status === 'cancelled');

  const loadsAll = activeTab === 'all' ? baseLoads : activeTab === 'active' ? activeLoads : activeTab === 'delivered' ? deliveredLoads : cancelledLoads;
  const totalPages = Math.max(1, Math.ceil(loadsAll.length / pageSize));
  const loads = loadsAll.slice((page - 1) * pageSize, page * pageSize);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="page-header">Load Management</h1>
          <p className="page-description">Manage all loads and assignments</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-2" onClick={() => {
            const data = activeTab === 'all' ? baseLoads : activeTab === 'active' ? activeLoads : activeTab === 'delivered' ? deliveredLoads : cancelledLoads;
            if (data.length === 0) { toast.error('No data to export'); return; }
            const headers = ['Reference', 'Driver', 'Truck', 'Broker', 'Origin', 'Destination', 'Pickup Date', 'Delivery Date', 'Rate', 'DH-O', 'Miles', 'RPM', 'Dispatcher', 'Status', 'Factoring', 'Notes'];
            const rows = data.map(l => {
              const drv = drivers.find(d => d.id === l.driver_id);
              const trk = trucks.find(t => t.id === l.truck_id);
              const dsp = dispatchers.find(d => d.id === l.dispatcher_id);
              const mi = Number(l.miles) || 0;
              const rpm = mi > 0 ? (Number(l.total_rate) / mi).toFixed(2) : '';
              return [l.reference_number, drv?.name || '', trk ? `Unit #${trk.unit_number}` : '', l.broker_client || '', l.origin, l.destination, l.pickup_date || '', l.delivery_date || '', Number(l.total_rate).toFixed(2), l.empty_miles || '', l.miles || '', rpm, dsp?.name || '', l.status, l.factoring || '', (l.notes || '').replace(/"/g, '""')].map(v => `"${v}"`).join(',');
            });
            const csv = [headers.join(','), ...rows].join('\n');
            const blob = new Blob([csv], { type: 'text/csv' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a'); a.href = url; a.download = `loads_${activeTab}_${new Date().toISOString().split('T')[0]}.csv`; a.click();
            URL.revokeObjectURL(url);
            toast.success(`${data.length} load(s) exported`);
          }}>
            <Download className="h-4 w-4" /> Export CSV
          </Button>
          <Button size="sm" className="gap-2" onClick={() => { setEditLoad(null); setShowForm(true); }}>
            <Plus className="h-4 w-4" /> New Load
          </Button>
        </div>
      </div>

      {/* Search + Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-8 w-[180px] text-xs" />
        </div>
        <Filter className="h-4 w-4 text-muted-foreground" />
          <Select value={filterDriver} onValueChange={setFilterDriver}>
            <SelectTrigger className="w-[160px] h-8 text-xs">
              <SelectValue placeholder="Driver" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Drivers</SelectItem>
              {drivers.map(d => (
                <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterTruck} onValueChange={setFilterTruck}>
            <SelectTrigger className="w-[160px] h-8 text-xs">
              <SelectValue placeholder="Truck" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Trucks</SelectItem>
              {trucks.map(t => (
                <SelectItem key={t.id} value={t.id}>Unit #{t.unit_number}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterDispatcher} onValueChange={setFilterDispatcher}>
            <SelectTrigger className="w-[160px] h-8 text-xs">
              <SelectValue placeholder="Dispatcher" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Dispatchers</SelectItem>
              {dispatchers.map(d => (
                <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterMonth} onValueChange={setFilterMonth}>
            <SelectTrigger className="w-[150px] h-8 text-xs">
              <SelectValue placeholder="Month" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Months</SelectItem>
              {['January','February','March','April','May','June','July','August','September','October','November','December'].map((m, i) => (
                <SelectItem key={i} value={String(i)}>{m}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterWeek} onValueChange={setFilterWeek}>
            <SelectTrigger className="w-[220px] h-8 text-xs">
              <SelectValue placeholder="Week" />
            </SelectTrigger>
            <SelectContent className="max-h-[300px]">
              <SelectItem value="all">All Weeks</SelectItem>
              {Array.from({ length: 52 }, (_, i) => {
                const weekNum = i + 1;
                const year = new Date().getFullYear();
                const jan4 = new Date(year, 0, 4);
                const mondayOfWeek1 = new Date(jan4);
                mondayOfWeek1.setDate(jan4.getDate() - ((jan4.getDay() + 6) % 7));
                const start = new Date(mondayOfWeek1);
                start.setDate(mondayOfWeek1.getDate() + (weekNum - 1) * 7);
                const end = new Date(start);
                end.setDate(start.getDate() + 6);
                const fmt = (d: Date) => `${d.getMonth() + 1}/${d.getDate()}`;
                return (
                  <SelectItem key={weekNum} value={String(weekNum)}>
                    Week {weekNum} (Mon {fmt(start)} - Sun {fmt(end)})
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
          <Select value={filterBroker} onValueChange={setFilterBroker}>
            <SelectTrigger className="w-[160px] h-8 text-xs">
              <SelectValue placeholder="Broker" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Brokers</SelectItem>
              {[...new Set(dbLoads.map(l => l.broker_client).filter(Boolean))].sort().map(b => (
                <SelectItem key={b!} value={b!}>{b}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterFactoring} onValueChange={setFilterFactoring}>
            <SelectTrigger className="w-[160px] h-8 text-xs">
              <SelectValue placeholder="Factoring" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Factoring</SelectItem>
              {[...new Set(dbLoads.map(l => l.factoring || '').filter(Boolean))].sort().map(f => (
                <SelectItem key={f} value={f}>{f}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {(filterDriver !== 'all' || filterTruck !== 'all' || filterDispatcher !== 'all' || filterWeek !== 'all' || filterMonth !== 'all' || filterBroker !== 'all' || filterFactoring !== 'all') && (
            <Button variant="ghost" size="sm" className="h-8 text-xs text-muted-foreground" onClick={() => { setFilterDriver('all'); setFilterTruck('all'); setFilterDispatcher('all'); setFilterWeek('all'); setFilterMonth('all'); setFilterBroker('all'); setFilterFactoring('all'); }}>
              Clear filters
            </Button>
          )}
      
      </div>

      <div className="flex gap-2 border-b">
        {([
          { key: 'active' as const, label: 'Active Loads', count: activeLoads.length },
          { key: 'delivered' as const, label: 'Delivered', count: deliveredLoads.length },
          { key: 'cancelled' as const, label: 'Cancelled', count: cancelledLoads.length },
          { key: 'all' as const, label: 'All Loads', count: baseLoads.length },
        ]).map(tab => (
          <button
            key={tab.key}
            onClick={() => { setActiveTab(tab.key); setExpandedId(null); setPage(1); }}
            className={`px-4 py-2.5 text-sm font-medium uppercase border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === tab.key
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab.label}
            <span className={`text-xs rounded-full px-2 py-0.5 font-semibold ${
              activeTab === tab.key ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
            }`}>{tab.count}</span>
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="glass-card">
        <div className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-[15px]">
              <thead><tr className="border-b glass-table-header">
                <th className="w-8 p-3"></th>
                <th className="text-left p-3 font-medium text-muted-foreground">Load #</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Driver/Truck</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Broker</th>
                <th className="text-left p-3 font-medium text-muted-foreground hidden md:table-cell">Origin</th>
                <th className="text-left p-3 font-medium text-muted-foreground hidden md:table-cell">Destination</th>
                <th className="text-left p-3 font-medium text-muted-foreground hidden lg:table-cell">Pickup</th>
                <th className="text-left p-3 font-medium text-muted-foreground hidden lg:table-cell">Delivery</th>
                <th className="text-right p-3 font-medium text-muted-foreground">Rate</th>
                <th className="text-right p-3 font-medium text-muted-foreground hidden md:table-cell whitespace-nowrap">DH-O</th>
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
                  const driver = drivers.find(d => d.id === load.driver_id);
                  const dispatcher = dispatchers.find(d => d.id === load.dispatcher_id);
                  const isExpanded = expandedId === load.id;
                    return (
                      <Fragment key={load.id}>
                        <tr
                          id={`load-row-${load.id}`}
                          className={`border-b last:border-0 glass-row cursor-pointer ${isExpanded ? 'glass-row-expanded' : ''}`}
                          onClick={() => {
                            const newId = isExpanded ? null : load.id;
                            setExpandedId(newId);
                            if (newId) {
                              setTimeout(() => {
                                document.getElementById(`load-row-${newId}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                              }, 100);
                            }
                          }}
                        >
                          <td className="p-3 text-muted-foreground">
                            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                          </td>
                          <td className="p-3 font-medium text-primary">{load.reference_number}</td>
                          <td className="p-3">
                            <div className="text-base font-bold text-foreground">{driver?.name || <span className="text-muted-foreground italic font-normal">Sin asignar</span>}</div>
                            <div className="text-muted-foreground text-xs">{trucks.find(t => t.id === load.truck_id)?.unit_number ? `Unit #${trucks.find(t => t.id === load.truck_id)!.unit_number}` : '—'}</div>
                          </td>
                          <td className="p-3 text-foreground">{load.broker_client || '—'}</td>
                          <td className="p-3 hidden md:table-cell">
                            {(() => { const { city, state } = extractCityState(load.origin); return (
                              <div className="flex items-center gap-1.5">
                                <MapPin className="h-3.5 w-3.5 text-green-600 flex-shrink-0" />
                                <div><div className="font-medium text-foreground uppercase text-xs">{city}</div>{state && <div className="text-muted-foreground text-[11px]">{state}</div>}</div>
                              </div>
                            ); })()}
                          </td>
                          <td className="p-3 hidden md:table-cell">
                            {(() => { const { city, state } = extractCityState(load.destination); return (
                              <div className="flex items-center gap-1.5">
                                <MapPin className="h-3.5 w-3.5 text-red-500 flex-shrink-0" />
                                <div><div className="font-medium text-foreground uppercase text-xs">{city}</div>{state && <div className="text-muted-foreground text-[11px]">{state}</div>}</div>
                              </div>
                            ); })()}
                          </td>
                          <td className="p-3 hidden lg:table-cell text-muted-foreground">{formatDate(load.pickup_date)}</td>
                          <td className="p-3 hidden lg:table-cell text-muted-foreground">{formatDate(load.delivery_date)}</td>
                          <td className="p-3 text-right font-semibold">${Number(load.total_rate).toLocaleString()}</td>
                          <td className="p-3 text-right hidden md:table-cell text-muted-foreground">{load.empty_miles && Number(load.empty_miles) > 0 ? Number(load.empty_miles).toLocaleString() : '—'}</td>
                          <td className="p-3 text-right hidden md:table-cell text-muted-foreground">{load.miles && Number(load.miles) > 0 ? Number(load.miles).toLocaleString() : '—'}</td>
                          <td className="p-3 text-right hidden md:table-cell">
                            {(() => {
                              if (!load.miles || Number(load.miles) <= 0) return <span className="text-muted-foreground">—</span>;
                              const rpm = Number(load.total_rate) / Number(load.miles);
                              const truck = trucks.find(t => t.id === load.truck_id);
                              const truckType = (truck?.truck_type || '').toLowerCase();
                              const isHotshot = truckType.includes('hotshot');
                              let colorClass = 'text-red-600'; // default red
                              if (isHotshot) {
                                if (rpm >= 1.90) colorClass = 'text-green-600';
                                else if (rpm >= 1.60) colorClass = 'text-amber-500';
                              } else {
                                // Box Truck / default
                                if (rpm >= 1.70) colorClass = 'text-green-600';
                                else if (rpm >= 1.40) colorClass = 'text-amber-500';
                              }
                              return <span className={`font-semibold ${colorClass}`}>${rpm.toFixed(2)}</span>;
                            })()}
                          </td>
                          <td className="p-3 hidden lg:table-cell">{dispatcher?.name || '—'}</td>
                          <td className="p-3" onClick={e => e.stopPropagation()}>
                            <Select value={load.status} onValueChange={async (val) => {
                              const prevStatus = load.status;
                              const updates: any = { status: val };
                              if (val === 'delivered') {
                                if (!load.delivery_date) updates.delivery_date = todayET();
                                if (!load.factoring) updates.factoring = 'pending';
                              }
                              await updateLoad(load.id, updates);
                              if (val === 'delivered') {
                                setPodUploadLoadId(load.id);
                              } else if (prevStatus === 'delivered' && val !== 'tonu') {
                                await deletePaymentsForLoad(load.id);
                              }
                            }}>
                              <SelectTrigger className="h-8 w-[155px] border-0 p-0 shadow-none focus:ring-0 [&>svg]:hidden bg-transparent">
                                <span className="flex items-center justify-between w-full gap-1">
                                  <StatusBadge status={load.status} className="text-[11px] px-3 py-1.5" />
                                  <span className="inline-flex h-5 w-5 items-center justify-center rounded border border-border bg-muted/40 text-muted-foreground ml-auto">
                                    <ChevronDown className="h-3 w-3 shrink-0" />
                                  </span>
                                </span>
                              </SelectTrigger>
                              <SelectContent>
                                {[
                                  { value: 'planned', label: 'Planned' },
                                  { value: 'dispatched', label: 'Dispatched' },
                                  { value: 'in_transit', label: 'In Transit' },
                                  { value: 'on_site_pickup', label: 'On Site - Pickup' },
                                  { value: 'picked_up', label: 'Picked Up' },
                                  { value: 'on_site_delivery', label: 'On Site - Delivery' },
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
                            {load.status === 'delivered' ? formatDate(load.delivery_date) : '—'}
                          </td>
                          <td className="p-3 hidden lg:table-cell" onClick={e => e.stopPropagation()}>
                            <Select value={load.factoring || ''} onValueChange={async (val) => {
                              const prevFactoring = load.factoring;
                              await updateLoad(load.id, { factoring: val });
                              if (val === 'ready') {
                                // Always attempt to generate — generatePaymentsForLoad already
                                // checks for existing driver/investor payments and skips if found
                                const driverData = drivers.find(d => d.id === load.driver_id) || null;
                                const dispatcherData = dispatchers.find(d => d.id === load.dispatcher_id) || null;
                                await generatePaymentsForLoad(load, driverData, dispatcherData);
                              } else if (prevFactoring === 'ready' && val !== 'ready') {
                                await deletePaymentsForLoad(load.id);
                              }
                            }}>
                              <SelectTrigger className="h-8 w-[145px] border-0 p-0 shadow-none focus:ring-0 [&>svg]:hidden bg-transparent">
                                <span className="flex items-center justify-between w-full gap-1">
                                  {load.factoring ? <StatusBadge status={`${load.factoring}_factoring`} className="text-[11px] px-3 py-1.5" /> : <span className="text-muted-foreground">—</span>}
                                  <span className="inline-flex h-5 w-5 items-center justify-center rounded border border-border bg-muted/40 text-muted-foreground ml-auto">
                                    <ChevronDown className="h-3 w-3 shrink-0" />
                                  </span>
                                </span>
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
                            <div className="flex justify-end gap-1.5">
                              <Button variant="ghost" size="sm" className="glass-action-btn tint-purple" onClick={() => { inputRefMap.current[load.id]?.click(); }} title="POD">
                                <Upload className="h-4 w-4" /> POD
                              </Button>
                              {load.pdf_url && (
                                <Button variant="ghost" size="sm" className="glass-action-btn tint-blue" asChild title="PDF">
                                  <a href={load.pdf_url} target="_blank" rel="noopener noreferrer">
                                    <ExternalLink className="h-4 w-4" /> PDF
                                  </a>
                                </Button>
                              )}
                              <Button variant="ghost" size="sm" className="glass-action-btn tint-green" onClick={() => handleGenerateInvoice(load)} title="Invoice">
                                 <FileText className="h-4 w-4" /> Invoice
                               </Button>
                              <Button variant="ghost" size="sm" className="glass-action-btn tint-amber" onClick={() => { setEditLoad(load); setShowForm(true); }} title="Edit">
                                <Pencil className="h-4 w-4" /> Edit
                              </Button>
                              <Button variant="ghost" size="sm" className="glass-action-btn tint-red" onClick={async (e) => { e.stopPropagation(); e.preventDefault(); if (window.confirm(`¿Eliminar carga ${load.reference_number}? Esta acción es permanente.`)) { await deleteLoad(load.id); } }} title="Delete">
                                <Trash2 className="h-4 w-4" /> Delete
                              </Button>
                            </div>
                            <InlinePodInput loadId={load.id} inputRefMap={inputRefMap} />
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr id={`load-detail-${load.id}`}>
                            <td colSpan={17} className="p-0">
                              <LoadDetailPanel
                                load={load}
                                drivers={drivers}
                                trucks={trucks}
                                dispatchers={dispatchers}
                                onMilesCalculated={async (loadId, miles, routeGeometry) => {
                                  const updateData: any = { miles };
                                  if (routeGeometry) {
                                    updateData.route_geometry = routeGeometry;
                                  }
                                  await supabase.from('loads').update(updateData).eq('id', loadId);
                                  await fetchLoads();
                                }}
                                onLoadDataUpdated={async () => { await fetchLoads(); }}
                              />
                            </td>
                          </tr>
                        )}
                      </Fragment>
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

          {/* Pagination Footer */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-4 border-t">
            <div className="text-sm text-muted-foreground">
              {loadsAll.length} loads
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

      {/* Form Dialog */}
      <LoadFormDialog
        open={showForm}
        onOpenChange={(open) => { setShowForm(open); if (!open) { setEditLoad(null); fetchLoads(); } }}
        editLoad={editLoad}
        dispatcherId={(user as any)?.dispatcher_id || undefined}
        onSubmit={async (input) => {
          if (editLoad) {
            await updateLoad(editLoad.id, input);
            return editLoad;
          } else {
            return await createLoad(input);
          }
        }}
      />

      {/* Delete now uses window.confirm - no Dialog needed */}

      {/* POD Upload Dialog on Delivered */}
      <Dialog open={!!podUploadLoadId} onOpenChange={(open) => { if (!open) setPodUploadLoadId(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Subir POD — Proof of Delivery</DialogTitle>
          </DialogHeader>
          {podUploadLoadId && <PodUploadSection loadId={podUploadLoadId} />}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPodUploadLoadId(null)}>Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* CSV Import Wizard */}
      <LoadImportWizard
        open={showImportWizard}
        onOpenChange={setShowImportWizard}
        onImport={createLoadsBulk}
        drivers={drivers.map(d => ({ id: d.id, name: d.name }))}
        trucks={trucks.map(t => ({ id: t.id, unit_number: t.unit_number, license_plate: t.license_plate }))}
        dispatchers={dispatchers.map(d => ({ id: d.id, name: d.name }))}
        existingLoads={dbLoads}
      />
    </div>
  );
};

export default Loads;
