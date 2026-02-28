import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { StatusBadge } from '@/components/StatusBadge';
import { UserFormDialog } from '@/components/UserFormDialog';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Plus, Shield, Calculator, Headphones, Truck as TruckIcon, Loader2, Pencil, Trash2, ChevronDown } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';

const roleIcons: Record<string, any> = {
  admin: Shield,
  accounting: Calculator,
  dispatcher: Headphones,
  driver: TruckIcon,
};

const roleBadgeStyles: Record<string, string> = {
  admin: 'bg-destructive/15 text-destructive',
  accounting: 'bg-warning/15 text-warning',
  dispatcher: 'bg-info/15 text-info',
  driver: 'bg-success/15 text-success',
};

const roleLabels: Record<string, string> = {
  admin: 'Admin',
  accounting: 'Accounting',
  dispatcher: 'Dispatcher',
  driver: 'Driver',
};

interface UserRow {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  is_active: boolean;
  role: string;
}

const UsersPage = () => {
  const { profile } = useAuth();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserRow | null>(null);
  const [deletingUser, setDeletingUser] = useState<UserRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchUsers = useCallback(async () => {
    if (!profile?.tenant_id) return;
    setLoading(true);
    const { data: profiles } = await supabase.from('profiles').select('id, full_name, email, phone, is_active').eq('tenant_id', profile.tenant_id);
    if (!profiles) { setLoading(false); return; }
    const { data: roles } = await supabase.from('user_roles').select('user_id, role').eq('tenant_id', profile.tenant_id);
    const roleMap = new Map((roles || []).map(r => [r.user_id, r.role]));
    const merged: UserRow[] = profiles.map(p => ({ ...p, role: roleMap.get(p.id) || 'admin' }));
    setUsers(merged);
    setLoading(false);
  }, [profile?.tenant_id]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const handleCreate = () => { setEditingUser(null); setDialogOpen(true); };
  const handleEdit = (user: UserRow) => { setEditingUser(user); setDialogOpen(true); };
  const handleDelete = async () => {
    if (!deletingUser) return;
    setDeleting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');
      const { data, error } = await supabase.functions.invoke('manage-user', {
        body: { action: 'delete', user_id: deletingUser.id },
      });
      if (error) {
        let msg = 'Error deleting user';
        if (error?.context?.body) {
          try { const b = JSON.parse(error.context.body); if (b.error) msg = b.error; } catch {}
        } else if (error?.message) msg = error.message;
        throw new Error(msg);
      }
      if (data?.error) throw new Error(data.error);
      toast.success('User deleted successfully');
      setDeletingUser(null);
      fetchUsers();
    } catch (err: any) {
      toast.error(err.message || 'Error deleting user');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="page-header">User Management</h1>
          <p className="page-description">Account and permission administration</p>
        </div>
        <Button size="sm" className="gap-2" onClick={handleCreate}>
          <Plus className="h-4 w-4" /> New User
        </Button>
      </div>

      <div className="glass-card overflow-hidden">
        <div className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b glass-table-header">
                    <th className="text-left p-3 font-medium text-muted-foreground">User</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">Email</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">Phone</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">Role</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">Status</th>
                    <th className="text-right p-3 font-medium text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.length === 0 ? (
                    <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">No users registered</td></tr>
                  ) : users.map(u => {
                    const initials = u.full_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
                    const RoleIcon = roleIcons[u.role] || Shield;
                    return (
                      <tr key={u.id} className="border-b last:border-0 glass-row">
                        <td className="p-3">
                          <div className="flex items-center gap-3">
                            <Avatar className="h-8 w-8">
                              <AvatarFallback className="text-xs bg-primary/10 text-primary">{initials}</AvatarFallback>
                            </Avatar>
                            <span className="font-medium">{u.full_name}</span>
                          </div>
                        </td>
                        <td className="p-3 text-muted-foreground">{u.email}</td>
                        <td className="p-3 text-muted-foreground">{u.phone || '—'}</td>
                        <td className="p-3">
                          <Badge variant="secondary" className={`gap-1 ${roleBadgeStyles[u.role] || ''}`}>
                            <RoleIcon className="h-3 w-3" /> {roleLabels[u.role] || u.role}
                          </Badge>
                        </td>
                        <td className="p-3" onClick={e => e.stopPropagation()}>
                          <Select value={u.is_active ? 'active' : 'inactive'} onValueChange={async (val) => {
                            const newActive = val === 'active';
                            await supabase.from('profiles').update({ is_active: newActive }).eq('id', u.id);
                            fetchUsers();
                          }}>
                            <SelectTrigger className="h-8 w-[140px] border-0 p-0 shadow-none focus:ring-0 [&>svg]:hidden bg-transparent">
                              <span className="flex items-center justify-between w-full gap-1">
                                <StatusBadge status={u.is_active ? 'active' : 'inactive'} className="text-[11px] px-3 py-1.5" />
                                <span className="inline-flex h-5 w-5 items-center justify-center rounded border border-border bg-muted/40 text-muted-foreground ml-auto">
                                  <ChevronDown className="h-3 w-3 shrink-0" />
                                </span>
                              </span>
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="active"><StatusBadge status="active" /></SelectItem>
                              <SelectItem value="inactive"><StatusBadge status="inactive" /></SelectItem>
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="p-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button className="glass-action-btn tint-amber inline-flex items-center" onClick={() => handleEdit(u)} title="Edit">
                              <Pencil className="h-4 w-4" /> Edit
                            </button>
                            {u.id !== profile?.id && (
                              <button className="glass-action-btn tint-red inline-flex items-center" onClick={() => setDeletingUser(u)} title="Delete">
                                <Trash2 className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <UserFormDialog open={dialogOpen} onOpenChange={setDialogOpen} user={editingUser} onSuccess={fetchUsers} />

      <AlertDialog open={!!deletingUser} onOpenChange={(open) => !open && setDeletingUser(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete User</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{deletingUser?.full_name}</strong> ({deletingUser?.email})? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); handleDelete(); }}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default UsersPage;
