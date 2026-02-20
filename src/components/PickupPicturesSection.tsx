import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Camera, Image, FileText, Download, Trash2, Copy, CheckSquare, Square, Loader2 } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { copyImageToClipboard } from '@/lib/clipboardUtils';
import { toast } from '@/hooks/use-toast';

interface PickupDoc {
  id: string;
  file_url: string;
  file_name: string;
  file_type: string;
  stop_address: string;
}

function extractPath(url: string): string | null {
  const match = url.match(/\/storage\/v1\/object\/sign\/driver-documents\/([^?]+)/);
  if (!match?.[1]) return null;
  try { return decodeURIComponent(match[1]); } catch { return match[1]; }
}

async function resolveUrl(fileUrl: string, loadId: string, fileName: string): Promise<string> {
  if (fileUrl?.startsWith('http')) {
    const p = extractPath(fileUrl);
    if (p) {
      const { data } = await supabase.storage.from('driver-documents').createSignedUrl(p, 3600);
      if (data?.signedUrl) return data.signedUrl;
    }
    return fileUrl;
  }
  if (!fileUrl) return '';
  const { data } = await supabase.storage.from('driver-documents').createSignedUrl(fileUrl, 3600);
  return data?.signedUrl || '';
}

export const PickupPicturesSection = ({ loadId }: { loadId: string }) => {
  const [docs, setDocs] = useState<PickupDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [copyIndex, setCopyIndex] = useState(0);
  const [copying, setCopying] = useState(false);

  const imageDocs = docs.filter(d => d.file_type === 'image');

  const fetchDocs = useCallback(async () => {
    const { data: stops } = await supabase
      .from('load_stops')
      .select('id, address')
      .eq('load_id', loadId)
      .eq('stop_type', 'pickup');

    if (!stops || stops.length === 0) { setLoading(false); return; }

    const stopIds = stops.map(s => s.id);
    const stopMap = Object.fromEntries(stops.map(s => [s.id, s.address]));

    const { data: podDocs } = await supabase
      .from('pod_documents')
      .select('*')
      .eq('load_id', loadId)
      .in('stop_id', stopIds)
      .order('created_at', { ascending: true });

    setDocs((podDocs || []).map((d: any) => ({
      id: d.id,
      file_url: d.file_url,
      file_name: d.file_name,
      file_type: d.file_type,
      stop_address: stopMap[d.stop_id] || 'Pick Up',
    })));
    setLoading(false);
  }, [loadId]);

  useEffect(() => { fetchDocs(); }, [fetchDocs]);

  const handleOpen = async (doc: PickupDoc) => {
    const url = await resolveUrl(doc.file_url, loadId, doc.file_name);
    if (url) window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleDownload = async (doc: PickupDoc) => {
    const url = await resolveUrl(doc.file_url, loadId, doc.file_name);
    if (!url) return;
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = doc.file_name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    } catch {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  const handleDelete = async (id: string) => {
    await supabase.from('pod_documents').delete().eq('id', id);
    setDocs(prev => prev.filter(d => d.id !== id));
    setSelectedIds(prev => { const n = new Set(prev); n.delete(id); return n; });
  };

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

  const handleCopy = async () => {
    const selected = imageDocs.filter(d => selectedIds.has(d.id));
    if (selected.length === 0) return;
    const idx = copyIndex % selected.length;
    const doc = selected[idx];

    setCopying(true);
    try {
      const url = await resolveUrl(doc.file_url, loadId, doc.file_name);
      if (!url) throw new Error('No URL');
      const ok = await copyImageToClipboard(url);
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

  return (
    <div className="p-3 rounded-lg bg-card border text-sm space-y-3">
      <div className="flex items-center justify-between">
        <h5 className="font-semibold flex items-center gap-1.5">
          <Camera className="h-3.5 w-3.5 text-primary" /> Pick Up Pictures — BOL & Load
        </h5>
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

      {loading && <p className="text-xs text-muted-foreground">Cargando fotos...</p>}

      {!loading && docs.length === 0 && (
        <p className="text-xs text-muted-foreground italic ml-1">Sin archivos de Pick Up</p>
      )}

      {docs.length > 0 && (
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
              <button onClick={() => handleOpen(doc)} className="hover:underline truncate max-w-[120px] text-left" title={`${doc.file_name} — ${doc.stop_address}`} type="button">
                {doc.file_name}
              </button>
              <button onClick={() => handleDownload(doc)} className="text-muted-foreground hover:text-foreground" type="button" title="Descargar">
                <Download className="h-3 w-3" />
              </button>
              <button onClick={() => handleDelete(doc.id)} className="text-destructive hover:text-destructive/80" type="button">
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {selectedIds.size > 0 && (
        <div className="flex items-center gap-2 pt-1">
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
