import { supabase } from '@/integrations/supabase/client';

/**
 * La ruta dibujada del recorrido vive en su propia tabla: pesa cientos de KB por carga
 * y no tiene por qué estar en la tabla de cargas, que se recorre entera al abrir la lista.
 */
export async function getLoadRoute(loadId: string): Promise<unknown | null> {
  const { data } = await supabase
    .from('load_routes' as any)
    .select('geometry')
    .eq('load_id', loadId)
    .maybeSingle();
  return (data as any)?.geometry ?? null;
}

export async function getLoadRoutes(loadIds: string[]): Promise<Record<string, unknown>> {
  if (loadIds.length === 0) return {};
  const { data } = await supabase
    .from('load_routes' as any)
    .select('load_id, geometry')
    .in('load_id', loadIds);
  const map: Record<string, unknown> = {};
  ((data as any[]) || []).forEach(r => { map[r.load_id] = r.geometry; });
  return map;
}

export async function saveLoadRoute(loadId: string, geometry: unknown): Promise<void> {
  if (!geometry) return;
  const { error } = await supabase
    .from('load_routes' as any)
    .upsert({ load_id: loadId, geometry, updated_at: new Date().toISOString() } as any, { onConflict: 'load_id' });
  if (error) console.error('No se pudo guardar la ruta:', error);
}

export async function deleteLoadRoute(loadId: string): Promise<void> {
  const { error } = await supabase.from('load_routes' as any).delete().eq('load_id', loadId);
  if (error) console.error('No se pudo borrar la ruta:', error);
}
