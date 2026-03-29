import { useRef, useState, useEffect, useMemo } from 'react';
import { usePodDocuments } from '@/hooks/usePodDocuments';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Upload, FileText, Loader2, CheckSquare, Square } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { StopDocumentGroup } from '@/components/StopDocumentGroup';

interface StopInfo {
  id: string;
  address: string;
  stop_order: number;
}

interface PodUploadSectionProps {
  loadId: string;
}

export const PodUploadSection = ({ loadId }: PodUploadSectionProps) => {
  const { pods, loading, uploading, uploadPod, deletePod, openPod, downloadPod } = usePodDocuments(loadId);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [deliveryStops, setDeliveryStops] = useState<StopInfo[]>([]);
  const [stopsLoaded, setStopsLoaded] = useState(false);

  useEffect(() => {
    const fetchDeliveryStops = async () => {
      const { data } = await supabase
        .from('load_stops')
        .select('id, address, stop_order')
        .eq('load_id', loadId)
        .eq('stop_type', 'delivery')
        .order('stop_order', { ascending: true });
      setDeliveryStops((data as StopInfo[]) || []);
      setStopsLoaded(true);
    };
    fetchDeliveryStops();
  }, [loadId]);

  const deliveryStopIds = useMemo(() => new Set(deliveryStops.map(s => s.id)), [deliveryStops]);

  const deliveryPods = useMemo(() => {
    if (!stopsLoaded) return [];
    return pods.filter(p => !p.stop_id || deliveryStopIds.has(p.stop_id));
  }, [pods, deliveryStopIds, stopsLoaded]);

  const showGroupHeaders = deliveryStops.length > 1;

  const groupedDocs = useMemo(() => {
    if (!showGroupHeaders) return null;
    const groups: { stop: StopInfo | null; docs: typeof deliveryPods }[] = [];
    
    for (const stop of deliveryStops) {
      groups.push({
        stop,
        docs: deliveryPods.filter(p => p.stop_id === stop.id),
      });
    }
    
    const unassigned = deliveryPods.filter(p => !p.stop_id);
    if (unassigned.length > 0) {
      groups.push({ stop: null, docs: unassigned });
    }
    
    return groups;
  }, [deliveryPods, deliveryStops, showGroupHeaders]);

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
        <div className="flex items-center gap-2">
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

      {loading && <p className="text-xs text-muted-foreground">Cargando PODs...</p>}

      {!loading && deliveryPods.length === 0 && (
        <p className="text-xs text-muted-foreground italic ml-1">Sin archivos</p>
      )}

      {!loading && deliveryPods.length > 0 && !showGroupHeaders && (
        <StopDocumentGroup
          label={null}
          docs={deliveryPods}
          onOpen={openPod}
          onDownload={downloadPod}
          onDelete={deletePod}
        />
      )}

      {!loading && groupedDocs && groupedDocs.map((group, i) => (
        <StopDocumentGroup
          key={group.stop?.id || 'unassigned'}
          label={
            group.stop
              ? `Delivery #${i + 1} — ${group.stop.address}`
              : 'Sin parada asignada'
          }
          docs={group.docs}
          onOpen={openPod}
          onDownload={downloadPod}
          onDelete={deletePod}
        />
      ))}
    </div>
  );
};
