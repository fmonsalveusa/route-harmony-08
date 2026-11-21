// Estilos compartidos de la app del driver (Material 3 / Google)

export const STATUS_META: Record<string, { label: string; chip: string }> = {
  planned: { label: 'Planned', chip: 'bg-[#e9eef6] text-[#444746]' },
  dispatched: { label: 'Dispatched', chip: 'bg-[#fef7e0] text-[#8a5a00]' },
  in_transit: { label: 'In Transit', chip: 'bg-[#d3e3fd] text-[#041e49]' },
  on_site_pickup: { label: 'On Site · Pickup', chip: 'bg-[#ffdbcb] text-[#5c1900]' },
  picked_up: { label: 'Picked Up', chip: 'bg-[#c2e7ff] text-[#004a77]' },
  on_site_delivery: { label: 'On Site · Delivery', chip: 'bg-[#ffdbcb] text-[#5c1900]' },
  delivered: { label: 'Delivered', chip: 'bg-[#c4eed0] text-[#0d652d]' },
  paid: { label: 'Paid', chip: 'bg-[#c4eed0] text-[#0d652d]' },
  tonu: { label: 'TONU', chip: 'bg-[#e9eef6] text-[#444746]' },
  cancelled: { label: 'Cancelled', chip: 'bg-[#f9dedc] text-[#8c1d18]' },
};

export const statusMeta = (s: string) =>
  STATUS_META[s] ?? { label: (s || '').replace(/_/g, ' '), chip: 'bg-[#e9eef6] text-[#444746]' };

export const cityState = (location: string) => {
  if (!location) return '—';
  const parts = location.split(',').map(p => p.trim());
  return parts.length >= 2 ? `${parts[0]}, ${parts[1]}` : location;
};

/** Tarjeta base: blanca, esquinas grandes, sin borde */
export const CARD = 'rounded-[28px] bg-white';
export const BTN_FILLED = 'inline-flex items-center justify-center gap-2 h-14 px-6 rounded-full bg-[#0b57d0] text-white text-base font-medium active:bg-[#0842a0] disabled:opacity-60 transition-colors';
export const BTN_TONAL = 'inline-flex items-center justify-center gap-2 h-12 px-5 rounded-full bg-[#d3e3fd] text-[#041e49] text-sm font-medium active:bg-[#c2d7fb] disabled:opacity-60 transition-colors';
export const BTN_OUTLINE = 'inline-flex items-center justify-center gap-2 h-10 px-4 rounded-full border border-[#747775] text-[#0b57d0] text-sm font-medium active:bg-[#e8f0fe] disabled:opacity-60 transition-colors';
