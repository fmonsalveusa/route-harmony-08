import { useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { PodDocument } from '@/hooks/usePodDocuments';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Image, FileText, Download, Trash2, Copy, CheckSquare, Square, Loader2 } from 'lucide-react';
import { copyImageToClipboard } from '@/lib/clipboardUtils';
import { toast } from '@/hooks/use-toast';

interface StopDocumentGroupProps {
  label: string | null; // null = don't show header (single stop)
  docs: PodDocument[];
  onOpen: (doc: PodDocument) => void;
  onDownload: (doc: PodDocument) => void;
  onDelete: (id: string) => void;
}

export const StopDocumentGroup = ({ label, docs, onOpen, onDownload, onDelete }: StopDocumentGroupProps) => {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [copyIndex, setCopyIndex] = useState(0);
  const [copying, setCopying] = useState(false);

  const imageDocs = useMemo(() => docs.filter(d => d.file_type === 'image'), [docs]);

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
    setCopyIndex(0);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === imageDocs.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(imageDocs.map(d => d.id)));
    }
    setCopyIndex(0);
  };

  const handleDelete = (id: string) => {
    onDelete(id);
    setSelectedIds(prev => { const n = new Set(prev); n.delete(id); return n; });
  };

  const resolveUrl = async (doc: PodDocument): Promise<string> => {
    const url = doc.file_url;
    if (!url) return '';
    if (url.startsWith('http')) {
      const match = url.match(/\/storage\/v1\/object\/sign\/driver-documents\/([^?]+)/);
      if (match?.[1]) {
        const path = decodeURIComponent(match[1]);
        const { data } = await supabase.storage.from('driver-documents').createSignedUrl(path, 3600);
        if (data?.signedUrl) return data.signedUrl;
      }
      return url;
    }
    const { data } = await supabase.storage.from('driver-documents').createSignedUrl(url, 3600);
    return data?.signedUrl || '';
  };

  const handleCopy = async () => {
    const selected = imageDocs.filter(d => selectedIds.has(d.id));
    if (selected.length === 0) return;
    const idx = copyIndex % selected.length;
    const doc = selected[idx];

    setCopying(true);
    try {
      const resolvedUrl = await resolveUrl(doc);
      if (!resolvedUrl) throw new Error('No URL');
      const ok = await copyImageToClipboard(resolvedUrl);
      if (ok) {
        toast({ title: `Copiada ${idx + 1} de ${selected.length}`, description: 'Pega con Ctrl+V / Cmd+V' });
        setCopyIndex(idx + 1);
      } else {
        toast({ title: 'No se pudo copiar', description: 'Se abrió en nueva pestaña', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error al copiar', variant: 'destructive' });
    } finally {
      setCopying(false);
    }
  };

  if (docs.length === 0) return null;

  return (
    <div className="space-y-2">
      {label && (
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          {imageDocs.length > 0 && (
            <button
              onClick={toggleSelectAll}
              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
              type="button"
            >
              {selectedIds.size === imageDocs.length ? <CheckSquare className="h-3 w-3" /> : <Square className="h-3 w-3" />}
              {selectedIds.size === imageDocs.length ? 'Deseleccionar' : 'Seleccionar todo'}
            </button>
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {docs.map(doc => (
          <div key={doc.id} className="flex items-center gap-1.5 bg-muted/50 rounded-md px-2 py-1 text-xs border">
            {doc.file_type === 'image' && (
              <Checkbox
                checked={selectedIds.has(doc.id)}
                onCheckedChange={() => toggleSelect(doc.id)}
                className="h-3.5 w-3.5"
              />
            )}
            {doc.file_type === 'image' ? <Image className="h-3 w-3 text-primary" /> : <FileText className="h-3 w-3 text-primary" />}
            <button onClick={() => onOpen(doc)} className="hover:underline truncate max-w-[120px] text-left" title={doc.file_name} type="button">
              {doc.file_name}
            </button>
            <button onClick={() => onDownload(doc)} className="text-muted-foreground hover:text-foreground" type="button" title="Descargar">
              <Download className="h-3 w-3" />
            </button>
            <button onClick={() => handleDelete(doc.id)} className="text-destructive hover:text-destructive/80" type="button">
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        ))}
      </div>

      {selectedIds.size > 0 && (
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" className="gap-1.5 text-xs h-7" onClick={handleCopy} disabled={copying}>
            {copying ? <Loader2 className="h-3 w-3 animate-spin" /> : <Copy className="h-3 w-3" />}
            {selectedIds.size === 1
              ? 'Copiar al Clipboard'
              : copyIndex === 0
                ? `Copiar al Clipboard (${selectedIds.size})`
                : `Copiar siguiente (${(copyIndex % selectedIds.size) + 1} de ${selectedIds.size})`}
          </Button>
        </div>
      )}
    </div>
  );
};
