import { useEffect, useState } from 'react';
import { MessageCircle, Loader2, Send } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { getTenantId } from '@/hooks/useTenantId';
import { WhatsAppGroupSelect } from '@/components/WhatsAppGroupSelect';
import { toast } from 'sonner';

interface Settings {
  whatsapp_admin_group_id: string | null;
  whatsapp_admin_group_name: string | null;
  wa_pod_reminders: boolean;
  wa_daily_reminders: boolean;
  wa_admin_report: boolean;
  wa_expiry_alerts: boolean;
}

const TOGGLES: { key: keyof Settings; title: string; description: string }[] = [
  {
    key: 'wa_pod_reminders',
    title: 'Recordatorio de POD',
    description: 'Si una carga se marca Delivered y a las 2 horas no tiene POD, se le recuerda al driver (máximo 3 veces, una por día, de 7am a 9pm). El mensaje de "carga completada" sale cuando se sube el POD.',
  },
  {
    key: 'wa_daily_reminders',
    title: 'Recordatorio diario de pickups y entregas',
    description: 'Cada mañana a las 7am, al grupo de cada driver con las paradas programadas para hoy.',
  },
  {
    key: 'wa_expiry_alerts',
    title: 'Vencimiento de documentos',
    description: 'Licencia y medical card del driver; seguro, registration y annual inspection del camión. A 30 y 7 días, el día del vencimiento y cada semana mientras siga vencido.',
  },
  {
    key: 'wa_admin_report',
    title: 'Reporte diario de administración',
    description: 'Cada mañana a las 7am al grupo de administración: cargas activas, sin driver, sin POD, drivers sin carga, pagos pendientes, mantenimientos y documentos vencidos.',
  },
];

export function WhatsAppSettingsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    if (!open) return;
    (async () => {
      const tenantId = await getTenantId();
      const { data } = await supabase.from('tenants' as any).select('*').eq('id', tenantId).maybeSingle();
      const row = data as any;
      setSettings({
        whatsapp_admin_group_id: row?.whatsapp_admin_group_id ?? null,
        whatsapp_admin_group_name: row?.whatsapp_admin_group_name ?? null,
        wa_pod_reminders: row?.wa_pod_reminders ?? true,
        wa_daily_reminders: row?.wa_daily_reminders ?? true,
        wa_admin_report: row?.wa_admin_report ?? true,
        wa_expiry_alerts: row?.wa_expiry_alerts ?? true,
      });
    })();
  }, [open]);

  const save = async (changes: Partial<Settings>) => {
    setSettings(prev => (prev ? { ...prev, ...changes } : prev));
    const tenantId = await getTenantId();
    const { error } = await supabase.from('tenants' as any).update(changes as any).eq('id', tenantId);
    if (error) toast.error(error.message);
  };

  const testReport = async () => {
    setTesting(true);
    try {
      const { data, error } = await supabase.functions.invoke('whatsapp-jobs', { body: { job: 'admin_report_test' } });
      if (error || data?.error) throw new Error(data?.error || error?.message);
      toast.success('Reporte enviado al grupo de administración');
    } catch (e: any) {
      toast.error(`No se pudo enviar: ${e.message}`);
    } finally {
      setTesting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-green-600" /> WhatsApp Settings
          </DialogTitle>
          <DialogDescription>
            Avisos automáticos a los grupos de WhatsApp. Los grupos de drivers, investors y dispatchers se asignan en el perfil de cada uno.
          </DialogDescription>
        </DialogHeader>

        {!settings ? (
          <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : (
          <div className="space-y-4">
            <WhatsAppGroupSelect
              className=""
              groupId={settings.whatsapp_admin_group_id}
              groupName={settings.whatsapp_admin_group_name}
              onChange={(id, name) => save({ whatsapp_admin_group_id: id, whatsapp_admin_group_name: name })}
              hint="Grupo de administración: aquí llega el reporte diario."
            />

            <div className="space-y-3">
              {TOGGLES.map(t => (
                <div key={t.key} className="flex items-start justify-between gap-3 rounded-lg border p-3">
                  <div>
                    <p className="text-sm font-medium">{t.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{t.description}</p>
                  </div>
                  <Switch
                    checked={Boolean(settings[t.key])}
                    onCheckedChange={(v) => save({ [t.key]: v } as Partial<Settings>)}
                  />
                </div>
              ))}
            </div>

            <Button
              variant="outline"
              className="w-full gap-2"
              onClick={testReport}
              disabled={testing || !settings.whatsapp_admin_group_id}
            >
              {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Enviar reporte de prueba ahora
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
