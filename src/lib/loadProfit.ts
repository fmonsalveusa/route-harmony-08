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
  monthlyFixedCosts: number;
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
  workingDaysPerMonth: number;
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
      const dailyFixed = input.workingDaysPerMonth > 0
        ? (Number(input.monthlyFixedCosts) || 0) / input.workingDaysPerMonth
        : 0;
      lines.push({
        label: 'Costos fijos',
        detail: `${days} día${days > 1 ? 's' : ''} × ${money(dailyFixed)}/día`,
        amount: dailyFixed * days,
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
