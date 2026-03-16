import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Settings, Pencil, Plus, Users, Truck, UserCheck, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface Plan {
  id: string;
  name: string;
  price: string;
  users: string;
  trucks: string;
  drivers: string;
  /** maps to subscription_plan enum value */
  planKey: string;
}

const defaultPlans: Plan[] = [
  { id: '1', name: 'Basic', price: '$199/mo', users: '1 user', trucks: '5 trucks', drivers: '5 drivers', planKey: 'basic' },
  { id: '2', name: 'Intermediate', price: '$399/mo', users: '2 users', trucks: '15 trucks', drivers: '15 drivers', planKey: 'intermediate' },
  { id: '3', name: 'Pro', price: '$799/mo', users: '20 users', trucks: '100 trucks', drivers: 'Unlimited', planKey: 'pro' },
];

/** Parse numeric values from display strings like "5 drivers" or "Unlimited" */
const parseNumericLimit = (val: string): number => {
  const lower = val.toLowerCase().trim();
  if (lower === 'unlimited' || lower === '-1') return -1;
  const num = parseInt(lower, 10);
  return isNaN(num) ? -1 : num;
};

const parsePriceMonthly = (val: string): number => {
  const num = parseFloat(val.replace(/[^0-9.]/g, ''));
  return isNaN(num) ? 0 : num;
};

const MasterSettings = () => {
  const [plans, setPlans] = useState<Plan[]>(defaultPlans);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
  const [form, setForm] = useState({ name: '', price: '', users: '', trucks: '', drivers: '' });
  const [saving, setSaving] = useState(false);

  const openCreate = () => {
    setEditingPlan(null);
    setForm({ name: '', price: '', users: '', trucks: '', drivers: '' });
    setDialogOpen(true);
  };

  const openEdit = (plan: Plan) => {
    setEditingPlan(plan);
    setForm({ name: plan.name, price: plan.price, users: plan.users, trucks: plan.trucks, drivers: plan.drivers });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name || !form.price) {
      toast.error('Name and price are required');
      return;
    }

    setSaving(true);

    try {
      if (editingPlan) {
        // Update local state
        setPlans(prev => prev.map(p => p.id === editingPlan.id ? { ...p, ...form } : p));

        // Propagate to all tenants & subscriptions with this plan
        const planKey = editingPlan.planKey;
        const maxDrivers = parseNumericLimit(form.drivers);
        const maxTrucks = parseNumericLimit(form.trucks);
        const maxUsers = parseNumericLimit(form.users);
        const priceMonthly = parsePriceMonthly(form.price);

        // Update tenants that have this plan
        const { error: tenantErr } = await supabase
          .from('tenants')
          .update({ max_drivers: maxDrivers })
          .eq('current_plan', planKey);

        if (tenantErr) console.error('Error updating tenants:', tenantErr);

        // Update subscriptions that have this plan
        const { error: subErr } = await supabase
          .from('subscriptions')
          .update({
            max_users: maxUsers,
            max_trucks: maxTrucks,
            price_monthly: priceMonthly,
          })
          .eq('plan', planKey as any);

        if (subErr) console.error('Error updating subscriptions:', subErr);

        toast.success(`Plan "${form.name}" updated. All companies with this plan have been synced.`);
      } else {
        setPlans(prev => [...prev, { id: crypto.randomUUID(), planKey: form.name.toLowerCase().replace(/\s+/g, '_'), ...form }]);
        toast.success('Plan created');
      }
    } catch (err) {
      console.error(err);
      toast.error('Error saving plan');
    } finally {
      setSaving(false);
      setDialogOpen(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-header">Settings</h1>
        <p className="page-description">Global platform configuration</p>
      </div>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2"><Settings className="h-5 w-5" /> Plans & Pricing</CardTitle>
            <CardDescription>Active subscription plan configuration. Changes propagate to all companies on that plan.</CardDescription>
          </div>
          <Button size="sm" onClick={openCreate} className="gap-1">
            <Plus className="h-4 w-4" /> New Plan
          </Button>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {plans.map(p => (
              <div key={p.id} className="border rounded-lg p-4 relative group">
                <Button
                  variant="outline"
                  size="icon"
                  className="absolute top-2 right-2 h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity text-amber-600 hover:text-amber-700"
                  onClick={() => openEdit(p)}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <h3 className="font-bold text-lg mb-1">{p.name}</h3>
                <p className="text-2xl font-bold text-primary">{p.price}</p>
                <ul className="mt-3 text-sm text-muted-foreground space-y-1">
                  <li className="flex items-center gap-1.5"><Users className="h-3.5 w-3.5" /> {p.users}</li>
                  <li className="flex items-center gap-1.5"><Truck className="h-3.5 w-3.5" /> {p.trucks}</li>
                  <li className="flex items-center gap-1.5"><UserCheck className="h-3.5 w-3.5" /> {p.drivers}</li>
                  <li>• Unlimited loads</li>
                </ul>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingPlan ? 'Edit Plan' : 'Create New Plan'}</DialogTitle>
            <DialogDescription>
              {editingPlan
                ? 'Changes will be applied to ALL companies currently on this plan.'
                : 'Fill in the details for the new plan.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Plan Name</Label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Enterprise" />
            </div>
            <div className="space-y-2">
              <Label>Price</Label>
              <Input value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} placeholder="e.g. $1299/mo" />
            </div>
            <div className="space-y-2">
              <Label>Users</Label>
              <Input value={form.users} onChange={e => setForm(f => ({ ...f, users: e.target.value }))} placeholder="e.g. 50 users" />
            </div>
            <div className="space-y-2">
              <Label>Trucks</Label>
              <Input value={form.trucks} onChange={e => setForm(f => ({ ...f, trucks: e.target.value }))} placeholder="e.g. 500 trucks" />
            </div>
            <div className="space-y-2">
              <Label>Drivers</Label>
              <Input value={form.drivers} onChange={e => setForm(f => ({ ...f, drivers: e.target.value }))} placeholder="e.g. 10 drivers or Unlimited" />
              <p className="text-xs text-muted-foreground">Use "Unlimited" for no limit, or a number like "5 drivers"</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              {editingPlan ? 'Save & Sync' : 'Create Plan'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MasterSettings;
