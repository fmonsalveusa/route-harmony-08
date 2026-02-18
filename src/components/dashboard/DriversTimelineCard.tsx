import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { StatusBadge } from '@/components/StatusBadge';
import { Badge } from '@/components/ui/badge';
import { formatDate } from '@/lib/dateUtils';
import { MapPin, Flag, Users } from 'lucide-react';

interface Load {
  id: string;
  reference_number: string;
  origin: string;
  destination: string;
  pickup_date: string | null;
  delivery_date: string | null;
  status: string;
  driver_id: string | null;
  total_rate: number;
}

interface Driver {
  id: string;
  name: string;
  status: string;
}

interface Props {
  loads: Load[];
  drivers: Driver[];
}

const ACTIVE_STATUSES = ['dispatched', 'in_transit', 'delivered'];

const statusLineColor: Record<string, string> = {
  dispatched: 'bg-[hsl(270,60%,50%)]',
  in_transit: 'bg-[hsl(142,70%,45%)]',
  delivered: 'bg-[hsl(152,60%,35%)]',
};

const statusDotColor: Record<string, string> = {
  dispatched: 'border-[hsl(270,60%,50%)]',
  in_transit: 'border-[hsl(142,70%,45%)]',
  delivered: 'border-[hsl(152,60%,35%)]',
};

export const DriversTimelineCard = ({ loads, drivers }: Props) => {
  const activeLoads = loads.filter(
    l => ACTIVE_STATUSES.includes(l.status) && l.driver_id
  );

  const grouped = activeLoads.reduce<Record<string, Load[]>>((acc, load) => {
    const dId = load.driver_id!;
    if (!acc[dId]) acc[dId] = [];
    acc[dId].push(load);
    return acc;
  }, {});

  // Sort each driver's loads by pickup_date
  Object.values(grouped).forEach(arr =>
    arr.sort((a, b) => (a.pickup_date || '').localeCompare(b.pickup_date || ''))
  );

  const driverEntries = Object.entries(grouped).map(([driverId, driverLoads]) => {
    const driver = drivers.find(d => d.id === driverId);
    return { driverId, driver, loads: driverLoads };
  }).filter(e => e.driver);

  if (driverEntries.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4" /> Drivers Load Timeline
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No drivers with active loads</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Users className="h-4 w-4" /> Drivers Load Timeline
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="max-h-[500px]">
          <div className="divide-y">
            {driverEntries.map(({ driverId, driver, loads: dLoads }) => (
              <div key={driverId} className="p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">{driver!.name}</span>
                  <StatusBadge status={driver!.status} />
                  <Badge variant="secondary" className="text-xs">
                    {dLoads.length} load{dLoads.length > 1 ? 's' : ''}
                  </Badge>
                </div>

                <div className="space-y-2">
                  {dLoads.map(load => (
                    <div key={load.id} className="flex items-center gap-2 text-xs">
                      {/* Pickup */}
                      <div className="flex items-center gap-1 min-w-[90px]">
                        <div className={`w-2.5 h-2.5 rounded-full border-2 ${statusDotColor[load.status] || 'border-muted-foreground'} bg-background shrink-0`} />
                        <MapPin className="h-3 w-3 text-muted-foreground shrink-0" />
                        <span className="text-muted-foreground">{formatDate(load.pickup_date)}</span>
                      </div>

                      {/* Connector line + load info */}
                      <div className="flex-1 flex items-center gap-1.5">
                        <div className={`h-0.5 w-4 ${statusLineColor[load.status] || 'bg-muted-foreground'} rounded shrink-0`} />
                        <span className="font-medium truncate max-w-[80px]">{load.reference_number}</span>
                        <span className="text-muted-foreground truncate max-w-[120px]">{load.origin} → {load.destination}</span>
                        <StatusBadge status={load.status} />
                        <span className="font-semibold ml-auto">${load.total_rate.toLocaleString()}</span>
                        <div className={`h-0.5 w-4 ${statusLineColor[load.status] || 'bg-muted-foreground'} rounded shrink-0`} />
                      </div>

                      {/* Delivery */}
                      <div className="flex items-center gap-1 min-w-[90px] justify-end">
                        <Flag className="h-3 w-3 text-muted-foreground shrink-0" />
                        <span className="text-muted-foreground">{formatDate(load.delivery_date)}</span>
                        <div className={`w-2.5 h-2.5 rounded-full border-2 ${statusDotColor[load.status] || 'border-muted-foreground'} bg-background shrink-0`} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};
