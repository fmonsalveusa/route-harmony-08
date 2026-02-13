import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Camera, Image, FileText, Download, Trash2 } from 'lucide-react';

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

  const fetchDocs = useCallback(async () => {
    // Get all pickup stop IDs for this load
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
  };

  return (
    <div className="p-3 rounded-lg bg-card border text-sm space-y-3">
      <h5 className="font-semibold flex items-center gap-1.5">
        <Camera className="h-3.5 w-3.5 text-primary" /> Pick Up Pictures — BOL & Load
      </h5>

      {loading && <p className="text-xs text-muted-foreground">Cargando fotos...</p>}

      {!loading && docs.length === 0 && (
        <p className="text-xs text-muted-foreground italic ml-1">Sin archivos de Pick Up</p>
      )}

      {docs.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {docs.map(doc => (
            <div key={doc.id} className="flex items-center gap-1.5 bg-muted/50 rounded-md px-2 py-1 text-xs border">
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
    </div>
  );
};
