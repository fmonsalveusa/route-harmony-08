import { useState } from 'react';
import { Radio, Plus, Pencil, Trash2, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useEldAccounts, DbEldAccount, EldProvider } from '@/hooks/useEldAccounts';
import { format } from 'date-fns';

const providerLabels: Record<EldProvider, string> = {
  hos247: 'HOS247',
  routeone: 'RouteOne',
};

const EldAccounts = () => {
  const { accounts, loading, createAccount, updateAccount, toggleActive, deleteAccount } = useEldAccounts();
  const [formOpen, setFormOpen] = useState(false);
  const [editItem, setEditItem] = useState<DbEldAccount | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Campos del formulario
  const [provider, setProvider] = useState<EldProvider>('hos247');
  const [apiUser, setApiUser] = useState('');
  const [password, setPassword] = useState('');
  const [companyId, setCompanyId] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);

  const openNew = () => {
    setEditItem(null);
    setProvider('hos247');
    setApiUser('');
    setPassword('');
    setCompanyId('');
    setIsActive(true);
    setFormOpen(true);
  };

  const openEdit = (acc: DbEldAccount) => {
    setEditItem(acc);
    setProvider(acc.provider);
    setApiUser(acc.api_user || '');
    setPassword(''); // nunca precargamos el password: vacío = no cambiar
    setCompanyId(acc.company_id || '');
    setIsActive(acc.is_active);
    setFormOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    const input = {
      provider,
      api_user: apiUser.trim(),
      password: password || undefined, // solo se envía si hay algo escrito
      company_id: companyId.trim() || null,
      is_active: isActive,
    };
    const ok = editItem
      ? await updateAccount(editItem.id, input)
      : await createAccount(input);
    setSaving(false);
    if (ok) setFormOpen(false);
  };

  // Company ID solo aplica a HOS247 (RouteOne usa api_user + password/key)
  const showCompanyId = provider === 'hos247';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Radio className="h-5 w-5 text-muted-foreground" />
          <div>
            <h1 className="text-lg font-semibold">ELD Accounts</h1>
            <p className="text-xs text-muted-foreground">
              Connect your HOS247 and RouteOne accounts to sync truck odometers automatically
            </p>
          </div>
        </div>
        <Button size="sm" onClick={openNew}>
          <Plus className="h-3.5 w-3.5 mr-1.5" /> Add Account
        </Button>
      </div>

      {/* Lista de cuentas */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      ) : accounts.length === 0 ? (
        <div className="py-12 text-center text-muted-foreground">
          <Radio className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No ELD accounts yet. Add one to start syncing odometers.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {accounts.map((acc) => (
            <div
              key={acc.id}
              className="flex items-center gap-4 px-4 py-3 rounded-lg border bg-card"
            >
              {/* Proveedor */}
              <div className="flex items-center gap-2 min-w-[110px]">
                <span className="text-sm font-semibold">{providerLabels[acc.provider] || acc.provider}</span>
              </div>

              {/* Usuario / company */}
              <div className="flex-1 min-w-0">
                <p className="text-sm truncate">{acc.api_user || '—'}</p>
                {acc.company_id && (
                  <p className="text-[11px] text-muted-foreground truncate">Company: {acc.company_id}</p>
                )}
              </div>

              {/* Última sync */}
              <div className="hidden sm:block text-right min-w-[130px]">
                <p className="text-[11px] text-muted-foreground">Last sync</p>
                <p className="text-xs">
                  {acc.last_synced_at ? format(new Date(acc.last_synced_at), 'MMM d, h:mm a') : 'Never'}
                </p>
              </div>

              {/* Estado activo */}
              <div className="flex items-center gap-2">
                {acc.is_active ? (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-sm bg-[#EAF3DE] text-[#3B6D11]">
                    <Check className="h-3 w-3" /> Active
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-sm bg-muted text-muted-foreground">
                    <X className="h-3 w-3" /> Off
                  </span>
                )}
                <Switch
                  checked={acc.is_active}
                  onCheckedChange={(v) => toggleActive(acc.id, v)}
                />
              </div>

              {/* Acciones */}
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(acc)}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeleteId(acc.id)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Formulario crear/editar */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editItem ? 'Edit ELD Account' : 'Add ELD Account'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Provider</Label>
              <Select value={provider} onValueChange={(v) => setProvider(v as EldProvider)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="hos247">HOS247</SelectItem>
                  <SelectItem value="routeone">RouteOne</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>API User</Label>
              <Input
                value={apiUser}
                onChange={(e) => setApiUser(e.target.value)}
                placeholder="API username"
                autoComplete="off"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Password / API Key</Label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={editItem ? 'Leave blank to keep current' : 'API password or key'}
                autoComplete="new-password"
              />
              {editItem && (
                <p className="text-[11px] text-muted-foreground">
                  For security, the saved password is never shown. Enter a new one only to change it.
                </p>
              )}
            </div>

            {showCompanyId && (
              <div className="space-y-1.5">
                <Label>Company ID</Label>
                <Input
                  value={companyId}
                  onChange={(e) => setCompanyId(e.target.value)}
                  placeholder="HOS247 Company ID"
                  autoComplete="off"
                />
              </div>
            )}

            <div className="flex items-center justify-between">
              <Label>Active</Label>
              <Switch checked={isActive} onCheckedChange={setIsActive} />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}>Cancel</Button>
            <Button
              onClick={handleSave}
              disabled={saving || !apiUser.trim() || (!editItem && !password)}
            >
              {saving ? 'Saving…' : editItem ? 'Save changes' : 'Add account'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmación de borrado */}
      <Dialog open={!!deleteId} onOpenChange={(open) => { if (!open) setDeleteId(null); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete ELD account?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This removes the account and its stored credentials. Trucks under this account will stop syncing until you add it again.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={async () => {
                if (deleteId) await deleteAccount(deleteId);
                setDeleteId(null);
              }}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default EldAccounts;
