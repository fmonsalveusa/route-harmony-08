import { useState, useMemo, Fragment } from 'react';
import { useDispatchers, DbDispatcher, DispatcherInput } from '@/hooks/useDispatchers';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { DispatcherFormDialog } from '@/components/DispatcherFormDialog';
import { StatTiles, SolidStatusPill, PILL_INPUT, TABLE_CARD, TABLE_HEAD_ROW, TABLE_ROW } from '@/components/StatTiles';
import { useDrivers } from '@/hooks/useDrivers';
import { Input } from '@/components/ui/input';
import { CreateAccessButton } from '@/components/CreateAccessButton';
import { Button } from '@/components/ui/button';
import { Plus, Phone, Mail, Percent, Pencil, Trash2, ChevronDown, ChevronUp, Headset, UserX, Users, UserMinus, Search } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatPhone } from '@/lib/phoneUtils';
import { DispatcherDetailPanel } from '@/components/DispatcherDetailPanel';

const Dispatchers = () => {
  const { dispatchers, loading, createDispatcher, updateDispatcher, deleteDispatcher } = useDispatchers();
  const [formOpen, setFormOpen] = useState(false);
  const [editingDispatcher, setEditingDispatcher] = useState<DbDispatcher | null>(null);
  const [activeTab, setActiveTab] = useState('active');
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const { drivers } = useDrivers();

  // Drivers activos por dispatcher, para la columna y el resumen
  const driversPerDispatcher = useMemo(() => {
    const map: Record<string, number> = {};
    drivers.filter(d => d.status !== 'inactive').forEach(d => {
      if (d.dispatcher_id) map[d.dispatcher_id] = (map[d.dispatcher_id] || 0) + 1;
    });
    return map;
  }, [drivers]);

  const handleSubmit = async (data: DispatcherInput) => {
    if (editingDispatcher) {
      await updateDispatcher(editingDispatcher.id, data);
    } else {
      await createDispatcher(data);
    }
    setEditingDispatcher(null);
  };

  const getFilteredByTab = (tab: string) => {
    let list = dispatchers;
    if (tab === 'active') list = list.filter(d => d.status !== 'inactive');
    if (tab === 'inactive') list = list.filter(d => d.status === 'inactive');
    const q = search.trim().toLowerCase();
    if (q) list = list.filter(d => d.name.toLowerCase().includes(q) || (d.email || '').toLowerCase().includes(q));
    return list;
  };

  const renderTable = (list: DbDispatcher[]) => (
    <div className={cn(TABLE_CARD, 'mt-3 overflow-x-auto')}>
      <table className="w-full text-sm">
        <thead>
          <tr className={TABLE_HEAD_ROW}>
            <th className="w-8 px-2 py-2.5"></th>
            <th className="text-left px-3 py-2.5 text-xs font-medium text-[#444746] dark:text-muted-foreground">Dispatcher</th>
            <th className="text-left px-3 py-2.5 text-xs font-medium text-[#444746] dark:text-muted-foreground hidden md:table-cell">Email</th>
            <th className="text-left px-3 py-2.5 text-xs font-medium text-[#444746] dark:text-muted-foreground hidden md:table-cell">Phone</th>
            <th className="text-center px-3 py-2.5 text-xs font-medium text-[#444746] dark:text-muted-foreground">Drivers</th>
            <th className="text-center px-3 py-2.5 text-xs font-medium text-[#444746] dark:text-muted-foreground">Commission 1</th>
            <th className="text-center px-3 py-2.5 text-xs font-medium text-[#444746] dark:text-muted-foreground hidden lg:table-cell">Commission 2</th>
            <th className="text-center px-3 py-2.5 text-xs font-medium text-[#444746] dark:text-muted-foreground hidden lg:table-cell">Dispatch Svc</th>
            <th className="text-left px-3 py-2.5 text-xs font-medium text-[#444746] dark:text-muted-foreground">Status</th>
            <th className="text-right px-3 py-2.5 text-xs font-medium text-[#444746] dark:text-muted-foreground">Actions</th>
          </tr>
        </thead>
        <tbody>
          {list.length === 0 ? (
            <tr><td colSpan={10} className="text-center p-8 text-muted-foreground">No dispatchers found.</td></tr>
          ) : list.map(d => {
            const initials = d.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase();
            const statusBorder = d.status === 'active'
              ? 'border-l-4 border-l-[#188038]'
              : 'border-l-4 border-l-[#d93025]';
            const avatarColor = d.color || '#94A3B8';

            return (
              <Fragment key={d.id}>
              <tr className={`${TABLE_ROW} cursor-pointer ${statusBorder} ${expandedId === d.id ? 'bg-[#f0f4f9] dark:bg-muted/50 hover:bg-[#f0f4f9]' : ''}`} onClick={() => setExpandedId(expandedId === d.id ? null : d.id)}>
                <td className="pl-3 pr-1 py-2 text-[#444746]">
                  {expandedId === d.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-full flex items-center justify-center text-white font-semibold text-sm flex-shrink-0" style={{ backgroundColor: avatarColor }}>
                      {initials}
                    </div>
                    <span className="font-medium text-[#1f1f1f] dark:text-foreground whitespace-nowrap">{d.name}</span>
                  </div>
                </td>
                <td className="px-3 py-2 text-muted-foreground hidden md:table-cell">
                  {d.email
                    ? <a href={`mailto:${d.email}`} className="flex items-center gap-1 hover:text-[#0b57d0] text-sm whitespace-nowrap"><Mail className="h-3.5 w-3.5" />{d.email}</a>
                    : '—'}
                </td>
                <td className="px-3 py-2 text-muted-foreground hidden md:table-cell">
                  {d.phone
                    ? <span className="flex items-center gap-1 text-sm whitespace-nowrap"><Phone className="h-3.5 w-3.5" />{formatPhone(d.phone)}</span>
                    : '—'}
                </td>
                <td className="px-3 py-2 text-center">
                  {driversPerDispatcher[d.id]
                    ? <span className="inline-flex items-center justify-center rounded-full bg-[#d3e3fd] text-[#041e49] dark:bg-blue-900/40 dark:text-blue-200 text-xs font-medium min-w-[28px] h-6 px-2">{driversPerDispatcher[d.id]}</span>
                    : <span className="text-muted-foreground text-xs">—</span>}
                </td>
                <td className="px-3 py-2 text-center">
                  <span className="inline-flex items-center justify-center rounded-full bg-[#f3e8fd] text-[#4a148c] dark:bg-violet-900/40 dark:text-violet-200 text-xs font-medium min-w-[40px] h-6 px-2">
                    {d.commission_percentage}%
                  </span>
                </td>
                <td className="px-3 py-2 text-center hidden lg:table-cell">
                  {(d.commission_2_percentage ?? 0) > 0
                    ? <span className="inline-flex items-center justify-center rounded-full bg-[#f3e8fd] text-[#4a148c] dark:bg-violet-900/40 dark:text-violet-200 text-xs font-medium min-w-[40px] h-6 px-2">{d.commission_2_percentage}%</span>
                    : <span className="text-muted-foreground text-xs">—</span>}
                </td>
                <td className="px-3 py-2 text-center hidden lg:table-cell">
                  <span className="inline-flex items-center justify-center rounded-full bg-[#c2e7ff] text-[#001d35] dark:bg-sky-900/40 dark:text-sky-200 text-xs font-medium min-w-[40px] h-6 px-2">
                    {d.dispatch_service_percentage}%
                  </span>
                </td>
                <td className="px-3 py-2" onClick={e => e.stopPropagation()}>
                  <Select value={d.status} onValueChange={v => updateDispatcher(d.id, { status: v })}>
                    <SelectTrigger className="h-8 w-[140px] border-0 p-0 shadow-none focus:ring-0 [&>svg]:hidden bg-transparent">
                      <span className="flex items-center justify-between w-full gap-1">
                        {d.status === 'inactive'
                          ? <SolidStatusPill label="Inactive" color="bg-red-600" />
                          : <SolidStatusPill label="Active" color="bg-green-600" />}
                        <span className="inline-flex h-5 w-5 items-center justify-center rounded border border-border bg-muted/40 text-muted-foreground ml-auto">
                          <ChevronDown className="h-3 w-3 shrink-0" />
                        </span>
                      </span>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active"><SolidStatusPill label="Active" color="bg-green-600" /></SelectItem>
                      <SelectItem value="inactive"><SolidStatusPill label="Inactive" color="bg-red-600" /></SelectItem>
                    </SelectContent>
                  </Select>
                </td>
                <td className="px-3 py-2 text-right" onClick={e => e.stopPropagation()}>
                  <div className="flex items-center justify-end gap-1">
                    <Button variant="ghost" size="sm" className="h-8 px-2.5 gap-1 rounded-full text-xs font-medium rounded-full text-[#0b57d0] hover:text-[#0b57d0] hover:bg-[#e8f0fe]" title="Edit"
                      onClick={() => { setEditingDispatcher(d); setFormOpen(true); }}>
                      <Pencil className="h-4 w-4" /> Editar
                    </Button>
                    <CreateAccessButton name={d.name} email={d.email} phone={d.phone} role="dispatcher" />
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0 rounded-full text-[#b3261e] hover:text-[#b3261e] hover:bg-[#fce8e6]" title="Delete"
                      onClick={async () => { if (window.confirm(`Delete dispatcher ${d.name}? This action is permanent.`)) { await deleteDispatcher(d.id); } }}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </td>
              </tr>
              {expandedId === d.id && (
                <tr>
                  <td colSpan={10} className="p-0">
                    <DispatcherDetailPanel dispatcher={d} drivers={drivers} />
                  </td>
                </tr>
              )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="h-10 w-10 rounded-full bg-[#d3e3fd] dark:bg-blue-900/40 text-[#041e49] dark:text-blue-200 flex items-center justify-center shrink-0">
            <Headset className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-[24px] leading-8 font-normal text-[#1f1f1f] dark:text-foreground">Dispatchers</h1>
            <p className="text-sm text-[#444746] dark:text-muted-foreground">Dispatcher and commission management</p>
          </div>
        </div>
        <Button className="h-10 rounded-2xl px-5 gap-2 bg-[#c2e7ff] hover:bg-[#b3dcf5] text-[#001d35] font-medium shadow-[0_1px_2px_rgba(60,64,67,.3),0_1px_3px_1px_rgba(60,64,67,.15)]" onClick={() => { setEditingDispatcher(null); setFormOpen(true); }}>
          <Plus className="h-5 w-5" /> New Dispatcher
        </Button>
      </div>

      {/* Resumen */}
      {(() => {
        const activeDrivers = drivers.filter(d => d.status !== 'inactive');
        return (
          <StatTiles tiles={[
            { label: 'Active Dispatchers', value: dispatchers.filter(d => d.status !== 'inactive').length, icon: Headset, tint: 'bg-[#d3e3fd] text-[#041e49] dark:bg-blue-900/40 dark:text-blue-200' },
            { label: 'Inactive', value: dispatchers.filter(d => d.status === 'inactive').length, icon: UserX, tint: 'bg-[#f9dedc] text-[#410e0b] dark:bg-red-900/40 dark:text-red-200' },
            { label: 'Drivers asignados', value: activeDrivers.filter(d => d.dispatcher_id).length, icon: Users, tint: 'bg-[#c4eed0] text-[#072711] dark:bg-emerald-900/40 dark:text-emerald-200' },
            { label: 'Drivers sin dispatcher', value: activeDrivers.filter(d => !d.dispatcher_id).length, icon: UserMinus, tint: 'bg-[#feefc3] text-[#3d2a00] dark:bg-amber-900/40 dark:text-amber-200' },
          ]} />
        );
      })()}

      <div className="relative w-full max-w-sm">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-[#444746] dark:text-muted-foreground" />
        <input placeholder="Buscar por nombre o email..." value={search} onChange={e => setSearch(e.target.value)}
          className="w-full h-10 rounded-full bg-white dark:bg-card border border-[#e3e3e3] dark:border-border pl-10 pr-4 text-sm text-[#1f1f1f] dark:text-foreground placeholder:text-[#444746] outline-none focus:shadow-[0_1px_1px_rgba(65,69,73,.3),0_1px_3px_1px_rgba(65,69,73,.15)] transition" />
      </div>

      {loading ? (
        <p className="text-muted-foreground text-sm">Loading dispatchers...</p>
      ) : (
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full justify-start rounded-none sm:rounded-none border-x-0 border-t-0 flex-nowrap border-b border-[#e3e3e3] dark:border-border bg-transparent h-12 p-0 px-1 overflow-x-auto overflow-y-hidden">
            <TabsTrigger className="h-12 rounded-none border-b-[3px] border-transparent px-4 gap-2 text-sm font-medium text-[#444746] dark:text-muted-foreground data-[state=active]:border-[#0b57d0] data-[state=active]:text-[#0b57d0] dark:data-[state=active]:text-blue-300 data-[state=active]:shadow-none data-[state=active]:bg-transparent" value="active">
              Active <span className={`text-[11px] rounded-full px-1.5 py-0.5 font-medium ${activeTab === 'active' ? 'bg-[#0b57d0] text-white' : 'bg-[#f0f4f9] dark:bg-muted text-[#444746] dark:text-muted-foreground'}`}>{dispatchers.filter(d => d.status !== 'inactive').length}</span>
            </TabsTrigger>
            <TabsTrigger className="h-12 rounded-none border-b-[3px] border-transparent px-4 gap-2 text-sm font-medium text-[#444746] dark:text-muted-foreground data-[state=active]:border-[#0b57d0] data-[state=active]:text-[#0b57d0] dark:data-[state=active]:text-blue-300 data-[state=active]:shadow-none data-[state=active]:bg-transparent" value="inactive">
              Inactive <span className={`text-[11px] rounded-full px-1.5 py-0.5 font-medium ${activeTab === 'inactive' ? 'bg-[#0b57d0] text-white' : 'bg-[#f0f4f9] dark:bg-muted text-[#444746] dark:text-muted-foreground'}`}>{dispatchers.filter(d => d.status === 'inactive').length}</span>
            </TabsTrigger>
            <TabsTrigger className="h-12 rounded-none border-b-[3px] border-transparent px-4 gap-2 text-sm font-medium text-[#444746] dark:text-muted-foreground data-[state=active]:border-[#0b57d0] data-[state=active]:text-[#0b57d0] dark:data-[state=active]:text-blue-300 data-[state=active]:shadow-none data-[state=active]:bg-transparent" value="all">
              All <span className={`text-[11px] rounded-full px-1.5 py-0.5 font-medium ${activeTab === 'all' ? 'bg-[#0b57d0] text-white' : 'bg-[#f0f4f9] dark:bg-muted text-[#444746] dark:text-muted-foreground'}`}>{dispatchers.length}</span>
            </TabsTrigger>
          </TabsList>
          {['active', 'inactive', 'all'].map(tab => (
            <TabsContent key={tab} value={tab}>
              {renderTable(getFilteredByTab(tab))}
            </TabsContent>
          ))}
        </Tabs>
      )}

      <DispatcherFormDialog open={formOpen} onOpenChange={setFormOpen} dispatcher={editingDispatcher} onSubmit={handleSubmit} />
    </div>
  );
};

export default Dispatchers;
