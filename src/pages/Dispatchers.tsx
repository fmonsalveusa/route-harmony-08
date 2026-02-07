import { mockDispatchers, mockDrivers } from '@/data/mockData';
import { StatusBadge } from '@/components/StatusBadge';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Plus, Phone, Mail, Users, Package, DollarSign, Percent } from 'lucide-react';

const Dispatchers = () => (
  <div className="space-y-6">
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div>
        <h1 className="page-header">Dispatchers</h1>
        <p className="page-description">Gestión de dispatchers y comisiones</p>
      </div>
      <Button size="sm" className="gap-2"><Plus className="h-4 w-4" /> Nuevo Dispatcher</Button>
    </div>

    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {mockDispatchers.map(d => {
        const initials = d.name.split(' ').map(n => n[0]).join('');
        const assignedDrivers = mockDrivers.filter(dr => dr.dispatcherId === d.id);
        return (
          <Card key={d.id} className="hover:shadow-md transition-shadow animate-fade-in">
            <CardContent className="p-5">
              <div className="flex items-start gap-4">
                <Avatar className="h-12 w-12">
                  <AvatarFallback className="bg-info/15 text-info font-semibold">{initials}</AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold">{d.name}</h3>
                    <StatusBadge status={d.status} />
                  </div>
                  <div className="flex items-center gap-1 mt-1">
                    <Percent className="h-3 w-3 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">{d.commissionPercentage}% · {d.payType === 'per_rate' ? 'por tarifa' : 'por carga'}</span>
                  </div>
                </div>
              </div>

              <div className="mt-4 space-y-2 text-sm">
                <div className="flex items-center gap-2 text-muted-foreground"><Phone className="h-3.5 w-3.5" />{d.phone}</div>
                <div className="flex items-center gap-2 text-muted-foreground"><Mail className="h-3.5 w-3.5" />{d.email}</div>
              </div>

              <div className="mt-4 pt-3 border-t grid grid-cols-3 gap-2 text-center">
                <div>
                  <div className="flex items-center justify-center gap-1">
                    <Users className="h-3 w-3 text-muted-foreground" />
                    <p className="text-lg font-bold">{assignedDrivers.length}</p>
                  </div>
                  <p className="text-[10px] text-muted-foreground uppercase">Drivers</p>
                </div>
                <div>
                  <div className="flex items-center justify-center gap-1">
                    <Package className="h-3 w-3 text-muted-foreground" />
                    <p className="text-lg font-bold">{d.loadsThisMonth}</p>
                  </div>
                  <p className="text-[10px] text-muted-foreground uppercase">Cargas</p>
                </div>
                <div>
                  <div className="flex items-center justify-center gap-1">
                    <DollarSign className="h-3 w-3 text-muted-foreground" />
                    <p className="text-lg font-bold">${(d.commissionsThisMonth / 1000).toFixed(1)}k</p>
                  </div>
                  <p className="text-[10px] text-muted-foreground uppercase">Comisiones</p>
                </div>
              </div>

              {d.commissionsPending > 0 && (
                <div className="mt-3 p-2 rounded-md bg-warning/10 text-center">
                  <p className="text-xs font-medium text-warning">Pendiente: ${d.commissionsPending.toLocaleString()}</p>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  </div>
);

export default Dispatchers;
