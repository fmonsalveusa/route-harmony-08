import { useCallback, useEffect, useState } from 'react';
import { Loader2, Send, ChevronDown } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { getTenantId } from '@/hooks/useTenantId';
import { WhatsAppGroupSelect, type WhatsAppGroup } from '@/components/WhatsAppGroupSelect';
import { TemplateEditor } from '@/components/whatsapp/TemplateEditor';
import { toast } from 'sonner';
import { AUTOMATIONS } from '../../../supabase/functions/_shared/templateDefaults';

type TenantRow = Record<string, any>;

export function AutomationsPanel({ groups }: { groups: WhatsAppGroup[] | null }) {
  const [tenant, setTenant] = useState<TenantRow | null>(null);
  const [custom, setCustom] = useState<Record<string, string>>({});
  const [open, setOpen] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);

  const load = useCallback(async () => {
    const tenantId = await getTenantId();
    const [{ data: t }, { data: templates }] = await Promise.all([
      supabase.from('tenants' as any).select('*').eq('id', tenantId).maybeSingle(),
      supabase.from('whatsapp_templates' as any).select('template_key, body').eq('tenant_id', tenantId),
    ]);
    setTenant((t as any) ?? {});
    setCustom(Object.fromEntries(((templates as any[]) || []).map(r => [r.template_key, r.body])));
  }, []);

  useEffect(() => { void load(); }, [load]);

  const updateTenant = async (changes: TenantRow) => {
    setTenant(prev => ({ ...(prev ?? {}), ...changes }));
    const tenantId = await getTenantId();
    const { error } = await supabase.from('tenants' as any).update(changes as any).eq('id', tenantId);
    if (error) toast.error(error.message);
  };

  const saveTemplate = async (key: string, body: string) => {
    const tenantId = await getTenantId();
    const { error } = await supabase
      .from('whatsapp_templates' as any)
      .upsert({ tenant_id: tenantId, template_key: key, body, updated_at: new Date().toISOString() } as any, { onConflict: 'tenant_id,template_key' });
    if (error) { toast.error(error.message); return; }
    setCustom(prev => ({ ...prev, [key]: body }));
    toast.success('Mensaje guardado. Los próximos avisos usan este texto.');
  };

  const resetTemplate = async (key: string) => {
    const tenantId = await getTenantId();
    const { error } = await supabase.from('whatsapp_templates' as any).delete().eq('tenant_id', tenantId).eq('template_key', key);
    if (error) { toast.error(error.message); return; }
    setCustom(prev => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
    toast.success('Se restauró el texto original');
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

  if (!tenant) {
    return <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-3">
      {AUTOMATIONS.map(a => {
        const enabled = tenant[a.toggle] !== false;
        const isOpen = open === a.id;
        const editedCount = a.templates.filter(t => custom[t.key] !== undefined).length;
        return (
          <div key={a.id} className={`rounded-lg border ${enabled ? '' : 'opacity-70'}`}>
            <div className="flex items-start gap-3 p-3">
              <button
                type="button"
                className="flex-1 text-left flex items-start gap-2"
                onClick={() => setOpen(isOpen ? null : a.id)}
              >
                <ChevronDown className={`h-4 w-4 mt-0.5 text-muted-foreground transition-transform ${isOpen ? '' : '-rotate-90'}`} />
                <div>
                  <p className="text-sm font-medium">
                    {a.title}
                    {editedCount > 0 && <span className="ml-2 text-[10px] text-blue-600">({editedCount} editado{editedCount > 1 ? 's' : ''})</span>}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">{a.description}</p>
                </div>
              </button>
              <Switch checked={enabled} onCheckedChange={v => updateTenant({ [a.toggle]: v })} />
            </div>

            {isOpen && (
              <div className="border-t p-3 space-y-3">
                {a.id === 'admin_report' && (
                  <>
                    <div>
                      <p className="text-xs font-medium mb-1.5">Grupo de administración</p>
                      <WhatsAppGroupSelect
                        compact
                        className=""
                        groups={groups}
                        groupId={tenant.whatsapp_admin_group_id ?? null}
                        groupName={tenant.whatsapp_admin_group_name ?? null}
                        onChange={(id, name) => updateTenant({ whatsapp_admin_group_id: id, whatsapp_admin_group_name: name })}
                      />
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-2"
                      onClick={testReport}
                      disabled={testing || !tenant.whatsapp_admin_group_id}
                    >
                      {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                      Enviar reporte de prueba ahora
                    </Button>
                  </>
                )}
                {a.templates.map(t => (
                  <TemplateEditor
                    key={t.key}
                    template={t}
                    customBody={custom[t.key] ?? null}
                    onSave={body => saveTemplate(t.key, body)}
                    onReset={() => resetTemplate(t.key)}
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
