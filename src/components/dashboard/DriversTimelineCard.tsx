import { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Users, ChevronLeft, ChevronRight, X } from 'lucide-react';

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
  miles?: number | null;
}

interface SelectedLoadInfo {
  load: Load;
  driverName: string;
  truckUnit: string;
  rect: { top: number; left: number; width: number };
}

interface Driver {
  id: string;
  name: string;
  status: string;
  truck_id: string | null;
}

interface Props {
  loads: Load[];
  drivers: Driver[];
  trucks?: { id: string; unit_number: string; driver_id: string | null }[];
}

const ACTIVE_STATUSES = ['planned', 'dispatched', 'in_transit', 'on_site_pickup', 'picked_up', 'on_site_delivery'];
const LEGEND_STATUSES = ['planned', 'dispatched', 'in_transit', 'on_site_pickup', 'picked_up', 'on_site_delivery'];

const statusConfig: Record<string, { label: string; bg: string; text: string }> = {
  planned: { label: 'Planned', bg: 'hsl(48,92%,85%)', text: 'hsl(48,92%,30%)' },
  dispatched: { label: 'Dispatched', bg: 'hsl(80,65%,85%)', text: 'hsl(80,65%,25%)' },
  in_transit: { label: 'In Transit', bg: 'hsl(140,60%,85%)', text: 'hsl(140,60%,25%)' },
  on_site_pickup: { label: 'On Site - Pickup', bg: 'hsl(170,60%,85%)', text: 'hsl(170,60%,25%)' },
  picked_up: { label: 'Picked Up', bg: 'hsl(200,70%,87%)', text: 'hsl(200,70%,30%)' },
  on_site_delivery: { label: 'On Site - Delivery', bg: 'hsl(230,60%,88%)', text: 'hsl(230,60%,30%)' },
  delivered: { label: 'Delivered', bg: 'hsl(270,55%,88%)', text: 'hsl(270,55%,30%)' },
  tonu: { label: 'TONU', bg: 'hsl(25,85%,87%)', text: 'hsl(25,85%,30%)' },
  cancelled: { label: 'Canceled', bg: 'hsl(0,72%,90%)', text: 'hsl(0,72%,30%)' },
};

const barBorderColors: Record<string, string> = {
  planned: 'hsl(48,92%,50%)',
  dispatched: 'hsl(80,65%,45%)',
  in_transit: 'hsl(140,60%,40%)',
  on_site_pickup: 'hsl(170,60%,40%)',
  picked_up: 'hsl(200,70%,48%)',
  on_site_delivery: 'hsl(230,60%,50%)',
  delivered: 'hsl(270,55%,50%)',
  tonu: 'hsl(25,85%,50%)',
  cancelled: 'hsl(0,72%,50%)',
};

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const VISIBLE_DAYS = 7;
const DRIVER_COL_WIDTH = 140;
const MIN_DAY_WIDTH = 120;

export const DriversTimelineCard = ({ loads, drivers, trucks = [] }: Props) => {
  const [weekOffset, setWeekOffset] = useState(0);
  const [selectedLoad, setSelectedLoad] = useState<SelectedLoadInfo | null>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const cardRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Measure available width from the card element itself
  useEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      // Subtract card horizontal padding (CardContent has px-0 but card has default border)
      setContainerWidth(entry.contentRect.width);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const dayWidth = containerWidth > 0
    ? Math.max(MIN_DAY_WIDTH, (containerWidth - DRIVER_COL_WIDTH) / VISIBLE_DAYS)
    : MIN_DAY_WIDTH;

  // Close popup on outside click
  useEffect(() => {
    if (!selectedLoad) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('[data-load-popup]')) return;
      setSelectedLoad(null);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [selectedLoad]);

  const handleLoadClick = useCallback((e: React.MouseEvent, load: Load, driverName: string, truckUnit: string) => {
    e.stopPropagation();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const cardRect = cardRef.current?.getBoundingClientRect();
    setSelectedLoad({
      load,
      driverName,
      truckUnit,
      rect: {
        top: rect.bottom - (cardRect?.top || 0) + 4,
        left: rect.left - (cardRect?.left || 0),
        width: rect.width,
      },
    });
  }, []);

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
        truck: (() => {
          const drv = drivers.find((d) => d.id === driverId);
          return drv?.truck_id ? trucks.find((t) => t.id === drv.truck_id) : undefined;
        })(),
        loads: grouped[driverId] || [],
      }))
      .filter((e) => e.driver)
      .sort((a, b) => a.driver!.name.localeCompare(b.driver!.name));

    return { driverEntries: entries, weekStart: startOfWeek, weekEnd: endOfWeek, daysInView: days };
  }, [loads, drivers, trucks, weekOffset]);

  const totalGridWidth = VISIBLE_DAYS * dayWidth;
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

  const formatCityState = (location: string) => {
    // Try to extract "City, ST" from addresses like "City, ST" or "City, State, ..."
    const parts = location.split(',').map(s => s.trim());
    if (parts.length >= 2) return `${parts[0]}, ${parts[1]}`;
    return location;
  };

  const rpm = selectedLoad?.load.miles && selectedLoad.load.miles > 0
    ? (selectedLoad.load.total_rate / selectedLoad.load.miles).toFixed(2)
    : 'N/A';

  return (
    <Card ref={cardRef} className="relative">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4" /> Drivers Load Timeline
            <Badge variant="secondary" className="ml-2 text-xs">{loads.filter(l => ACTIVE_STATUSES.includes(l.status) && l.driver_id).length} loads</Badge>
          </CardTitle>
          {/* Legend */}
          <div className="flex items-center gap-3">
            {LEGEND_STATUSES.map((key) => {
              const cfg = statusConfig[key];
              return (
              <div key={key} className="flex items-center gap-1.5">
                <span
                  className="inline-block w-3 h-3 rounded-sm border"
                  style={{ backgroundColor: cfg.bg, borderColor: barBorderColors[key] }}
                />
                <span className="text-[11px] text-muted-foreground font-medium">{cfg.label}</span>
              </div>
              );
            })}
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

        <div className="w-full overflow-x-auto">
          <div ref={containerRef} style={{ width: containerWidth > 0 ? `${DRIVER_COL_WIDTH + VISIBLE_DAYS * dayWidth}px` : '100%', minWidth: `${DRIVER_COL_WIDTH + VISIBLE_DAYS * MIN_DAY_WIDTH}px` }}>
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
                      style={{ width: dayWidth }}
                      className={`border-l border-border ${isToday ? 'bg-primary/5' : ''}`}
                    >
                      <div className="text-[11px] font-semibold text-foreground px-1 py-0.5 border-b border-border/50">
                        {day.getDate()} {DAY_NAMES[day.getDay()]}
                      </div>
                      <div className="flex h-4">
                        {hourLabels.map((h) => (
                          <div
                            key={h}
                            style={{ width: dayWidth / 4 }}
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
                      {truck ? `Truck #${truck.unit_number}` : 'No truck'}
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
                          style={{ left: di * dayWidth, width: dayWidth }}
                        >
                          {/* Quarter-day grid lines */}
                          {[1, 2, 3].map((q) => (
                            <div
                              key={q}
                              className="absolute top-0 bottom-0 border-l border-border/15"
                              style={{ left: q * (dayWidth / 4) }}
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
                            className="relative h-[26px] flex items-center rounded-md border overflow-hidden cursor-pointer hover:brightness-95 transition-all"
                            style={{
                              position: 'absolute',
                              left: `${leftPct}%`,
                              width: `${widthPct}%`,
                              minWidth: 60,
                              backgroundColor: cfg.bg,
                              borderColor,
                              top: `${6 + dLoads.indexOf(load) * 30}px`,
                            }}
                            onClick={(e) => handleLoadClick(e, load, driver!.name, truck ? `#${truck.unit_number}` : 'N/A')}
                          >
                            <span className="text-[11px] font-semibold px-2 truncate" style={{ color: cfg.text }}>
                              {load.reference_number}
                            </span>
                            <span
                              className="text-[9px] font-medium px-1.5 py-0.5 rounded-sm mr-2 whitespace-nowrap"
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
        </div>

        {/* Load Detail Popup */}
        {selectedLoad && (() => {
          const { load, driverName, truckUnit, rect } = selectedLoad;
          const cfg = statusConfig[load.status] || statusConfig.planned;
          const borderColor = barBorderColors[load.status] || 'hsl(215,15%,70%)';
          return (
            <div
              data-load-popup
              className="absolute z-50 w-72 bg-background border border-border rounded-lg shadow-xl p-4 space-y-2"
              style={{ top: rect.top + 8, left: Math.max(8, Math.min(rect.left, (cardRef.current?.offsetWidth || 400) - 300)) }}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-foreground">Load #{load.reference_number}</span>
                <button onClick={() => setSelectedLoad(null)} className="text-muted-foreground hover:text-foreground">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[12px]">
                <div>
                  <span className="text-muted-foreground">Status</span>
                  <p className="font-semibold" style={{ color: cfg.text }}>{cfg.label}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Driver</span>
                  <p className="font-semibold text-foreground truncate">{driverName}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Truck</span>
                  <p className="font-semibold text-foreground">{truckUnit}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Rate</span>
                  <p className="font-semibold text-foreground">${load.total_rate.toLocaleString()}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">RPM</span>
                  <p className="font-semibold text-foreground">{rpm === 'N/A' ? rpm : `$${rpm}`}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Miles</span>
                  <p className="font-semibold text-foreground">{load.miles ? load.miles.toLocaleString() : 'N/A'}</p>
                </div>
              </div>
              <div className="border-t border-border pt-2 space-y-1.5 text-[12px]">
                <div className="flex items-start gap-2">
                  <span className="text-green-600 font-bold mt-0.5">P</span>
                  <div>
                    <p className="font-semibold text-foreground">{formatCityState(load.origin)}</p>
                    <p className="text-muted-foreground">{load.pickup_date || '—'}</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-red-600 font-bold mt-0.5">D</span>
                  <div>
                    <p className="font-semibold text-foreground">{formatCityState(load.destination)}</p>
                    <p className="text-muted-foreground">{load.delivery_date || '—'}</p>
                  </div>
                </div>
              </div>
            </div>
          );
        })()}
      </CardContent>
    </Card>
  );
};
