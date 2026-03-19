import { HelpCircle, Hammer, CircleDot, Package, Cog } from 'lucide-react';

export interface MaintenanceTypeConfig {
  key: string;
  label: string;
  icon: any;
  defaultIntervalMiles?: number;
  defaultIntervalDays?: number;
}

export const MAINTENANCE_TYPES: MaintenanceTypeConfig[] = [
  { key: 'maintenance', label: 'Maintenance', icon: Cog },
  { key: 'repairs', label: 'Repairs', icon: Hammer },
  { key: 'tires', label: 'Tires', icon: CircleDot },
  { key: 'parts', label: 'Parts', icon: Package },
  { key: 'custom', label: 'Custom', icon: HelpCircle },
];

export const MAINTENANCE_TYPE_LABELS: Record<string, string> = Object.fromEntries(
  MAINTENANCE_TYPES.map(t => [t.key, t.label])
);

export const MAINTENANCE_CATEGORIES_BY_TYPE: Record<string, { value: string; label: string }[]> = {
  maintenance: [
    { value: 'oil_change', label: 'Oil Change' },
    { value: 'filter_replacement', label: 'Filter Replacement' },
    { value: 'dot_inspection', label: 'DOT Inspection' },
    { value: 'pm_service', label: 'PM Service' },
    { value: 'lubrication', label: 'Lubrication/Greasing' },
    { value: 'fluid_topup', label: 'Fluid Top-Up' },
  ],
  repairs: [
    { value: 'engine', label: 'Engine Repair' },
    { value: 'transmission', label: 'Transmission Repair' },
    { value: 'brake', label: 'Brake Repair' },
    { value: 'electrical', label: 'Electrical Repair' },
    { value: 'body_work', label: 'Body Work' },
    { value: 'ac_repair', label: 'A/C Repair' },
    { value: 'suspension', label: 'Suspension Repair' },
    { value: 'other_repair', label: 'Other Repair' },
  ],
  tires: [
    { value: 'new_tires', label: 'New Tires' },
    { value: 'tire_repair', label: 'Tire Repair/Patch' },
    { value: 'tire_rotation', label: 'Tire Rotation' },
    { value: 'wheel_alignment', label: 'Wheel Alignment' },
    { value: 'tire_balancing', label: 'Tire Balancing' },
  ],
  parts: [
    { value: 'filters', label: 'Filters' },
    { value: 'belts', label: 'Belts' },
    { value: 'hoses', label: 'Hoses' },
    { value: 'lights', label: 'Lights' },
    { value: 'batteries', label: 'Batteries' },
    { value: 'wipers', label: 'Wipers' },
    { value: 'other_parts', label: 'Other Parts' },
  ],
};

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
