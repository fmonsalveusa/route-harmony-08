import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { Plus, Search, Building2, Eye, Pencil, Ban, CheckCircle } from 'lucide-react';

type WizardStep = 1 | 2 | 3 | 4 | 5;

interface TenantForm {
  legal_name: string;
  dba_name: string;
  dot_number: string;
  mc_number: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  phone: string;
  email: string;
  // Admin
  admin_name: string;
  admin_email: string;
  admin_phone: string;
  admin_password: string;
  // Plan
  plan: 'basic' | 'intermediate' | 'pro';
}

const planDetails = {
  basic: { label: 'Básico', price: 199, maxUsers: 1, maxTrucks: 5, color: 'border-green-300 bg-green-50' },
  intermediate: { label: 'Intermedio', price: 399, maxUsers: 2, maxTrucks: 15, color: 'border-blue-300 bg-blue-50' },
  pro: { label: 'Pro', price: 799, maxUsers: 20, maxTrucks: 100, color: 'border-amber-300 bg-amber-50' },
};

const emptyForm: TenantForm = {
  legal_name: '', dba_name: '', dot_number: '', mc_number: '',
  address: '', city: '', state: '', zip: '', phone: '', email: '',
  admin_name: '', admin_email: '', admin_phone: '', admin_password: '',
  plan: 'basic',
};

const generatePassword = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$';
  return Array.from({ length: 12 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
};

const MasterTenants = () => {
  const [tenants, setTenants] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showWizard, setShowWizard] = useState(false);
  const [wizardStep, setWizardStep] = useState<WizardStep>(1);
  const [form, setForm] = useState<TenantForm>({ ...emptyForm, admin_password: generatePassword() });
  const [creating, setCreating] = useState(false);
  const [createdCreds, setCreatedCreds] = useState<{ email: string; password: string } | null>(null);
  const [detailTenant, setDetailTenant] = useState<any>(null);
  const [editTenant, setEditTenant] = useState<any>(null);
  const [editForm, setEditForm] = useState({
    name: '', legal_name: '', dba_name: '', dot_number: '', mc_number: '',
    address: '', city: '', state: '', zip: '', phone: '', email: '', website: '',
    plan: '' as string,
  });

  const openEdit = (t: any) => {
    setEditForm({
      name: t.name || '', legal_name: t.legal_name || '', dba_name: t.dba_name || '',
      dot_number: t.dot_number || '', mc_number: t.mc_number || '',
      address: t.address || '', city: t.city || '', state: t.state || '',
      zip: t.zip || '', phone: t.phone || '', email: t.email || '', website: t.website || '',
      plan: t.subscription?.plan || '',
    });
    setEditTenant(t);
  };

  const handleEditSave = async () => {
    if (!editTenant) return;
    const { plan, ...rest } = editForm;
    const payload: any = { ...rest };
    Object.keys(payload).forEach(k => { if (payload[k] === '') payload[k] = null; });
    payload.name = rest.name || rest.legal_name;
    const { error } = await supabase.from('tenants').update(payload).eq('id', editTenant.id);
    if (error) { toast.error('Error al actualizar empresa'); return; }

    // Update subscription plan if changed
    if (plan && plan !== editTenant.subscription?.plan) {
      const pd = planDetails[plan as keyof typeof planDetails];
      if (pd && editTenant.subscription?.id) {
        const { error: subErr } = await supabase.from('subscriptions').update({
          plan: plan as any,
          price_monthly: pd.price,
          max_users: pd.maxUsers,
          max_trucks: pd.maxTrucks,
        }).eq('id', editTenant.subscription.id);
        if (subErr) { toast.error('Error al actualizar plan'); return; }
      } else if (pd && !editTenant.subscription) {
        // Create subscription if none exists
        await supabase.from('subscriptions').insert({
          tenant_id: editTenant.id,
          plan: plan as any,
          price_monthly: pd.price,
          max_users: pd.maxUsers,
          max_trucks: pd.maxTrucks,
        });
      }
    }

    toast.success('Empresa actualizada');
    setEditTenant(null);
    fetchTenants();
  };

  const fetchTenants = async () => {
    const { data: tData } = await supabase.from('tenants').select('*').order('created_at', { ascending: false });
    const { data: sData } = await supabase.from('subscriptions').select('*');
    const { data: pData } = await supabase.from('profiles').select('id, tenant_id, full_name, email').not('is_master_admin', 'eq', true);
    const { data: trkData } = await supabase.from('trucks').select('id, tenant_id');

    const subsMap = Object.fromEntries((sData || []).map(s => [s.tenant_id, s]));
    const userCounts: Record<string, number> = {};
    const truckCounts: Record<string, number> = {};
    (pData || []).forEach(p => { if (p.tenant_id) userCounts[p.tenant_id] = (userCounts[p.tenant_id] || 0) + 1; });
    (trkData || []).forEach(t => { if ((t as any).tenant_id) truckCounts[(t as any).tenant_id] = (truckCounts[(t as any).tenant_id] || 0) + 1; });

    setTenants((tData || []).map(t => ({
      ...t,
      subscription: subsMap[t.id],
      userCount: userCounts[t.id] || 0,
      truckCount: truckCounts[t.id] || 0,
    })));
    setLoading(false);
  };

  useEffect(() => { fetchTenants(); }, []);

  const filtered = tenants.filter(t => {
    if (statusFilter !== 'all') {
      if (statusFilter === 'active' && !t.is_active) return false;
      if (statusFilter === 'inactive' && t.is_active) return false;
    }
    if (search) {
      const s = search.toLowerCase();
      return t.name?.toLowerCase().includes(s) || t.legal_name?.toLowerCase().includes(s) || t.dot_number?.includes(s) || t.mc_number?.includes(s);
    }
    return true;
  });

  const openWizard = () => {
    setForm({ ...emptyForm, admin_password: generatePassword() });
    setWizardStep(1);
    setCreatedCreds(null);
    setShowWizard(true);
  };

  const handleCreate = async () => {
    setCreating(true);
    try {
      // 1. Create tenant
      const { data: tenant, error: tErr } = await supabase.from('tenants').insert({
        name: form.dba_name || form.legal_name,
        legal_name: form.legal_name,
        dba_name: form.dba_name,
        dot_number: form.dot_number,
        mc_number: form.mc_number,
        address: form.address,
        city: form.city,
        state: form.state,
        zip: form.zip,
        phone: form.phone,
        email: form.email,
      }).select().single();

      if (tErr || !tenant) throw new Error(tErr?.message || 'Failed to create tenant');

      // 2. Create subscription
      const pd = planDetails[form.plan];
      const { error: sErr } = await supabase.from('subscriptions').insert({
        tenant_id: tenant.id,
        plan: form.plan,
        price_monthly: pd.price,
        max_users: pd.maxUsers,
        max_trucks: pd.maxTrucks,
      });
      if (sErr) throw new Error(sErr.message);

      // 3. Create admin user via edge function
      const { data: signUpData, error: signUpErr } = await supabase.auth.signUp({
        email: form.admin_email,
        password: form.admin_password,
        options: {
          emailRedirectTo: `${window.location.origin}/`,
          data: { full_name: form.admin_name },
        },
      });

      if (signUpErr) throw new Error(signUpErr.message);

      // 4. Update profile with tenant_id
      if (signUpData.user) {
        // Wait a moment for trigger to create profile
        await new Promise(r => setTimeout(r, 1000));

        await supabase.from('profiles').update({
          tenant_id: tenant.id,
          full_name: form.admin_name,
          phone: form.admin_phone,
        }).eq('id', signUpData.user.id);

        // 5. Assign admin role
        await supabase.from('user_roles').insert({
          user_id: signUpData.user.id,
          role: 'admin',
          tenant_id: tenant.id,
        });
      }

      setCreatedCreds({ email: form.admin_email, password: form.admin_password });
      setWizardStep(5);
      toast.success('Empresa creada exitosamente');
      fetchTenants();
    } catch (err: any) {
      toast.error(`Error: ${err.message}`);
    }
    setCreating(false);
  };

  const toggleTenantStatus = async (tenantId: string, currentlyActive: boolean) => {
    await supabase.from('tenants').update({ is_active: !currentlyActive }).eq('id', tenantId);
    toast.success(currentlyActive ? 'Empresa suspendida' : 'Empresa reactivada');
    fetchTenants();
  };

  const planBadge = (plan: string) => {
    const s: Record<string, string> = { basic: 'bg-green-100 text-green-700', intermediate: 'bg-blue-100 text-blue-700', pro: 'bg-amber-100 text-amber-700' };
    return <Badge className={s[plan] || ''}>{plan?.toUpperCase()}</Badge>;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-header">Gestión de Empresas</h1>
          <p className="page-description">Crea y administra empresas en la plataforma</p>
        </div>
        <Button onClick={openWizard} className="bg-purple-600 hover:bg-purple-700">
          <Plus className="h-4 w-4 mr-2" /> Nueva Empresa
        </Button>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search by name, DOT or MC..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left p-3 font-medium text-muted-foreground">Empresa</th>
                  <th className="text-left p-3 font-medium text-muted-foreground hidden md:table-cell">DOT / MC</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">Plan</th>
                  <th className="text-center p-3 font-medium text-muted-foreground">Usuarios</th>
                  <th className="text-center p-3 font-medium text-muted-foreground">Camiones</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">Estado</th>
                  <th className="text-right p-3 font-medium text-muted-foreground">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">No hay empresas.</td></tr>
                )}
                {filtered.map(t => (
                  <tr key={t.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        {t.logo_url ? <img src={t.logo_url} className="h-8 w-8 rounded object-cover" alt="" /> : <Building2 className="h-5 w-5 text-muted-foreground" />}
                        <div>
                          <p className="font-medium">{t.name}</p>
                          {t.legal_name && t.legal_name !== t.name && <p className="text-xs text-muted-foreground">{t.legal_name}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="p-3 hidden md:table-cell text-muted-foreground text-xs">{t.dot_number || '—'} / {t.mc_number || '—'}</td>
                    <td className="p-3">{t.subscription ? planBadge(t.subscription.plan) : '—'}</td>
                    <td className="p-3 text-center">
                      <span className="font-medium">{t.userCount}</span>
                      <span className="text-muted-foreground">/{t.subscription?.max_users || '?'}</span>
                    </td>
                    <td className="p-3 text-center">
                      <span className="font-medium">{t.truckCount}</span>
                      <span className="text-muted-foreground">/{t.subscription?.max_trucks || '?'}</span>
                    </td>
                    <td className="p-3">
                      <Badge className={t.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}>
                        {t.is_active ? 'Activa' : 'Inactiva'}
                      </Badge>
                    </td>
                    <td className="p-3 text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setDetailTenant(t)} title="Ver detalles">
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => openEdit(t)} title="Editar">
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => toggleTenantStatus(t.id, t.is_active)} title={t.is_active ? 'Suspender' : 'Activar'}>
                          {t.is_active ? <Ban className="h-4 w-4 text-red-500" /> : <CheckCircle className="h-4 w-4 text-green-500" />}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Detail Dialog */}
      <Dialog open={!!detailTenant} onOpenChange={() => setDetailTenant(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" /> {detailTenant?.name}
            </DialogTitle>
          </DialogHeader>
          {detailTenant && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-muted-foreground">Legal:</span> {detailTenant.legal_name || '—'}</div>
                <div><span className="text-muted-foreground">DOT:</span> {detailTenant.dot_number || '—'}</div>
                <div><span className="text-muted-foreground">MC:</span> {detailTenant.mc_number || '—'}</div>
                <div><span className="text-muted-foreground">Teléfono:</span> {detailTenant.phone || '—'}</div>
                <div className="col-span-2"><span className="text-muted-foreground">Dirección:</span> {[detailTenant.address, detailTenant.city, detailTenant.state, detailTenant.zip].filter(Boolean).join(', ') || '—'}</div>
              </div>
              {detailTenant.subscription && (
                <div className="border rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">Plan {detailTenant.subscription.plan?.toUpperCase()}</span>
                    <span className="font-semibold">${Number(detailTenant.subscription.price_monthly).toLocaleString()}/mes</span>
                  </div>
                  <div>
                    <div className="flex justify-between text-xs text-muted-foreground mb-1">
                      <span>Usuarios: {detailTenant.userCount}/{detailTenant.subscription.max_users}</span>
                    </div>
                    <Progress value={(detailTenant.userCount / detailTenant.subscription.max_users) * 100} className="h-2" />
                  </div>
                  <div>
                    <div className="flex justify-between text-xs text-muted-foreground mb-1">
                      <span>Camiones: {detailTenant.truckCount}/{detailTenant.subscription.max_trucks}</span>
                    </div>
                    <Progress value={(detailTenant.truckCount / detailTenant.subscription.max_trucks) * 100} className="h-2" />
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editTenant} onOpenChange={() => setEditTenant(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Pencil className="h-5 w-5" /> Editar Empresa</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2"><Label>Nombre Comercial *</Label><Input value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} /></div>
              <div className="col-span-2"><Label>Nombre Legal</Label><Input value={editForm.legal_name} onChange={e => setEditForm(f => ({ ...f, legal_name: e.target.value }))} /></div>
              <div className="col-span-2"><Label>DBA</Label><Input value={editForm.dba_name} onChange={e => setEditForm(f => ({ ...f, dba_name: e.target.value }))} /></div>
              <div><Label>DOT#</Label><Input value={editForm.dot_number} onChange={e => setEditForm(f => ({ ...f, dot_number: e.target.value }))} /></div>
              <div><Label>MC#</Label><Input value={editForm.mc_number} onChange={e => setEditForm(f => ({ ...f, mc_number: e.target.value }))} /></div>
              <div className="col-span-2"><Label>Dirección</Label><Input value={editForm.address} onChange={e => setEditForm(f => ({ ...f, address: e.target.value }))} /></div>
              <div><Label>Ciudad</Label><Input value={editForm.city} onChange={e => setEditForm(f => ({ ...f, city: e.target.value }))} /></div>
              <div className="grid grid-cols-2 gap-2">
                <div><Label>Estado</Label><Input value={editForm.state} onChange={e => setEditForm(f => ({ ...f, state: e.target.value }))} /></div>
                <div><Label>ZIP</Label><Input value={editForm.zip} onChange={e => setEditForm(f => ({ ...f, zip: e.target.value }))} /></div>
              </div>
              <div><Label>Teléfono</Label><Input value={editForm.phone} onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))} /></div>
              <div><Label>Email</Label><Input type="email" value={editForm.email} onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))} /></div>
              <div className="col-span-2"><Label>Website</Label><Input value={editForm.website} onChange={e => setEditForm(f => ({ ...f, website: e.target.value }))} /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditTenant(null)}>Cancelar</Button>
            <Button onClick={handleEditSave} className="bg-purple-600 hover:bg-purple-700">Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Wizard */}
      <Dialog open={showWizard} onOpenChange={() => setShowWizard(false)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Crear Nueva Empresa — Paso {wizardStep} de 5</DialogTitle>
          </DialogHeader>

          {/* Step indicators */}
          <div className="flex gap-1 mb-4">
            {[1, 2, 3, 4, 5].map(s => (
              <div key={s} className={`h-1.5 flex-1 rounded-full transition-colors ${s <= wizardStep ? 'bg-purple-600' : 'bg-muted'}`} />
            ))}
          </div>

          {wizardStep === 1 && (
            <div className="grid gap-4">
              <h3 className="font-semibold">Información de la Empresa</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2"><Label>Nombre Legal *</Label><Input value={form.legal_name} onChange={e => setForm(f => ({ ...f, legal_name: e.target.value }))} required /></div>
                <div className="col-span-2"><Label>DBA / Nombre Comercial</Label><Input value={form.dba_name} onChange={e => setForm(f => ({ ...f, dba_name: e.target.value }))} /></div>
                <div><Label>DOT Number *</Label><Input value={form.dot_number} onChange={e => setForm(f => ({ ...f, dot_number: e.target.value }))} /></div>
                <div><Label>MC Number *</Label><Input value={form.mc_number} onChange={e => setForm(f => ({ ...f, mc_number: e.target.value }))} /></div>
                <div className="col-span-2"><Label>Dirección</Label><Input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} /></div>
                <div><Label>Ciudad</Label><Input value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} /></div>
                <div><Label>Estado</Label><Input value={form.state} onChange={e => setForm(f => ({ ...f, state: e.target.value }))} /></div>
                <div><Label>ZIP</Label><Input value={form.zip} onChange={e => setForm(f => ({ ...f, zip: e.target.value }))} /></div>
                <div><Label>Teléfono *</Label><Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} /></div>
                <div className="col-span-2"><Label>Email</Label><Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} /></div>
              </div>
            </div>
          )}

          {wizardStep === 2 && (
            <div className="grid gap-4">
              <h3 className="font-semibold">Configuración del Administrador</h3>
              <div className="grid gap-3">
                <div><Label>Nombre Completo *</Label><Input value={form.admin_name} onChange={e => setForm(f => ({ ...f, admin_name: e.target.value }))} /></div>
                <div><Label>Email (login) *</Label><Input type="email" value={form.admin_email} onChange={e => setForm(f => ({ ...f, admin_email: e.target.value }))} /></div>
                <div><Label>Teléfono</Label><Input value={form.admin_phone} onChange={e => setForm(f => ({ ...f, admin_phone: e.target.value }))} /></div>
                <div>
                  <Label>Contraseña Temporal</Label>
                  <div className="flex gap-2">
                    <Input value={form.admin_password} readOnly className="font-mono" />
                    <Button variant="outline" onClick={() => setForm(f => ({ ...f, admin_password: generatePassword() }))}>Regenerar</Button>
                    <Button variant="outline" onClick={() => { navigator.clipboard.writeText(form.admin_password); toast.success('Copiada'); }}>Copiar</Button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {wizardStep === 3 && (
            <div className="grid gap-4">
              <h3 className="font-semibold">Selección de Plan</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {(Object.entries(planDetails) as [string, typeof planDetails.basic][]).map(([key, plan]) => (
                  <button
                    key={key}
                    onClick={() => setForm(f => ({ ...f, plan: key as any }))}
                    className={`rounded-lg border-2 p-4 text-left transition-all ${form.plan === key ? `${plan.color} border-primary ring-2 ring-primary/20` : 'border-border hover:border-muted-foreground/30'}`}
                  >
                    <p className="font-bold text-lg">{plan.label}</p>
                    <p className="text-2xl font-bold my-2">${plan.price}<span className="text-sm font-normal text-muted-foreground">/mes</span></p>
                    <ul className="text-xs space-y-1 text-muted-foreground">
                      <li>✓ {plan.maxUsers} usuario(s)</li>
                      <li>✓ {plan.maxTrucks} camiones</li>
                      <li>✓ Cargas ilimitadas</li>
                    </ul>
                  </button>
                ))}
              </div>
            </div>
          )}

          {wizardStep === 4 && (
            <div className="grid gap-4">
              <h3 className="font-semibold">Revisión y Confirmación</h3>
              <div className="space-y-3 text-sm">
                <div className="border rounded-lg p-3">
                  <p className="font-medium mb-1">Empresa</p>
                  <p>{form.legal_name} {form.dba_name && `(${form.dba_name})`}</p>
                  <p className="text-muted-foreground">DOT: {form.dot_number} · MC: {form.mc_number}</p>
                  <p className="text-muted-foreground">{[form.address, form.city, form.state, form.zip].filter(Boolean).join(', ')}</p>
                </div>
                <div className="border rounded-lg p-3">
                  <p className="font-medium mb-1">Administrador</p>
                  <p>{form.admin_name}</p>
                  <p className="text-muted-foreground">{form.admin_email}</p>
                </div>
                <div className="border rounded-lg p-3">
                  <p className="font-medium mb-1">Plan</p>
                  <p>{planDetails[form.plan].label} — ${planDetails[form.plan].price}/mes</p>
                </div>
              </div>
            </div>
          )}

          {wizardStep === 5 && createdCreds && (
            <div className="text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto">
                <CheckCircle className="h-8 w-8 text-green-600" />
              </div>
              <h3 className="font-bold text-lg">¡Empresa creada exitosamente!</h3>
              <div className="border rounded-lg p-4 bg-muted/50 text-left text-sm space-y-2">
                <p><span className="font-medium">Email:</span> {createdCreds.email}</p>
                <p><span className="font-medium">Contraseña:</span> <code className="bg-background px-2 py-0.5 rounded">{createdCreds.password}</code></p>
              </div>
              <Button onClick={() => { navigator.clipboard.writeText(`Email: ${createdCreds.email}\nContraseña: ${createdCreds.password}`); toast.success('Credenciales copiadas'); }}>
                Copiar Credenciales
              </Button>
            </div>
          )}

          {wizardStep < 5 && (
            <DialogFooter className="gap-2">
              {wizardStep > 1 && <Button variant="outline" onClick={() => setWizardStep(s => (s - 1) as WizardStep)}>Anterior</Button>}
              {wizardStep < 4 && (
                <Button onClick={() => setWizardStep(s => (s + 1) as WizardStep)}
                  disabled={wizardStep === 1 && !form.legal_name || wizardStep === 2 && (!form.admin_name || !form.admin_email)}
                >
                  Siguiente
                </Button>
              )}
              {wizardStep === 4 && (
                <Button onClick={handleCreate} disabled={creating} className="bg-purple-600 hover:bg-purple-700">
                  {creating ? 'Creando...' : 'Crear Empresa'}
                </Button>
              )}
            </DialogFooter>
          )}

          {wizardStep === 5 && (
            <DialogFooter>
              <Button onClick={() => setShowWizard(false)}>Cerrar</Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MasterTenants;
