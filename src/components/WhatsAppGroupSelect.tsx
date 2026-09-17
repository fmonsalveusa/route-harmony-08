import { useState } from 'react';
import { MessageCircle, RefreshCw, Send, Loader2 } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Group { id: string; name: string }

interface Props {
  groupId: string | null;
  groupName: string | null;
  onChange: (id: string | null, name: string | null) => void;
  className?: string;
  hint?: string;
}

/** Grupo de WhatsApp donde llegan los avisos de cargas del driver */
export function WhatsAppGroupSelect({ groupId, groupName, onChange, className = 'md:col-span-2', hint }: Props) {
  const [groups, setGroups] = useState<Group[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);

  const loadGroups = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('whatsapp-groups', { body: { action: 'list' } });
      if (error || data?.error) throw new Error(data?.error || error?.message);
      setGroups(data.groups || []);
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
      const { data, error } = await supabase.functions.invoke('whatsapp-groups', { body: { action: 'test', group_id: groupId } });
      if (error || data?.error) throw new Error(data?.error || error?.message);
      toast.success('Mensaje de prueba enviado');
    } catch (e: any) {
      toast.error(`No se pudo enviar: ${e.message}`);
    } finally {
      setTesting(false);
    }
  };

  // Mientras no se carguen los grupos, mostrar el guardado como única opción
  const options: Group[] = groups ?? (groupId ? [{ id: groupId, name: groupName || groupId }] : []);

  return (
    <div className={`space-y-2 p-3 rounded-lg border-2 border-green-500/40 bg-green-50 dark:bg-green-950/20 ${className}`}>
      <Label className="font-semibold text-green-700 flex items-center gap-1.5">
        <MessageCircle className="h-4 w-4" /> Grupo de WhatsApp
      </Label>
      <div className="flex gap-2">
        <Select
          value={groupId || 'none'}
          onOpenChange={(open) => { if (open && !groups && !loading) void loadGroups(); }}
          onValueChange={(v) => {
            if (v === 'none') return onChange(null, null);
            onChange(v, options.find(g => g.id === v)?.name ?? null);
          }}
        >
          <SelectTrigger className="flex-1">
            <SelectValue placeholder="Sin grupo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Sin grupo (no se envían mensajes)</SelectItem>
            {loading && <div className="px-2 py-1.5 text-xs text-muted-foreground">Cargando grupos...</div>}
            {options.map(g => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button type="button" variant="outline" size="icon" onClick={loadGroups} disabled={loading} title="Recargar grupos">
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </Button>
        <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={sendTest} disabled={!groupId || testing}>
          {testing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
          Probar
        </Button>
      </div>
      <p className="text-[11px] text-muted-foreground">
        {hint ?? 'Aquí llegan los avisos de cargas, mantenimiento (Company Drivers) y recibos de pago.'}
      </p>
    </div>
  );
}
