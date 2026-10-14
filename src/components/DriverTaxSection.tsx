import { useCallback, useEffect, useState } from 'react';
import { FileText, Loader2, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { getTenantId } from '@/hooks/useTenantId';
import { toast } from 'sonner';

type Entity = 'individual' | 'business';
interface Tax { entity_type: Entity; legal_name: string | null; tax_id: string | null; business_name: string | null; source: string | null; notes: string | null }

const digits = (s: string | null | undefined) => String(s ?? '').replace(/\D/g, '');
const fmt = (entity: Entity, id: string | null) => {
  const d = digits(id);
  if (d.length !== 9) return d;
  return entity === 'business' ? `${d.slice(0, 2)}-${d.slice(2)}` : `${d.slice(0, 3)}-${d.slice(3, 5)}-${d.slice(5)}`;
};

/**
 * Datos fiscales del driver para el 1099 (SSN o EIN, a nombre personal o de compañía).
 * Solo admin y accounting (la tabla lo exige). Se pueden leer del W-9 subido con IA.
 */
export function DriverTaxSection({ driverId, hasW9 }: { driverId: string; hasW9: boolean }) {
  const [tax, setTax] = useState<Tax | null>(null);
  const [entity, setEntity] = useState<Entity>('individual');
  const [legalName, setLegalName] = useState('');
  const [taxId, setTaxId] = useState('');
  const [busy, setBusy] = useState<'save' | 'w9' | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabase.from('payee_tax_info' as any)
      .select('entity_type, legal_name, tax_id, business_name, source, notes')
      .eq('recipient_type', 'driver').eq('recipient_id', driverId).maybeSingle();
    const t = (data as unknown as Tax) ?? null;
    setTax(t);
    setEntity(t?.entity_type ?? 'individual');
    setLegalName(t?.legal_name ?? '');
    setTaxId(fmt(t?.entity_type ?? 'individual', t?.tax_id ?? null));
  }, [driverId]);

  useEffect(() => { void load(); }, [load]);

  const save = async () => {
    const id = digits(taxId);
    if (id && id.length !== 9) { toast.error('El SSN o EIN debe tener 9 dígitos'); return; }
    setBusy('save');
    const { error } = await supabase.from('payee_tax_info' as any).upsert({
      recipient_type: 'driver', recipient_id: driverId, tenant_id: await getTenantId(),
      entity_type: entity, legal_name: legalName.trim() || null, tax_id: id || null, source: 'manual',
      updated_at: new Date().toISOString(),
    } as any, { onConflict: 'recipient_type,recipient_id' });
    setBusy(null);
    if (error) { toast.error(`No se pudo guardar: ${error.message}`); return; }
    toast.success('Datos fiscales guardados');
    void load();
  };

  const readW9 = async () => {
    setBusy('w9');
    try {
      const { data, error } = await supabase.functions.invoke('w9-extract', { body: { driver_id: driverId } });
      if (error) {
        const b = await (error as any).context?.json?.().catch(() => null);
        throw new Error(b?.error ?? error.message);
      }
      const r = data?.results?.[0];
      if (r?.error) throw new Error(r.error);
      if (r?.warning) toast.warning(r.warning); else toast.success('Datos leídos del W-9. Revísalos.');
      await load();
    } catch (e: any) {
      toast.error(e.message || 'No se pudo leer el W-9');
    } finally {
      setBusy(null);
    }
  };

  const changed = entity !== (tax?.entity_type ?? 'individual') || legalName !== (tax?.legal_name ?? '') || digits(taxId) !== digits(tax?.tax_id);

  return (
    <div className="space-y-3 p-3 rounded-lg border-2 border-slate-300/60 bg-slate-50 dark:bg-slate-900/30 md:col-span-2">
      <div className="flex items-center justify-between gap-2">
        <Label className="font-semibold flex items-center gap-1.5"><FileText className="h-4 w-4" /> Datos fiscales (1099)</Label>
        {tax?.source === 'w9' && <span className="text-[11px] text-muted-foreground">Leído del W-9</span>}
      </div>
      <div className="grid gap-2 sm:grid-cols-3">
        <div className="space-y-1">
          <Label className="text-xs">A nombre de</Label>
          <Select value={entity} onValueChange={v => setEntity(v as Entity)}>
            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="individual">Persona (SSN)</SelectItem>
              <SelectItem value="business">Compañía (EIN)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">{entity === 'business' ? 'Nombre de la compañía' : 'Nombre legal'}</Label>
          <Input className="h-9" value={legalName} onChange={e => setLegalName(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">{entity === 'business' ? 'EIN' : 'SSN'}</Label>
          <Input className="h-9 font-mono" value={taxId} onChange={e => setTaxId(e.target.value)} autoComplete="off" inputMode="numeric"
            placeholder={entity === 'business' ? '12-3456789' : '123-45-6789'} />
        </div>
      </div>
      {tax?.notes && <p className="text-[11px] text-amber-700">Nota de la lectura: {tax.notes}</p>}
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" onClick={save} disabled={busy !== null || !changed}>
          {busy === 'save' && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />} Guardar
        </Button>
        {hasW9 && (
          <Button type="button" size="sm" variant="outline" className="gap-1" onClick={readW9} disabled={busy !== null}>
            {busy === 'w9' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />} Leer del W-9
          </Button>
        )}
      </div>
      <p className="text-[11px] text-muted-foreground">Solo admin y accounting ven estos datos. Se usan en Payments → Reporte anual (1099).</p>
    </div>
  );
}

/** Solo lectura, para el perfil del driver: a nombre de quién van los 1099 y el SSN/EIN (enmascarado) */
export function DriverTaxInfo({ driverId }: { driverId: string }) {
  const [tax, setTax] = useState<Tax | null | undefined>(undefined);
  useEffect(() => {
    let cancelled = false;
    supabase.from('payee_tax_info' as any)
      .select('entity_type, legal_name, tax_id, business_name, source, notes')
      .eq('recipient_type', 'driver').eq('recipient_id', driverId).maybeSingle()
      .then(({ data }) => { if (!cancelled) setTax((data as unknown as Tax) ?? null); });
    return () => { cancelled = true; };
  }, [driverId]);

  const d = digits(tax?.tax_id);
  const masked = !d ? '—' : tax?.entity_type === 'business' ? `**-***${d.slice(-4)}` : `***-**-${d.slice(-4)}`;
  const SOURCE: Record<string, string> = { onboarding: 'Onboarding (W-9)', w9: 'Leído del W-9', manual: 'Manual' };
  return (
    <div className="border-t pt-3">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Tax Information</p>
      {tax === undefined ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : !tax ? (
        <p className="text-sm text-muted-foreground italic">Sin datos fiscales — agrégalos al editar el driver</p>
      ) : (
        <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
          <div>
            <p className="text-xs text-muted-foreground">1099 a nombre de</p>
            <p className="font-medium">{tax.entity_type === 'business' ? 'Empresa' : 'Personal'}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">{tax.entity_type === 'business' ? 'EIN' : 'SSN'}</p>
            <p className="font-mono font-medium">{masked}</p>
          </div>
          <div className="col-span-2">
            <p className="text-xs text-muted-foreground">{tax.entity_type === 'business' ? 'Empresa' : 'Nombre legal'}</p>
            <p className="font-medium">{tax.legal_name || '—'}</p>
          </div>
          {tax.source && <p className="col-span-2 text-[11px] text-muted-foreground">Fuente: {SOURCE[tax.source] ?? tax.source}</p>}
        </div>
      )}
    </div>
  );
}
