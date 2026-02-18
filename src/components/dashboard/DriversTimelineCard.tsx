import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { StatusBadge } from '@/components/StatusBadge';
import { Badge } from '@/components/ui/badge';
import { formatDate } from '@/lib/dateUtils';
import { Users } from 'lucide-react';

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

const ACTIVE_STATUSES = ['planned', 'dispatched', 'in_transit'];

const barColors: Record<string, string> = {
  pending: 'hsl(38,92%,50%)',
  planned: 'hsl(215,70%,50%)',
  dispatched: 'hsl(270,60%,50%)',
  in_transit: 'hsl(142,70%,45%)'
};

/** Extract "City, ST" from a full address like "123 Main St, Dallas, TX 75201" */
const extractCityState = (address: string): string => {
  // Try to find pattern: City, ST (2-letter state)
  const match = address.match(/([A-Za-z\s.'-]+),\s*([A-Z]{2})\b/);
  if (match) return `${match[1].trim()}, ${match[2]}`;
  // Fallback: take last two comma-separated parts
  const parts = address.split(',').map((p) => p.trim());
  if (parts.length >= 2) {
    const state = parts[parts.length - 1].replace(/\d+/g, '').trim().split(' ')[0];
    const city = parts[parts.length - 2];
    return `${city}, ${state}`;
  }
  return address.substring(0, 20);
};

export const DriversTimelineCard = ({ loads, drivers }: Props) => {
  const { driverEntries, globalMin, globalMax, totalDays } = useMemo(() => {
    const activeLoads = loads.filter(
      (l) => ACTIVE_STATUSES.includes(l.status) && l.driver_id && l.pickup_date
    );

    if (activeLoads.length === 0) return { driverEntries: [], globalMin: 0, globalMax: 0, totalDays: 1 };

    // Find global date range
    let minTs = Infinity,maxTs = -Infinity;
    activeLoads.forEach((l) => {
      const p = new Date(l.pickup_date + 'T00:00:00').getTime();
      const d = l.delivery_date ? new Date(l.delivery_date + 'T00:00:00').getTime() : p + 86400000;
      if (p < minTs) minTs = p;
      if (d > maxTs) maxTs = d;
    });

    // Add 1 day padding on each side
    minTs -= 86400000;
    maxTs += 86400000;
    const days = Math.max((maxTs - minTs) / 86400000, 1);

    // Group by driver
    const grouped: Record<string, Load[]> = {};
    activeLoads.forEach((l) => {
      const dId = l.driver_id!;
      if (!grouped[dId]) grouped[dId] = [];
      grouped[dId].push(l);
    });

    Object.values(grouped).forEach((arr) =>
    arr.sort((a, b) => (a.pickup_date || '').localeCompare(b.pickup_date || ''))
    );

    const entries = Object.entries(grouped).
    map(([driverId, driverLoads]) => ({
      driverId,
      driver: drivers.find((d) => d.id === driverId),
      loads: driverLoads
    })).
    filter((e) => e.driver).
    sort((a, b) => a.driver!.name.localeCompare(b.driver!.name));

    return { driverEntries: entries, globalMin: minTs, globalMax: maxTs, totalDays: days };
  }, [loads, drivers]);

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
      </Card>);

  }

  // Generate date axis labels
  const axisLabels: {label: string;pct: number;}[] = [];
  const stepDays = Math.max(1, Math.floor(totalDays / 6));
  for (let i = 0; i <= totalDays; i += stepDays) {
    const d = new Date(globalMin + i * 86400000);
    axisLabels.push({
      label: `${d.getMonth() + 1}/${d.getDate()}`,
      pct: i / totalDays * 100
    });
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Users className="h-4 w-4" /> Drivers Load Timeline
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        <ScrollArea className="max-h-[800px]">
          {/* Date axis */}
          <div className="flex items-center mb-1 ml-[160px]">
            <div className="relative w-full h-5">
              {axisLabels.map((a, i) =>
              <span
                key={i}
                className="absolute text-[10px] text-muted-foreground -translate-x-1/2"
                style={{ left: `${a.pct}%` }}>

                  {a.label}
                </span>
              )}
            </div>
          </div>

          {/* Today marker reference */}
          {(() => {
            const todayTs = new Date(new Date().toISOString().split('T')[0] + 'T00:00:00').getTime();
            const todayPct = (todayTs - globalMin) / (totalDays * 86400000) * 100;
            if (todayPct < 0 || todayPct > 100) return null;
            return (
              <div className="flex items-center mb-1 ml-[160px]">
                <div className="relative w-full h-0">
                  <div
                    className="absolute top-0 w-px bg-destructive opacity-50"
                    style={{ left: `${todayPct}%`, height: `${driverEntries.length * 60 + 20}px` }} />

                  <span
                    className="absolute -top-3 text-[9px] text-destructive font-medium -translate-x-1/2"
                    style={{ left: `${todayPct}%` }}>

                    Today
                  </span>
                </div>
              </div>);

          })()}

          <div className="space-y-1">
            {driverEntries.map(({ driverId, driver, loads: dLoads }) =>
            <div key={driverId} className="flex items-start gap-2">
                {/* Driver name column */}
                <div className="w-[150px] shrink-0 pt-1 text-sm font-bold">
                  <p className="text-sm font-bold truncate">{driver!.name}</p>
                  <div className="flex items-center gap-1 mt-0.5">
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
                      {dLoads.length} load{dLoads.length > 1 ? 's' : ''}
                    </Badge>
                  </div>
                </div>

                {/* Timeline bars */}
                <div className="flex-1 min-h-[50px] space-y-1 py-1">
                  {dLoads.map((load) => {
                  const pickupTs = new Date(load.pickup_date + 'T00:00:00').getTime();
                  const deliveryTs = load.delivery_date ?
                  new Date(load.delivery_date + 'T00:00:00').getTime() :
                  pickupTs + 86400000;

                  const leftPct = (pickupTs - globalMin) / (totalDays * 86400000) * 100;
                  const widthPct = Math.max((deliveryTs - pickupTs) / (totalDays * 86400000) * 100, 2);
                  const color = barColors[load.status] || 'hsl(215,15%,50%)';

                  const originLabel = extractCityState(load.origin);
                  const destLabel = extractCityState(load.destination);

                  return (
                    <div key={load.id} className="relative w-full h-[28px] group">
                        <div className="absolute inset-0 bg-muted/30 rounded-sm" />
                        {/* Origin label */}
                        <span
                        className="absolute text-[8px] text-muted-foreground font-medium whitespace-nowrap"
                        style={{ left: `${leftPct}%`, top: '-1px', transform: 'translateX(0)' }}>

                          {originLabel}
                        </span>
                        {/* Bar */}
                        <div
                        className="absolute top-[10px] h-[16px] rounded-sm flex items-center justify-center overflow-hidden cursor-default transition-opacity hover:opacity-90"
                        style={{
                          left: `${leftPct}%`,
                          width: `${widthPct}%`,
                          backgroundColor: color,
                          minWidth: '30px'
                        }}
                        title={`${load.reference_number}: ${load.origin} → ${load.destination}\nPickup: ${formatDate(load.pickup_date)} | Delivery: ${formatDate(load.delivery_date)}\n$${load.total_rate.toLocaleString()}`}>

                          <span className="text-[9px] text-white font-medium truncate px-1">
                            {load.reference_number}
                          </span>
                        </div>
                        {/* Destination label */}
                        <span
                        className="absolute text-[8px] text-muted-foreground font-medium whitespace-nowrap"
                        style={{ left: `${leftPct + widthPct}%`, top: '-1px', transform: 'translateX(-100%)' }}>

                          {destLabel}
                        </span>
                      </div>);

                })}
                </div>
              </div>
            )}
          </div>
          <div className="h-8" />
        </ScrollArea>
      </CardContent>
    </Card>);

};