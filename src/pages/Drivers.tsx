import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { mockDrivers, mockDispatchers, mockTrucks } from '@/data/mockData';
import { StatusBadge } from '@/components/StatusBadge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Plus, Search, Phone, Mail, Truck as TruckIcon, Headphones, Package, DollarSign } from 'lucide-react';

const Drivers = () => {
  const { user } = useAuth();
  const [search, setSearch] = useState('');

  const isDispatcher = user?.role === 'dispatcher';
  let drivers = isDispatcher
    ? mockDrivers.filter(d => d.dispatcherId === (user?.dispatcherId || 'd1'))
    : mockDrivers;

  if (search) drivers = drivers.filter(d =>
    d.name.toLowerCase().includes(search.toLowerCase()) ||
    d.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="page-header">Conductores</h1>
          <p className="page-description">{isDispatcher ? 'Drivers bajo tu gestión' : 'Gestión completa de conductores'}</p>
        </div>
        {!isDispatcher && <Button size="sm" className="gap-2"><Plus className="h-4 w-4" /> Nuevo Driver</Button>}
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Buscar por nombre o email..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {drivers.map(driver => {
          const dispatcher = mockDispatchers.find(d => d.id === driver.dispatcherId);
          const truck = mockTrucks.find(t => t.id === driver.truckId);
          const initials = driver.name.split(' ').map(n => n[0]).join('');
          return (
            <Card key={driver.id} className="hover:shadow-md transition-shadow animate-fade-in">
              <CardContent className="p-5">
                <div className="flex items-start gap-4">
                  <Avatar className="h-12 w-12">
                    <AvatarFallback className="bg-primary/10 text-primary font-semibold">{initials}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold truncate">{driver.name}</h3>
                      <StatusBadge status={driver.status} />
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">CDL: {driver.license}</p>
                  </div>
                </div>

                <div className="mt-4 space-y-2 text-sm">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Phone className="h-3.5 w-3.5" />{driver.phone}
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Mail className="h-3.5 w-3.5" />{driver.email}
                  </div>
                  {dispatcher && (
                    <div className="flex items-center gap-2">
                      <Headphones className="h-3.5 w-3.5 text-info" />
                      <Badge variant="secondary" className="text-xs">{dispatcher.name}</Badge>
                    </div>
                  )}
                  {truck && (
                    <div className="flex items-center gap-2">
                      <TruckIcon className="h-3.5 w-3.5 text-primary" />
                      <span>{truck.plateNumber} · {truck.model}</span>
                    </div>
                  )}
                </div>

                <div className="mt-4 pt-3 border-t grid grid-cols-3 gap-2 text-center">
                  <div>
                    <p className="text-lg font-bold">{driver.loadsThisMonth}</p>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Cargas</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold">${(driver.earningsThisMonth / 1000).toFixed(1)}k</p>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Ganado</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold">{driver.payPercentage}%</p>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Pago</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

export default Drivers;
