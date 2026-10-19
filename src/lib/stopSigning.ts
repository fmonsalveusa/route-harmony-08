import type { DocumentField } from '@/types/document';

/** Paradas (stop_order) que tienen campos asignados, en orden. Vacío = documento de una sola firma */
export function documentStops(fields: DocumentField[] | null | undefined): number[] {
  return [...new Set((fields ?? []).map((f) => f.stop).filter((s): s is number => typeof s === 'number'))].sort((a, b) => a - b);
}

/** PDF con lo firmado hasta esa parada; el trigger documents_attach_pod lo agrega como POD de la parada */
export const stopPdfPath = (docId: string, stop: number) => `signing/${docId}/stop_${stop}.pdf`;
