import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Users, ChevronLeft, ChevronRight } from 'lucide-react';

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
  trucks?: { id: string; unit_number: string; driver_id: string | null }[];
}

const ACTIVE_STATUSES = ['planned', 'dispatched', 'in_transit'];

const statusConfig: Record<string, { label: string; bg: string; text: string }> = {
  planned: { label: 'Planned', bg: 'hsl(215,70%,92%)', text: 'hsl(215,70%,35%)' },
  dispatched: { label: 'Dispatched', bg: 'hsl(270,60%,92%)', text: 'hsl(270,60%,35%)' },
  in_transit: { label: 'In Transit', bg: 'hsl(142,60%,90%)', text: 'hsl(142,60%,30%)' },
};

const barBorderColors: Record<string, string> = {
  planned: 'hsl(215,70%,70%)',
  dispatched: 'hsl(270,60%,70%)',
  in_transit: 'hsl(142,60%,55%)',
};

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const HOURS_PER_DAY = 24;
const HOUR_WIDTH_PX = 8; // px per hour
const DAY_WIDTH_PX = HOURS_PER_DAY * HOUR_WIDTH_PX; // 192px per day
const VISIBLE_DAYS = 7;
const DRIVER_COL_WIDTH = 140;

export const DriversTimelineCard = ({ loads, drivers, trucks = [] }: Props) => {
  const [weekOffset, setWeekOffset] = useState(0);

  const { driverEntries, weekStart, weekEnd, daysInView } = useMemo(() => {
    // Calculate week boundaries
    const today = new Date();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay() + 1 + weekOffset * 7); // Monday
    startOfWeek.setHours(0, 0, 0, 0);

    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + VISIBLE_DAYS);
    endOfWeek.setHours(0, 0, 0, 0);

    const days: Date[] = [];
    for (let i = 0; i < VISIBLE_DAYS; i++) {
      const d = new Date(startOfWeek);
      d.setDate(startOfWeek.getDate() + i);
      days.push(d);
    }

    // Filter active loads that overlap with visible range
    const wStartTs = startOfWeek.getTime();
    const wEndTs = endOfWeek.getTime();

    const activeLoads = loads.filter((l) => {
      if (!ACTIVE_STATUSES.includes(l.status) || !l.driver_id || !l.pickup_date) return false;
      const pickupTs = new Date(l.pickup_date + 'T00:00:00').getTime();
      const deliveryTs = l.delivery_date
        ? new Date(l.delivery_date + 'T23:59:59').getTime()
        : pickupTs + 86400000;
      return pickupTs < wEndTs && deliveryTs > wStartTs;
    });

    // Group by driver
    const grouped: Record<string, Load[]> = {};
    activeLoads.forEach((l) => {
      const dId = l.driver_id!;
      if (!grouped[dId]) grouped[dId] = [];
      grouped[dId].push(l);
    });

    // Also include drivers with active loads outside the view (show empty row)
    const allActiveDriverIds = new Set(
      loads.filter((l) => ACTIVE_STATUSES.includes(l.status) && l.driver_id).map((l) => l.driver_id!)
    );

    const entries = Array.from(allActiveDriverIds)
      .map((driverId) => ({
        driverId,
        driver: drivers.find((d) => d.id === driverId),
        truck: trucks.find((t) => t.driver_id === driverId),
        loads: grouped[driverId] || [],
      }))
      .filter((e) => e.driver)
      .sort((a, b) => a.driver!.name.localeCompare(b.driver!.name));

    return { driverEntries: entries, weekStart: startOfWeek, weekEnd: endOfWeek, daysInView: days };
  }, [loads, drivers, trucks, weekOffset]);

  const totalGridWidth = VISIBLE_DAYS * DAY_WIDTH_PX;
  const weekStartTs = weekStart.getTime();
  const totalMs = VISIBLE_DAYS * 86400000;

  // Month/year label
  const monthLabel = (() => {
    const months = new Set(daysInView.map((d) => `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`));
    return Array.from(months).join(' – ');
  })();

  const hourLabels = [0, 6, 12, 18];

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
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4" /> Drivers Load Timeline
          </CardTitle>
          {/* Legend */}
          <div className="flex items-center gap-3">
            {Object.entries(statusConfig).map(([key, cfg]) => (
              <div key={key} className="flex items-center gap-1.5">
                <span
                  className="inline-block w-3 h-3 rounded-sm border"
                  style={{ backgroundColor: cfg.bg, borderColor: barBorderColors[key] }}
                />
                <span className="text-[11px] text-muted-foreground font-medium">{cfg.label}</span>
              </div>
            ))}
          </div>
        </div>
      </CardHeader>

      <CardContent className="px-0 pb-2">
        {/* Month + navigation */}
        <div className="flex items-center gap-2 px-4 mb-2">
          <span className="text-sm font-semibold text-foreground">{monthLabel}</span>
          <div className="flex items-center gap-0.5">
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setWeekOffset((o) => o - 1)}>
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setWeekOffset((o) => o + 1)}>
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="h-6 text-[11px] px-2 ml-1"
            onClick={() => setWeekOffset(0)}
          >
            Today
          </Button>
        </div>

        <ScrollArea className="w-full">
          <div style={{ minWidth: `${DRIVER_COL_WIDTH + totalGridWidth + 16}px` }}>
            {/* Day + hour headers */}
            <div className="flex border-b border-border">
              <div style={{ width: DRIVER_COL_WIDTH, minWidth: DRIVER_COL_WIDTH }} className="shrink-0" />
              <div className="flex">
                {daysInView.map((day, di) => {
                  const isToday =
                    day.toDateString() === new Date().toDateString();
                  return (
                    <div
                      key={di}
                      style={{ width: DAY_WIDTH_PX }}
                      className={`border-l border-border ${isToday ? 'bg-primary/5' : ''}`}
                    >
                      <div className="text-[11px] font-semibold text-foreground px-1 py-0.5 border-b border-border/50">
                        {day.getDate()} {DAY_NAMES[day.getDay()]}
                      </div>
                      <div className="flex h-4">
                        {hourLabels.map((h) => (
                          <div
                            key={h}
                            style={{ width: DAY_WIDTH_PX / 4 }}
                            className="text-[9px] text-muted-foreground text-center border-r border-border/30 last:border-r-0"
                          >
                            {String(h).padStart(2, '0')}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Driver rows */}
            <div>
              {driverEntries.map(({ driverId, driver, truck, loads: dLoads }) => {
                const rowHeight = Math.max(48, dLoads.length * 32 + 12);
                return (
                <div key={driverId} className="flex border-b border-border/50 hover:bg-muted/20 transition-colors" style={{ minHeight: rowHeight }}>
                  {/* Driver info */}
                  <div
                    style={{ width: DRIVER_COL_WIDTH, minWidth: DRIVER_COL_WIDTH }}
                    className="shrink-0 px-3 py-2 border-r border-border flex flex-col justify-center"
                  >
                    <p className="text-sm font-bold truncate leading-tight">{driver!.name}</p>
                    <p className="text-[11px] text-muted-foreground leading-tight">
                      {truck ? truck.unit_number : '—'}
                    </p>
                    {dLoads.length > 1 && (
                      <p className="text-[10px] text-muted-foreground mt-0.5">{dLoads.length} loads</p>
                    )}
                  </div>

                  {/* Timeline area */}
                  <div className="relative" style={{ width: totalGridWidth, height: rowHeight }}>
                    {/* Grid lines */}
                    {daysInView.map((day, di) => {
                      const isToday = day.toDateString() === new Date().toDateString();
                      return (
                        <div
                          key={di}
                          className={`absolute top-0 bottom-0 border-l border-border/30 ${isToday ? 'bg-primary/5' : ''}`}
                          style={{ left: di * DAY_WIDTH_PX, width: DAY_WIDTH_PX }}
                        >
                          {/* Quarter-day grid lines */}
                          {[1, 2, 3].map((q) => (
                            <div
                              key={q}
                              className="absolute top-0 bottom-0 border-l border-border/15"
                              style={{ left: q * (DAY_WIDTH_PX / 4) }}
                            />
                          ))}
                        </div>
                      );
                    })}

                    {/* Today marker */}
                    {(() => {
                      const nowTs = Date.now();
                      const pct = (nowTs - weekStartTs) / totalMs;
                      if (pct < 0 || pct > 1) return null;
                      return (
                        <div
                          className="absolute top-0 bottom-0 w-0.5 bg-destructive/60 z-10"
                          style={{ left: `${pct * 100}%` }}
                        />
                      );
                    })()}

                    {/* Load bars */}
                    <div className="relative py-1.5 space-y-1 z-20">
                      {dLoads.map((load) => {
                        const pickupTs = new Date(load.pickup_date + 'T00:00:00').getTime();
                        const deliveryTs = load.delivery_date
                          ? new Date(load.delivery_date + 'T23:59:59').getTime()
                          : pickupTs + 86400000;

                        // Clamp to visible range
                        const clampedStart = Math.max(pickupTs, weekStartTs);
                        const clampedEnd = Math.min(deliveryTs, weekStartTs + totalMs);
                        if (clampedEnd <= clampedStart) return null;

                        const leftPct = ((clampedStart - weekStartTs) / totalMs) * 100;
                        const widthPct = ((clampedEnd - clampedStart) / totalMs) * 100;

                        const cfg = statusConfig[load.status] || statusConfig.planned;
                        const borderColor = barBorderColors[load.status] || 'hsl(215,15%,70%)';

                        return (
                          <div
                            key={load.id}
                            className="relative h-[26px] flex items-center rounded-md border overflow-hidden cursor-default"
                            style={{
                              position: 'absolute',
                              left: `${leftPct}%`,
                              width: `${widthPct}%`,
                              minWidth: 60,
                              backgroundColor: cfg.bg,
                              borderColor,
                              top: `${6 + dLoads.indexOf(load) * 30}px`,
                            }}
                            title={`${load.reference_number}: ${load.origin} → ${load.destination}\n$${load.total_rate.toLocaleString()}`}
                          >
                            <span className="text-[11px] font-semibold px-2 truncate" style={{ color: cfg.text }}>
                              {load.reference_number}
                            </span>
                            <span
                              className="text-[9px] font-medium px-1.5 py-0.5 rounded-sm mr-1 whitespace-nowrap"
                              style={{
                                backgroundColor: borderColor,
                                color: 'white',
                              }}
                            >
                              {cfg.label}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
              })}
            </div>
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </CardContent>
    </Card>
  );
};
