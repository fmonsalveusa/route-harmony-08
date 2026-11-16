import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Mail, Lock, User, Phone, UserCog } from 'lucide-react';

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
  { value: 'investor', label: 'Investor' },
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
      let msg = 'Error saving user';
      if (err?.context?.body) {
        try { const b = JSON.parse(err.context.body); if (b.error) msg = b.error; } catch {}
      } else if (err?.message) {
        msg = err.message;
      }
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md rounded-[28px] border-0 bg-[#f8fafd] dark:bg-background [&_label]:text-xs [&_label]:font-medium [&_label]:text-[#444746] dark:[&_label]:text-muted-foreground [&_input]:h-10 [&_input]:rounded-lg [&_input]:shadow-none [&_input]:bg-white dark:[&_input]:bg-card [&_input]:border-[#c4c7c5] dark:[&_input]:border-border [&_input:focus-visible]:ring-1 [&_input:focus-visible]:ring-[#0b57d0] [&_input:focus-visible]:border-[#0b57d0] [&_button[role=combobox]]:h-10 [&_button[role=combobox]]:rounded-lg [&_button[role=combobox]]:shadow-none [&_button[role=combobox]]:bg-white dark:[&_button[role=combobox]]:bg-card [&_button[role=combobox]]:border-[#c4c7c5] dark:[&_button[role=combobox]]:border-border [&_textarea]:rounded-lg [&_textarea]:shadow-none [&_textarea]:bg-white dark:[&_textarea]:bg-card [&_textarea]:border-[#c4c7c5]">
        <DialogHeader className="space-y-0">
          <div className="flex items-center gap-3">
            <span className="h-11 w-11 rounded-full bg-[#d3e3fd] dark:bg-blue-900/40 text-[#041e49] dark:text-blue-200 flex items-center justify-center shrink-0">
              <UserCog className="h-5 w-5" />
            </span>
            <div>
              <DialogTitle className="text-[22px] leading-7 font-normal text-[#1f1f1f] dark:text-foreground">{isEdit ? 'Edit User' : 'New User'}</DialogTitle>
              <p className="text-sm text-[#444746] dark:text-muted-foreground">{isEdit ? 'Actualiza el acceso del usuario' : 'Crea el acceso a la app'}</p>
            </div>
          </div>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3 rounded-3xl bg-white dark:bg-card border border-[#e3e3e3] dark:border-border px-4 py-3">
          <div className="space-y-1">
            <Label htmlFor="fullName">Full Name</Label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input id="fullName" value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Full name" className="pl-10" required />
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="email">Email</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="email@example.com" className="pl-10" required disabled={isEdit} />
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="phone">Phone</Label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input id="phone" value={phone} onChange={e => setPhone(e.target.value)} placeholder="(555) 123-4567" className="pl-10" />
            </div>
          </div>

          <div className="space-y-1">
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

          <div className="space-y-1">
            <Label htmlFor="password">{isEdit ? 'New password (leave empty to keep current)' : 'Password'}</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input id="password" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder={isEdit ? '••••••••' : 'Mínimo 8 caracteres'} className="pl-10" required={!isEdit} minLength={8} />
            </div>
          </div>

          {isEdit && (
            <div className="flex items-center justify-between rounded-2xl bg-[#f0f4f9] dark:bg-muted/60 px-3 py-2">
              <Label htmlFor="is-active" className="cursor-pointer">Active user</Label>
              <Switch id="is-active" checked={isActive} onCheckedChange={setIsActive} />
            </div>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="ghost" className="h-10 rounded-full px-5 text-[#0b57d0] hover:text-[#0b57d0] hover:bg-[#e8f0fe] dark:text-blue-300 font-medium" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" className="h-10 rounded-full px-6 bg-[#0b57d0] hover:bg-[#0842a0] text-white font-medium" disabled={loading}>
              {loading ? 'Saving...' : isEdit ? 'Update' : 'Create User'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
