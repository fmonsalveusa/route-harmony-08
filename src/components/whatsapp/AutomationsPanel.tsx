import { useCallback, useEffect, useState } from 'react';
import { Loader2, Send, ChevronDown, Paperclip, Trash2 } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { getTenantId } from '@/hooks/useTenantId';
import { WhatsAppGroupSelect, type WhatsAppGroup } from '@/components/WhatsAppGroupSelect';
import { TemplateEditor } from '@/components/whatsapp/TemplateEditor';
import { toast } from 'sonner';
import { AUTOMATIONS } from '../../../supabase/functions/_shared/templateDefaults';

type TenantRow = Record<string, any>;

// Avisos programados que se pueden disparar a mano
const MANUAL_JOBS: Record<string, { job: string; confirm: string }> = {
  daily_reminders: {
    job: 'manual_daily_reminders',
    confirm: 'Se enviará el recordatorio de hoy a los drivers con pickups o entregas programadas. Los que ya lo recibieron hoy no lo recibirán de nuevo. ¿Continuar?',
  },
  pod_reminder: {
    job: 'manual_pod',
    confirm: 'Se enviará el recordatorio de POD a las cargas entregadas hace más de 2 horas sin POD (máximo 3 por carga, uno cada 24 horas, entre 7am y 9pm). ¿Continuar?',
  },
  gps_reminders: {
    job: 'manual_gps',
    confirm: 'Se enviará el aviso de GPS a los drivers que tienen la app vieja o no dieron el permiso "Siempre". Los que ya lo recibieron hoy no lo reciben de nuevo. ¿Continuar?',
  },
  expiry_alerts: {
    job: 'manual_expiry',
    confirm: 'Se enviarán los avisos de documentos que vencen en 30 o 7 días, hoy, o que siguen vencidos (cada 7 días). Los que ya se enviaron hoy no se repiten. ¿Continuar?',
  },
  admin_report: {
    job: 'admin_report_test',
    confirm: 'Se enviará el reporte de hoy al grupo de administración. ¿Continuar?',
  },
};

function summarize(job: string, r: Record<string, any>): string {
  if (job === 'manual_daily_reminders') {
    const parts = [`${r.daily_reminders ?? 0} enviado(s)`];
    const already = (r.daily_drivers ?? 0) - (r.daily_reminders ?? 0) - (r.daily_no_group ?? 0);
    if (already > 0) parts.push(`${already} ya lo tenían hoy`);
    if (r.daily_no_group) parts.push(`${r.daily_no_group} driver(s) sin grupo`);
    if (r.daily_unassigned) parts.push(`${r.daily_unassigned} carga(s) sin driver`);
    return (r.daily_drivers ?? 0) === 0 && !r.daily_unassigned ? 'No hay paradas programadas para hoy' : parts.join(' · ');
  }
  if (job === 'manual_pod') {
    if (r.pod_outside_hours) return 'Fuera de horario: los recordatorios de POD solo salen entre 7am y 9pm';
    return `${r.pod_reminders ?? 0} recordatorio(s) enviado(s)${r.pod_completed ? ` · ${r.pod_completed} carga(s) ya tenían POD` : ''}`;
  }
  if (job === 'manual_expiry') return `${r.expiry_alerts ?? 0} aviso(s) enviado(s)`;
  return 'Reporte enviado al grupo de administración';
}

export function AutomationsPanel({ groups, channel = 'whatsapp' }: { groups: WhatsAppGroup[] | null; channel?: 'whatsapp' | 'email' }) {
  const [tenant, setTenant] = useState<TenantRow | null>(null);
  const [custom, setCustom] = useState<Record<string, string>>({});
  const [open, setOpen] = useState<string | null>(null);
  const [running, setRunning] = useState<string | null>(null);

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

  // PDF que se adjunta al mensaje de acceso del driver (company-private/whatsapp/<tenant>/...)
  const [uploading, setUploading] = useState(false);
  const uploadAccessPdf = async (file: File | undefined) => {
    if (!file) return;
    if (file.type !== 'application/pdf') { toast.error('Solo archivos PDF'); return; }
    if (file.size > 15 * 1024 * 1024) { toast.error('El PDF pesa más de 15 MB'); return; }
    setUploading(true);
    try {
      const tenantId = await getTenantId();
      const path = `whatsapp/${tenantId}/driver-access-${Date.now()}.pdf`;
      const { error } = await supabase.storage.from('company-private').upload(path, file, { contentType: 'application/pdf' });
      if (error) throw error;
      const old = tenant?.wa_driver_access_pdf_path;
      await updateTenant({ wa_driver_access_pdf_path: path, wa_driver_access_pdf_name: file.name });
      if (old) await supabase.storage.from('company-private').remove([old]);
      toast.success('PDF guardado. Se adjunta en los próximos mensajes de acceso.');
    } catch (e: any) {
      toast.error(`No se pudo subir el PDF: ${e.message}`);
    } finally {
      setUploading(false);
    }
  };
  const removeAccessPdf = async () => {
    const old = tenant?.wa_driver_access_pdf_path;
    await updateTenant({ wa_driver_access_pdf_path: null, wa_driver_access_pdf_name: null });
    if (old) await supabase.storage.from('company-private').remove([old]);
    toast.success('Se quitó el PDF');
  };

  const runNow = async (automationId: string) => {
    const manual = MANUAL_JOBS[automationId];
    if (!manual || !window.confirm(manual.confirm)) return;
    setRunning(automationId);
    try {
      const { data, error } = await supabase.functions.invoke('whatsapp-jobs', { body: { job: manual.job } });
      if (error || data?.error) throw new Error(data?.error || error?.message);
      const result = Object.values(data?.results ?? {})[0] as Record<string, any> | undefined;
      toast.success(summarize(manual.job, result ?? {}), { description: 'Detalle en la pestaña Historial.' });
    } catch (e: any) {
      toast.error(`No se pudo enviar: ${e.message}`);
    } finally {
      setRunning(null);
    }
  };

  if (!tenant) {
    return <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-3">
      {AUTOMATIONS.filter(a => (a.channel ?? 'whatsapp') === channel).map(a => {
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
              {MANUAL_JOBS[a.id] && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 px-2 text-xs gap-1"
                  onClick={() => runNow(a.id)}
                  disabled={running !== null || !enabled || (a.id === 'admin_report' && !tenant.whatsapp_admin_group_id)}
                  title={!enabled ? 'Activa el aviso para poder enviarlo' : 'Enviar ahora'}
                >
                  {running === a.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                  Enviar ahora
                </Button>
              )}
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
                  </>
                )}
                {a.id === 'driver_access' && (
                  <div>
                    <p className="text-xs font-medium mb-1.5">PDF adjunto (se envía después del mensaje)</p>
                    {tenant.wa_driver_access_pdf_path ? (
                      <div className="flex items-center gap-2 text-sm">
                        <Paperclip className="h-4 w-4 text-muted-foreground" />
                        <span className="truncate">{tenant.wa_driver_access_pdf_name ?? 'documento.pdf'}</span>
                        <label className="text-xs text-blue-600 hover:underline cursor-pointer">
                          Cambiar
                          <input type="file" accept="application/pdf" className="hidden" disabled={uploading} onChange={e => uploadAccessPdf(e.target.files?.[0])} />
                        </label>
                        <button type="button" className="text-destructive" onClick={removeAccessPdf} title="Quitar PDF"><Trash2 className="h-3.5 w-3.5" /></button>
                      </div>
                    ) : (
                      <label className="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs cursor-pointer hover:bg-muted">
                        {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Paperclip className="h-3.5 w-3.5" />}
                        {uploading ? 'Subiendo...' : 'Subir PDF'}
                        <input type="file" accept="application/pdf" className="hidden" disabled={uploading} onChange={e => uploadAccessPdf(e.target.files?.[0])} />
                      </label>
                    )}
                  </div>
                )}
                {a.id === 'meeting_reminder' && (
                  <div>
                    <p className="text-xs font-medium mb-1.5">Grupo de reuniones</p>
                    <WhatsAppGroupSelect
                      compact
                      className=""
                      groups={groups}
                      groupId={tenant.whatsapp_meetings_group_id ?? null}
                      groupName={tenant.whatsapp_meetings_group_name ?? null}
                      onChange={(id, name) => updateTenant({ whatsapp_meetings_group_id: id, whatsapp_meetings_group_name: name })}
                    />
                  </div>
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
