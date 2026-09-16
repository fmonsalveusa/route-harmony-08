export interface ProfitLine {
  label: string;
  detail: string;
  amount: number;
}

export interface LoadProfit {
  rate: number;
  totalMiles: number;
  days: number;
  lines: ProfitLine[];
  totalCosts: number;
  netProfit: number;
  margin: number;
  profitPerMile: number;
}

export interface LoadProfitInput {
  totalRate: number;
  loadedMiles: number;
  emptyMiles: number;
  pickupDate: string | null;
  deliveryDate: string | null;
  mpg: number | null;
  monthlyFixedCosts: number;
  costPerMile: number;
  driverPayPct: number;
  dispatcherPct: number;
  factoringPct: number;
  actualExpenses: number;
  dieselPrice: number;
  workingDaysPerMonth: number;
}

/** Inclusive day count between two dates, minimum 1 */
function daysBetween(pickup: string | null, delivery: string | null): number {
  if (!pickup || !delivery) return 1;
  const a = new Date(pickup.split('T')[0] + 'T00:00:00');
  const b = new Date(delivery.split('T')[0] + 'T00:00:00');
  if (isNaN(a.getTime()) || isNaN(b.getTime())) return 1;
  const diff = Math.round((b.getTime() - a.getTime()) / 86400000) + 1;
  return Math.max(1, diff);
}

export function calculateLoadProfit(input: LoadProfitInput): LoadProfit {
  const rate = Number(input.totalRate) || 0;
  const totalMiles = (Number(input.loadedMiles) || 0) + (Number(input.emptyMiles) || 0);
  const days = daysBetween(input.pickupDate, input.deliveryDate);

  const gallons = input.mpg && input.mpg > 0 ? totalMiles / input.mpg : 0;
  const fuelCost = gallons * (Number(input.dieselPrice) || 0);

  const perMileCost = totalMiles * (Number(input.costPerMile) || 0);

  const dailyFixed = input.workingDaysPerMonth > 0
    ? (Number(input.monthlyFixedCosts) || 0) / input.workingDaysPerMonth
    : 0;
  const fixedAllocation = dailyFixed * days;

  const driverPay = rate * (Number(input.driverPayPct) || 0) / 100;
  const dispatcherPay = rate * (Number(input.dispatcherPct) || 0) / 100;
  const factoring = rate * (Number(input.factoringPct) || 0) / 100;
  const actual = Number(input.actualExpenses) || 0;

  const lines: ProfitLine[] = [
    {
      label: 'Diésel',
      detail: input.mpg && input.mpg > 0
        ? `${totalMiles.toLocaleString()} mi ÷ ${input.mpg} mpg × $${input.dieselPrice.toFixed(2)}`
        : 'MPG no configurado',
      amount: fuelCost,
    },
    {
      label: 'Costos por milla',
      detail: `${totalMiles.toLocaleString()} mi × $${(Number(input.costPerMile) || 0).toFixed(3)}`,
      amount: perMileCost,
    },
    {
      label: 'Costos fijos',
      detail: `${days} día${days > 1 ? 's' : ''} × $${dailyFixed.toFixed(2)}/día`,
      amount: fixedAllocation,
    },
    {
      label: 'Driver pay',
      detail: `${input.driverPayPct}%`,
      amount: driverPay,
    },
    {
      label: 'Dispatcher',
      detail: `${input.dispatcherPct}%`,
      amount: dispatcherPay,
    },
    {
      label: 'Factoring',
      detail: `${input.factoringPct}%`,
      amount: factoring,
    },
    {
      label: 'Gastos reales',
      detail: 'peajes, parqueo, reparaciones',
      amount: actual,
    },
  ].filter(l => l.amount > 0);

  const totalCosts = lines.reduce((sum, l) => sum + l.amount, 0);
  const netProfit = rate - totalCosts;

  return {
    rate,
    totalMiles,
    days,
    lines,
    totalCosts,
    netProfit,
    margin: rate > 0 ? (netProfit / rate) * 100 : 0,
    profitPerMile: totalMiles > 0 ? netProfit / totalMiles : 0,
  };
}
