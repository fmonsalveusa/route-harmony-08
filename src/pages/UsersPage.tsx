import { mockUsers } from '@/data/mockData';
import { StatusBadge } from '@/components/StatusBadge';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Plus, Shield, Calculator, Headphones } from 'lucide-react';

const roleIcons: Record<string, any> = { admin: Shield, accounting: Calculator, dispatcher: Headphones };
const roleBadgeStyles: Record<string, string> = {
  admin: 'bg-destructive/15 text-destructive',
  accounting: 'bg-warning/15 text-warning',
  dispatcher: 'bg-info/15 text-info',
};

const UsersPage = () => (
  <div className="space-y-6">
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div>
        <h1 className="page-header">Gestión de Usuarios</h1>
        <p className="page-description">Administración de cuentas y permisos</p>
      </div>
      <Button size="sm" className="gap-2"><Plus className="h-4 w-4" /> Nuevo Usuario</Button>
    </div>

    <Card>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b bg-muted/50">
              <th className="text-left p-3 font-medium text-muted-foreground">Usuario</th>
              <th className="text-left p-3 font-medium text-muted-foreground">Email</th>
              <th className="text-left p-3 font-medium text-muted-foreground">Rol</th>
              <th className="text-left p-3 font-medium text-muted-foreground">Estado</th>
              <th className="text-right p-3 font-medium text-muted-foreground">Acciones</th>
            </tr></thead>
            <tbody>
              {mockUsers.map(u => {
                const initials = u.name.split(' ').map(n => n[0]).join('');
                const RoleIcon = roleIcons[u.role];
                return (
                  <tr key={u.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="p-3">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="text-xs bg-primary/10 text-primary">{initials}</AvatarFallback>
                        </Avatar>
                        <span className="font-medium">{u.name}</span>
                      </div>
                    </td>
                    <td className="p-3 text-muted-foreground">{u.email}</td>
                    <td className="p-3">
                      <Badge variant="secondary" className={`gap-1 ${roleBadgeStyles[u.role]}`}>
                        <RoleIcon className="h-3 w-3" /> {u.role}
                      </Badge>
                    </td>
                    <td className="p-3"><StatusBadge status="active" /></td>
                    <td className="p-3 text-right">
                      <Button size="sm" variant="ghost" className="text-xs">Editar</Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  </div>
);

export default UsersPage;
