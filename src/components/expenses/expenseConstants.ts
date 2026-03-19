export const EXPENSE_TYPES = [
  'fuel', 'maintenance', 'materials', 'repairs', 'tires', 'insurance',
  'permits_licenses', 'tolls', 'parking', 'cleaning',
  'parts', 'labor', 'towing', 'fines', 'other',
] as const;

export const EXPENSE_TYPE_LABELS: Record<string, string> = {
  fuel: 'Fuel',
  maintenance: 'Maintenance',
  materials: 'Materials',
  repairs: 'Repairs',
  tires: 'Tires',
  insurance: 'Insurance',
  permits_licenses: 'Permits & Licenses',
  tolls: 'Tolls',
  parking: 'Parking',
  cleaning: 'Cleaning/Washing',
  parts: 'Parts',
  labor: 'Labor',
  towing: 'Towing',
  fines: 'Fines/Violations',
  other: 'Other',
};

export const EXPENSE_TYPE_COLORS: Record<string, string> = {
  fuel: 'bg-emerald-100 text-emerald-800',
  maintenance: 'bg-blue-100 text-blue-800',
  materials: 'bg-lime-100 text-lime-800',
  repairs: 'bg-amber-100 text-amber-800',
  tires: 'bg-violet-100 text-violet-800',
  insurance: 'bg-indigo-100 text-indigo-800',
  permits_licenses: 'bg-purple-100 text-purple-800',
  tolls: 'bg-cyan-100 text-cyan-800',
  parking: 'bg-sky-100 text-sky-800',
  cleaning: 'bg-teal-100 text-teal-800',
  parts: 'bg-orange-100 text-orange-800',
  labor: 'bg-pink-100 text-pink-800',
  towing: 'bg-rose-100 text-rose-800',
  fines: 'bg-red-200 text-red-900',
  other: 'bg-gray-100 text-gray-800',
};

export const CATEGORIES_BY_TYPE: Record<string, { value: string; label: string }[]> = {
  fuel: [
    { value: 'diesel', label: 'Diesel' },
    { value: 'def', label: 'DEF (Diesel Exhaust Fluid)' },
    { value: 'gasoline', label: 'Gasoline' },
    { value: 'oil', label: 'Oil' },
    { value: 'additives', label: 'Additives' },
  ],
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

export const PAYMENT_METHODS = [
  { value: 'fleet_card', label: 'Fleet Card' },
  { value: 'credit_card', label: 'Company Credit Card' },
  { value: 'cash', label: 'Cash' },
  { value: 'check', label: 'Check' },
  { value: 'wire_transfer', label: 'Wire Transfer' },
  { value: 'other', label: 'Other' },
];

export const PAYMENT_METHOD_LABELS: Record<string, string> = Object.fromEntries(
  PAYMENT_METHODS.map(p => [p.value, p.label])
);
