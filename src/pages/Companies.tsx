import React, { useState } from 'react';
import { useCompanies, Company } from '@/hooks/useCompanies';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Pencil, Building2, FileSignature, Plus, Trash2, Power, PowerOff, Puzzle } from 'lucide-react';
import { toast } from 'sonner';
import { StatTiles, TABLE_CARD, TABLE_HEAD_ROW, TABLE_ROW } from '@/components/StatTiles';
import { RtsAssistantDialog } from '@/components/RtsAssistantDialog';
import { DatExtensionDialog } from '@/components/DatExtensionDialog';
import { useAuth } from '@/contexts/AuthContext';

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
  const { companies, loading, createCompany, updateCompany, deleteCompany } = useCompanies();
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<CompanyForm>(emptyForm);
  const [activeTab, setActiveTab] = useState('active');
  const [rtsOpen, setRtsOpen] = useState(false);
  const [datOpen, setDatOpen] = useState(false);
  const { role, isMasterAdmin } = useAuth();
  const isAdmin = role === 'admin' || !!isMasterAdmin;

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
    await updateCompany(c.id, { status: newStatus });
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
        <Button size="lg" className="gap-2 rounded-full px-5 bg-[#0b57d0] hover:bg-[#0842a0] text-white font-medium shadow-none" onClick={() => { setEditId(null); setForm(emptyForm); setShowForm(true); }}>
          <Building2 className="h-5 w-5" /> Configurar mi Empresa
        </Button>
        <CompanyFormDialog open={showForm} onOpenChange={setShowForm} editId={editId} form={form} set={set} setForm={setForm} onSave={handleSave} />
      </div>
    );
  }

  const renderTable = (list: Company[]) => (
    <div className={TABLE_CARD}>
      <div className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-[15px]">
            <thead><tr className={TABLE_HEAD_ROW}>
              <th className="text-left px-3 py-2.5 text-xs font-medium text-[#444746] dark:text-muted-foreground">Empresa</th>
              <th className="text-left px-3 py-2.5 text-xs font-medium text-[#444746] dark:text-muted-foreground hidden md:table-cell">MC#</th>
              <th className="text-left px-3 py-2.5 text-xs font-medium text-[#444746] dark:text-muted-foreground hidden md:table-cell">DOT#</th>
              <th className="text-left px-3 py-2.5 text-xs font-medium text-[#444746] dark:text-muted-foreground hidden lg:table-cell">Ciudad</th>
              <th className="text-left px-3 py-2.5 text-xs font-medium text-[#444746] dark:text-muted-foreground hidden lg:table-cell">Teléfono</th>
              <th className="text-left px-3 py-2.5 text-xs font-medium text-[#444746] dark:text-muted-foreground hidden lg:table-cell">Email</th>
              <th className="text-center px-3 py-2.5 text-xs font-medium text-[#444746] dark:text-muted-foreground">
                <div className="flex items-center justify-center gap-1">
                  <FileSignature className="h-3.5 w-3.5" /> Leasing
                </div>
              </th>
              <th className="text-right px-3 py-2.5 text-xs font-medium text-[#444746] dark:text-muted-foreground">Acciones</th>
            </tr></thead>
            <tbody>
              {list.length === 0 && (
                <tr><td colSpan={8} className="p-8 text-center text-muted-foreground">No hay empresas en esta categoría</td></tr>
              )}
              {list.map(c => (
                <tr key={c.id} className={`${TABLE_ROW} last:border-0 border-l-4 ${c.status === 'inactive' ? 'border-l-red-600' : 'border-l-green-600'}`}>
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <div className="font-medium">{c.name}</div>
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
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="page-header flex items-center gap-3"><span className="page-icon"><Building2 className="h-5 w-5" /></span>Companies</h1>
          <p className="page-description pl-[52px]">Manage your carrier companies for invoices, documents, and leasing agreements</p>
        </div>
        <div className="flex gap-2 self-start sm:self-auto">
          {isAdmin && (
            <Button variant="outline" className="gap-2 rounded-full px-4 shadow-none border-[#747775] dark:border-border text-[#0b57d0] dark:text-blue-300 hover:bg-[#e8f0fe] hover:text-[#0b57d0] font-medium bg-transparent" onClick={() => setRtsOpen(true)}>
              <FileSignature className="h-4 w-4" /> Asistente RTS
            </Button>
          )}
          {isAdmin && (
            <Button variant="outline" className="gap-2 rounded-full px-4 shadow-none border-[#747775] dark:border-border text-[#0b57d0] dark:text-blue-300 hover:bg-[#e8f0fe] hover:text-[#0b57d0] font-medium bg-transparent" onClick={() => setDatOpen(true)}>
              <Puzzle className="h-4 w-4" /> Extensión DAT
            </Button>
          )}
          <Button className="gap-2 rounded-full px-5 bg-[#0b57d0] hover:bg-[#0842a0] text-white font-medium shadow-none" onClick={openNew}>
            <Plus className="h-4 w-4" /> Add New Company
          </Button>
        </div>
      </div>
      <RtsAssistantDialog open={rtsOpen} onOpenChange={setRtsOpen} />
      <DatExtensionDialog open={datOpen} onOpenChange={setDatOpen} />

      <StatTiles tiles={[
        { label: 'Total Companies', value: companies.length, icon: Building2, tint: 'bg-[#d3e3fd] text-[#041e49] dark:bg-blue-900/40 dark:text-blue-200' },
        { label: 'Active', value: activeCompanies.length, icon: Power, tint: 'bg-[#c4eed0] text-[#072711] dark:bg-emerald-900/40 dark:text-emerald-200' },
        { label: 'Inactive', value: inactiveCompanies.length, icon: PowerOff, tint: 'bg-[#f9dedc] text-[#410e0b] dark:bg-red-900/40 dark:text-red-200' },
        { label: 'En Leasing Agreement', value: activeCompanies.filter(c => c.leasing_agreement_active).length, icon: FileSignature, tint: 'bg-[#f3e8fd] text-[#4a148c] dark:bg-violet-900/40 dark:text-violet-200' },
      ]} />

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full justify-start rounded-none sm:rounded-none border-x-0 border-t-0 flex-nowrap border-b border-[#e3e3e3] dark:border-border bg-transparent h-12 p-0 px-1 overflow-x-auto overflow-y-hidden">
          <TabsTrigger className="h-12 rounded-none border-b-[3px] border-transparent px-4 gap-2 text-sm font-medium text-[#444746] dark:text-muted-foreground data-[state=active]:border-[#0b57d0] data-[state=active]:text-[#0b57d0] dark:data-[state=active]:text-blue-300 data-[state=active]:shadow-none data-[state=active]:bg-transparent" value="active">Active ({activeCompanies.length})</TabsTrigger>
          <TabsTrigger className="h-12 rounded-none border-b-[3px] border-transparent px-4 gap-2 text-sm font-medium text-[#444746] dark:text-muted-foreground data-[state=active]:border-[#0b57d0] data-[state=active]:text-[#0b57d0] dark:data-[state=active]:text-blue-300 data-[state=active]:shadow-none data-[state=active]:bg-transparent" value="inactive">Inactive ({inactiveCompanies.length})</TabsTrigger>
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
    <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto rounded-[28px] border-0 bg-[#f8fafd] dark:bg-background [&_label]:text-xs [&_label]:font-medium [&_label]:text-[#444746] dark:[&_label]:text-muted-foreground [&_input]:rounded-lg [&_input]:shadow-none [&_input]:bg-white dark:[&_input]:bg-card [&_input]:border-[#c4c7c5] dark:[&_input]:border-border [&_input:focus-visible]:ring-1 [&_input:focus-visible]:ring-[#0b57d0] [&_input:focus-visible]:border-[#0b57d0] [&_button[role=combobox]]:rounded-lg [&_button[role=combobox]]:shadow-none [&_button[role=combobox]]:bg-white dark:[&_button[role=combobox]]:bg-card [&_button[role=combobox]]:border-[#c4c7c5] dark:[&_button[role=combobox]]:border-border [&_textarea]:rounded-lg [&_textarea]:shadow-none [&_textarea]:bg-white dark:[&_textarea]:bg-card [&_textarea]:border-[#c4c7c5]">
      <DialogHeader>
        <DialogTitle className="text-[22px] leading-7 font-normal text-[#1f1f1f] dark:text-foreground">{editId ? 'Editar Empresa' : 'Configurar Empresa'}</DialogTitle>
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
        <Button className="h-10 rounded-full px-5 text-[#0b57d0] hover:text-[#0b57d0] hover:bg-[#e8f0fe] dark:text-blue-300 font-medium" variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
        <Button className="h-10 rounded-full px-6 bg-[#0b57d0] hover:bg-[#0842a0] text-white font-medium" onClick={onSave} disabled={!form.name.trim()}>Guardar</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
);

export default Companies;
