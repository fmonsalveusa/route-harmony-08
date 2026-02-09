import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { DbLoad } from '@/hooks/useLoads';
import { DbTruck } from '@/hooks/useTrucks';
import { Target } from 'lucide-react';

interface Props {
  loads: DbLoad[];
  trucks: DbTruck[];
}

interface TruckTypeRPM {
  type: string;
  avgRpm: number;
  loadCount: number;
}

export function MarketAnalysisCard({ loads, trucks }: Props) {
  const [targets, setTargets] = useState<Record<string, number>>({});

  const rpmByType = useMemo(() => {
    // Map truck_id -> truck_type
    const truckTypeMap: Record<string, string> = {};
    trucks.forEach(t => { truckTypeMap[t.id] = t.truck_type; });

    const agg: Record<string, { totalRate: number; totalMiles: number; count: number }> = {};

    loads.forEach(l => {
      if (l.status === 'cancelled' || !l.truck_id || !l.miles || l.miles <= 0) return;
      const type = truckTypeMap[l.truck_id] || 'Unknown';
      if (!agg[type]) agg[type] = { totalRate: 0, totalMiles: 0, count: 0 };
      agg[type].totalRate += l.total_rate;
      agg[type].totalMiles += l.miles;
      agg[type].count += 1;
    });

    return Object.entries(agg)
      .map(([type, d]): TruckTypeRPM => ({
        type,
        avgRpm: d.totalMiles > 0 ? d.totalRate / d.totalMiles : 0,
        loadCount: d.count,
      }))
      .sort((a, b) => b.avgRpm - a.avgRpm);
  }, [loads, trucks]);

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <Target className="h-4 w-4 text-primary" />
          <CardTitle className="text-base">Market Analysis · RPM por Tipo de Camión</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {rpmByType.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">Sin datos de RPM disponibles. Asegúrate de que las cargas tengan millas y camión asignado.</p>
        ) : (
          rpmByType.map(item => {
            const target = targets[item.type] || 0;
            const pct = target > 0 ? Math.min((item.avgRpm / target) * 100, 150) : 0;
            const isAbove = target > 0 && item.avgRpm >= target;

            return (
              <div key={item.type} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-sm font-medium">{item.type}</span>
                    <span className="text-xs text-muted-foreground ml-2">({item.loadCount} cargas)</span>
                  </div>
                  <span className={`text-sm font-bold ${isAbove ? 'text-success' : target > 0 ? 'text-destructive' : ''}`}>
                    ${item.avgRpm.toFixed(2)}/mi
                  </span>
                </div>

                {target > 0 && (
                  <div className="space-y-1">
                    <Progress value={Math.min(pct, 100)} className="h-2.5" />
                    <div className="flex justify-between text-[10px] text-muted-foreground">
                      <span>RPM: ${item.avgRpm.toFixed(2)}</span>
                      <span>Target: ${target.toFixed(2)}</span>
                      <span className={isAbove ? 'text-success' : 'text-destructive'}>
                        {isAbove ? '+' : ''}{((item.avgRpm - target) / target * 100).toFixed(1)}%
                      </span>
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-muted-foreground whitespace-nowrap">Target RPM:</span>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    className="h-7 text-xs w-24"
                    value={targets[item.type] || ''}
                    onChange={e => setTargets(prev => ({ ...prev, [item.type]: Number(e.target.value) }))}
                  />
                </div>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
