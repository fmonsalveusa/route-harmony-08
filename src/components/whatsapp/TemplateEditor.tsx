import { useEffect, useRef, useState } from 'react';
import { RotateCcw, Save, Loader2 } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { renderTemplate, type TemplateDefinition } from '../../../supabase/functions/_shared/templateDefaults';

interface Props {
  template: TemplateDefinition;
  customBody: string | null;
  onSave: (body: string) => Promise<void>;
  onReset: () => Promise<void>;
}

/** Editor de un mensaje: variables clicables, vista previa y restaurar el original */
export function TemplateEditor({ template, customBody, onSave, onReset }: Props) {
  const [body, setBody] = useState(customBody ?? template.body);
  const [saving, setSaving] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { setBody(customBody ?? template.body); }, [customBody, template.body]);

  const isCustom = customBody !== null;
  const current = customBody ?? template.body;
  const dirty = body !== current;
  const unknownVars = [...body.matchAll(/\{(\w+)\}/g)]
    .map(m => m[1])
    .filter(k => !template.variables.some(v => v.key === k));

  const samples = Object.fromEntries(template.variables.map(v => [v.key, v.sample]));

  const insertVariable = (key: string) => {
    const el = textareaRef.current;
    const token = `{${key}}`;
    if (!el) return setBody(prev => prev + token);
    const start = el.selectionStart ?? body.length;
    const end = el.selectionEnd ?? body.length;
    const next = body.slice(0, start) + token + body.slice(end);
    setBody(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + token.length, start + token.length);
    });
  };

  const run = async (fn: () => Promise<void>) => {
    setSaving(true);
    try { await fn(); } finally { setSaving(false); }
  };

  return (
    <div className="space-y-2 rounded-lg border bg-muted/20 p-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-sm font-medium flex items-center gap-2">
            {template.title}
            {isCustom && <Badge variant="outline" className="text-[10px] text-blue-600 border-blue-300">Editado</Badge>}
          </p>
          <p className="text-[11px] text-muted-foreground">{template.description}</p>
        </div>
      </div>

      <Textarea
        ref={textareaRef}
        value={body}
        onChange={e => setBody(e.target.value)}
        rows={Math.min(8, Math.max(3, body.split('\n').length + 1))}
        className="text-sm bg-background"
      />

      <div className="flex flex-wrap gap-1.5">
        {template.variables.map(v => (
          <button
            key={v.key}
            type="button"
            onClick={() => insertVariable(v.key)}
            title={v.description}
            className="px-2 py-0.5 rounded-full border bg-background text-[11px] font-mono text-primary hover:bg-primary/10"
          >
            {`{${v.key}}`}
          </button>
        ))}
      </div>

      {unknownVars.length > 0 && (
        <p className="text-[11px] text-amber-700">
          Estas variables no existen para este aviso y saldrán tal cual: {unknownVars.map(k => `{${k}}`).join(', ')}
        </p>
      )}

      <div className="rounded-md bg-[#dcf8c6] dark:bg-green-950/40 px-3 py-2 text-sm whitespace-pre-wrap text-foreground">
        <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Vista previa</p>
        {renderTemplate(body, samples)}
      </div>

      <div className="flex flex-wrap justify-end gap-2">
        {dirty && (
          <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => setBody(current)} disabled={saving}>
            Descartar cambios
          </Button>
        )}
        {isCustom && (
          <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" onClick={() => run(onReset)} disabled={saving}>
            <RotateCcw className="h-3.5 w-3.5" /> Restaurar original
          </Button>
        )}
        <Button size="sm" className="h-8 text-xs gap-1.5" onClick={() => run(() => onSave(body))} disabled={saving || !dirty || !body.trim()}>
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Guardar
        </Button>
      </div>
    </div>
  );
}
