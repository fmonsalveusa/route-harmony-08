import { useMemo, useRef, useState } from 'react';
import { Send, Loader2, Search, Paperclip, X, Image as ImageIcon, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/integrations/supabase/client';
import { compressImage } from '@/lib/imageCompression';
import { toast } from 'sonner';
import type { WhatsAppGroup } from '@/components/WhatsAppGroupSelect';

const MAX_FILE_MB = 15;

/** Mensaje escrito a mano, a los grupos que elijas */
export function BroadcastPanel({ groups }: { groups: WhatsAppGroup[] | null }) {
  const [message, setMessage] = useState('');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const visible = useMemo(
    () => (groups ?? []).filter(g => !search || g.name.toLowerCase().includes(search.toLowerCase())),
    [groups, search],
  );

  const toggle = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const selectVisible = (on: boolean) => {
    setSelected(prev => {
      const next = new Set(prev);
      visible.forEach(g => (on ? next.add(g.id) : next.delete(g.id)));
      return next;
    });
  };

  const pickFile = (f: File | undefined) => {
    if (!f) return;
    if (f.size > MAX_FILE_MB * 1024 * 1024) {
      toast.error(`El archivo pasa de ${MAX_FILE_MB} MB`);
      return;
    }
    setFile(f);
    setPreview(f.type.startsWith('image/') ? URL.createObjectURL(f) : null);
  };

  const clearFile = () => {
    setFile(null);
    setPreview(null);
    if (fileRef.current) fileRef.current.value = '';
  };

  const send = async () => {
    const chosen = (groups ?? []).filter(g => selected.has(g.id));
    if (chosen.length === 0) { toast.error('Elige al menos un grupo'); return; }
    if (!message.trim() && !file) { toast.error('Escribe un mensaje o adjunta un archivo'); return; }
    const withFile = file ? ` con ${file.type.startsWith('image/') ? 'la imagen' : 'el archivo'} adjunto` : '';
    if (!window.confirm(`Se enviará el mensaje${withFile} a ${chosen.length} grupo(s). ¿Continuar?`)) return;

    setSending(true);
    try {
      let mediaUrl: string | undefined;
      let mediaType: 'image' | 'document' | undefined;

      if (file) {
        const isImage = file.type.startsWith('image/');
        const body = isImage ? await compressImage(file, { maxDimension: 1600, quality: 0.85 }) : file;
        const ext = isImage ? 'jpg' : (file.name.split('.').pop() || 'bin');
        const path = `broadcast/${Date.now()}_${file.name.replace(/[^A-Za-z0-9._-]/g, '_').replace(/\.[^.]+$/, '')}.${ext}`;
        const { error: upErr } = await supabase.storage.from('driver-documents')
          .upload(path, body, isImage ? { contentType: 'image/jpeg' } : undefined);
        if (upErr) throw upErr;
        const { data: signed } = await supabase.storage.from('driver-documents').createSignedUrl(path, 7200);
        if (!signed?.signedUrl) throw new Error('No se pudo preparar el archivo');
        mediaUrl = signed.signedUrl;
        mediaType = isImage ? 'image' : 'document';
      }

      const { data, error } = await supabase.functions.invoke('whatsapp-groups', {
        body: {
          action: 'broadcast',
          group_ids: chosen.map(g => ({ id: g.id, name: g.name })),
          message,
          media_url: mediaUrl,
          media_type: mediaType,
          filename: file?.name,
        },
      });
      if (error || data?.error) throw new Error(data?.error || error?.message);

      const failed = (data.failed ?? []) as { name?: string; error: string }[];
      if (failed.length === 0) {
        toast.success(`Enviado a ${data.sent} grupo(s)`);
        setMessage('');
        setSelected(new Set());
        clearFile();
      } else {
        toast.warning(`Enviado a ${data.sent}, falló en ${failed.length}`, {
          description: failed.slice(0, 3).map(f => f.name || f.error).join(', '),
        });
      }
    } catch (e: any) {
      toast.error(`No se pudo enviar: ${e.message}`);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Textarea
          value={message}
          onChange={e => setMessage(e.target.value)}
          placeholder="Escribe aquí el mensaje que quieres enviar a los grupos..."
          className="min-h-28 text-sm"
        />

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={() => fileRef.current?.click()} disabled={sending}>
            <Paperclip className="h-3.5 w-3.5" /> {file ? 'Cambiar archivo' : 'Adjuntar imagen o archivo'}
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*,.pdf,.doc,.docx,.xls,.xlsx"
            className="hidden"
            onChange={e => pickFile(e.target.files?.[0])}
          />
          {file && (
            <div className="flex items-center gap-2 rounded-md border px-2 py-1">
              {preview
                ? <img src={preview} alt={file.name} className="h-8 w-8 rounded object-cover" />
                : <FileText className="h-4 w-4 text-muted-foreground" />}
              <span className="text-xs max-w-48 truncate">{file.name}</span>
              <button type="button" onClick={clearFile} className="text-muted-foreground hover:text-destructive">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
          <p className="text-[11px] text-muted-foreground">
            {file?.type.startsWith('image/')
              ? <><ImageIcon className="inline h-3 w-3 mr-0.5" /> La imagen va con el mensaje como pie de foto.</>
              : `Máximo ${MAX_FILE_MB} MB.`}
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar grupo..." className="h-8 w-52 pl-8 text-xs" />
          </div>
          <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => selectVisible(true)}>
            Seleccionar {search ? 'los visibles' : 'todos'}
          </Button>
          <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => setSelected(new Set())}>
            Quitar selección
          </Button>
          <span className="text-xs text-muted-foreground ml-auto">{selected.size} grupo(s) seleccionado(s)</span>
        </div>

        <div className="rounded-lg border divide-y max-h-72 overflow-y-auto">
          {groups === null && <p className="text-sm text-muted-foreground text-center py-8">Cargando grupos...</p>}
          {groups !== null && visible.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">Sin resultados</p>}
          {visible.map(g => (
            <label key={g.id} className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-muted/40">
              <Checkbox checked={selected.has(g.id)} onCheckedChange={() => toggle(g.id)} />
              <span className="text-sm truncate">{g.name}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="flex justify-end">
        <Button onClick={send} disabled={sending || selected.size === 0} className="gap-1.5">
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          {sending ? 'Enviando...' : `Enviar a ${selected.size || ''} grupo(s)`}
        </Button>
      </div>
      <p className="text-[11px] text-muted-foreground">
        Los envíos salen de a uno, con segundo y medio de diferencia, para que WhatsApp no lo tome como spam.
        Cada envío queda registrado en la pestaña Historial.
      </p>
    </div>
  );
}
