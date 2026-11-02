import { useCallback, useEffect, useState } from 'react';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/integrations/supabase/client';
import { getTenantId } from '@/hooks/useTenantId';
import { toast } from 'sonner';

interface Entry {
  id: string;
  question: string;
  answer: string;
  answer_en: string | null;
  active: boolean;
}

const EMPTY = { question: '', answer: '', answer_en: '' };

/**
 * Preguntas frecuentes del asistente de WhatsApp. La IA elige cuál responde la consulta
 * y se envía exactamente el texto guardado aquí.
 */
export function KnowledgePanel() {
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [editing, setEditing] = useState<string | null>(null);   // id, 'new' o null
  const [draft, setDraft] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const tenantId = await getTenantId();
    const { data, error } = await supabase
      .from('whatsapp_knowledge' as any).select('id, question, answer, answer_en, active')
      .eq('tenant_id', tenantId).order('created_at');
    if (error) toast.error(error.message);
    setEntries(((data as any[]) ?? []) as Entry[]);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const startEdit = (e?: Entry) => {
    setEditing(e?.id ?? 'new');
    setDraft(e ? { question: e.question, answer: e.answer, answer_en: e.answer_en ?? '' } : EMPTY);
  };

  const save = async () => {
    if (!draft.question.trim() || !draft.answer.trim()) {
      toast.error('Completa la pregunta y la respuesta en español');
      return;
    }
    setSaving(true);
    const row = {
      question: draft.question.trim(),
      answer: draft.answer.trim(),
      answer_en: draft.answer_en.trim() || null,
      updated_at: new Date().toISOString(),
    };
    const { error } = editing === 'new'
      ? await supabase.from('whatsapp_knowledge' as any).insert({ ...row, tenant_id: await getTenantId() } as any)
      : await supabase.from('whatsapp_knowledge' as any).update(row as any).eq('id', editing!);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    setEditing(null);
    toast.success('Pregunta guardada. El asistente ya la usa.');
    void load();
  };

  const toggle = async (e: Entry, active: boolean) => {
    setEntries(prev => prev?.map(x => (x.id === e.id ? { ...x, active } : x)) ?? null);
    const { error } = await supabase.from('whatsapp_knowledge' as any).update({ active } as any).eq('id', e.id);
    if (error) toast.error(error.message);
  };

  const remove = async (e: Entry) => {
    if (!window.confirm(`¿Borrar la pregunta "${e.question}"?`)) return;
    const { error } = await supabase.from('whatsapp_knowledge' as any).delete().eq('id', e.id);
    if (error) { toast.error(error.message); return; }
    void load();
  };

  if (!entries) return <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />;

  const form = (
    <div className="rounded-md border bg-muted/30 p-3 space-y-2">
      <div>
        <p className="text-xs font-medium mb-1">Pregunta o tema</p>
        <Input
          value={draft.question}
          onChange={e => setDraft({ ...draft, question: e.target.value })}
          placeholder="Ej: ¿Cuánto cobran por el dispatch? / porcentaje del dispatch"
        />
      </div>
      <div>
        <p className="text-xs font-medium mb-1">Respuesta en español</p>
        <Textarea rows={4} value={draft.answer} onChange={e => setDraft({ ...draft, answer: e.target.value })} />
      </div>
      <div>
        <p className="text-xs font-medium mb-1">Respuesta en inglés (opcional; si está vacía se envía la de español)</p>
        <Textarea rows={3} value={draft.answer_en} onChange={e => setDraft({ ...draft, answer_en: e.target.value })} />
      </div>
      <p className="text-[11px] text-muted-foreground">Puedes usar {'{nombre}'} para el nombre de quien escribe.</p>
      <div className="flex gap-2 justify-end">
        <Button variant="ghost" size="sm" onClick={() => setEditing(null)}>Cancelar</Button>
        <Button size="sm" onClick={save} disabled={saving}>
          {saving && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />}Guardar
        </Button>
      </div>
    </div>
  );

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-medium">Preguntas frecuentes</p>
          <p className="text-[11px] text-muted-foreground">
            Si alguien pregunta algo de esta lista, el asistente le envía la respuesta tal cual está escrita aquí.
          </p>
        </div>
        {editing === null && (
          <Button variant="outline" size="sm" className="h-7 px-2 text-xs gap-1" onClick={() => startEdit()}>
            <Plus className="h-3.5 w-3.5" />Agregar
          </Button>
        )}
      </div>

      {editing === 'new' && form}
      {entries.length === 0 && editing !== 'new' && (
        <p className="text-xs text-muted-foreground italic">Todavía no hay preguntas frecuentes.</p>
      )}
      {entries.map(e => (editing === e.id ? <div key={e.id}>{form}</div> : (
        <div key={e.id} className={`rounded-md border p-2.5 flex items-start gap-3 ${e.active ? '' : 'opacity-60'}`}>
          <button type="button" className="flex-1 text-left min-w-0" onClick={() => startEdit(e)}>
            <p className="text-sm font-medium">{e.question}</p>
            <p className="text-xs text-muted-foreground line-clamp-2 whitespace-pre-line">{e.answer}</p>
          </button>
          <Switch checked={e.active} onCheckedChange={v => toggle(e, v)} />
          <button type="button" className="text-destructive mt-0.5" onClick={() => remove(e)} title="Borrar">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      )))}
    </div>
  );
}
