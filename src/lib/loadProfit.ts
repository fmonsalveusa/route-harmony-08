export interface ProfitLine {
  label: string;
  detail: string;
  amount: number;
}

export interface LoadProfit {
  serviceType: string;
  serviceLabel: string;
  rate: number;
  revenue: number;
  revenueDetail: string;
  totalMiles: number;
  days: number;
  lines: ProfitLine[];
  totalCosts: number;
  netProfit: number;
  margin: number;
  profitPerMile: number;
}

export interface LoadProfitInput {
  serviceType: string;
  totalRate: number;
  loadedMiles: number;
  emptyMiles: number;
  pickupDate: string | null;
  deliveryDate: string | null;
  mpg: number | null;
  /** Costo fijo asignado: días calendario de la carga, con los días compartidos repartidos */
  fixedCost: FixedCostAllocation;
  costPerMile: number;
  driverPayPct: number;
  investorPayPct: number;
  dispatcherPct: number;
  factoringPct: number;
  dispatchServiceFeePct: number;
  actualExpenses: number;
  dieselPrice: number;
  /** true si el precio del diésel quedó congelado al entregar */
  dieselFrozen?: boolean;
}

export interface FixedCostAllocation {
  /** Monto total de costos fijos que le toca a la carga */
  amount: number;
  /** Días que le tocan (fraccionados cuando comparte días con otras cargas del camión) */
  days: number;
  /** Cargas del mismo camión con las que comparte algún día */
  sharedWith: string[];
}

export interface LoadSpan {
  id: string;
  ref: string;
  pickupDate: string | null;
  deliveryDate: string | null;
}

const addDays = (date: string, n: number) => {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().split('T')[0];
};

/** Días calendario que ocupa la carga (pickup → entrega, inclusive). Sin entrega: solo el pickup. */
function spanOf(l: LoadSpan): { start: string; end: string } | null {
  const start = (l.pickupDate || '').split('T')[0];
  if (!start) return null;
  const rawEnd = (l.deliveryDate || '').split('T')[0];
  return { start, end: rawEnd && rawEnd >= start ? rawEnd : start };
}

/**
 * Reparte los costos fijos del camión por día calendario.
 * Cada día que la carga ocupa se divide en partes iguales entre todas las cargas
 * del mismo camión que también ocupan ese día.
 */
export function allocateFixedCost(
  load: LoadSpan,
  truckLoads: LoadSpan[],
  dailyCostAt: (date: string) => number,
): FixedCostAllocation {
  const span = spanOf(load);
  if (!span) return { amount: 0, days: 0, sharedWith: [] };

  const others = truckLoads
    .filter(l => l.id !== load.id)
    .map(l => ({ load: l, span: spanOf(l) }))
    .filter((o): o is { load: LoadSpan; span: { start: string; end: string } } => o.span !== null);

  let amount = 0;
  let days = 0;
  const sharedWith = new Set<string>();

  for (let day = span.start; day <= span.end; day = addDays(day, 1)) {
    const overlapping = others.filter(o => o.span.start <= day && day <= o.span.end);
    const share = 1 / (overlapping.length + 1);
    amount += share * dailyCostAt(day);
    days += share;
    overlapping.forEach(o => sharedWith.add(o.load.ref));
  }

  return { amount, days, sharedWith: [...sharedWith] };
}

const SERVICE_LABELS: Record<string, string> = {
  company_driver: 'Company Driver',
  owner_operator: 'Owner Operator',
  dispatch_service: 'Dispatch Service',
};

/** Inclusive day count between two dates, minimum 1 */
function daysBetween(pickup: string | null, delivery: string | null): number {
  if (!pickup || !delivery) return 1;
  const a = new Date(pickup.split('T')[0] + 'T00:00:00');
  const b = new Date(delivery.split('T')[0] + 'T00:00:00');
  if (isNaN(a.getTime()) || isNaN(b.getTime())) return 1;
  const diff = Math.round((b.getTime() - a.getTime()) / 86400000) + 1;
  return Math.max(1, diff);
}

const money = (n: number) => '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function calculateLoadProfit(input: LoadProfitInput): LoadProfit {
  const rate = Number(input.totalRate) || 0;
  const totalMiles = (Number(input.loadedMiles) || 0) + (Number(input.emptyMiles) || 0);
  const days = daysBetween(input.pickupDate, input.deliveryDate);
  const serviceType = input.serviceType || 'owner_operator';

  const pct = (p: number) => rate * (Number(p) || 0) / 100;
  const lines: ProfitLine[] = [];

  let revenue = rate;
  let revenueDetail = '';

  if (serviceType === 'dispatch_service') {
    // Solo cobramos el fee de dispatch — el rate de la carga no es nuestro
    revenue = pct(input.dispatchServiceFeePct);
    revenueDetail = `${input.dispatchServiceFeePct}% de ${money(rate)}`;
    lines.push({
      label: 'Dispatcher',
      detail: `${input.dispatcherPct}% de ${money(rate)}`,
      amount: pct(input.dispatcherPct),
    });
  } else {
    // Company Driver — el camión es nuestro, van todos sus costos
    if (serviceType === 'company_driver') {
      const gallons = input.mpg && input.mpg > 0 ? totalMiles / input.mpg : 0;
      lines.push({
        label: 'Diésel',
        detail: input.mpg && input.mpg > 0
          ? `${totalMiles.toLocaleString()} mi ÷ ${input.mpg} mpg × $${input.dieselPrice.toFixed(2)}${input.dieselFrozen ? ' (al entregar)' : ''}`
          : 'MPG no configurado',
        amount: gallons * (Number(input.dieselPrice) || 0),
      });
      lines.push({
        label: 'Costos por milla',
        detail: `${totalMiles.toLocaleString()} mi × $${(Number(input.costPerMile) || 0).toFixed(3)}`,
        amount: totalMiles * (Number(input.costPerMile) || 0),
      });
      const fixed = input.fixedCost;
      const fixedDays = Math.round(fixed.days * 100) / 100;
      const perDay = fixed.days > 0 ? fixed.amount / fixed.days : 0;
      const shared = fixed.sharedWith.length > 0
        ? ` (compartido con ${fixed.sharedWith.map(r => `#${r}`).join(', ')})`
        : '';
      lines.push({
        label: 'Costos fijos',
        detail: `${fixedDays} día${fixedDays === 1 ? '' : 's'} × ${money(perDay)}/día${shared}`,
        amount: fixed.amount,
      });
    }

    // Company Driver y Owner Operator comparten estos
    lines.push({ label: 'Driver pay', detail: `${input.driverPayPct}%`, amount: pct(input.driverPayPct) });
    lines.push({ label: 'Investor pay', detail: `${input.investorPayPct}%`, amount: pct(input.investorPayPct) });
    lines.push({ label: 'Dispatcher', detail: `${input.dispatcherPct}%`, amount: pct(input.dispatcherPct) });
    // Owner Operator: el factoring ya va descontado del % del driver/investor
    if (serviceType !== 'owner_operator') {
      lines.push({ label: 'Factoring', detail: `${input.factoringPct}%`, amount: pct(input.factoringPct) });
    }
  }

  lines.push({
    label: 'Gastos reales',
    detail: 'peajes, parqueo, reparaciones',
    amount: Number(input.actualExpenses) || 0,
  });

  const visible = lines.filter(l => l.amount > 0);
  const totalCosts = visible.reduce((sum, l) => sum + l.amount, 0);
  const netProfit = revenue - totalCosts;

  return {
    serviceType,
    serviceLabel: SERVICE_LABELS[serviceType] || serviceType,
    rate,
    revenue,
    revenueDetail,
    totalMiles,
    days,
    lines: visible,
    totalCosts,
    netProfit,
    margin: revenue > 0 ? (netProfit / revenue) * 100 : 0,
    profitPerMile: totalMiles > 0 ? netProfit / totalMiles : 0,
  };
}
