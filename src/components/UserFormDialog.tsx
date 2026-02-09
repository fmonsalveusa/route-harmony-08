import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Mail, Lock, User, Phone } from 'lucide-react';

interface UserData {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  is_active: boolean;
  role: string;
}

interface UserFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user?: UserData | null;
  onSuccess: () => void;
}

const roles = [
  { value: 'admin', label: 'Admin' },
  { value: 'accounting', label: 'Accounting' },
  { value: 'dispatcher', label: 'Dispatcher' },
  { value: 'driver', label: 'Driver' },
];

export const UserFormDialog = ({ open, onOpenChange, user, onSuccess }: UserFormDialogProps) => {
  const isEdit = !!user;
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState('dispatcher');
  const [password, setPassword] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) {
      setFullName(user.full_name);
      setEmail(user.email);
      setPhone(user.phone || '');
      setRole(user.role);
      setIsActive(user.is_active);
      setPassword('');
    } else {
      setFullName(''); setEmail(''); setPhone(''); setRole('dispatcher'); setPassword(''); setIsActive(true);
    }
  }, [user, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');
      const body: Record<string, unknown> = isEdit
        ? { action: 'update', user_id: user!.id, full_name: fullName, phone: phone || null, role, is_active: isActive }
        : { action: 'create', email, password, full_name: fullName, phone: phone || null, role };
      if (isEdit && password) body.password = password;
      const { data, error } = await supabase.functions.invoke('manage-user', { body });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(isEdit ? 'User updated' : 'User created successfully');
      onSuccess();
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || 'Error saving user');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit User' : 'New User'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="fullName">Full Name</Label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input id="fullName" value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Full name" className="pl-10" required />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="email@example.com" className="pl-10" required disabled={isEdit} />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Phone</Label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input id="phone" value={phone} onChange={e => setPhone(e.target.value)} placeholder="(555) 123-4567" className="pl-10" />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="role">Role</Label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {roles.map(r => (
                  <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">{isEdit ? 'New password (leave empty to keep current)' : 'Password'}</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input id="password" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder={isEdit ? '••••••••' : 'Minimum 6 characters'} className="pl-10" required={!isEdit} minLength={6} />
            </div>
          </div>

          {isEdit && (
            <div className="flex items-center justify-between rounded-md border p-3">
              <Label htmlFor="is-active" className="cursor-pointer">Active user</Label>
              <Switch id="is-active" checked={isActive} onCheckedChange={setIsActive} />
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Saving...' : isEdit ? 'Update' : 'Create User'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
