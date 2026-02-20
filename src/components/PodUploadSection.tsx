import { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import { usePodDocuments } from '@/hooks/usePodDocuments';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Upload, FileText, Image, Download, Trash2, Loader2, Copy, CheckSquare, Square } from 'lucide-react';
import { copyImageToClipboard } from '@/lib/clipboardUtils';
import { toast } from '@/hooks/use-toast';

interface PodUploadSectionProps {
  loadId: string;
}

export const PodUploadSection = ({ loadId }: PodUploadSectionProps) => {
  const { pods, loading, uploading, uploadPod, deletePod, openPod, downloadPod } = usePodDocuments(loadId);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [deliveryStopIds, setDeliveryStopIds] = useState<Set<string>>(new Set());
  const [stopsLoaded, setStopsLoaded] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [copyIndex, setCopyIndex] = useState(0);
  const [copying, setCopying] = useState(false);

  useEffect(() => {
    const fetchDeliveryStops = async () => {
      const { data } = await supabase
        .from('load_stops')
        .select('id')
        .eq('load_id', loadId)
        .eq('stop_type', 'delivery');
      setDeliveryStopIds(new Set((data || []).map(s => s.id)));
      setStopsLoaded(true);
    };
    fetchDeliveryStops();
  }, [loadId]);

  const deliveryPods = useMemo(() => {
    if (!stopsLoaded) return [];
    return pods.filter(p => !p.stop_id || deliveryStopIds.has(p.stop_id));
  }, [pods, deliveryStopIds, stopsLoaded]);

  const imagePods = useMemo(() => deliveryPods.filter(p => p.file_type === 'image'), [deliveryPods]);

  const handleFileChange = async (files: FileList | null) => {
    if (!files) return;
    for (let i = 0; i < files.length; i++) {
      await uploadPod(files[i]);
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
    if (selectedIds.size === imagePods.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(imagePods.map(p => p.id)));
    }
    setCopyIndex(0);
  };

  const handleDelete = (id: string) => {
    deletePod(id);
    setSelectedIds(prev => { const n = new Set(prev); n.delete(id); return n; });
  };

  const resolveUrl = async (pod: typeof deliveryPods[0]): Promise<string> => {
    if (pod.file_url?.startsWith('http')) {
      const match = pod.file_url.match(/\/storage\/v1\/object\/sign\/driver-documents\/([^?]+)/);
      if (match?.[1]) {
        const path = decodeURIComponent(match[1]);
        const { data } = await supabase.storage.from('driver-documents').createSignedUrl(path, 3600);
        if (data?.signedUrl) return data.signedUrl;
      }
      return pod.file_url;
    }
    if (!pod.file_url) return '';
    const { data } = await supabase.storage.from('driver-documents').createSignedUrl(pod.file_url, 3600);
    return data?.signedUrl || '';
  };

  const handleCopy = async () => {
    const selected = imagePods.filter(p => selectedIds.has(p.id));
    if (selected.length === 0) return;
    const idx = copyIndex % selected.length;
    const pod = selected[idx];

    setCopying(true);
    try {
      const url = await resolveUrl(pod);
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
          <FileText className="h-3.5 w-3.5 text-primary" /> POD — Proof of Delivery
        </h5>
        <div className="flex items-center gap-2">
          {imagePods.length > 0 && (
            <button
              onClick={toggleSelectAll}
              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
              type="button"
            >
              {selectedIds.size === imagePods.length ? <CheckSquare className="h-3 w-3" /> : <Square className="h-3 w-3" />}
              {selectedIds.size === imagePods.length ? 'Deseleccionar' : 'Seleccionar todo'}
            </button>
          )}
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 text-xs h-7"
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
          >
            {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
            Subir POD
          </Button>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,.pdf"
          multiple
          className="hidden"
          onChange={e => handleFileChange(e.target.files)}
        />
      </div>

      {deliveryPods.length === 0 && !loading && (
        <p className="text-xs text-muted-foreground italic ml-1">Sin archivos</p>
      )}

      {deliveryPods.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {deliveryPods.map(pod => (
            <div key={pod.id} className="flex items-center gap-1.5 bg-muted/50 rounded-md px-2 py-1 text-xs border">
              {pod.file_type === 'image' && (
                <Checkbox
                  checked={selectedIds.has(pod.id)}
                  onCheckedChange={() => toggleSelect(pod.id)}
                  className="h-3.5 w-3.5"
                />
              )}
              {pod.file_type === 'image' ? <Image className="h-3 w-3 text-primary" /> : <FileText className="h-3 w-3 text-primary" />}
              <button
                onClick={() => openPod(pod)}
                className="hover:underline truncate max-w-[120px] text-left"
                title={pod.file_name}
                type="button"
              >
                {pod.file_name}
              </button>
              <button
                onClick={() => downloadPod(pod)}
                className="text-muted-foreground hover:text-foreground"
                type="button"
                title="Descargar"
              >
                <Download className="h-3 w-3" />
              </button>
              <button onClick={() => handleDelete(pod.id)} className="text-destructive hover:text-destructive/80" type="button">
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

      {loading && <p className="text-xs text-muted-foreground">Cargando PODs...</p>}
    </div>
  );
};
