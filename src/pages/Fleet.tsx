import { mockTrucks, mockDrivers, mockInvestors } from '@/data/mockData';
import { StatusBadge } from '@/components/StatusBadge';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, Truck as TruckIcon, User, Building } from 'lucide-react';

const Fleet = () => (
  <div className="space-y-6">
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div>
        <h1 className="page-header">Flota de Camiones</h1>
        <p className="page-description">Gestión y disponibilidad de vehículos</p>
      </div>
      <Button size="sm" className="gap-2"><Plus className="h-4 w-4" /> Nuevo Camión</Button>
    </div>

    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {mockTrucks.map(truck => {
        const driver = mockDrivers.find(d => d.id === truck.driverId);
        const investor = mockInvestors.find(i => i.id === truck.investorId);
        return (
          <Card key={truck.id} className="hover:shadow-md transition-shadow animate-fade-in">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <TruckIcon className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg">{truck.plateNumber}</h3>
                    <p className="text-xs text-muted-foreground">{truck.model}</p>
                  </div>
                </div>
                <StatusBadge status={truck.status} />
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Año</span>
                  <span className="font-medium">{truck.year}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground flex items-center gap-1.5"><User className="h-3.5 w-3.5" /> Driver</span>
                  <span className="font-medium">{driver?.name || '—'}</span>
                </div>
                {investor && (
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground flex items-center gap-1.5"><Building className="h-3.5 w-3.5" /> Investor</span>
                    <span className="font-medium text-xs">{investor.name}</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  </div>
);

export default Fleet;
