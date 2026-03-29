import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { usePodDocuments } from '@/hooks/usePodDocuments';
import { Camera, Upload, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { StopDocumentGroup } from '@/components/StopDocumentGroup';

interface StopInfo {
  id: string;
  address: string;
  stop_order: number;
}

export const PickupPicturesSection = ({ loadId }: { loadId: string }) => {
  const { pods, loading, uploading, uploadPod, deletePod, openPod, downloadPod } = usePodDocuments(loadId);

  const [pickupStops, setPickupStops] = useState<StopInfo[]>([]);
  const [firstPickupStopId, setFirstPickupStopId] = useState<string | null>(null);
  const [stopsLoaded, setStopsLoaded] = useState(false);

  useEffect(() => {
    const fetchPickupStops = async () => {
      const { data } = await supabase
        .from('load_stops')
        .select('id, address, stop_order')
        .eq('load_id', loadId)
        .eq('stop_type', 'pickup')
        .order('stop_order', { ascending: true });
      const stops = (data as StopInfo[]) || [];
      setPickupStops(stops);
      setFirstPickupStopId(stops[0]?.id || null);
      setStopsLoaded(true);
    };
    fetchPickupStops();
  }, [loadId]);

  const pickupStopIds = useMemo(() => new Set(pickupStops.map(s => s.id)), [pickupStops]);

  const pickupDocs = useMemo(() => {
    if (!stopsLoaded) return [];
    return pods.filter(p => !p.stop_id || pickupStopIds.has(p.stop_id));
  }, [pods, pickupStopIds, stopsLoaded]);

  const showGroupHeaders = pickupStops.length > 1;

  const groupedDocs = useMemo(() => {
    if (!showGroupHeaders) return null;
    const groups: { stop: StopInfo | null; docs: typeof pickupDocs }[] = [];

    for (const stop of pickupStops) {
      groups.push({
        stop,
        docs: pickupDocs.filter(p => p.stop_id === stop.id),
      });
    }

    const unassigned = pickupDocs.filter(p => !p.stop_id);
    if (unassigned.length > 0) {
      groups.push({ stop: null, docs: unassigned });
    }

    return groups;
  }, [pickupDocs, pickupStops, showGroupHeaders]);

  const handleFileChange = async (files: FileList | null) => {
    if (!files) return;
    for (let i = 0; i < files.length; i++) {
      await uploadPod(files[i], firstPickupStopId || undefined);
    }
  };

  return (
    <div className="p-3 rounded-lg bg-card border text-sm space-y-3">
      <div className="flex items-center justify-between">
        <h5 className="font-semibold flex items-center gap-1.5">
          <Camera className="h-3.5 w-3.5 text-primary" /> Pick Up Pictures — BOL & Load
        </h5>
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

      {loading && <p className="text-xs text-muted-foreground">Cargando fotos...</p>}

      {!loading && pickupDocs.length === 0 && (
        <p className="text-xs text-muted-foreground italic ml-1">Sin archivos de Pick Up</p>
      )}

      {!loading && pickupDocs.length > 0 && !showGroupHeaders && (
        <StopDocumentGroup
          label={null}
          docs={pickupDocs}
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
              ? `Pickup #${i + 1} — ${group.stop.address}`
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
