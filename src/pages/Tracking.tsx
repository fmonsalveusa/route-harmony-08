import { MapPin, Package } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusBadge } from '@/components/StatusBadge';
import { mockLoads, mockDrivers, mockTrucks } from '@/data/mockData';

const Tracking = () => {
  const activeLoads = mockLoads.filter(l => l.status === 'in_transit');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-header">Seguimiento en Vivo</h1>
        <p className="page-description">Ubicación y estado de cargas activas</p>
      </div>

      {/* Map placeholder */}
      <Card className="overflow-hidden">
        <div className="h-72 bg-muted flex items-center justify-center relative">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-accent/5" />
          <div className="text-center z-10">
            <MapPin className="h-12 w-12 text-muted-foreground/40 mx-auto mb-2" />
            <p className="text-muted-foreground font-medium">Mapa en Tiempo Real</p>
            <p className="text-xs text-muted-foreground">Se integrará con servicio de mapas</p>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {activeLoads.map(load => {
          const driver = mockDrivers.find(d => d.id === load.driverId);
          const truck = mockTrucks.find(t => t.id === load.truckId);
          return (
            <Card key={load.id} className="animate-fade-in">
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-semibold">{load.referenceNumber}</h3>
                    <p className="text-xs text-muted-foreground">{load.brokerClient}</p>
                  </div>
                  <StatusBadge status={load.status} />
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-success" />
                    <span>{load.origin}</span>
                  </div>
                  <div className="ml-1 border-l-2 border-dashed border-muted-foreground/30 h-4" />
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-destructive" />
                    <span>{load.destination}</span>
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t flex justify-between text-xs text-muted-foreground">
                  <span>Driver: {driver?.name || '—'}</span>
                  <span>Camión: {truck?.plateNumber || '—'}</span>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

export default Tracking;
