import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { StatusBadge } from '@/components/StatusBadge';
import { UserFormDialog } from '@/components/UserFormDialog';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Plus, Shield, Calculator, Headphones, Truck as TruckIcon, Loader2, Pencil } from 'lucide-react';

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

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
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
                      <tr key={u.id} className="border-b last:border-0 hover:bg-muted/30">
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
                        <td className="p-3"><StatusBadge status={u.is_active ? 'active' : 'inactive'} /></td>
                        <td className="p-3 text-right">
                          <Button variant="outline" size="sm" className="h-8 px-2 text-xs border-amber-400 bg-white text-amber-600 hover:bg-amber-50 hover:text-amber-700 gap-1" onClick={() => handleEdit(u)} title="Edit">
                            <Pencil className="h-4 w-4" /> Edit
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <UserFormDialog open={dialogOpen} onOpenChange={setDialogOpen} user={editingUser} onSuccess={fetchUsers} />
    </div>
  );
};

export default UsersPage;
