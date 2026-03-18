import { useState } from 'react';
import { useEldAccounts, EldAccount, EldVehicleMap } from '@/hooks/useEldAccounts';
import { useDrivers } from '@/hooks/useDrivers';
import { useTrucks } from '@/hooks/useTrucks';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Trash2, RefreshCw, Wifi, WifiOff, Radio, Link2 } from 'lucide-react';
import { format } from 'date-fns';

export default function EldSettings() {
  const {
    accounts, vehicleMaps, loading,
    createAccount, deleteAccount, toggleAccount,
    createVehicleMap, deleteVehicleMap, triggerSync,
  } = useEldAccounts();
  const { drivers } = useDrivers();
  const { trucks } = useTrucks();

  const [showAddAccount, setShowAddAccount] = useState(false);
  const [showAddMapping, setShowAddMapping] = useState(false);
  const [newAccount, setNewAccount] = useState({ api_user: '', api_password: '', company_id: '' });
  const [newMapping, setNewMapping] = useState({ eld_account_id: '', eld_vehicle_id: '', eld_vehicle_name: '', driver_id: '', truck_id: '' });

  const handleCreateAccount = async () => {
    if (!newAccount.api_user || !newAccount.api_password || !newAccount.company_id) return;
    await createAccount(newAccount);
    setNewAccount({ api_user: '', api_password: '', company_id: '' });
    setShowAddAccount(false);
  };

  const handleCreateMapping = async () => {
    if (!newMapping.eld_account_id || !newMapping.eld_vehicle_id) return;
    await createVehicleMap({
      eld_account_id: newMapping.eld_account_id,
      eld_vehicle_id: newMapping.eld_vehicle_id,
      eld_vehicle_name: newMapping.eld_vehicle_name || undefined,
      driver_id: newMapping.driver_id || undefined,
      truck_id: newMapping.truck_id || undefined,
    });
    setNewMapping({ eld_account_id: '', eld_vehicle_id: '', eld_vehicle_name: '', driver_id: '', truck_id: '' });
    setShowAddMapping(false);
  };

  if (loading) {
    return <div className="p-6 flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-2 border-muted border-t-primary" /></div>;
  }

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">ELD Integration</h1>
          <p className="text-sm text-muted-foreground">Connect your HOS247 ELD accounts for automatic fleet tracking</p>
        </div>
        <Button variant="outline" size="sm" onClick={triggerSync} className="gap-2">
          <RefreshCw className="h-4 w-4" />
          Sync Now
        </Button>
      </div>

      {/* ELD Accounts */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Radio className="h-5 w-5 text-primary" />
            ELD Accounts
          </CardTitle>
          <Dialog open={showAddAccount} onOpenChange={setShowAddAccount}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1"><Plus className="h-4 w-4" /> Add Account</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Add HOS247 Account</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>API User</Label>
                  <Input value={newAccount.api_user} onChange={e => setNewAccount(p => ({ ...p, api_user: e.target.value }))} placeholder="HOS247 username" />
                </div>
                <div className="space-y-2">
                  <Label>API Password</Label>
                  <Input type="password" value={newAccount.api_password} onChange={e => setNewAccount(p => ({ ...p, api_password: e.target.value }))} placeholder="HOS247 password" />
                </div>
                <div className="space-y-2">
                  <Label>Company ID</Label>
                  <Input value={newAccount.company_id} onChange={e => setNewAccount(p => ({ ...p, company_id: e.target.value }))} placeholder="HOS247 company ID" />
                </div>
                <Button onClick={handleCreateAccount} className="w-full">Add Account</Button>
              </div>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {accounts.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No ELD accounts configured yet. Add your HOS247 credentials to start tracking.</p>
          ) : (
            <div className="space-y-3">
              {accounts.map((account) => (
                <div key={account.id} className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${account.is_active ? 'bg-success/20' : 'bg-muted'}`}>
                      {account.is_active ? <Wifi className="h-5 w-5 text-success" /> : <WifiOff className="h-5 w-5 text-muted-foreground" />}
                    </div>
                    <div>
                      <p className="font-medium text-sm">{account.api_user}</p>
                      <p className="text-xs text-muted-foreground">Company: {account.company_id}</p>
                      {account.last_synced_at && (
                        <p className="text-xs text-muted-foreground">Last sync: {format(new Date(account.last_synced_at), 'MMM d, HH:mm')}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={account.is_active ? 'default' : 'secondary'}>
                      {account.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                    <Switch checked={account.is_active} onCheckedChange={(v) => toggleAccount(account.id, v)} />
                    <Button variant="ghost" size="icon" onClick={() => deleteAccount(account.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Vehicle Mappings */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Link2 className="h-5 w-5 text-primary" />
            Vehicle Mappings
          </CardTitle>
          <Dialog open={showAddMapping} onOpenChange={setShowAddMapping}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1" disabled={accounts.length === 0}><Plus className="h-4 w-4" /> Add Mapping</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Map ELD Vehicle to Driver</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>ELD Account</Label>
                  <Select value={newMapping.eld_account_id} onValueChange={v => setNewMapping(p => ({ ...p, eld_account_id: v }))}>
                    <SelectTrigger><SelectValue placeholder="Select account" /></SelectTrigger>
                    <SelectContent>
                      {accounts.map(a => (
                        <SelectItem key={a.id} value={a.id}>{a.api_user} ({a.company_id})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>ELD Vehicle ID</Label>
                  <Input value={newMapping.eld_vehicle_id} onChange={e => setNewMapping(p => ({ ...p, eld_vehicle_id: e.target.value }))} placeholder="Vehicle ID from HOS247" />
                </div>
                <div className="space-y-2">
                  <Label>Vehicle Name (optional)</Label>
                  <Input value={newMapping.eld_vehicle_name} onChange={e => setNewMapping(p => ({ ...p, eld_vehicle_name: e.target.value }))} placeholder="e.g. Truck #101" />
                </div>
                <div className="space-y-2">
                  <Label>Driver</Label>
                  <Select value={newMapping.driver_id} onValueChange={v => setNewMapping(p => ({ ...p, driver_id: v }))}>
                    <SelectTrigger><SelectValue placeholder="Select driver" /></SelectTrigger>
                    <SelectContent>
                      {drivers.filter(d => d.status !== 'inactive').map(d => (
                        <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Truck (optional)</Label>
                  <Select value={newMapping.truck_id} onValueChange={v => setNewMapping(p => ({ ...p, truck_id: v }))}>
                    <SelectTrigger><SelectValue placeholder="Select truck" /></SelectTrigger>
                    <SelectContent>
                      {trucks.map(t => (
                        <SelectItem key={t.id} value={t.id}>{t.unit_number} - {t.model}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={handleCreateMapping} className="w-full">Create Mapping</Button>
              </div>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {vehicleMaps.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No vehicle mappings yet. Map ELD vehicles to your drivers for automatic tracking.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ELD Vehicle</TableHead>
                    <TableHead>Driver</TableHead>
                    <TableHead>Account</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {vehicleMaps.map((vm) => {
                    const driver = drivers.find(d => d.id === vm.driver_id);
                    const account = accounts.find(a => a.id === vm.eld_account_id);
                    return (
                      <TableRow key={vm.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium text-sm">{vm.eld_vehicle_name || vm.eld_vehicle_id}</p>
                            {vm.eld_vehicle_name && <p className="text-xs text-muted-foreground">ID: {vm.eld_vehicle_id}</p>}
                          </div>
                        </TableCell>
                        <TableCell>{driver?.name || '—'}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{account?.api_user || '—'}</TableCell>
                        <TableCell>
                          <Badge variant={vm.is_active ? 'default' : 'secondary'}>
                            {vm.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon" onClick={() => deleteVehicleMap(vm.id)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
