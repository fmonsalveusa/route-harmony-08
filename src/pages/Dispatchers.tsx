import { useState } from 'react';
import { useDispatchers, DbDispatcher, DispatcherInput } from '@/hooks/useDispatchers';
import { useLoads } from '@/hooks/useLoads';
import { useDrivers } from '@/hooks/useDrivers';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { DispatcherFormDialog } from '@/components/DispatcherFormDialog';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Plus, Phone, Mail, Percent, Pencil, Trash2, ChevronDown, ChevronUp, Package, User, MapPin, DollarSign } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { StatusBadge } from '@/components/StatusBadge';
import { formatDate } from '@/lib/dateUtils';

const dispatcherStatusColor = (status: string) => {
  switch (status) {
    case 'active': return 'bg-green-600';
    case 'inactive': return 'bg-red-600';
    default: return 'bg-gray-500';
  }
};

const Dispatchers = () => {
  const { dispatchers, loading, createDispatcher, updateDispatcher, deleteDispatcher } = useDispatchers();
  const { loads } = useLoads();
  const { drivers } = useDrivers();
  const [formOpen, setFormOpen] = useState(false);
  const [editingDispatcher, setEditingDispatcher] = useState<DbDispatcher | null>(null);
  const [activeTab, setActiveTab] = useState('active');
  const [expandedDispatcher, setExpandedDispatcher] = useState<string | null>(null);

  const getLoadsForDispatcher = (dispatcherId: string) =>
    loads.filter(l => l.dispatcher_id === dispatcherId);

  const getDriverName = (driverId: string | null) => {
    if (!driverId) return 'Unassigned';
    const driver = drivers.find(d => d.id === driverId);
    return driver?.name || 'Unknown';
  };

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

  const renderDispatcherCard = (d: DbDispatcher) => {
    const initials = d.name.split(' ').map(n => n[0]).join('');
    const dispatcherLoads = getLoadsForDispatcher(d.id);
    return (
      <Card key={d.id} className="hover:shadow-md transition-shadow animate-fade-in">
        <CardContent className="p-5">
          <div className="flex items-start gap-4">
            <Avatar className="h-12 w-12">
              <AvatarFallback className="bg-info/15 text-info font-semibold">{initials}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold truncate">{d.name}</h3>
            </div>
            <Select value={d.status} onValueChange={v => updateDispatcher(d.id, { status: v })}>
              <SelectTrigger className={`w-auto h-7 text-xs font-semibold text-white border-0 rounded-full px-3 gap-1 ${dispatcherStatusColor(d.status)}`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="mt-4 space-y-2 text-sm">
            <div className="flex items-center gap-2 text-muted-foreground"><Mail className="h-3.5 w-3.5" />{d.email}</div>
            <div className="flex items-center gap-2 text-muted-foreground"><Phone className="h-3.5 w-3.5" />{d.phone}</div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Percent className="h-3.5 w-3.5" />
              <span>Commission: {d.commission_percentage}%</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Percent className="h-3.5 w-3.5" />
              <span>Dispatch Service: {d.dispatch_service_percentage}%</span>
            </div>
          </div>

          <div className="mt-3 pt-3 border-t flex justify-between items-center">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-2 text-xs gap-1 text-muted-foreground"
              onClick={() => setExpandedDispatcher(expandedDispatcher === d.id ? null : d.id)}
            >
              <Package className="h-3.5 w-3.5" />
              Loads ({dispatcherLoads.length})
              {expandedDispatcher === d.id ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            </Button>
            <div className="flex gap-1.5">
              <Button variant="outline" size="sm" className="h-8 px-2 text-xs border-amber-400 bg-white text-amber-600 hover:bg-amber-50 hover:text-amber-700 gap-1" onClick={() => { setEditingDispatcher(d); setFormOpen(true); }} title="Edit">
                <Pencil className="h-4 w-4" /> Edit
              </Button>
              <Button variant="outline" size="sm" className="h-8 px-2 text-xs border-red-400 bg-white text-red-600 hover:bg-red-50 hover:text-red-700 gap-1" onClick={async () => { if (window.confirm(`Delete dispatcher ${d.name}? This action is permanent.`)) { await deleteDispatcher(d.id); } }} title="Delete">
                <Trash2 className="h-4 w-4" /> Delete
              </Button>
            </div>
          </div>

          {expandedDispatcher === d.id && (
            <div className="mt-3 pt-3 border-t space-y-2">
              {dispatcherLoads.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-2">No loads assigned</p>
              ) : (
                dispatcherLoads.map(load => (
                  <div key={load.id} className="rounded-lg border bg-muted/30 p-3 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold">{load.reference_number}</span>
                      <StatusBadge status={load.status as any} />
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <User className="h-3 w-3" />
                      <span>{getDriverName(load.driver_id)}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <MapPin className="h-3 w-3" />
                      <span className="truncate">{load.origin} → {load.destination}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">{load.pickup_date ? formatDate(load.pickup_date) : '—'}</span>
                      <div className="flex items-center gap-1 font-medium">
                        <DollarSign className="h-3 w-3" />
                        {load.total_rate.toLocaleString()}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
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
            <TabsTrigger value="active">Active <span className={`text-xs rounded-full px-2 py-0.5 font-semibold ${activeTab === 'active' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>{dispatchers.filter(d => d.status !== 'inactive').length}</span></TabsTrigger>
            <TabsTrigger value="inactive">Inactive <span className={`text-xs rounded-full px-2 py-0.5 font-semibold ${activeTab === 'inactive' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>{dispatchers.filter(d => d.status === 'inactive').length}</span></TabsTrigger>
            <TabsTrigger value="all">All <span className={`text-xs rounded-full px-2 py-0.5 font-semibold ${activeTab === 'all' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>{dispatchers.length}</span></TabsTrigger>
          </TabsList>
          {['active', 'inactive', 'all'].map(tab => (
            <TabsContent key={tab} value={tab}>
              {getFilteredByTab(tab).length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No dispatchers found.</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {getFilteredByTab(tab).map(renderDispatcherCard)}
                </div>
              )}
            </TabsContent>
          ))}
        </Tabs>
      )}

      <DispatcherFormDialog open={formOpen} onOpenChange={setFormOpen} dispatcher={editingDispatcher} onSubmit={handleSubmit} />
    </div>
  );
};

export default Dispatchers;
