import { Droplets, RotateCcw, Disc, Settings, Wind, Thermometer, Fuel, ClipboardCheck, Wrench, HelpCircle } from 'lucide-react';

export interface MaintenanceTypeConfig {
  key: string;
  label: string;
  icon: any;
  defaultIntervalMiles?: number;
  defaultIntervalDays?: number;
}

export const MAINTENANCE_TYPES: MaintenanceTypeConfig[] = [
  { key: 'oil_change', label: 'Oil Change', icon: Droplets, defaultIntervalMiles: 10000 },
  { key: 'tire_rotation', label: 'Tire Rotation', icon: RotateCcw, defaultIntervalMiles: 15000 },
  { key: 'brake_inspection', label: 'Brake Inspection', icon: Disc, defaultIntervalMiles: 25000 },
  { key: 'transmission', label: 'Transmission Service', icon: Settings, defaultIntervalMiles: 30000 },
  { key: 'air_filter', label: 'Air Filter', icon: Wind, defaultIntervalMiles: 15000 },
  { key: 'coolant_flush', label: 'Coolant Flush', icon: Thermometer, defaultIntervalMiles: 30000 },
  { key: 'def_system', label: 'DEF System', icon: Fuel, defaultIntervalMiles: 10000 },
  { key: 'dot_inspection', label: 'DOT Inspection', icon: ClipboardCheck, defaultIntervalDays: 365 },
  { key: 'pm_service', label: 'PM Service', icon: Wrench, defaultIntervalMiles: 25000 },
  { key: 'custom', label: 'Custom', icon: HelpCircle },
];

export function getMaintenanceTypeConfig(key: string): MaintenanceTypeConfig {
  return MAINTENANCE_TYPES.find(t => t.key === key) || MAINTENANCE_TYPES[MAINTENANCE_TYPES.length - 1];
}

export function getStatusColor(status: string) {
  switch (status) {
    case 'ok': return { bg: 'bg-green-500/15', text: 'text-green-600', border: 'border-green-500/30', dot: 'bg-green-500' };
    case 'warning': return { bg: 'bg-amber-500/15', text: 'text-amber-600', border: 'border-amber-500/30', dot: 'bg-amber-500' };
    case 'due': return { bg: 'bg-red-500/15', text: 'text-red-600', border: 'border-red-500/30', dot: 'bg-red-500' };
    default: return { bg: 'bg-muted', text: 'text-muted-foreground', border: 'border-border', dot: 'bg-muted-foreground' };
  }
}
