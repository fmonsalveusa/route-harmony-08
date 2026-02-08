import { useRef } from 'react';
import { usePodDocuments } from '@/hooks/usePodDocuments';
import { Button } from '@/components/ui/button';
import { Upload, FileText, Image, Download, Trash2, Loader2 } from 'lucide-react';

interface Stop {
  id: string;
  type: string;
  address: string;
}

interface PodUploadSectionProps {
  loadId: string;
  stops: Stop[];
}

export const PodUploadSection = ({ loadId, stops }: PodUploadSectionProps) => {
  const { pods, loading, uploading, uploadPod, deletePod } = usePodDocuments(loadId);
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const generalInputRef = useRef<HTMLInputElement | null>(null);

  const handleFileChange = async (files: FileList | null, stopId?: string) => {
    if (!files) return;
    for (let i = 0; i < files.length; i++) {
      await uploadPod(files[i], stopId);
    }
  };

  const podsForStop = (stopId: string) => pods.filter(p => p.stop_id === stopId);
  const generalPods = pods.filter(p => !p.stop_id);

  return (
    <div className="p-3 rounded-lg bg-card border text-sm space-y-3">
      <h5 className="font-semibold flex items-center gap-1.5">
        <FileText className="h-3.5 w-3.5 text-primary" /> POD — Proof of Delivery
      </h5>

      {/* Per-stop PODs */}
      {stops.length > 0 && stops.map(stop => (
        <div key={stop.id} className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">
              {stop.type === 'pickup' ? '📦 Pick Up' : '📍 Delivery'}: <span className="text-foreground">{stop.address}</span>
            </span>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-xs h-7"
              disabled={uploading}
              onClick={() => fileInputRefs.current[stop.id]?.click()}
            >
              {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
              Subir
            </Button>
            <input
              ref={el => { fileInputRefs.current[stop.id] = el; }}
              type="file"
              accept="image/*,.pdf"
              multiple
              className="hidden"
              onChange={e => handleFileChange(e.target.files, stop.id)}
            />
          </div>
          <PodFileList pods={podsForStop(stop.id)} onDelete={deletePod} />
        </div>
      ))}

      {/* General PODs (no specific stop) */}
      <div className="space-y-1.5 pt-1 border-t">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground">📎 POD General (sin parada específica)</span>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 text-xs h-7"
            disabled={uploading}
            onClick={() => generalInputRef.current?.click()}
          >
            {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
            Subir
          </Button>
          <input
            ref={generalInputRef}
            type="file"
            accept="image/*,.pdf"
            multiple
            className="hidden"
            onChange={e => handleFileChange(e.target.files)}
          />
        </div>
        <PodFileList pods={generalPods} onDelete={deletePod} />
      </div>

      {loading && <p className="text-xs text-muted-foreground">Cargando PODs...</p>}
    </div>
  );
};

function PodFileList({ pods, onDelete }: { pods: { id: string; file_url: string; file_name: string; file_type: string }[]; onDelete: (id: string) => void }) {
  if (pods.length === 0) return <p className="text-xs text-muted-foreground italic ml-1">Sin archivos</p>;

  return (
    <div className="flex flex-wrap gap-2">
      {pods.map(pod => (
        <div key={pod.id} className="flex items-center gap-1.5 bg-muted/50 rounded-md px-2 py-1 text-xs border">
          {pod.file_type === 'image' ? <Image className="h-3 w-3 text-primary" /> : <FileText className="h-3 w-3 text-primary" />}
          <a href={pod.file_url} target="_blank" rel="noopener noreferrer" className="hover:underline truncate max-w-[120px]" title={pod.file_name}>
            {pod.file_name}
          </a>
          <a href={pod.file_url} download className="text-muted-foreground hover:text-foreground">
            <Download className="h-3 w-3" />
          </a>
          <button onClick={() => onDelete(pod.id)} className="text-destructive hover:text-destructive/80">
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      ))}
    </div>
  );
}
