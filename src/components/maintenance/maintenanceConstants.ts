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

export const MAINTENANCE_TYPE_LABELS: Record<string, string> = Object.fromEntries(
  MAINTENANCE_TYPES.map(t => [t.key, t.label])
);

export const MAINTENANCE_CATEGORIES_BY_TYPE: Record<string, { value: string; label: string }[]> = {
  oil_change: [
    { value: 'full_synthetic', label: 'Full Synthetic' },
    { value: 'semi_synthetic', label: 'Semi-Synthetic' },
    { value: 'conventional', label: 'Conventional' },
    { value: 'oil_filter', label: 'Oil Filter Replacement' },
  ],
  tire_rotation: [
    { value: 'rotation', label: 'Tire Rotation' },
    { value: 'balancing', label: 'Tire Balancing' },
    { value: 'alignment', label: 'Wheel Alignment' },
    { value: 'new_tires', label: 'New Tires' },
    { value: 'tire_repair', label: 'Tire Repair/Patch' },
  ],
  brake_inspection: [
    { value: 'pad_replacement', label: 'Brake Pad Replacement' },
    { value: 'rotor_replacement', label: 'Rotor Replacement' },
    { value: 'brake_fluid', label: 'Brake Fluid Change' },
    { value: 'adjustment', label: 'Brake Adjustment' },
    { value: 'inspection_only', label: 'Inspection Only' },
  ],
  transmission: [
    { value: 'fluid_change', label: 'Fluid Change' },
    { value: 'filter_replacement', label: 'Filter Replacement' },
    { value: 'full_service', label: 'Full Service' },
    { value: 'repair', label: 'Repair' },
  ],
  air_filter: [
    { value: 'engine_filter', label: 'Engine Air Filter' },
    { value: 'cabin_filter', label: 'Cabin Air Filter' },
    { value: 'both', label: 'Both Filters' },
  ],
  coolant_flush: [
    { value: 'full_flush', label: 'Full Coolant Flush' },
    { value: 'top_up', label: 'Coolant Top-Up' },
    { value: 'hose_replacement', label: 'Hose Replacement' },
    { value: 'thermostat', label: 'Thermostat Replacement' },
  ],
  def_system: [
    { value: 'def_refill', label: 'DEF Refill' },
    { value: 'sensor_replacement', label: 'Sensor Replacement' },
    { value: 'injector_cleaning', label: 'Injector Cleaning' },
    { value: 'system_repair', label: 'System Repair' },
  ],
  dot_inspection: [
    { value: 'annual_inspection', label: 'Annual Inspection' },
    { value: 'pre_trip', label: 'Pre-Trip Inspection' },
    { value: 'post_trip', label: 'Post-Trip Inspection' },
    { value: 'roadside', label: 'Roadside Inspection' },
  ],
  pm_service: [
    { value: 'pm_a', label: 'PM-A (Basic)' },
    { value: 'pm_b', label: 'PM-B (Intermediate)' },
    { value: 'pm_c', label: 'PM-C (Comprehensive)' },
    { value: 'lubrication', label: 'Lubrication/Greasing' },
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
