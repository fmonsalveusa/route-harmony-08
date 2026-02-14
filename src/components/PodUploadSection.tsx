import { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import { usePodDocuments } from '@/hooks/usePodDocuments';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Upload, FileText, Image, Download, Trash2, Loader2 } from 'lucide-react';

interface PodUploadSectionProps {
  loadId: string;
}

export const PodUploadSection = ({ loadId }: PodUploadSectionProps) => {
  const { pods, loading, uploading, uploadPod, deletePod, openPod, downloadPod } = usePodDocuments(loadId);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Get delivery stop IDs to filter only delivery PODs
  const [deliveryStopIds, setDeliveryStopIds] = useState<Set<string>>(new Set());
  const [stopsLoaded, setStopsLoaded] = useState(false);

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

  // Filter: only show docs linked to delivery stops OR docs with no stop_id (legacy uploaded via this section)
  const deliveryPods = useMemo(() => {
    if (!stopsLoaded) return [];
    return pods.filter(p => !p.stop_id || deliveryStopIds.has(p.stop_id));
  }, [pods, deliveryStopIds, stopsLoaded]);

  const handleFileChange = async (files: FileList | null) => {
    if (!files) return;
    for (let i = 0; i < files.length; i++) {
      await uploadPod(files[i]);
    }
  };

  return (
    <div className="p-3 rounded-lg bg-card border text-sm space-y-3">
      <div className="flex items-center justify-between">
        <h5 className="font-semibold flex items-center gap-1.5">
          <FileText className="h-3.5 w-3.5 text-primary" /> POD — Proof of Delivery
        </h5>
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
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,.pdf"
          multiple
          className="hidden"
          onChange={e => handleFileChange(e.target.files)}
        />
      </div>

      <PodFileList pods={deliveryPods} onDelete={deletePod} onOpen={openPod} onDownload={downloadPod} />
      {loading && <p className="text-xs text-muted-foreground">Cargando PODs...</p>}
    </div>
  );
};

function PodFileList({
  pods,
  onDelete,
  onOpen,
  onDownload,
}: {
  pods: { id: string; file_url: string; file_name: string; file_type: string }[];
  onDelete: (id: string) => void;
  onOpen: (pod: any) => void;
  onDownload: (pod: any) => void;
}) {
  if (pods.length === 0) return <p className="text-xs text-muted-foreground italic ml-1">Sin archivos</p>;

  return (
    <div className="flex flex-wrap gap-2">
      {pods.map(pod => (
        <div key={pod.id} className="flex items-center gap-1.5 bg-muted/50 rounded-md px-2 py-1 text-xs border">
          {pod.file_type === 'image' ? <Image className="h-3 w-3 text-primary" /> : <FileText className="h-3 w-3 text-primary" />}
          <button
            onClick={() => onOpen(pod)}
            className="hover:underline truncate max-w-[120px] text-left"
            title={pod.file_name}
            type="button"
          >
            {pod.file_name}
          </button>
          <button
            onClick={() => onDownload(pod)}
            className="text-muted-foreground hover:text-foreground"
            type="button"
            title="Descargar"
          >
            <Download className="h-3 w-3" />
          </button>
          <button onClick={() => onDelete(pod.id)} className="text-destructive hover:text-destructive/80" type="button">
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      ))}
    </div>
  );
}
