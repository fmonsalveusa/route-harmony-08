import { useState, useEffect, useCallback } from 'react';
import { MapPin, Navigation, Camera, Check, Clock, Image, Loader2 } from 'lucide-react';
import { DocumentScanner } from './DocumentScanner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { getTenantId } from '@/hooks/useTenantId';
import { createNotification } from '@/hooks/useNotifications';
import { toast } from '@/hooks/use-toast';
import { format } from 'date-fns';

interface StopCardProps {
  stop: {
    id: string;
    load_id: string;
    stop_type: string;
    address: string;
    stop_order: number;
    date: string | null;
    arrived_at: string | null;
  };
  loadRef: string;
  driverName: string;
  onUpdate: () => void;
  podDocuments: { id: string; file_name: string; file_url: string }[];
}

export const StopCard = ({ stop, loadRef, driverName, onUpdate, podDocuments }: StopCardProps) => {
  const [arriving, setArriving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);

  const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(stop.address)}`;

  const handleArrived = async () => {
    setArriving(true);
    const { error } = await supabase
      .from('load_stops')
      .update({ arrived_at: new Date().toISOString() } as any)
      .eq('id', stop.id);

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      await createNotification({
        type: 'driver_arrived',
        title: `Driver arrived at ${stop.stop_type}`,
        message: `${driverName} arrived at ${stop.address} (Load ${loadRef})`,
        load_id: stop.load_id,
      });
      toast({ title: 'Arrived!' });
      onUpdate();
    }
    setArriving(false);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploading(true);

    const tenant_id = await getTenantId();

    for (const file of Array.from(files)) {
      const ext = file.name.split('.').pop();
      const filePath = `pods/${stop.load_id}/${stop.id}_${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('driver-documents')
        .upload(filePath, file);

      if (uploadError) {
        toast({ title: 'Upload error', description: uploadError.message, variant: 'destructive' });
        continue;
      }

      await supabase.from('pod_documents').insert({
        load_id: stop.load_id,
        stop_id: stop.id,
        file_name: file.name,
        file_url: filePath,
        file_type: file.type.startsWith('image/') ? 'image' : 'pdf',
        tenant_id,
      } as any);

      await createNotification({
        type: 'pod_uploaded',
        title: 'POD uploaded',
        message: `${driverName} uploaded a POD for ${stop.address} (Load ${loadRef})`,
        load_id: stop.load_id,
      });
    }

    toast({ title: 'POD(s) uploaded successfully' });
    setUploading(false);
    onUpdate();
    e.target.value = '';
  };

  const isArrived = !!stop.arrived_at;
  const stopPods = podDocuments.filter(p => (p as any).stop_id === stop.id);

  // Resolve signed URLs for thumbnails
  const [resolvedUrls, setResolvedUrls] = useState<Record<string, string>>({});
  const [resolvingUrls, setResolvingUrls] = useState(false);

  const resolveUrls = useCallback(async () => {
    if (stopPods.length === 0) return;
    setResolvingUrls(true);
    const urls: Record<string, string> = {};
    for (const doc of stopPods) {
      try {
        let path = doc.file_url;
        // If it's already an http URL (legacy), extract the storage path
        if (path.startsWith('http')) {
          const match = path.match(/\/storage\/v1\/object\/sign\/driver-documents\/([^?]+)/);
          if (match?.[1]) {
            path = decodeURIComponent(match[1]);
          } else {
            urls[doc.id] = path;
            continue;
          }
        }
        const { data } = await supabase.storage
          .from('driver-documents')
          .createSignedUrl(path, 3600);
        if (data?.signedUrl) urls[doc.id] = data.signedUrl;
      } catch {
        // skip
      }
    }
    setResolvedUrls(urls);
    setResolvingUrls(false);
  }, [stopPods.map(p => p.id).join(',')]);

  useEffect(() => {
    resolveUrls();
  }, [resolveUrls]);

  const handleOpenPod = async (doc: { id: string; file_url: string }) => {
    // Open blank window synchronously to avoid popup blocker
    const win = window.open('', '_blank');
    let url = resolvedUrls[doc.id];
    if (!url) {
      let path = doc.file_url;
      if (path.startsWith('http')) {
        const match = path.match(/\/storage\/v1\/object\/sign\/driver-documents\/([^?]+)/);
        if (match?.[1]) path = decodeURIComponent(match[1]);
      }
      const { data } = await supabase.storage
        .from('driver-documents')
        .createSignedUrl(path, 3600);
      url = data?.signedUrl || '';
    }
    if (url && win) {
      win.location.href = url;
    } else if (win) {
      win.close();
      toast({ title: 'Error', description: 'No se pudo abrir el archivo', variant: 'destructive' });
    }
  };

  return (
    <div className={`rounded-xl border p-4 space-y-3 ${isArrived ? 'border-success/50 bg-success/5' : 'bg-card'}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2">
          <div className={`mt-0.5 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white ${stop.stop_type === 'pickup' ? 'bg-success' : 'bg-destructive'}`}>
            {stop.stop_type === 'pickup' ? 'P' : 'D'}
          </div>
          <div>
            <p className="text-sm font-semibold">{stop.stop_type === 'pickup' ? 'Pick Up' : 'Delivery'}</p>
            <p className="text-xs text-muted-foreground">{stop.address}</p>
            {stop.date && <p className="text-xs text-muted-foreground mt-0.5">{format(new Date(stop.date), 'MMM dd, yyyy')}</p>}
          </div>
        </div>

        {isArrived && (
          <Badge className="bg-success text-success-foreground text-[10px] gap-1">
            <Check className="h-3 w-3" />
            {format(new Date(stop.arrived_at!), 'h:mm a')}
          </Badge>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <a href={googleMapsUrl} target="_blank" rel="noopener noreferrer">
          <Button variant="outline" size="sm" className="gap-1.5 text-xs">
            <Navigation className="h-3.5 w-3.5" /> Navigate
          </Button>
        </a>

        {!isArrived && (
          <Button size="sm" className="gap-1.5 text-xs" onClick={handleArrived} disabled={arriving}>
            <MapPin className="h-3.5 w-3.5" />
            {arriving ? 'Marking...' : 'Arrived'}
          </Button>
        )}

        {isArrived && (
          <>
            <label>
              <Button variant="outline" size="sm" className="gap-1.5 text-xs" asChild disabled={uploading}>
                <span>
                  <Camera className="h-3.5 w-3.5" />
                  {uploading ? 'Uploading...' : stop.stop_type === 'pickup' ? 'Load Pictures' : 'Upload POD'}
                </span>
              </Button>
              <input type="file" accept="image/*,application/pdf" capture="environment" multiple className="hidden" onChange={handleFileUpload} />
            </label>
            <Button variant="default" size="sm" className="gap-1.5 text-xs" onClick={() => setScannerOpen(true)}>
              <Camera className="h-3.5 w-3.5" />
              {stop.stop_type === 'pickup' ? 'Scanear BOL' : 'Scanear POD'}
            </Button>
          </>
        )}
      </div>

      {stopPods.length > 0 && (
        <div className="flex flex-wrap gap-2 pt-1">
          {stopPods.map(doc => (
            <button key={doc.id} onClick={() => handleOpenPod(doc)} className="relative group" type="button">
              <div className="w-14 h-14 rounded-lg border overflow-hidden bg-muted flex items-center justify-center">
                {resolvedUrls[doc.id] && doc.file_name.match(/\.(jpg|jpeg|png|gif|webp)/i) ? (
                  <img src={resolvedUrls[doc.id]} alt={doc.file_name} className="w-full h-full object-cover" />
                ) : resolvingUrls ? (
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                ) : (
                  <Image className="h-5 w-5 text-muted-foreground" />
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      <DocumentScanner
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
        stop={stop}
        loadRef={loadRef}
        driverName={driverName}
        onUpdate={onUpdate}
      />
    </div>
  );
};
