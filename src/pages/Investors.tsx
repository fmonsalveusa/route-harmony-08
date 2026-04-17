import { useState, useMemo } from 'react';
import { useInvestors, DbInvestor, InvestorInput } from '@/hooks/useInvestors';
import { useDrivers } from '@/hooks/useDrivers';
import { usePayments } from '@/hooks/usePayments';
import { StatCard } from '@/components/StatCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Landmark, Pencil, Trash2, PlusCircle, Search, Phone, Mail, Users, DollarSign, X, Percent } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

// ─── Create / Edit Dialog ────────────────────────────────────
const InvestorFormDialog = ({
  open, onOpenChange, investor, onSubmit,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  investor?: DbInvestor | null;
  onSubmit: (data: InvestorInput) => Promise<void>;
}) => {
  const getInitialForm = (): InvestorInput => investor
    ? { name: investor.name, email: investor.email || '', phone: investor.phone || '', notes: investor.notes || '', pay_percentage: investor.pay_percentage ?? 0 }
    : { name: '', email: '', phone: '', notes: '', pay_percentage: 0 };

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
      });
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{investor ? 'Edit Investor' : 'New Investor'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Name *</Label>
            <Input
              value={form.name}
              onChange={e => set('name', e.target.value)}
              placeholder="Full name"
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label>Email</Label>
            <Input
              type="email"
              value={form.email || ''}
              onChange={e => set('email', e.target.value)}
              placeholder="investor@email.com"
            />
          </div>

          <div className="space-y-2">
            <Label>Phone</Label>
            <Input
              value={form.phone || ''}
              onChange={e => set('phone', e.target.value)}
              placeholder="555-0000"
            />
          </div>

          {/* Pay percentage — key field */}
          <div className="space-y-2 p-3 rounded-lg border-2 border-violet-400/50 bg-violet-50 dark:bg-violet-950/20">
            <Label className="font-semibold text-violet-700 dark:text-violet-300 flex items-center gap-1.5">
              <Percent className="h-4 w-4" /> Investor Pay % ⭐
            </Label>
            <Input
              type="number"
              min={0}
              max={100}
              step={0.5}
              value={form.pay_percentage ?? ''}
              onChange={e => set('pay_percentage', e.target.value)}
              placeholder="e.g. 75"
              className="text-lg font-semibold"
            />
            <p className="text-xs text-violet-600 dark:text-violet-400">
              Percentage of each load's total rate paid to this investor.
              This value auto-fills when the investor is assigned to a driver.
            </p>
          </div>

          <div className="space-y-2">
            <Label>Notes</Label>
            <Input
              value={form.notes || ''}
              onChange={e => set('notes', e.target.value)}
              placeholder="Optional notes"
            />
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
  const { investors, loading, createInvestor, updateInvestor, deleteInvestor } = useInvestors();
  const { drivers } = useDrivers();
  const { payments } = usePayments();

  const [search, setSearch] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editingInvestor, setEditingInvestor] = useState<DbInvestor | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Count drivers per investor
  const driversPerInvestor = useMemo(() => {
    const map: Record<string, number> = {};
    drivers.forEach(d => {
      const invId = (d as any).investor_id;
      if (invId) map[invId] = (map[invId] || 0) + 1;
    });
    return map;
  }, [drivers]);

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
    if (!search.trim()) return investors;
    const q = search.toLowerCase();
    return investors.filter(i =>
      i.name.toLowerCase().includes(q) ||
      (i.email || '').toLowerCase().includes(q) ||
      (i.phone || '').toLowerCase().includes(q)
    );
  }, [investors, search]);

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

      {/* Table */}
      <div className="glass-card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b glass-table-header">
              <th className="text-left p-4 font-medium text-muted-foreground">Name</th>
              <th className="text-left p-4 font-medium text-muted-foreground">Email</th>
              <th className="text-left p-4 font-medium text-muted-foreground">Phone</th>
              <th className="text-center p-4 font-medium text-muted-foreground">Pay %</th>
              <th className="text-center p-4 font-medium text-muted-foreground">Drivers</th>
              <th className="text-right p-4 font-medium text-muted-foreground">Pending</th>
              <th className="text-left p-4 font-medium text-muted-foreground">Notes</th>
              <th className="text-right p-4 font-medium text-muted-foreground">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={8} className="text-center p-8 text-muted-foreground">Loading...</td></tr>
            )}
            {!loading && filtered.length === 0 && (
              <tr>
                <td colSpan={8} className="text-center p-8 text-muted-foreground">
                  {search ? 'No investors match your search.' : 'No investors yet — click "New Investor" to add one.'}
                </td>
              </tr>
            )}
            {filtered.map(inv => (
              <tr key={inv.id} className="border-b last:border-0 glass-row">
                <td className="p-4 font-semibold">
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <Landmark className="h-4 w-4 text-primary" />
                    </div>
                    {inv.name}
                  </div>
                </td>
                <td className="p-4 text-muted-foreground">
                  {inv.email
                    ? <a href={`mailto:${inv.email}`} className="flex items-center gap-1 hover:text-primary"><Mail className="h-3.5 w-3.5" />{inv.email}</a>
                    : '—'}
                </td>
                <td className="p-4 text-muted-foreground">
                  {inv.phone
                    ? <span className="flex items-center gap-1"><Phone className="h-3.5 w-3.5" />{inv.phone}</span>
                    : '—'}
                </td>
                <td className="p-4 text-center">
                  <span className="inline-flex items-center justify-center rounded-full bg-violet-500/10 text-violet-600 dark:text-violet-400 text-xs font-semibold min-w-[40px] h-6 px-2">
                    {inv.pay_percentage}%
                  </span>
                </td>
                <td className="p-4 text-center">
                  {driversPerInvestor[inv.id] > 0
                    ? <span className="inline-flex items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-semibold min-w-[24px] h-6 px-2">{driversPerInvestor[inv.id]}</span>
                    : <span className="text-muted-foreground text-xs">—</span>}
                </td>
                <td className="p-4 text-right">
                  {pendingPerInvestor[inv.id] > 0
                    ? <span className="font-semibold text-amber-500">${pendingPerInvestor[inv.id].toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                    : <span className="text-muted-foreground text-xs">—</span>}
                </td>
                <td className="p-4 text-muted-foreground text-xs max-w-[180px] truncate">
                  {inv.notes || '—'}
                </td>
                <td className="p-4 text-right">
                  <div className="flex items-center justify-end gap-1.5">
                    <button
                      className="glass-action-btn tint-amber inline-flex items-center"
                      onClick={() => { setEditingInvestor(inv); setFormOpen(true); }}
                    >
                      <Pencil className="h-4 w-4" /> Edit
                    </button>
                    <button
                      className="glass-action-btn tint-red inline-flex items-center"
                      onClick={() => setDeleteConfirmId(inv.id)}
                    >
                      <Trash2 className="h-4 w-4" /> Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

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
