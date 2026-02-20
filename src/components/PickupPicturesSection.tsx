import { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { usePodDocuments } from '@/hooks/usePodDocuments';
import { Camera, Image, FileText, Download, Trash2, Copy, CheckSquare, Square, Loader2, Upload } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { copyImageToClipboard } from '@/lib/clipboardUtils';
import { toast } from '@/hooks/use-toast';

export const PickupPicturesSection = ({ loadId }: { loadId: string }) => {
  const { pods, loading, uploading, uploadPod, deletePod, openPod, downloadPod } = usePodDocuments(loadId);

  const [pickupStopIds, setPickupStopIds] = useState<Set<string>>(new Set());
  const [firstPickupStopId, setFirstPickupStopId] = useState<string | null>(null);
  const [stopsLoaded, setStopsLoaded] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [copyIndex, setCopyIndex] = useState(0);
  const [copying, setCopying] = useState(false);

  useEffect(() => {
    const fetchPickupStops = async () => {
      const { data } = await supabase
        .from('load_stops')
        .select('id')
        .eq('load_id', loadId)
        .eq('stop_type', 'pickup');
      const ids = (data || []).map(s => s.id);
      setPickupStopIds(new Set(ids));
      setFirstPickupStopId(ids[0] || null);
      setStopsLoaded(true);
    };
    fetchPickupStops();
  }, [loadId]);

  // Show docs that belong to pickup stops OR have no stop_id (null)
  const pickupDocs = useMemo(() => {
    if (!stopsLoaded) return [];
    return pods.filter(p => !p.stop_id || pickupStopIds.has(p.stop_id));
  }, [pods, pickupStopIds, stopsLoaded]);

  const imageDocs = useMemo(() => pickupDocs.filter(d => d.file_type === 'image'), [pickupDocs]);

  const handleFileChange = async (files: FileList | null) => {
    if (!files) return;
    for (let i = 0; i < files.length; i++) {
      await uploadPod(files[i], firstPickupStopId || undefined);
    }
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

  const handleDelete = (id: string) => {
    deletePod(id);
    setSelectedIds(prev => { const n = new Set(prev); n.delete(id); return n; });
  };

  const handleCopy = async () => {
    const selected = imageDocs.filter(d => selectedIds.has(d.id));
    if (selected.length === 0) return;
    const idx = copyIndex % selected.length;
    const doc = selected[idx];

    setCopying(true);
    try {
      const url = doc.file_url;
      if (!url) throw new Error('No URL');
      // Resolve signed URL
      const { data } = await supabase.storage.from('driver-documents').createSignedUrl(
        url.startsWith('http') ? url : url, 3600
      );
      const resolvedUrl = data?.signedUrl || url;
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

  return (
    <div className="p-3 rounded-lg bg-card border text-sm space-y-3">
      <div className="flex items-center justify-between">
        <h5 className="font-semibold flex items-center gap-1.5">
          <Camera className="h-3.5 w-3.5 text-primary" /> Pick Up Pictures — BOL & Load
        </h5>
        <div className="flex items-center gap-2">
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
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 text-xs h-7"
            disabled={uploading}
            onClick={() => document.getElementById(`pickup-file-${loadId}`)?.click()}
          >
            {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
            Subir BOL
          </Button>
          <input
            id={`pickup-file-${loadId}`}
            type="file"
            accept="image/*,.pdf"
            multiple
            className="hidden"
            onChange={e => { handleFileChange(e.target.files); e.target.value = ''; }}
          />
        </div>
      </div>

      {loading && <p className="text-xs text-muted-foreground">Cargando fotos...</p>}

      {!loading && pickupDocs.length === 0 && (
        <p className="text-xs text-muted-foreground italic ml-1">Sin archivos de Pick Up</p>
      )}

      {pickupDocs.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {pickupDocs.map(doc => (
            <div key={doc.id} className="flex items-center gap-1.5 bg-muted/50 rounded-md px-2 py-1 text-xs border">
              {doc.file_type === 'image' && (
                <Checkbox
                  checked={selectedIds.has(doc.id)}
                  onCheckedChange={() => toggleSelect(doc.id)}
                  className="h-3.5 w-3.5"
                />
              )}
              {doc.file_type === 'image' ? <Image className="h-3 w-3 text-primary" /> : <FileText className="h-3 w-3 text-primary" />}
              <button onClick={() => openPod(doc)} className="hover:underline truncate max-w-[120px] text-left" title={doc.file_name} type="button">
                {doc.file_name}
              </button>
              <button onClick={() => downloadPod(doc)} className="text-muted-foreground hover:text-foreground" type="button" title="Descargar">
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
