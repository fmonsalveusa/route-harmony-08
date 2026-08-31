import React, { useState } from 'react';
import { useCompanies, Company } from '@/hooks/useCompanies';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Pencil, Building2, Star, FileSignature, Plus, Trash2, Power, PowerOff } from 'lucide-react';
import { toast } from 'sonner';
import { StatCard } from '@/components/StatCard';

type CompanyForm = {
  name: string; legal_name: string; mc_number: string; dot_number: string;
  address: string; city: string; state: string; zip: string;
  phone: string; email: string; website: string; logo_url: string;
  leasing_agreement_active: boolean;
};

const emptyForm: CompanyForm = {
  name: '', legal_name: '', mc_number: '', dot_number: '',
  address: '', city: '', state: '', zip: '',
  phone: '', email: '', website: '', logo_url: '',
  leasing_agreement_active: false,
};

const Companies = () => {
  const { companies, loading, createCompany, updateCompany, deleteCompany, setPrimaryCompany } = useCompanies();
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<CompanyForm>(emptyForm);
  const [activeTab, setActiveTab] = useState('active');

  const hasCompany = companies.length > 0;
  const isSetupMode = !hasCompany && !loading;

  const activeCompanies = companies.filter(c => c.status !== 'inactive');
  const inactiveCompanies = companies.filter(c => c.status === 'inactive');

  const openEdit = (c: Company) => {
    setEditId(c.id);
    setForm({
      name: c.name, legal_name: c.legal_name || '', mc_number: c.mc_number || '',
      dot_number: c.dot_number || '', address: c.address || '', city: c.city || '',
      state: c.state || '', zip: c.zip || '', phone: c.phone || '', email: c.email || '',
      website: c.website || '', logo_url: c.logo_url || '',
      leasing_agreement_active: c.leasing_agreement_active ?? false,
    });
    setShowForm(true);
  };

  const toggleLeasing = async (c: Company) => {
    await updateCompany(c.id, { leasing_agreement_active: !c.leasing_agreement_active } as any);
  };

  const toggleStatus = async (c: Company) => {
    const newStatus = c.status === 'inactive' ? 'active' : 'inactive';
    await updateCompany(c.id, { status: newStatus } as any);
  };

  const handleDelete = async (c: Company) => {
    if (!confirm(`¿Eliminar "${c.name}"? Esta acción no se puede deshacer.`)) return;
    await deleteCompany(c.id);
  };

  const openNew = () => {
    setEditId(null);
    setForm(emptyForm);
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.error('Required field: Company Name');
      return;
    }
    const payload: any = { ...form };
    Object.keys(payload).forEach(k => { if (payload[k] === '') payload[k] = null; });
    payload.name = form.name;
    payload.is_primary = true;
    if (editId) await updateCompany(editId, payload);
    else await createCompany(payload);
    setShowForm(false);
  };

  const set = (field: string, val: string) => setForm(f => ({ ...f, [field]: val }));

  if (isSetupMode) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-6">
        <div className="p-4 rounded-full bg-primary/10">
          <Building2 className="h-12 w-12 text-primary" />
        </div>
        <div className="text-center space-y-2 max-w-md">
          <h1 className="text-2xl font-bold">¡Bienvenido a DispatchUp!</h1>
          <p className="text-muted-foreground">
            Para comenzar a usar el sistema, completa la información de tu empresa. Esta información se usará en tus facturas y documentos.
          </p>
        </div>
        <Button size="lg" className="gap-2" onClick={() => { setEditId(null); setForm(emptyForm); setShowForm(true); }}>
          <Building2 className="h-5 w-5" /> Configurar mi Empresa
        </Button>
        <CompanyFormDialog open={showForm} onOpenChange={setShowForm} editId={editId} form={form} set={set} setForm={setForm} onSave={handleSave} />
      </div>
    );
  }

  const renderTable = (list: Company[]) => (
    <div className="glass-card overflow-hidden">
      <div className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-[15px]">
            <thead><tr className="border-b glass-table-header">
              <th className="text-left p-3 font-medium text-muted-foreground">Empresa</th>
              <th className="text-left p-3 font-medium text-muted-foreground hidden md:table-cell">MC#</th>
              <th className="text-left p-3 font-medium text-muted-foreground hidden md:table-cell">DOT#</th>
              <th className="text-left p-3 font-medium text-muted-foreground hidden lg:table-cell">Ciudad</th>
              <th className="text-left p-3 font-medium text-muted-foreground hidden lg:table-cell">Teléfono</th>
              <th className="text-left p-3 font-medium text-muted-foreground hidden lg:table-cell">Email</th>
              <th className="text-center p-3 font-medium text-muted-foreground">
                <div className="flex items-center justify-center gap-1">
                  <FileSignature className="h-3.5 w-3.5" /> Leasing
                </div>
              </th>
              <th className="text-right p-3 font-medium text-muted-foreground">Acciones</th>
            </tr></thead>
            <tbody>
              {list.length === 0 && (
                <tr><td colSpan={8} className="p-8 text-center text-muted-foreground">No hay empresas en esta categoría</td></tr>
              )}
              {list.map(c => (
                <tr key={c.id} className="border-b last:border-0 glass-row">
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <div className="font-medium">{c.name}</div>
                      {c.is_primary && (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 px-2 py-0.5 rounded-full">
                          <Star className="h-3 w-3 fill-current" /> Principal
                        </span>
                      )}
                    </div>
                    {c.legal_name && <div className="text-xs text-muted-foreground">{c.legal_name}</div>}
                  </td>
                  <td className="p-3 hidden md:table-cell text-muted-foreground">{c.mc_number || '—'}</td>
                  <td className="p-3 hidden md:table-cell text-muted-foreground">{c.dot_number || '—'}</td>
                  <td className="p-3 hidden lg:table-cell text-muted-foreground">{c.city ? `${c.city}, ${c.state || ''}` : '—'}</td>
                  <td className="p-3 hidden lg:table-cell text-muted-foreground">{c.phone || '—'}</td>
                  <td className="p-3 hidden lg:table-cell text-muted-foreground">{c.email || '—'}</td>
                  <td className="p-3 text-center">
                    <Switch
                      checked={c.leasing_agreement_active ?? false}
                      onCheckedChange={() => toggleLeasing(c)}
                      title={c.leasing_agreement_active ? 'Quitar del Leasing Agreement' : 'Incluir en Leasing Agreement'}
                    />
                  </td>
                  <td className="p-3 text-right">
                    <div className="flex justify-end gap-1.5">
                      <button className="glass-action-btn tint-amber inline-flex items-center" onClick={() => openEdit(c)} title="Editar">
                        <Pencil className="h-4 w-4" /> Editar
                      </button>
                      <button
                        className={`glass-action-btn inline-flex items-center ${c.status === 'inactive' ? 'tint-green' : 'tint-slate'}`}
                        onClick={() => toggleStatus(c)}
                        title={c.status === 'inactive' ? 'Activar' : 'Desactivar'}
                      >
                        {c.status === 'inactive' ? <><Power className="h-4 w-4" /> Activate</> : <><PowerOff className="h-4 w-4" /> Deactivate</>}
                      </button>
                      <button className="glass-action-btn tint-red inline-flex items-center" onClick={() => handleDelete(c)} title="Eliminar">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="page-header">Companies</h1>
          <p className="page-description">Manage your carrier companies for invoices, documents, and leasing agreements</p>
        </div>
        <Button className="gap-2 self-start sm:self-auto" onClick={openNew}>
          <Plus className="h-4 w-4" /> Add New Company
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard title="Total Companies" value={companies.length} icon={Building2} />
        <StatCard title="Active" value={activeCompanies.length} icon={Power} />
        <StatCard title="Inactive" value={inactiveCompanies.length} icon={PowerOff} />
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="active">Active ({activeCompanies.length})</TabsTrigger>
          <TabsTrigger value="inactive">Inactive ({inactiveCompanies.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="mt-4">
          {renderTable(activeCompanies)}
        </TabsContent>

        <TabsContent value="inactive" className="mt-4">
          {renderTable(inactiveCompanies)}
        </TabsContent>
      </Tabs>

      <CompanyFormDialog open={showForm} onOpenChange={setShowForm} editId={editId} form={form} set={set} setForm={setForm} onSave={handleSave} />
    </div>
  );
};

const CompanyFormDialog = ({
  open, onOpenChange, editId, form, set, setForm, onSave,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editId: string | null;
  form: CompanyForm;
  set: (field: string, val: string) => void;
  setForm: React.Dispatch<React.SetStateAction<CompanyForm>>;
  onSave: () => void;
}) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>{editId ? 'Editar Empresa' : 'Configurar Empresa'}</DialogTitle>
      </DialogHeader>
      <div className="grid gap-4 py-2">
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2"><Label>Nombre de la Empresa *</Label><Input value={form.name} onChange={e => set('name', e.target.value)} /></div>
          <div className="col-span-2"><Label>Nombre Legal</Label><Input value={form.legal_name} onChange={e => set('legal_name', e.target.value)} /></div>
          <div><Label>MC#</Label><Input value={form.mc_number} onChange={e => set('mc_number', e.target.value)} /></div>
          <div><Label>DOT#</Label><Input value={form.dot_number} onChange={e => set('dot_number', e.target.value)} /></div>
          <div className="col-span-2"><Label>Dirección</Label><Input value={form.address} onChange={e => set('address', e.target.value)} /></div>
          <div><Label>Ciudad</Label><Input value={form.city} onChange={e => set('city', e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label>Estado</Label><Input value={form.state} onChange={e => set('state', e.target.value)} /></div>
            <div><Label>ZIP</Label><Input value={form.zip} onChange={e => set('zip', e.target.value)} /></div>
          </div>
          <div><Label>Teléfono</Label><Input value={form.phone} onChange={e => set('phone', e.target.value)} /></div>
          <div><Label>Email</Label><Input value={form.email} onChange={e => set('email', e.target.value)} type="email" /></div>
          <div className="col-span-2"><Label>Website</Label><Input value={form.website} onChange={e => set('website', e.target.value)} /></div>
        </div>

        <div className="flex items-center justify-between rounded-lg border p-4 bg-muted/30">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2 font-medium text-sm">
              <FileSignature className="h-4 w-4 text-primary" />
              Incluir en Leasing Agreement
            </div>
            <p className="text-xs text-muted-foreground">
              {form.leasing_agreement_active
                ? '✅ Activo — se genera un Leasing Agreement con esta empresa durante el onboarding'
                : '⬜ Desactivado — no se genera Leasing Agreement con esta empresa'}
            </p>
          </div>
          <Switch
            checked={form.leasing_agreement_active}
            onCheckedChange={v => setForm(f => ({ ...f, leasing_agreement_active: v }))}
          />
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
        <Button onClick={onSave} disabled={!form.name.trim()}>Guardar</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
);

export default Companies;
