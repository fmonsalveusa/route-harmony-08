import { useState, useMemo, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useInvestors, DbInvestor, InvestorInput } from '@/hooks/useInvestors';
import { useDrivers } from '@/hooks/useDrivers';
import { usePayments } from '@/hooks/usePayments';
import { StatCard } from '@/components/StatCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { StatusBadge } from '@/components/StatusBadge';
import { CreateAccessButton } from '@/components/CreateAccessButton';
import { ChevronDown, Landmark, Pencil, Trash2, PlusCircle, Search, Phone, Mail, Users, DollarSign, X, Percent } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { formatPhone } from '@/lib/phoneUtils';

// ─── Create / Edit Dialog ────────────────────────────────────
const InvestorFormDialog = ({
  open, onOpenChange, investor, onSubmit,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  investor?: DbInvestor | null;
  onSubmit: (data: InvestorInput) => Promise<void>;
}) => {
  const getInitialForm = (): InvestorInput => investor ? {
    name: investor.name,
    email: investor.email || '',
    phone: investor.phone || '',
    notes: investor.notes || '',
    pay_percentage: investor.pay_percentage ?? 0,
    address: investor.address || '',
    city: investor.city || '',
    state: investor.state || '',
    zip: investor.zip || '',
    business_name: investor.business_name || '',
    ein: investor.ein || '',
    ssn_last4: investor.ssn_last4 || '',
    bank_name: investor.bank_name || '',
    account_holder_name: investor.account_holder_name || '',
    routing_number: investor.routing_number || '',
    account_number: investor.account_number || '',
    account_type: investor.account_type || 'checking',
  } : {
    name: '', email: '', phone: '', notes: '', pay_percentage: 0,
    address: '', city: '', state: '', zip: '',
    business_name: '', ein: '', ssn_last4: '',
    bank_name: '', account_holder_name: '', routing_number: '', account_number: '', account_type: 'checking',
  };

  const [form, setForm] = useState<InvestorInput>(getInitialForm);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const handleOpen = (v: boolean) => {
    if (v) setForm(getInitialForm());
    onOpenChange(v);
  };

  const set = (key: keyof InvestorInput, value: any) =>
    setForm(prev => ({ ...prev, [key]: value }));

  const handleSubmit = async () => {
    if (!form.name.trim()) {
      toast({ title: 'Name is required', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      await onSubmit({
        name: form.name.trim(),
        email: form.email?.trim() || null,
        phone: form.phone?.trim() || null,
        notes: form.notes?.trim() || null,
        pay_percentage: Number(form.pay_percentage) || 0,
        address: form.address?.trim() || null,
        city: form.city?.trim() || null,
        state: form.state?.trim() || null,
        zip: form.zip?.trim() || null,
        business_name: form.business_name?.trim() || null,
        ein: form.ein?.trim() || null,
        ssn_last4: form.ssn_last4?.trim() || null,
        bank_name: form.bank_name?.trim() || null,
        account_holder_name: form.account_holder_name?.trim() || null,
        routing_number: form.routing_number?.trim() || null,
        account_number: form.account_number?.trim() || null,
        account_type: form.account_type || 'checking',
      });
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{investor ? 'Edit Investor' : 'New Investor'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-6 py-2">

          {/* Basic Info */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Personal Information</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2 sm:col-span-2">
                <Label>Full Name *</Label>
                <Input value={form.name} onChange={e => set('name', e.target.value)} placeholder="Full name" autoFocus />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input type="email" value={form.email || ''} onChange={e => set('email', e.target.value)} placeholder="investor@email.com" />
              </div>
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input value={form.phone || ''} onChange={e => set('phone', e.target.value)} placeholder="555-0000" />
              </div>
            </div>
          </div>

          {/* Address */}
          <div className="space-y-3 border-t pt-4">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Address</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2 sm:col-span-2">
                <Label>Street Address</Label>
                <Input value={form.address || ''} onChange={e => set('address', e.target.value)} placeholder="123 Main St" />
              </div>
              <div className="space-y-2">
                <Label>City</Label>
                <Input value={form.city || ''} onChange={e => set('city', e.target.value)} placeholder="Miami" />
              </div>
              <div className="space-y-2">
                <Label>State</Label>
                <Input value={form.state || ''} onChange={e => set('state', e.target.value)} placeholder="FL" maxLength={2} />
              </div>
              <div className="space-y-2">
                <Label>Zip Code</Label>
                <Input value={form.zip || ''} onChange={e => set('zip', e.target.value)} placeholder="33101" />
              </div>
            </div>
          </div>

          {/* Business Info */}
          <div className="space-y-3 border-t pt-4">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Business Information <span className="text-xs font-normal normal-case">(opcional)</span></h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2 sm:col-span-2">
                <Label>Business Name (LLC / Corp)</Label>
                <Input value={form.business_name || ''} onChange={e => set('business_name', e.target.value)} placeholder="e.g. Smith Transport LLC" />
              </div>
              <div className="space-y-2">
                <Label>EIN (si tiene empresa)</Label>
                <Input value={form.ein || ''} onChange={e => set('ein', e.target.value)} placeholder="XX-XXXXXXX" />
              </div>
              <div className="space-y-2">
                <Label>SSN Last 4 (si es persona natural)</Label>
                <Input value={form.ssn_last4 || ''} onChange={e => set('ssn_last4', e.target.value.replace(/\D/g, '').slice(0, 4))} placeholder="XXXX" maxLength={4} />
              </div>
            </div>
          </div>

          {/* Pay % */}
          <div className="space-y-2 border-t pt-4 p-3 rounded-lg border-2 border-violet-400/50 bg-violet-50 dark:bg-violet-950/20">
            <Label className="font-semibold text-violet-700 dark:text-violet-300 flex items-center gap-1.5">
              <Percent className="h-4 w-4" /> Investor Pay % ⭐
            </Label>
            <Input
              type="number" min={0} max={100} step={0.5}
              value={form.pay_percentage ?? ''}
              onChange={e => set('pay_percentage', e.target.value)}
              placeholder="e.g. 75"
              className="text-lg font-semibold"
            />
            <p className="text-xs text-violet-600 dark:text-violet-400">
              Percentage of each load's total rate paid to this investor.
            </p>
          </div>

          {/* Banking */}
          <div className="space-y-3 border-t pt-4">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Banking Information <span className="text-xs font-normal normal-case">(ACH Direct Deposit)</span></h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2 sm:col-span-2">
                <Label>Account Holder Name</Label>
                <Input value={form.account_holder_name || ''} onChange={e => set('account_holder_name', e.target.value)} placeholder="Full name as it appears on the account" />
              </div>
              <div className="space-y-2">
                <Label>Bank Name</Label>
                <Input value={form.bank_name || ''} onChange={e => set('bank_name', e.target.value)} placeholder="e.g. Chase, Bank of America" />
              </div>
              <div className="space-y-2">
                <Label>Account Type</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={form.account_type || 'checking'}
                  onChange={e => set('account_type', e.target.value)}
                >
                  <option value="checking">Checking</option>
                  <option value="savings">Savings</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label>Routing Number</Label>
                <Input value={form.routing_number || ''} onChange={e => set('routing_number', e.target.value.replace(/\D/g, '').slice(0, 9))} placeholder="9-digit routing number" maxLength={9} />
              </div>
              <div className="space-y-2">
                <Label>Account Number</Label>
                <Input value={form.account_number || ''} onChange={e => set('account_number', e.target.value.replace(/\D/g, ''))} placeholder="Account number" />
              </div>
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-2 border-t pt-4">
            <Label>Notes</Label>
            <Input value={form.notes || ''} onChange={e => set('notes', e.target.value)} placeholder="Optional notes" />
          </div>

        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? 'Saving...' : investor ? 'Save Changes' : 'Create Investor'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// ─── Main Page ───────────────────────────────────────────────
const Investors = () => {
  const { role, isMasterAdmin } = useAuth();
  const isAllowed = role === 'admin' || role === 'accounting' || isMasterAdmin;

  const { investors, loading, createInvestor, updateInvestor, deleteInvestor } = useInvestors();
  const { drivers } = useDrivers();
  const { payments } = usePayments();

  // Redirect unauthorized roles to dashboard
  if (!isAllowed) return <Navigate to="/dashboard" replace />;

  const [search, setSearch] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editingInvestor, setEditingInvestor] = useState<DbInvestor | null>(null);
  const [activeTab, setActiveTab] = useState('active');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Cargar driver_investors activos (relación many-to-many real)
  const [driverInvestorLinks, setDriverInvestorLinks] = useState<{ driver_id: string; investor_id: string }[]>([]);
  useEffect(() => {
    supabase
      .from('driver_investors' as any)
      .select('driver_id, investor_id')
      .eq('is_active', true)
      .then(({ data }) => setDriverInvestorLinks((data as any) || []));
  }, []);

  // Count drivers per investor (usando driver_investors)
  const driversPerInvestor = useMemo(() => {
    const map: Record<string, number> = {};
    driverInvestorLinks.forEach(link => {
      if (link.investor_id) map[link.investor_id] = (map[link.investor_id] || 0) + 1;
    });
    return map;
  }, [driverInvestorLinks]);

  // Lista de nombres de drivers por investor (para el tooltip)
  const driverNamesPerInvestor = useMemo(() => {
    const map: Record<string, string[]> = {};
    const driverById = new Map(drivers.map(d => [d.id, d.name]));
    driverInvestorLinks.forEach(link => {
      if (link.investor_id) {
        if (!map[link.investor_id]) map[link.investor_id] = [];
        const name = driverById.get(link.driver_id);
        if (name) map[link.investor_id].push(name);
      }
    });
    return map;
  }, [driverInvestorLinks, drivers]);

  // Pending payment amount per investor (by recipient_id = investor.id for new payments)
  const pendingPerInvestor = useMemo(() => {
    const map: Record<string, number> = {};
    payments
      .filter(p => p.recipient_type === 'investor' && p.status === 'pending')
      .forEach(p => {
        map[p.recipient_id] = (map[p.recipient_id] || 0) + Number(p.amount);
      });
    return map;
  }, [payments]);

  const totalPending = useMemo(() =>
    payments.filter(p => p.recipient_type === 'investor' && p.status === 'pending')
      .reduce((s, p) => s + Number(p.amount), 0),
    [payments]
  );

  const filtered = useMemo(() => {
    let list = investors;
    if (activeTab === 'active') list = list.filter(i => (i.status || 'active') !== 'inactive');
    if (activeTab === 'inactive') list = list.filter(i => i.status === 'inactive');
    if (!search.trim()) return list;
    const q = search.toLowerCase();
    return list.filter(i =>
      i.name.toLowerCase().includes(q) ||
      (i.email || '').toLowerCase().includes(q) ||
      (i.phone || '').toLowerCase().includes(q)
    );
  }, [investors, search, activeTab]);

  const deleteTarget = investors.find(i => i.id === deleteConfirmId);
  const assignedToDelete = deleteTarget ? (driversPerInvestor[deleteTarget.id] || 0) : 0;

  const handleCreate = async (data: InvestorInput) => { await createInvestor(data); };
  const handleEdit = async (data: InvestorInput) => {
    if (!editingInvestor) return;
    await updateInvestor(editingInvestor.id, data);
    setEditingInvestor(null);
  };
  const handleDelete = async () => {
    if (!deleteConfirmId) return;
    await deleteInvestor(deleteConfirmId);
    setDeleteConfirmId(null);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="page-header">Investors</h1>
          <p className="page-description">Manage investors linked to your drivers</p>
        </div>
        <Button onClick={() => { setEditingInvestor(null); setFormOpen(true); }} className="gap-1.5">
          <PlusCircle className="h-4 w-4" /> New Investor
        </Button>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          title="Total Investors"
          value={String(investors.length)}
          icon={Landmark}
          iconClassName="bg-primary/10 text-primary"
        />
        <StatCard
          title="Drivers Assigned"
          value={String(Object.values(driversPerInvestor).reduce((a, b) => a + b, 0))}
          icon={Users}
          iconClassName="bg-sky-500/10 text-sky-500"
        />
        <StatCard
          title="Pending Payments"
          value={`$${totalPending.toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
          icon={DollarSign}
          iconClassName="bg-amber-500/10 text-amber-500"
        />
      </div>

      {/* Search */}
      <div className="relative w-full max-w-xs">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search investors..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-9 h-9"
        />
        {search && (
          <button
            onClick={() => setSearch('')}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Tabs por status */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="active">
            Active <span className={`ml-1.5 text-xs rounded-full px-2 py-0.5 font-semibold ${activeTab === 'active' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>{investors.filter(i => (i.status || 'active') !== 'inactive').length}</span>
          </TabsTrigger>
          <TabsTrigger value="inactive">
            Inactive <span className={`ml-1.5 text-xs rounded-full px-2 py-0.5 font-semibold ${activeTab === 'inactive' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>{investors.filter(i => i.status === 'inactive').length}</span>
          </TabsTrigger>
          <TabsTrigger value="all">
            All <span className={`ml-1.5 text-xs rounded-full px-2 py-0.5 font-semibold ${activeTab === 'all' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>{investors.length}</span>
          </TabsTrigger>
        </TabsList>

      {/* Table */}
      <div className="glass-card overflow-hidden mt-4">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b glass-table-header">
              <th className="text-left p-4 font-medium text-muted-foreground">Name</th>
              <th className="text-left p-4 font-medium text-muted-foreground">Email</th>
              <th className="text-left p-4 font-medium text-muted-foreground">Phone</th>
              <th className="text-left p-4 font-medium text-muted-foreground hidden md:table-cell">Location</th>
              <th className="text-center p-4 font-medium text-muted-foreground">Pay %</th>
              <th className="text-center p-4 font-medium text-muted-foreground">Drivers</th>
              <th className="text-right p-4 font-medium text-muted-foreground">Pending</th>
              <th className="text-left p-4 font-medium text-muted-foreground">Status</th>
              <th className="text-right p-4 font-medium text-muted-foreground">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={7} className="text-center p-8 text-muted-foreground">Loading...</td></tr>
            )}
            {!loading && filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="text-center p-8 text-muted-foreground">
                  {search ? 'No investors match your search.' : 'No investors yet — click "New Investor" to add one.'}
                </td>
              </tr>
            )}
            {filtered.map(inv => (
              <tr key={inv.id} className="border-b last:border-b-0 glass-row border-l-[3px] border-l-[#185FA5]">
                <td className="p-4 font-semibold">
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-full bg-[#185FA5]/10 flex items-center justify-center shrink-0">
                      <Landmark className="h-4 w-4 text-[#185FA5]" />
                    </div>
                    {inv.name}
                    {inv.business_name && (
                      <span className="text-xs text-muted-foreground font-normal">{inv.business_name}</span>
                    )}
                  </div>
                </td>
                <td className="p-4 text-muted-foreground">
                  {inv.email
                    ? <a href={`mailto:${inv.email}`} className="flex items-center gap-1 hover:text-primary"><Mail className="h-3.5 w-3.5" />{inv.email}</a>
                    : '—'}
                </td>
                <td className="p-4 text-muted-foreground">
                  {inv.phone
                    ? <span className="flex items-center gap-1"><Phone className="h-3.5 w-3.5" />{formatPhone(inv.phone)}</span>
                    : '—'}
                </td>
                <td className="p-4 text-muted-foreground text-xs hidden md:table-cell">
                  {inv.city && inv.state ? `${inv.city}, ${inv.state}` : inv.city || inv.state || '—'}
                </td>
                <td className="p-4 text-center">
                  <span className="inline-flex items-center justify-center rounded-full bg-violet-500/10 text-violet-600 dark:text-violet-400 text-xs font-semibold min-w-[40px] h-6 px-2">
                    {inv.pay_percentage}%
                  </span>
                </td>
                <td className="p-4 text-center">
                  {driversPerInvestor[inv.id] > 0
                    ? (
                      <TooltipProvider delayDuration={200}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="inline-flex items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-semibold min-w-[24px] h-6 px-2 cursor-help">{driversPerInvestor[inv.id]}</span>
                          </TooltipTrigger>
                          <TooltipContent>
                            <div className="text-xs">
                              {(driverNamesPerInvestor[inv.id] || []).map((name, i) => (
                                <div key={i}>{name}</div>
                              ))}
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )
                    : <span className="text-muted-foreground text-xs">—</span>}
                </td>
                <td className="p-4 text-right">
                  {pendingPerInvestor[inv.id] > 0
                    ? <span className="font-semibold text-amber-500">${pendingPerInvestor[inv.id].toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                    : <span className="text-muted-foreground text-xs">—</span>}
                </td>
                <td className="p-4" onClick={e => e.stopPropagation()}>
                  <Select value={inv.status || 'active'} onValueChange={v => updateInvestor(inv.id, { status: v })}>
                    <SelectTrigger className="h-8 w-[140px] border-0 p-0 shadow-none focus:ring-0 [&>svg]:hidden bg-transparent">
                      <span className="flex items-center justify-between w-full gap-1">
                        <StatusBadge status={inv.status || 'active'} className="text-[11px] px-3 py-1.5" />
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
                <td className="p-4 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                      onClick={() => { setEditingInvestor(inv); setFormOpen(true); }}>
                      <Pencil className="h-3.5 w-3.5" /> Edit
                    </Button>
                    <CreateAccessButton name={inv.name} email={inv.email} phone={inv.phone} role="investor" />
                    <Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1 text-red-500 hover:text-red-600 hover:bg-red-50"
                      onClick={() => setDeleteConfirmId(inv.id)}>
                      <Trash2 className="h-3.5 w-3.5" /> Delete
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      </Tabs>

      {/* Create / Edit dialog */}
      <InvestorFormDialog
        open={formOpen}
        onOpenChange={open => { setFormOpen(open); if (!open) setEditingInvestor(null); }}
        investor={editingInvestor}
        onSubmit={editingInvestor ? handleEdit : handleCreate}
      />

      {/* Delete confirmation */}
      <Dialog open={!!deleteConfirmId} onOpenChange={open => { if (!open) setDeleteConfirmId(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete investor?</DialogTitle>
          </DialogHeader>
          <div className="py-2 text-sm text-muted-foreground space-y-2">
            <p>This will permanently delete <strong className="text-foreground">{deleteTarget?.name}</strong>.</p>
            {assignedToDelete > 0 && (
              <p className="text-amber-600 font-medium">
                ⚠ {assignedToDelete} driver{assignedToDelete > 1 ? 's are' : ' is'} linked to this investor and will be unlinked.
              </p>
            )}
            <p>Existing payment records are not affected.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmId(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Investors;
