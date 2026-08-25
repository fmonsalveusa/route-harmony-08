import { useState, useMemo, useRef } from 'react';
import { useDispatchServiceClients, DispatchServiceClient } from '@/hooks/useDispatchServiceClients';
import { useDrivers } from '@/hooks/useDrivers';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Label } from '@/components/ui/label';
import { Plus, Pencil, Trash2, ChevronDown, ChevronUp, Building2, Loader2, Eye, EyeOff, Copy, Check, FileText, ExternalLink, Download, Upload } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface ClientFormState {
  legal_business_name: string;
  dba: string;
  mc_number: string;
  dot_number: string;
  ein: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  phone: string;
  email: string;
  email_password: string;
  owner_full_name: string;
  factoring_company_name: string;
  factoring_username: string;
  factoring_password: string;
  insurance_company_name: string;
  insurance_policy_number: string;
  insurance_expiry_date: string;
}

const emptyForm: ClientFormState = {
  legal_business_name: '',
  dba: '',
  mc_number: '',
  dot_number: '',
  ein: '',
  address: '',
  city: '',
  state: '',
  zip: '',
  phone: '',
  email: '',
  email_password: '',
  owner_full_name: '',
  factoring_company_name: '',
  factoring_username: '',
  factoring_password: '',
  insurance_company_name: '',
  insurance_policy_number: '',
  insurance_expiry_date: '',
};

function ClientFormDialog({
  open,
  onOpenChange,
  editing,
  onSave,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing: DispatchServiceClient | null;
  onSave: (form: ClientFormState, id?: string) => Promise<void>;
}) {
  const [form, setForm] = useState<ClientFormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const update = (field: keyof ClientFormState) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm(prev => ({ ...prev, [field]: e.target.value }));
  };

  // Cargar datos al abrir en modo edicion
  useMemo(() => {
    if (open) {
      if (editing) {
        setForm({
          legal_business_name: editing.legal_business_name || '',
          dba: editing.dba || '',
          mc_number: editing.mc_number || '',
          dot_number: editing.dot_number || '',
          ein: editing.ein || '',
          address: editing.address || '',
          city: editing.city || '',
          state: editing.state || '',
          zip: editing.zip || '',
          phone: editing.phone || '',
          email: editing.email || '',
          email_password: editing.email_password || '',
          owner_full_name: editing.owner_full_name || '',
          factoring_company_name: editing.factoring_company_name || '',
          factoring_username: editing.factoring_username || '',
          factoring_password: editing.factoring_password || '',
          insurance_company_name: editing.insurance_company_name || '',
          insurance_policy_number: editing.insurance_policy_number || '',
          insurance_expiry_date: editing.insurance_expiry_date || '',
        });
      } else {
        setForm(emptyForm);
      }
      setShowPassword(false);
    }
  }, [open, editing]);

  const handleSubmit = async () => {
    if (!form.legal_business_name.trim()) {
      toast({ title: 'Legal Business Name es obligatorio', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      await onSave(form, editing?.id);
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl w-[95vw] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            {editing ? 'Edit Dispatch Service Client' : 'New Dispatch Service Client'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          {/* Empresa */}
          <div>
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">Empresa</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1"><Label>Legal Business Name *</Label><Input value={form.legal_business_name} onChange={update('legal_business_name')} /></div>
              <div className="space-y-1"><Label>DBA (opcional)</Label><Input value={form.dba} onChange={update('dba')} /></div>
              <div className="space-y-1"><Label>MC #</Label><Input value={form.mc_number} onChange={update('mc_number')} /></div>
              <div className="space-y-1"><Label>DOT #</Label><Input value={form.dot_number} onChange={update('dot_number')} /></div>
              <div className="space-y-1"><Label>EIN</Label><Input value={form.ein} onChange={update('ein')} /></div>
              <div className="space-y-1"><Label>Phone</Label><Input value={form.phone} onChange={update('phone')} /></div>
              <div className="space-y-1 md:col-span-2"><Label>Email</Label><Input type="email" value={form.email} onChange={update('email')} /></div>
              <div className="space-y-1 md:col-span-2">
                <Label>Email Password (opcional)</Label>
                <div className="relative">
                  <Input type={showPassword ? 'text' : 'password'} value={form.email_password} onChange={update('email_password')} className="pr-9" placeholder="Solo si el cliente nos da acceso al email" />
                  <button type="button" onClick={() => setShowPassword(v => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div className="space-y-1 md:col-span-2"><Label>Address</Label><Input value={form.address} onChange={update('address')} /></div>
              <div className="space-y-1"><Label>City</Label><Input value={form.city} onChange={update('city')} /></div>
              <div className="space-y-1"><Label>State</Label><Input value={form.state} onChange={update('state')} /></div>
              <div className="space-y-1"><Label>Zip</Label><Input value={form.zip} onChange={update('zip')} /></div>
              <div className="space-y-1 md:col-span-2"><Label>Owner / Authorized Representative (firma el agreement)</Label><Input value={form.owner_full_name} onChange={update('owner_full_name')} /></div>
            </div>
          </div>

          {/* Factoring */}
          <div>
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">Factoring</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="space-y-1"><Label>Factoring Company</Label><Input value={form.factoring_company_name} onChange={update('factoring_company_name')} /></div>
              <div className="space-y-1"><Label>Username</Label><Input value={form.factoring_username} onChange={update('factoring_username')} /></div>
              <div className="space-y-1">
                <Label>Password</Label>
                <div className="relative">
                  <Input type={showPassword ? 'text' : 'password'} value={form.factoring_password} onChange={update('factoring_password')} className="pr-9" />
                  <button type="button" onClick={() => setShowPassword(v => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Insurance */}
          <div>
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">Insurance</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="space-y-1"><Label>Company</Label><Input value={form.insurance_company_name} onChange={update('insurance_company_name')} /></div>
              <div className="space-y-1"><Label>Policy #</Label><Input value={form.insurance_policy_number} onChange={update('insurance_policy_number')} /></div>
              <div className="space-y-1"><Label>Expiry Date</Label><Input type="date" value={form.insurance_expiry_date} onChange={update('insurance_expiry_date')} /></div>
            </div>
          </div>
        </div>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving...</> : editing ? 'Update' : 'Create'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Resuelve un storage path a signed URL (o devuelve http URLs tal cual).
async function resolveDocUrl(pathOrUrl: string | null | undefined): Promise<string | null> {
  if (!pathOrUrl) return null;
  if (pathOrUrl.startsWith('http')) return pathOrUrl;
  const { data } = await supabase.storage.from('driver-documents').createSignedUrl(pathOrUrl, 3600);
  return data?.signedUrl || null;
}

function ClientDocCard({
  label, path, colorClass, clientId, dbColumn, onChanged,
}: {
  label: string;
  path: string | null;
  colorClass?: string;
  clientId: string;
  dbColumn: string;
  onChanged: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isMissing = !path;

  const open = async () => {
    if (!path) return;
    setLoading(true);
    const url = await resolveDocUrl(path);
    setLoading(false);
    if (!url) { toast({ title: 'Archivo no encontrado', variant: 'destructive' }); return; }
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const download = async () => {
    if (!path) return;
    setLoading(true);
    const url = await resolveDocUrl(path);
    if (!url) { setLoading(false); toast({ title: 'Archivo no encontrado', variant: 'destructive' }); return; }
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = `${label.replace(/\s+/g, '_')}.${path.split('.').pop() || 'pdf'}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    } catch { window.open(url, '_blank'); }
    setLoading(false);
  };

  const handleDelete = async () => {
    if (!path) return;
    if (!confirm(`Borrar ${label}?`)) return;
    setLoading(true);
    try {
      // Borrar archivo del storage
      await supabase.storage.from('driver-documents').remove([path]);
      // Setear columna a null
      const { error } = await supabase
        .from('dispatch_service_clients' as any)
        .update({ [dbColumn]: null } as any)
        .eq('id', clientId);
      if (error) throw error;
      toast({ title: `${label} eliminado` });
      onChanged();
    } catch (err: any) {
      toast({ title: 'Error al eliminar', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size === 0) { toast({ title: 'Archivo vacio', variant: 'destructive' }); return; }
    setLoading(true);
    try {
      const ext = file.name.split('.').pop() || 'pdf';
      // Nombre estable por dbColumn para simplicidad; upsert reemplaza si existe
      const key = dbColumn.replace(/_url$/, '');
      const newPath = `dispatch_clients/${clientId}/${key}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from('driver-documents')
        .upload(newPath, file, { upsert: true });
      if (upErr) throw upErr;
      const { error: dbErr } = await supabase
        .from('dispatch_service_clients' as any)
        .update({ [dbColumn]: newPath } as any)
        .eq('id', clientId);
      if (dbErr) throw dbErr;
      toast({ title: `${label} actualizado` });
      onChanged();
    } catch (err: any) {
      toast({ title: 'Error al subir', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className={`border rounded-md p-2 flex flex-col ${isMissing ? 'opacity-70 border-dashed' : 'border-solid'}`}>
      <div className={`flex items-center justify-center h-10 rounded ${colorClass || 'bg-rose-500/10 text-rose-600'} mb-1.5`}>
        <FileText className="h-5 w-5" />
      </div>
      <p className="text-[10px] font-semibold text-center truncate mb-1" title={label}>{label}</p>
      {isMissing ? (
        <>
          <p className="text-[9px] text-center text-muted-foreground italic mb-1">No subido</p>
          <div className="flex justify-center">
            <button
              onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
              disabled={loading}
              className="text-[10px] px-2 py-0.5 rounded bg-primary/10 text-primary hover:bg-primary/20 font-semibold inline-flex items-center gap-1"
              title="Subir"
            >
              {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
              Subir
            </button>
          </div>
        </>
      ) : (
        <div className="flex gap-1 justify-center">
          <button onClick={open} disabled={loading} className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground" title="Ver">
            {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <ExternalLink className="h-3 w-3" />}
          </button>
          <button onClick={download} disabled={loading} className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground" title="Descargar">
            <Download className="h-3 w-3" />
          </button>
          <button onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }} disabled={loading} className="p-1 rounded hover:bg-muted text-primary hover:text-primary" title="Reemplazar">
            <Upload className="h-3 w-3" />
          </button>
          <button onClick={handleDelete} disabled={loading} className="p-1 rounded hover:bg-muted text-destructive hover:text-destructive" title="Borrar">
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      )}
      <input ref={fileInputRef} type="file" accept=".pdf,image/*" className="hidden" onChange={handleUpload} />
    </div>
  );
}

function ClientCard({
  client,
  driverCount,
  driverNames,
  onEdit,
  onDelete,
  onDocsChanged,
}: {
  client: DispatchServiceClient;
  driverCount: number;
  driverNames: string[];
  onEdit: () => void;
  onDelete: () => void;
  onDocsChanged: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const copyToClipboard = (value: string, key: string) => {
    navigator.clipboard.writeText(value);
    setCopied(key);
    setTimeout(() => setCopied(null), 1500);
  };

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-0">
        {/* Header */}
        <div className="flex items-start justify-between p-3 border-b bg-muted/20">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="p-2 rounded-lg bg-primary/10">
              <Building2 className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-semibold text-sm truncate">{client.legal_business_name}</h3>
                {client.dba && <span className="text-xs text-muted-foreground">DBA: {client.dba}</span>}
              </div>
              <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                {client.mc_number && <span>MC# {client.mc_number}</span>}
                {client.dot_number && <span>DOT# {client.dot_number}</span>}
                <span className="font-medium text-foreground">{driverCount} driver{driverCount !== 1 ? 's' : ''}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Button variant="outline" size="sm" onClick={onEdit} className="h-7 gap-1 text-xs">
              <Pencil className="h-3 w-3" /> Edit
            </Button>
            <Button variant="outline" size="sm" onClick={onDelete} className="h-7 gap-1 text-xs text-destructive hover:text-destructive">
              <Trash2 className="h-3 w-3" />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setExpanded(v => !v)} className="h-7 w-7 p-0">
              {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        {expanded && (
          <div className="p-3 space-y-3 text-xs">
            {/* Contact */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <div><span className="text-muted-foreground">Owner:</span> <span className="font-medium">{client.owner_full_name || '—'}</span></div>
              <div><span className="text-muted-foreground">Phone:</span> <span className="font-medium">{client.phone || '—'}</span></div>
              <div className="md:col-span-2"><span className="text-muted-foreground">Email:</span> <span className="font-medium">{client.email || '—'}</span></div>
              {client.email_password && (
                <div className="md:col-span-2 flex items-center gap-1">
                  <span className="text-muted-foreground">Email Password:</span>
                  <span className="font-medium font-mono">{showPassword ? client.email_password : '••••••••'}</span>
                  <button onClick={() => setShowPassword(v => !v)} className="p-0.5 hover:bg-muted rounded" title="Ver">
                    {showPassword ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                  </button>
                  <button onClick={() => copyToClipboard(client.email_password!, 'email-pass')} className="p-0.5 hover:bg-muted rounded" title="Copiar">
                    {copied === 'email-pass' ? <Check className="h-3 w-3 text-green-600" /> : <Copy className="h-3 w-3" />}
                  </button>
                </div>
              )}
              <div className="md:col-span-2">
                <span className="text-muted-foreground">Address:</span>{' '}
                <span className="font-medium">
                  {[client.address, client.city, client.state, client.zip].filter(Boolean).join(', ') || '—'}
                </span>
              </div>
              {client.ein && <div><span className="text-muted-foreground">EIN:</span> <span className="font-medium">{client.ein}</span></div>}
            </div>

            {/* Factoring */}
            {(client.factoring_company_name || client.factoring_username) && (
              <div className="pt-2 border-t">
                <p className="font-semibold text-muted-foreground uppercase tracking-wide text-[10px] mb-1">Factoring</p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                  <div><span className="text-muted-foreground">Company:</span> <span className="font-medium">{client.factoring_company_name || '—'}</span></div>
                  <div className="flex items-center gap-1">
                    <span className="text-muted-foreground">User:</span>
                    <span className="font-medium">{client.factoring_username || '—'}</span>
                    {client.factoring_username && (
                      <button onClick={() => copyToClipboard(client.factoring_username!, 'user')} className="p-0.5 hover:bg-muted rounded" title="Copiar">
                        {copied === 'user' ? <Check className="h-3 w-3 text-green-600" /> : <Copy className="h-3 w-3" />}
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-muted-foreground">Pass:</span>
                    <span className="font-medium font-mono">
                      {client.factoring_password ? (showPassword ? client.factoring_password : '••••••••') : '—'}
                    </span>
                    {client.factoring_password && (
                      <>
                        <button onClick={() => setShowPassword(v => !v)} className="p-0.5 hover:bg-muted rounded" title="Ver">
                          {showPassword ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                        </button>
                        <button onClick={() => copyToClipboard(client.factoring_password!, 'pass')} className="p-0.5 hover:bg-muted rounded" title="Copiar">
                          {copied === 'pass' ? <Check className="h-3 w-3 text-green-600" /> : <Copy className="h-3 w-3" />}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Insurance */}
            {(client.insurance_company_name || client.insurance_policy_number) && (
              <div className="pt-2 border-t">
                <p className="font-semibold text-muted-foreground uppercase tracking-wide text-[10px] mb-1">Insurance</p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                  <div><span className="text-muted-foreground">Company:</span> <span className="font-medium">{client.insurance_company_name || '—'}</span></div>
                  <div><span className="text-muted-foreground">Policy #:</span> <span className="font-medium">{client.insurance_policy_number || '—'}</span></div>
                  <div><span className="text-muted-foreground">Expires:</span> <span className="font-medium">{client.insurance_expiry_date || '—'}</span></div>
                </div>
              </div>
            )}

            {/* Documents */}
            <div className="pt-2 border-t">
              <p className="font-semibold text-muted-foreground uppercase tracking-wide text-[10px] mb-1.5">Documents</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <ClientDocCard label="W9" path={(client as any).w9_url || null} colorClass="bg-blue-500/10 text-blue-600" clientId={client.id} dbColumn="w9_url" onChanged={onDocsChanged} />
                <ClientDocCard label="MC/DOT Authority" path={client.mc_authority_url} colorClass="bg-purple-500/10 text-purple-600" clientId={client.id} dbColumn="mc_authority_url" onChanged={onDocsChanged} />
                <ClientDocCard label="Insurance Cert" path={client.insurance_cert_url} colorClass="bg-emerald-500/10 text-emerald-600" clientId={client.id} dbColumn="insurance_cert_url" onChanged={onDocsChanged} />
                <ClientDocCard label="Signed Agreement" path={client.dispatch_service_agreement_url} colorClass="bg-amber-500/10 text-amber-600" clientId={client.id} dbColumn="dispatch_service_agreement_url" onChanged={onDocsChanged} />
              </div>
            </div>

            {/* Drivers */}
            <div className="pt-2 border-t">
              <p className="font-semibold text-muted-foreground uppercase tracking-wide text-[10px] mb-1">Drivers vinculados</p>
              {driverNames.length === 0 ? (
                <p className="text-muted-foreground italic">Ningun driver vinculado todavia</p>
              ) : (
                <div className="flex flex-wrap gap-1">
                  {driverNames.map(n => (
                    <span key={n} className="inline-flex items-center px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-medium">
                      {n}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Agreement */}
            <div className="pt-2 border-t text-[10px] text-muted-foreground">
              {client.agreement_signed_at
                ? <>Agreement firmado el {new Date(client.agreement_signed_at).toLocaleDateString()}</>
                : <>Agreement no firmado todavia</>}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function DispatchServiceClientsSection() {
  const { clients, loading, createClient, updateClient, deleteClient, refetch } = useDispatchServiceClients();
  const { drivers } = useDrivers();
  const [search, setSearch] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<DispatchServiceClient | null>(null);
  const [deleting, setDeleting] = useState<DispatchServiceClient | null>(null);

  const driversPerClient = useMemo(() => {
    const map: Record<string, { count: number; names: string[] }> = {};
    for (const d of drivers) {
      const cid = (d as any).dispatch_service_client_id;
      if (!cid) continue;
      if (!map[cid]) map[cid] = { count: 0, names: [] };
      map[cid].count++;
      map[cid].names.push(d.name);
    }
    return map;
  }, [drivers]);

  const filtered = useMemo(() => {
    if (!search.trim()) return clients;
    const s = search.toLowerCase();
    return clients.filter(c =>
      c.legal_business_name.toLowerCase().includes(s) ||
      (c.dba || '').toLowerCase().includes(s) ||
      (c.mc_number || '').toLowerCase().includes(s) ||
      (c.dot_number || '').toLowerCase().includes(s)
    );
  }, [clients, search]);

  const handleSave = async (form: ClientFormState, id?: string) => {
    const payload: any = {
      ...form,
      insurance_expiry_date: form.insurance_expiry_date || null,
    };
    // Limpiar strings vacios a null para columnas opcionales
    Object.keys(payload).forEach(k => {
      if (payload[k] === '') payload[k] = null;
    });
    if (id) {
      await updateClient(id, payload);
      toast({ title: 'Client actualizado' });
    } else {
      await createClient(payload);
      toast({ title: 'Client creado' });
    }
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    const ok = await deleteClient(deleting.id);
    if (ok) toast({ title: 'Client borrado' });
    setDeleting(null);
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Input placeholder="Buscar por nombre, MC#, DOT#..." value={search} onChange={e => setSearch(e.target.value)} className="pl-3" />
        </div>
        <Button size="sm" className="gap-1.5" onClick={() => { setEditing(null); setFormOpen(true); }}>
          <Plus className="h-4 w-4" /> New Client
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : filtered.length === 0 ? (
        <p className="text-center text-muted-foreground py-8 text-sm">
          {clients.length === 0 ? 'No hay clientes de Dispatch Service registrados todavia.' : 'Ninguno coincide con la busqueda.'}
        </p>
      ) : (
        <div className="space-y-2">
          {filtered.map(c => (
            <ClientCard
              key={c.id}
              client={c}
              driverCount={driversPerClient[c.id]?.count || 0}
              driverNames={driversPerClient[c.id]?.names || []}
              onEdit={() => { setEditing(c); setFormOpen(true); }}
              onDelete={() => setDeleting(c)}
              onDocsChanged={refetch}
            />
          ))}
        </div>
      )}

      <ClientFormDialog open={formOpen} onOpenChange={setFormOpen} editing={editing} onSave={handleSave} />

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Borrar Client</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Seguro que quieres borrar <strong>{deleting?.legal_business_name}</strong>?
              Los drivers vinculados se desvinculan pero no se borran.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); confirmDelete(); }} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
