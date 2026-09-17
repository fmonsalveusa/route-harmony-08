import { useState } from 'react';
import { MessageCircle, RefreshCw, Send, Loader2 } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface WhatsAppGroup { id: string; name: string }

export async function fetchWhatsAppGroups(): Promise<WhatsAppGroup[]> {
  const { data, error } = await supabase.functions.invoke('whatsapp-groups', { body: { action: 'list' } });
  if (error || data?.error) throw new Error(data?.error || error?.message);
  return data.groups || [];
}

export async function sendWhatsAppTest(groupId: string) {
  const { data, error } = await supabase.functions.invoke('whatsapp-groups', { body: { action: 'test', group_id: groupId } });
  if (error || data?.error) throw new Error(data?.error || error?.message);
}

interface Props {
  groupId: string | null;
  groupName: string | null;
  onChange: (id: string | null, name: string | null) => void;
  className?: string;
  hint?: string;
  /** Lista ya cargada (tablas con muchas filas); si no se pasa, se carga al abrir */
  groups?: WhatsAppGroup[] | null;
  /** Versión de una línea, sin título ni texto de ayuda */
  compact?: boolean;
}

/** Grupo de WhatsApp donde llegan los avisos */
export function WhatsAppGroupSelect({ groupId, groupName, onChange, className = 'md:col-span-2', hint, groups: providedGroups, compact }: Props) {
  const [ownGroups, setOwnGroups] = useState<WhatsAppGroup[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const groups = providedGroups ?? ownGroups;

  const loadGroups = async () => {
    if (providedGroups) return;
    setLoading(true);
    try {
      setOwnGroups(await fetchWhatsAppGroups());
    } catch (e: any) {
      toast.error(`No se pudieron cargar los grupos: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const sendTest = async () => {
    if (!groupId) return;
    setTesting(true);
    try {
      await sendWhatsAppTest(groupId);
      toast.success('Mensaje de prueba enviado');
    } catch (e: any) {
      toast.error(`No se pudo enviar: ${e.message}`);
    } finally {
      setTesting(false);
    }
  };

  // Si el grupo guardado ya no aparece en la lista, se sigue mostrando para no perderlo
  const options: WhatsAppGroup[] = groups
    ? (groupId && !groups.some(g => g.id === groupId) ? [{ id: groupId, name: groupName || groupId }, ...groups] : groups)
    : (groupId ? [{ id: groupId, name: groupName || groupId }] : []);

  const controls = (
    <div className="flex gap-2">
      <Select
        value={groupId || 'none'}
        onOpenChange={(open) => { if (open && !groups && !loading) void loadGroups(); }}
        onValueChange={(v) => {
          if (v === 'none') return onChange(null, null);
          onChange(v, options.find(g => g.id === v)?.name ?? null);
        }}
      >
        <SelectTrigger className={compact ? 'h-8 text-xs flex-1 min-w-0' : 'flex-1'}>
          <SelectValue placeholder="Sin grupo" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">Sin grupo (no se envían mensajes)</SelectItem>
          {loading && <div className="px-2 py-1.5 text-xs text-muted-foreground">Cargando grupos...</div>}
          {options.map(g => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}
        </SelectContent>
      </Select>
      {!compact && !providedGroups && (
        <Button type="button" variant="outline" size="icon" onClick={loadGroups} disabled={loading} title="Recargar grupos">
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      )}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className={compact ? 'h-8 px-2 text-xs gap-1' : 'gap-1.5'}
        onClick={sendTest}
        disabled={!groupId || testing}
        title="Enviar mensaje de prueba"
      >
        {testing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
        Probar
      </Button>
    </div>
  );

  if (compact) return <div className={className}>{controls}</div>;

  return (
    <div className={`space-y-2 p-3 rounded-lg border-2 border-green-500/40 bg-green-50 dark:bg-green-950/20 ${className}`}>
      <Label className="font-semibold text-green-700 flex items-center gap-1.5">
        <MessageCircle className="h-4 w-4" /> Grupo de WhatsApp
      </Label>
      {controls}
      <p className="text-[11px] text-muted-foreground">
        {hint ?? 'Aquí llegan los avisos de cargas, mantenimiento (Company Drivers) y recibos de pago.'}
      </p>
    </div>
  );
}
