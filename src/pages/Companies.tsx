import { useState } from 'react';
import { useCompanies, Company } from '@/hooks/useCompanies';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';

import { Plus, Pencil, Trash2, Building2 } from 'lucide-react';
import { toast } from 'sonner';
import { StatCard } from '@/components/StatCard';

const emptyForm = {
  name: '', legal_name: '', mc_number: '', dot_number: '',
  address: '', city: '', state: '', zip: '',
  phone: '', email: '', website: '', logo_url: '',
};

const Companies = () => {
  const { companies, loading, createCompany, updateCompany, deleteCompany } = useCompanies();
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [deleteTarget, setDeleteTarget] = useState<Company | null>(null);

  const openNew = () => { setEditId(null); setForm(emptyForm); setShowForm(true); };
  const openEdit = (c: Company) => {
    setEditId(c.id);
    setForm({
      name: c.name, legal_name: c.legal_name || '', mc_number: c.mc_number || '',
      dot_number: c.dot_number || '', address: c.address || '', city: c.city || '',
      state: c.state || '', zip: c.zip || '', phone: c.phone || '', email: c.email || '',
      website: c.website || '', logo_url: c.logo_url || '',
    });
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

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="page-header">Companies</h1>
          <p className="page-description">Configure your trucking company information</p>
        </div>
        <Button size="sm" className="gap-2" onClick={openNew}>
          <Plus className="h-4 w-4" /> New Company
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <StatCard title="Total Companies" value={companies.length} icon={Building2} />
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-[15px]">
              <thead><tr className="border-b bg-muted/50">
                <th className="text-left p-3 font-medium text-muted-foreground">Company</th>
                <th className="text-left p-3 font-medium text-muted-foreground hidden md:table-cell">MC#</th>
                <th className="text-left p-3 font-medium text-muted-foreground hidden md:table-cell">DOT#</th>
                <th className="text-left p-3 font-medium text-muted-foreground hidden lg:table-cell">City</th>
                <th className="text-left p-3 font-medium text-muted-foreground hidden lg:table-cell">Phone</th>
                <th className="text-left p-3 font-medium text-muted-foreground hidden lg:table-cell">Email</th>
                <th className="text-right p-3 font-medium text-muted-foreground">Actions</th>
              </tr></thead>
              <tbody>
                {companies.length === 0 && !loading && (
                  <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">No companies configured. Add one to include it in your invoices.</td></tr>
                )}
                {companies.map(c => (
                  <tr key={c.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="p-3">
                      <div className="font-medium">{c.name}</div>
                      {c.legal_name && <div className="text-xs text-muted-foreground">{c.legal_name}</div>}
                    </td>
                    <td className="p-3 hidden md:table-cell text-muted-foreground">{c.mc_number || '—'}</td>
                    <td className="p-3 hidden md:table-cell text-muted-foreground">{c.dot_number || '—'}</td>
                    <td className="p-3 hidden lg:table-cell text-muted-foreground">{c.city ? `${c.city}, ${c.state || ''}` : '—'}</td>
                    <td className="p-3 hidden lg:table-cell text-muted-foreground">{c.phone || '—'}</td>
                    <td className="p-3 hidden lg:table-cell text-muted-foreground">{c.email || '—'}</td>
                    <td className="p-3 text-right">
                      <div className="flex justify-end gap-1.5">
                        <Button variant="outline" size="sm" className="h-8 px-2 text-xs border-amber-400 bg-white text-amber-600 hover:bg-amber-50 hover:text-amber-700 gap-1" onClick={() => openEdit(c)} title="Edit">
                          <Pencil className="h-4 w-4" /> Edit
                        </Button>
                        <Button variant="outline" size="sm" className="h-8 px-2 text-xs border-red-400 bg-white text-red-600 hover:bg-red-50 hover:text-red-700 gap-1" onClick={async () => { if (window.confirm(`Delete company ${c.name}? This action is permanent.`)) { await deleteCompany(c.id); } }} title="Delete">
                          <Trash2 className="h-4 w-4" /> Delete
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

      {/* Form Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editId ? 'Edit Company' : 'New Company'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2"><Label>Name *</Label><Input value={form.name} onChange={e => set('name', e.target.value)} /></div>
              <div className="col-span-2"><Label>Legal Name</Label><Input value={form.legal_name} onChange={e => set('legal_name', e.target.value)} /></div>
              <div><Label>MC#</Label><Input value={form.mc_number} onChange={e => set('mc_number', e.target.value)} /></div>
              <div><Label>DOT#</Label><Input value={form.dot_number} onChange={e => set('dot_number', e.target.value)} /></div>
              <div className="col-span-2"><Label>Address</Label><Input value={form.address} onChange={e => set('address', e.target.value)} /></div>
              <div><Label>City</Label><Input value={form.city} onChange={e => set('city', e.target.value)} /></div>
              <div className="grid grid-cols-2 gap-2">
                <div><Label>State</Label><Input value={form.state} onChange={e => set('state', e.target.value)} /></div>
                <div><Label>ZIP</Label><Input value={form.zip} onChange={e => set('zip', e.target.value)} /></div>
              </div>
              <div><Label>Phone</Label><Input value={form.phone} onChange={e => set('phone', e.target.value)} /></div>
              <div><Label>Email</Label><Input value={form.email} onChange={e => set('email', e.target.value)} type="email" /></div>
              <div className="col-span-2"><Label>Website</Label><Input value={form.website} onChange={e => set('website', e.target.value)} /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={!form.name.trim()}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete now uses window.confirm */}
    </div>
  );
};

export default Companies;
