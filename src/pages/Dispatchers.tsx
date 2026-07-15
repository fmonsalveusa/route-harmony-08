import { useState } from 'react';
import { useDispatchers, DbDispatcher, DispatcherInput } from '@/hooks/useDispatchers';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { DispatcherFormDialog } from '@/components/DispatcherFormDialog';
import { StatusBadge } from '@/components/StatusBadge';
import { CreateAccessButton } from '@/components/CreateAccessButton';
import { Button } from '@/components/ui/button';
import { Plus, Phone, Mail, Percent, Pencil, Trash2, ChevronDown } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatPhone } from '@/lib/phoneUtils';

const Dispatchers = () => {
  const { dispatchers, loading, createDispatcher, updateDispatcher, deleteDispatcher } = useDispatchers();
  const [formOpen, setFormOpen] = useState(false);
  const [editingDispatcher, setEditingDispatcher] = useState<DbDispatcher | null>(null);
  const [activeTab, setActiveTab] = useState('active');

  const handleSubmit = async (data: DispatcherInput) => {
    if (editingDispatcher) {
      await updateDispatcher(editingDispatcher.id, data);
    } else {
      await createDispatcher(data);
    }
    setEditingDispatcher(null);
  };

  const getFilteredByTab = (tab: string) => {
    if (tab === 'active') return dispatchers.filter(d => d.status !== 'inactive');
    if (tab === 'inactive') return dispatchers.filter(d => d.status === 'inactive');
    return dispatchers;
  };

  const renderTable = (list: DbDispatcher[]) => (
    <div className="rounded-lg border overflow-hidden">
      <table className="w-full">
        <thead>
          <tr className="border-b glass-table-header">
            <th className="text-left p-3 text-xs font-bold text-muted-foreground uppercase tracking-wider">Dispatcher</th>
            <th className="text-left p-3 text-xs font-bold text-muted-foreground uppercase tracking-wider hidden md:table-cell">Email</th>
            <th className="text-left p-3 text-xs font-bold text-muted-foreground uppercase tracking-wider hidden md:table-cell">Phone</th>
            <th className="text-center p-3 text-xs font-bold text-muted-foreground uppercase tracking-wider">Commission 1</th>
            <th className="text-center p-3 text-xs font-bold text-muted-foreground uppercase tracking-wider hidden lg:table-cell">Commission 2</th>
            <th className="text-center p-3 text-xs font-bold text-muted-foreground uppercase tracking-wider hidden lg:table-cell">Dispatch Svc</th>
            <th className="text-left p-3 text-xs font-bold text-muted-foreground uppercase tracking-wider">Status</th>
            <th className="text-right p-3 text-xs font-bold text-muted-foreground uppercase tracking-wider">Actions</th>
          </tr>
        </thead>
        <tbody>
          {list.length === 0 ? (
            <tr><td colSpan={8} className="text-center p-8 text-muted-foreground">No dispatchers found.</td></tr>
          ) : list.map(d => {
            const initials = d.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase();
            const statusBorder = d.status === 'active'
              ? 'border-l-[3px] border-l-[#639922]'
              : 'border-l-[3px] border-l-[#DC2626]';
            const avatarColor = d.color || '#94A3B8';

            return (
              <tr key={d.id} className={`border-b last:border-b-0 glass-row ${statusBorder}`}>
                <td className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-full flex items-center justify-center text-white font-semibold text-sm flex-shrink-0" style={{ backgroundColor: avatarColor }}>
                      {initials}
                    </div>
                    <span className="font-semibold">{d.name}</span>
                  </div>
                </td>
                <td className="p-4 text-muted-foreground hidden md:table-cell">
                  {d.email
                    ? <a href={`mailto:${d.email}`} className="flex items-center gap-1 hover:text-primary text-sm"><Mail className="h-3.5 w-3.5" />{d.email}</a>
                    : '—'}
                </td>
                <td className="p-4 text-muted-foreground hidden md:table-cell">
                  {d.phone
                    ? <span className="flex items-center gap-1 text-sm"><Phone className="h-3.5 w-3.5" />{formatPhone(d.phone)}</span>
                    : '—'}
                </td>
                <td className="p-4 text-center">
                  <span className="inline-flex items-center justify-center rounded-full bg-violet-500/10 text-violet-600 text-xs font-semibold min-w-[40px] h-6 px-2">
                    {d.commission_percentage}%
                  </span>
                </td>
                <td className="p-4 text-center hidden lg:table-cell">
                  {(d.commission_2_percentage ?? 0) > 0
                    ? <span className="inline-flex items-center justify-center rounded-full bg-violet-500/10 text-violet-600 text-xs font-semibold min-w-[40px] h-6 px-2">{d.commission_2_percentage}%</span>
                    : <span className="text-muted-foreground text-xs">—</span>}
                </td>
                <td className="p-4 text-center hidden lg:table-cell">
                  <span className="inline-flex items-center justify-center rounded-full bg-blue-500/10 text-blue-600 text-xs font-semibold min-w-[40px] h-6 px-2">
                    {d.dispatch_service_percentage}%
                  </span>
                </td>
                <td className="p-4" onClick={e => e.stopPropagation()}>
                  <Select value={d.status} onValueChange={v => updateDispatcher(d.id, { status: v })}>
                    <SelectTrigger className="h-8 w-[140px] border-0 p-0 shadow-none focus:ring-0 [&>svg]:hidden bg-transparent">
                      <span className="flex items-center justify-between w-full gap-1">
                        <StatusBadge status={d.status} className="text-[11px] px-3 py-1.5" />
                        <span className="inline-flex h-5 w-5 items-center justify-center rounded border border-border bg-muted/40 text-muted-foreground ml-auto">
                          <ChevronDown className="h-3 w-3 shrink-0" />
                        </span>
                      </span>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active"><StatusBadge status="active" /></SelectItem>
                      <SelectItem value="inactive"><StatusBadge status="inactive" /></SelectItem>
                    </SelectContent>
                  </Select>
                </td>
                <td className="p-4 text-right" onClick={e => e.stopPropagation()}>
                  <div className="flex items-center justify-end gap-1">
                    <Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                      onClick={() => { setEditingDispatcher(d); setFormOpen(true); }}>
                      <Pencil className="h-3.5 w-3.5" /> Edit
                    </Button>
                    <CreateAccessButton name={d.name} email={d.email} phone={d.phone} role="dispatcher" />
                    <Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1 text-red-500 hover:text-red-600 hover:bg-red-50"
                      onClick={async () => { if (window.confirm(`Delete dispatcher ${d.name}? This action is permanent.`)) { await deleteDispatcher(d.id); } }}>
                      <Trash2 className="h-3.5 w-3.5" /> Delete
                    </Button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-header">Dispatchers</h1>
          <p className="page-description">Dispatcher and commission management</p>
        </div>
        <Button size="sm" className="gap-2" onClick={() => { setEditingDispatcher(null); setFormOpen(true); }}>
          <Plus className="h-4 w-4" /> New Dispatcher
        </Button>
      </div>

      {loading ? (
        <p className="text-muted-foreground text-sm">Loading dispatchers...</p>
      ) : (
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="active">
              Active <span className={`ml-1.5 text-xs rounded-full px-2 py-0.5 font-semibold ${activeTab === 'active' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>{dispatchers.filter(d => d.status !== 'inactive').length}</span>
            </TabsTrigger>
            <TabsTrigger value="inactive">
              Inactive <span className={`ml-1.5 text-xs rounded-full px-2 py-0.5 font-semibold ${activeTab === 'inactive' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>{dispatchers.filter(d => d.status === 'inactive').length}</span>
            </TabsTrigger>
            <TabsTrigger value="all">
              All <span className={`ml-1.5 text-xs rounded-full px-2 py-0.5 font-semibold ${activeTab === 'all' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>{dispatchers.length}</span>
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
