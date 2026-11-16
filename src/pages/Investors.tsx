import { useState, useMemo, useEffect, Fragment } from 'react';
import { WhatsAppGroupSelect } from '@/components/WhatsAppGroupSelect';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useInvestors, DbInvestor, InvestorInput } from '@/hooks/useInvestors';
import { useDrivers } from '@/hooks/useDrivers';
import { usePayments } from '@/hooks/usePayments';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { StatTiles, SolidStatusPill, PILL_INPUT, TABLE_CARD, TABLE_HEAD_ROW, TABLE_ROW } from '@/components/StatTiles';
import { CreateAccessButton } from '@/components/CreateAccessButton';
import { DriverTaxSection } from '@/components/DriverTaxSection';
import { ChevronDown, ChevronUp, Landmark, Pencil, Trash2, PlusCircle, Search, Phone, Mail, Users, DollarSign, X, Percent, UserX } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { formatPhone } from '@/lib/phoneUtils';
import { InvestorDetailPanel, InvestorLink } from '@/components/InvestorDetailPanel';

// ─── Create / Edit Dialog ────────────────────────────────────
const InvestorFormDialog = ({
  open, onOpenChange, investor, onSubmit,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  investor?: DbInvestor | null;
  onSubmit: (data: InvestorInput) => Promise<void>;
}) => {
  const { role, isMasterAdmin } = useAuth();
  const canSeeTax = role === 'admin' || role === 'accounting' || !!isMasterAdmin;
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
    whatsapp_group_id: (investor as any).whatsapp_group_id || null,
    whatsapp_group_name: (investor as any).whatsapp_group_name || null,
  } : {
    name: '', email: '', phone: '', notes: '', pay_percentage: 0,
    address: '', city: '', state: '', zip: '',
    business_name: '', ein: '', ssn_last4: '',
    bank_name: '', account_holder_name: '', routing_number: '', account_number: '', account_type: 'checking',
    whatsapp_group_id: null, whatsapp_group_name: null,
  };

  const [form, setForm] = useState<InvestorInput>(getInitialForm);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  // Recargar el formulario cada vez que se abre (crear o editar otro investor)
  useEffect(() => {
    if (open) setForm(getInitialForm());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, investor]);

  const handleOpen = (v: boolean) => {
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
        whatsapp_group_id: form.whatsapp_group_id || null,
        whatsapp_group_name: form.whatsapp_group_name || null,
      });
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto rounded-[28px] border-0 bg-[#f8fafd] dark:bg-background [&_label]:text-xs [&_label]:font-medium [&_label]:text-[#444746] dark:[&_label]:text-muted-foreground [&_input]:rounded-lg [&_input]:shadow-none [&_input]:bg-white dark:[&_input]:bg-card [&_input]:border-[#c4c7c5] dark:[&_input]:border-border [&_input:focus-visible]:ring-1 [&_input:focus-visible]:ring-[#0b57d0] [&_input:focus-visible]:border-[#0b57d0] [&_button[role=combobox]]:rounded-lg [&_button[role=combobox]]:shadow-none [&_button[role=combobox]]:bg-white dark:[&_button[role=combobox]]:bg-card [&_button[role=combobox]]:border-[#c4c7c5] dark:[&_button[role=combobox]]:border-border [&_textarea]:rounded-lg [&_textarea]:shadow-none [&_textarea]:bg-white dark:[&_textarea]:bg-card [&_textarea]:border-[#c4c7c5]">
        <DialogHeader className="space-y-0">
          <div className="flex items-center gap-3">
            <span className="h-11 w-11 rounded-full bg-[#d3e3fd] dark:bg-blue-900/40 text-[#041e49] dark:text-blue-200 flex items-center justify-center shrink-0">
              <Landmark className="h-5 w-5" />
            </span>
            <div>
              <DialogTitle className="text-[22px] leading-7 font-normal text-[#1f1f1f] dark:text-foreground">{investor ? 'Edit Investor' : 'New Investor'}</DialogTitle>
              <p className="text-sm text-[#444746] dark:text-muted-foreground">{investor ? investor.name : 'Completa la información del investor'}</p>
            </div>
          </div>
        </DialogHeader>
        <div className="space-y-3 py-1">

          {/* Basic Info */}
          <div className="space-y-2 rounded-3xl bg-white dark:bg-card border border-[#e3e3e3] dark:border-border px-4 py-3">
            <h3 className="text-[15px] font-medium text-[#1f1f1f] dark:text-foreground">Personal Information</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-2">
              <div className="space-y-1 sm:col-span-2">
                <Label>Full Name *</Label>
                <Input value={form.name} onChange={e => set('name', e.target.value)} placeholder="Full name" autoFocus />
              </div>
              <div className="space-y-1">
                <Label>Email</Label>
                <Input type="email" value={form.email || ''} onChange={e => set('email', e.target.value)} placeholder="investor@email.com" />
              </div>
              <div className="space-y-1">
                <Label>Phone</Label>
                <Input value={form.phone || ''} onChange={e => set('phone', e.target.value)} placeholder="555-0000" />
              </div>
            </div>
          </div>

          {/* Address */}
          <div className="space-y-2 rounded-3xl bg-white dark:bg-card border border-[#e3e3e3] dark:border-border px-4 py-3">
            <h3 className="text-[15px] font-medium text-[#1f1f1f] dark:text-foreground">Address</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-2">
              <div className="space-y-1 sm:col-span-2">
                <Label>Street Address</Label>
                <Input value={form.address || ''} onChange={e => set('address', e.target.value)} placeholder="123 Main St" />
              </div>
              <div className="space-y-1">
                <Label>City</Label>
                <Input value={form.city || ''} onChange={e => set('city', e.target.value)} placeholder="Miami" />
              </div>
              <div className="space-y-1">
                <Label>State</Label>
                <Input value={form.state || ''} onChange={e => set('state', e.target.value)} placeholder="FL" maxLength={2} />
              </div>
              <div className="space-y-1">
                <Label>Zip Code</Label>
                <Input value={form.zip || ''} onChange={e => set('zip', e.target.value)} placeholder="33101" />
              </div>
            </div>
          </div>

          {/* Business Info */}
          <div className="space-y-2 rounded-3xl bg-white dark:bg-card border border-[#e3e3e3] dark:border-border px-4 py-3">
            <h3 className="text-[15px] font-medium text-[#1f1f1f] dark:text-foreground">Business Information <span className="text-xs font-normal text-[#444746] dark:text-muted-foreground">(opcional)</span></h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-2">
              <div className="space-y-1 sm:col-span-2">
                <Label>Business Name (LLC / Corp)</Label>
                <Input value={form.business_name || ''} onChange={e => set('business_name', e.target.value)} placeholder="e.g. Smith Transport LLC" />
              </div>
              <div className="space-y-1">
                <Label>EIN (si tiene empresa)</Label>
                <Input value={form.ein || ''} onChange={e => set('ein', e.target.value)} placeholder="XX-XXXXXXX" />
              </div>
              <div className="space-y-1">
                <Label>SSN Last 4 (si es persona natural)</Label>
                <Input value={form.ssn_last4 || ''} onChange={e => set('ssn_last4', e.target.value.replace(/\D/g, '').slice(0, 4))} placeholder="XXXX" maxLength={4} />
              </div>
            </div>
          </div>

          {/* Tax Information para el 1099 (solo admin y accounting, al editar) */}
          {investor?.id && canSeeTax && (
            <div className="rounded-3xl bg-white dark:bg-card border border-[#e3e3e3] dark:border-border px-4 py-3">
              <h3 className="text-[15px] font-medium text-[#1f1f1f] dark:text-foreground mb-2">Tax Information</h3>
              <DriverTaxSection driverId={investor.id} recipientType="investor" hasW9={!!investor.w9_url} />
            </div>
          )}

          {/* Pay % */}
          <div className="space-y-1.5 px-4 py-3 rounded-3xl bg-[#f3e8fd] dark:bg-violet-950/30">
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
          <div className="space-y-2 rounded-3xl bg-white dark:bg-card border border-[#e3e3e3] dark:border-border px-4 py-3">
            <h3 className="text-[15px] font-medium text-[#1f1f1f] dark:text-foreground">Banking Information <span className="text-xs font-normal text-[#444746] dark:text-muted-foreground">(ACH Direct Deposit)</span></h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-2">
              <div className="space-y-1 sm:col-span-2">
                <Label>Account Holder Name</Label>
                <Input value={form.account_holder_name || ''} onChange={e => set('account_holder_name', e.target.value)} placeholder="Full name as it appears on the account" />
              </div>
              <div className="space-y-1">
                <Label>Bank Name</Label>
                <Input value={form.bank_name || ''} onChange={e => set('bank_name', e.target.value)} placeholder="e.g. Chase, Bank of America" />
              </div>
              <div className="space-y-1">
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
              <div className="space-y-1">
                <Label>Routing Number</Label>
                <Input value={form.routing_number || ''} onChange={e => set('routing_number', e.target.value.replace(/\D/g, '').slice(0, 9))} placeholder="9-digit routing number" maxLength={9} />
              </div>
              <div className="space-y-1">
                <Label>Account Number</Label>
                <Input value={form.account_number || ''} onChange={e => set('account_number', e.target.value.replace(/\D/g, ''))} placeholder="Account number" />
              </div>
            </div>
          </div>

          <WhatsAppGroupSelect
            className=""
            groupId={form.whatsapp_group_id ?? null}
            groupName={form.whatsapp_group_name ?? null}
            onChange={(id, name) => setForm(prev => ({ ...prev, whatsapp_group_id: id, whatsapp_group_name: name }))}
            hint="Aquí llegan los recibos cuando un pago del investor se marca Paid."
          />

          {/* Notes */}
          <div className="space-y-2 rounded-3xl bg-white dark:bg-card border border-[#e3e3e3] dark:border-border px-4 py-3">
            <Label>Notes</Label>
            <Input value={form.notes || ''} onChange={e => set('notes', e.target.value)} placeholder="Optional notes" />
          </div>

        </div>
        <DialogFooter>
          <Button className="h-10 rounded-full px-5 text-[#0b57d0] hover:text-[#0b57d0] hover:bg-[#e8f0fe] dark:text-blue-300 font-medium" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button className="h-10 rounded-full px-6 bg-[#0b57d0] hover:bg-[#0842a0] text-white font-medium" onClick={handleSubmit} disabled={saving}>
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
  const [driverInvestorLinks, setDriverInvestorLinks] = useState<InvestorLink[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  useEffect(() => {
    supabase
      .from('driver_investors' as any)
      .select('driver_id, investor_id, pay_percentage')
      .eq('is_active', true)
      .then(({ data }) => setDriverInvestorLinks((data as any) || []));
  }, []);

  // Count drivers per investor (usando driver_investors)
  // Solo drivers activos (los inactivos siguen vinculados para el historial de pagos)
  const activeDriverIds = useMemo(() => new Set(drivers.filter(d => d.status !== 'inactive').map(d => d.id)), [drivers]);
  const driversPerInvestor = useMemo(() => {
    const map: Record<string, number> = {};
    driverInvestorLinks.forEach(link => {
      if (link.investor_id && activeDriverIds.has(link.driver_id)) map[link.investor_id] = (map[link.investor_id] || 0) + 1;
    });
    return map;
  }, [driverInvestorLinks, activeDriverIds]);

  // Lista de nombres de drivers por investor (para el tooltip)
  const driverNamesPerInvestor = useMemo(() => {
    const map: Record<string, string[]> = {};
    const driverById = new Map(drivers.map(d => [d.id, d.name]));
    driverInvestorLinks.forEach(link => {
      if (link.investor_id && activeDriverIds.has(link.driver_id)) {
        if (!map[link.investor_id]) map[link.investor_id] = [];
        const name = driverById.get(link.driver_id);
        if (name) map[link.investor_id].push(name);
      }
    });
    return map;
  }, [driverInvestorLinks, drivers, activeDriverIds]);

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
    <div className="space-y-3">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="h-10 w-10 rounded-full bg-[#d3e3fd] dark:bg-blue-900/40 text-[#041e49] dark:text-blue-200 flex items-center justify-center shrink-0">
            <Landmark className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-[24px] leading-8 font-normal text-[#1f1f1f] dark:text-foreground">Investors</h1>
            <p className="text-sm text-[#444746] dark:text-muted-foreground">Manage investors linked to your drivers</p>
          </div>
        </div>
        <Button onClick={() => { setEditingInvestor(null); setFormOpen(true); }} className="h-10 rounded-2xl px-5 gap-2 bg-[#c2e7ff] hover:bg-[#b3dcf5] text-[#001d35] font-medium shadow-[0_1px_2px_rgba(60,64,67,.3),0_1px_3px_1px_rgba(60,64,67,.15)]">
          <PlusCircle className="h-5 w-5" /> New Investor
        </Button>
      </div>

      {/* Resumen */}
      <StatTiles tiles={[
        { label: 'Active Investors', value: investors.filter(i => (i.status || 'active') !== 'inactive').length, icon: Landmark, tint: 'bg-[#d3e3fd] text-[#041e49] dark:bg-blue-900/40 dark:text-blue-200' },
        { label: 'Drivers Assigned', value: Object.values(driversPerInvestor).reduce((a, b) => a + b, 0), icon: Users, tint: 'bg-[#c4eed0] text-[#072711] dark:bg-emerald-900/40 dark:text-emerald-200' },
        { label: 'Pending Payments', value: `$${totalPending.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, icon: DollarSign, tint: 'bg-[#feefc3] text-[#3d2a00] dark:bg-amber-900/40 dark:text-amber-200' },
        { label: 'Inactive', value: investors.filter(i => i.status === 'inactive').length, icon: UserX, tint: 'bg-[#f9dedc] text-[#410e0b] dark:bg-red-900/40 dark:text-red-200' },
      ]} />

      {/* Search */}
      <div className="relative w-full max-w-sm">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-[#444746] dark:text-muted-foreground" />
        <input
          placeholder="Buscar investors..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full h-10 rounded-full bg-white dark:bg-card border border-[#e3e3e3] dark:border-border pl-10 pr-8 text-sm text-[#1f1f1f] dark:text-foreground placeholder:text-[#444746] outline-none focus:shadow-[0_1px_1px_rgba(65,69,73,.3),0_1px_3px_1px_rgba(65,69,73,.15)] transition"
        />
        {search && (
          <button
            onClick={() => setSearch('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Tabs por status */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full justify-start rounded-none sm:rounded-none border-x-0 border-t-0 flex-nowrap border-b border-[#e3e3e3] dark:border-border bg-transparent h-12 p-0 px-1 overflow-x-auto overflow-y-hidden">
          <TabsTrigger className="h-12 rounded-none border-b-[3px] border-transparent px-4 gap-2 text-sm font-medium text-[#444746] dark:text-muted-foreground data-[state=active]:border-[#0b57d0] data-[state=active]:text-[#0b57d0] dark:data-[state=active]:text-blue-300 data-[state=active]:shadow-none data-[state=active]:bg-transparent" value="active">
            Active <span className={`text-[11px] rounded-full px-1.5 py-0.5 font-medium ${activeTab === 'active' ? 'bg-[#0b57d0] text-white' : 'bg-[#f0f4f9] dark:bg-muted text-[#444746] dark:text-muted-foreground'}`}>{investors.filter(i => (i.status || 'active') !== 'inactive').length}</span>
          </TabsTrigger>
          <TabsTrigger className="h-12 rounded-none border-b-[3px] border-transparent px-4 gap-2 text-sm font-medium text-[#444746] dark:text-muted-foreground data-[state=active]:border-[#0b57d0] data-[state=active]:text-[#0b57d0] dark:data-[state=active]:text-blue-300 data-[state=active]:shadow-none data-[state=active]:bg-transparent" value="inactive">
            Inactive <span className={`text-[11px] rounded-full px-1.5 py-0.5 font-medium ${activeTab === 'inactive' ? 'bg-[#0b57d0] text-white' : 'bg-[#f0f4f9] dark:bg-muted text-[#444746] dark:text-muted-foreground'}`}>{investors.filter(i => i.status === 'inactive').length}</span>
          </TabsTrigger>
          <TabsTrigger className="h-12 rounded-none border-b-[3px] border-transparent px-4 gap-2 text-sm font-medium text-[#444746] dark:text-muted-foreground data-[state=active]:border-[#0b57d0] data-[state=active]:text-[#0b57d0] dark:data-[state=active]:text-blue-300 data-[state=active]:shadow-none data-[state=active]:bg-transparent" value="all">
            All <span className={`text-[11px] rounded-full px-1.5 py-0.5 font-medium ${activeTab === 'all' ? 'bg-[#0b57d0] text-white' : 'bg-[#f0f4f9] dark:bg-muted text-[#444746] dark:text-muted-foreground'}`}>{investors.length}</span>
          </TabsTrigger>
        </TabsList>

      {/* Table */}
      <div className={`${TABLE_CARD} mt-3 overflow-x-auto`}>
        <table className="w-full text-sm">
          <thead>
            <tr className={TABLE_HEAD_ROW}>
              <th className="w-8 px-2 py-2.5"></th>
              <th className="text-left px-3 py-2.5 text-xs font-medium text-[#444746] dark:text-muted-foreground">Name</th>
              <th className="text-left px-3 py-2.5 text-xs font-medium text-[#444746] dark:text-muted-foreground">Email</th>
              <th className="text-left px-3 py-2.5 text-xs font-medium text-[#444746] dark:text-muted-foreground">Phone</th>
              <th className="text-left px-3 py-2.5 text-xs font-medium text-[#444746] dark:text-muted-foreground hidden md:table-cell">Location</th>
              <th className="text-center px-3 py-2.5 text-xs font-medium text-[#444746] dark:text-muted-foreground">Pay %</th>
              <th className="text-center px-3 py-2.5 text-xs font-medium text-[#444746] dark:text-muted-foreground">Drivers</th>
              <th className="text-right px-3 py-2.5 text-xs font-medium text-[#444746] dark:text-muted-foreground">Pending</th>
              <th className="text-left px-3 py-2.5 text-xs font-medium text-[#444746] dark:text-muted-foreground">Status</th>
              <th className="text-right px-3 py-2.5 text-xs font-medium text-[#444746] dark:text-muted-foreground">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={10} className="text-center p-8 text-muted-foreground">Loading...</td></tr>
            )}
            {!loading && filtered.length === 0 && (
              <tr>
                <td colSpan={10} className="text-center p-8 text-muted-foreground">
                  {search ? 'No investors match your search.' : 'No investors yet — click "New Investor" to add one.'}
                </td>
              </tr>
            )}
            {filtered.map(inv => (
              <Fragment key={inv.id}>
              <tr className={`${TABLE_ROW} cursor-pointer border-l-4 ${inv.status === 'inactive' ? 'border-l-[#d93025]' : 'border-l-[#188038]'} ${expandedId === inv.id ? 'bg-[#f0f4f9] dark:bg-muted/50 hover:bg-[#f0f4f9]' : ''}`}
                onClick={() => setExpandedId(expandedId === inv.id ? null : inv.id)}>
                <td className="pl-3 pr-1 py-2 text-[#444746]">
                  {expandedId === inv.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </td>
                <td className="px-3 py-2 font-medium text-[#1f1f1f] dark:text-foreground whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-full bg-[#d3e3fd] dark:bg-blue-900/40 flex items-center justify-center shrink-0">
                      <Landmark className="h-4 w-4 text-[#041e49] dark:text-blue-200" />
                    </div>
                    {inv.name}
                    {inv.business_name && (
                      <span className="text-xs text-muted-foreground font-normal">{inv.business_name}</span>
                    )}
                  </div>
                </td>
                <td className="px-3 py-2 text-muted-foreground">
                  {inv.email
                    ? <a href={`mailto:${inv.email}`} className="flex items-center gap-1 hover:text-[#0b57d0] whitespace-nowrap"><Mail className="h-3.5 w-3.5" />{inv.email}</a>
                    : '—'}
                </td>
                <td className="px-3 py-2 text-muted-foreground">
                  {inv.phone
                    ? <span className="flex items-center gap-1 whitespace-nowrap"><Phone className="h-3.5 w-3.5" />{formatPhone(inv.phone)}</span>
                    : '—'}
                </td>
                <td className="px-3 py-2 text-muted-foreground text-xs hidden md:table-cell">
                  {inv.city && inv.state ? `${inv.city}, ${inv.state}` : inv.city || inv.state || '—'}
                </td>
                <td className="px-3 py-2 text-center">
                  <span className="inline-flex items-center justify-center rounded-full bg-[#f3e8fd] text-[#4a148c] dark:bg-violet-900/40 dark:text-violet-200 text-xs font-medium min-w-[40px] h-6 px-2">
                    {inv.pay_percentage}%
                  </span>
                </td>
                <td className="px-3 py-2 text-center">
                  {driversPerInvestor[inv.id] > 0
                    ? (
                      <TooltipProvider delayDuration={200}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="inline-flex items-center justify-center rounded-full bg-[#d3e3fd] text-[#041e49] dark:bg-blue-900/40 dark:text-blue-200 text-xs font-medium min-w-[24px] h-6 px-2 cursor-help">{driversPerInvestor[inv.id]}</span>
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
                <td className="px-3 py-2 text-right">
                  {pendingPerInvestor[inv.id] > 0
                    ? <span className="font-semibold text-amber-500">${pendingPerInvestor[inv.id].toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                    : <span className="text-muted-foreground text-xs">—</span>}
                </td>
                <td className="px-3 py-2" onClick={e => e.stopPropagation()}>
                  <Select value={inv.status || 'active'} onValueChange={v => updateInvestor(inv.id, { status: v })}>
                    <SelectTrigger className="h-8 w-[140px] border-0 p-0 shadow-none focus:ring-0 [&>svg]:hidden bg-transparent">
                      <span className="flex items-center justify-between w-full gap-1">
                        {inv.status === 'inactive'
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
                      onClick={() => { setEditingInvestor(inv); setFormOpen(true); }}>
                      <Pencil className="h-4 w-4" /> Editar
                    </Button>
                    <CreateAccessButton name={inv.name} email={inv.email} phone={inv.phone} role="investor" />
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0 rounded-full text-[#b3261e] hover:text-[#b3261e] hover:bg-[#fce8e6]" title="Delete"
                      onClick={() => setDeleteConfirmId(inv.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </td>
              </tr>
              {expandedId === inv.id && (
                <tr>
                  <td colSpan={10} className="p-0">
                    <InvestorDetailPanel investor={inv} links={driverInvestorLinks} drivers={drivers} />
                  </td>
                </tr>
              )}
              </Fragment>
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
        <DialogContent className="max-w-sm rounded-[28px] border-0 bg-[#f8fafd] dark:bg-background [&_label]:text-xs [&_label]:font-medium [&_label]:text-[#444746] dark:[&_label]:text-muted-foreground [&_input]:rounded-lg [&_input]:shadow-none [&_input]:bg-white dark:[&_input]:bg-card [&_input]:border-[#c4c7c5] dark:[&_input]:border-border [&_input:focus-visible]:ring-1 [&_input:focus-visible]:ring-[#0b57d0] [&_input:focus-visible]:border-[#0b57d0] [&_button[role=combobox]]:rounded-lg [&_button[role=combobox]]:shadow-none [&_button[role=combobox]]:bg-white dark:[&_button[role=combobox]]:bg-card [&_button[role=combobox]]:border-[#c4c7c5] dark:[&_button[role=combobox]]:border-border [&_textarea]:rounded-lg [&_textarea]:shadow-none [&_textarea]:bg-white dark:[&_textarea]:bg-card [&_textarea]:border-[#c4c7c5]">
          <DialogHeader>
            <DialogTitle className="text-[22px] leading-7 font-normal text-[#1f1f1f] dark:text-foreground">Delete investor?</DialogTitle>
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
            <Button className="h-10 rounded-full px-5 text-[#0b57d0] hover:text-[#0b57d0] hover:bg-[#e8f0fe] dark:text-blue-300 font-medium" variant="ghost" onClick={() => setDeleteConfirmId(null)}>Cancel</Button>
            <Button className="h-10 rounded-full px-6 bg-[#b3261e] hover:bg-[#8c1d18] text-white font-medium"  onClick={handleDelete}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Investors;
