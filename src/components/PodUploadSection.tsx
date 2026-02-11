import { useRef, useState } from 'react';
import { usePodDocuments, PodDocument } from '@/hooks/usePodDocuments';
import { Button } from '@/components/ui/button';
import { Upload, FileText, Image, Download, Trash2, Loader2, Eye } from 'lucide-react';

interface PodUploadSectionProps {
  loadId: string;
}

export const PodUploadSection = ({ loadId }: PodUploadSectionProps) => {
  const { pods, loading, uploading, uploadPod, deletePod, downloadPod, getSignedUrl } = usePodDocuments(loadId);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleFileChange = async (files: FileList | null) => {
    if (!files) return;
    for (let i = 0; i < files.length; i++) {
      await uploadPod(files[i]);
    }
  };

  const handleView = async (pod: PodDocument) => {
    const url = await getSignedUrl(pod.file_url);
    if (url) window.open(url, '_blank');
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

      <PodFileList pods={pods} onDelete={deletePod} onDownload={downloadPod} onView={handleView} />
      {loading && <p className="text-xs text-muted-foreground">Cargando PODs...</p>}
    </div>
  );
};

function PodFileList({ pods, onDelete, onDownload, onView }: {
  pods: PodDocument[];
  onDelete: (id: string) => void;
  onDownload: (pod: PodDocument) => void;
  onView: (pod: PodDocument) => void;
}) {
  if (pods.length === 0) return <p className="text-xs text-muted-foreground italic ml-1">Sin archivos</p>;

  return (
    <div className="flex flex-wrap gap-2">
      {pods.map(pod => (
        <div key={pod.id} className="flex items-center gap-1.5 bg-muted/50 rounded-md px-2 py-1 text-xs border">
          {pod.file_type === 'image' ? <Image className="h-3 w-3 text-primary" /> : <FileText className="h-3 w-3 text-primary" />}
          <button onClick={() => onView(pod)} className="hover:underline truncate max-w-[120px]" title={pod.file_name}>
            {pod.file_name}
          </button>
          <button onClick={() => onDownload(pod)} className="text-muted-foreground hover:text-foreground" title="Descargar">
            <Download className="h-3 w-3" />
          </button>
          <button onClick={() => onDelete(pod.id)} className="text-destructive hover:text-destructive/80">
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      ))}
    </div>
  );
}
