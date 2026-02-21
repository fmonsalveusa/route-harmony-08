import { useState, useEffect, useCallback } from 'react';
import { MapPin, Navigation, Camera, Check, Clock, Image, Loader2, Trash2, PackageCheck, CheckCircle2 } from 'lucide-react';
import { DocumentScanner } from './DocumentScanner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { getTenantId } from '@/hooks/useTenantId';
import { createNotification } from '@/hooks/useNotifications';
import { toast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { compressImage } from '@/lib/imageCompression';

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
  loadStatus?: string;
  isLastDelivery?: boolean;
}

export const StopCard = ({ stop, loadRef, driverName, onUpdate, podDocuments, loadStatus, isLastDelivery }: StopCardProps) => {
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
      // Update load status to on_site
      const newStatus = stop.stop_type === 'pickup' ? 'on_site_pickup' : 'on_site_delivery';
      await supabase.from('loads').update({ status: newStatus }).eq('id', stop.load_id);

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

  const [changingStatus, setChangingStatus] = useState(false);

  const handlePickedUp = async () => {
    setChangingStatus(true);
    await supabase.from('loads').update({ status: 'picked_up' }).eq('id', stop.load_id);
    await createNotification({
      type: 'status_changed',
      title: 'Picked Up',
      message: `${driverName} marked load ${loadRef} as Picked Up`,
      load_id: stop.load_id,
    });
    toast({ title: 'Status: Picked Up' });
    onUpdate();
    setChangingStatus(false);
  };

  const handleDelivered = async () => {
    setChangingStatus(true);
    // Import and call generatePaymentsForLoad from parent context
    await supabase.from('loads').update({ status: 'delivered' }).eq('id', stop.load_id);
    await createNotification({
      type: 'status_changed',
      title: 'Load Delivered!',
      message: `${driverName} marked load ${loadRef} as Delivered`,
      load_id: stop.load_id,
    });
    toast({ title: 'Marked as Delivered!' });
    onUpdate();
    setChangingStatus(false);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploading(true);

    const tenant_id = await getTenantId();

    for (const file of Array.from(files)) {
      const isImage = file.type.startsWith('image/');
      const compressed = isImage ? await compressImage(file) : file;
      const ext = isImage ? 'jpg' : file.name.split('.').pop();
      const filePath = `pods/${stop.load_id}/${stop.id}_${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('driver-documents')
        .upload(filePath, compressed, isImage ? { contentType: 'image/jpeg' } : undefined);

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
    if (stopPods.length === 0) {
      setResolvedUrls({});
      return;
    }
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [podDocuments]);

  useEffect(() => {
    resolveUrls();
  }, [resolveUrls]);

  const handleDeletePod = async (doc: { id: string; file_url: string; file_name: string }) => {
    // Delete storage file
    let path = doc.file_url;
    if (path.startsWith('http')) {
      const match = path.match(/\/storage\/v1\/object\/sign\/driver-documents\/([^?]+)/);
      if (match?.[1]) path = decodeURIComponent(match[1]);
    }
    if (path && !path.startsWith('http')) {
      await supabase.storage.from('driver-documents').remove([path]);
    }
    // Delete DB record
    const { error } = await supabase.from('pod_documents').delete().eq('id', doc.id);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Archivo eliminado' });
      onUpdate();
    }
  };

  const [deletingId, setDeletingId] = useState<string | null>(null);

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
            <p className="text-base font-semibold">{stop.stop_type === 'pickup' ? 'Pick Up' : 'Delivery'}</p>
            <p className="text-sm text-muted-foreground">{stop.address}</p>
            {stop.date && <p className="text-sm text-muted-foreground mt-0.5">{format(new Date(stop.date), 'MMM dd, yyyy')}</p>}
          </div>
        </div>

        {isArrived && (
          <Badge className="bg-success text-success-foreground text-xs gap-1">
            <Check className="h-3 w-3" />
            {format(new Date(stop.arrived_at!), 'h:mm a')}
          </Badge>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <a href={googleMapsUrl} target="_blank" rel="noopener noreferrer">
          <Button variant="outline" size="sm" className="gap-1.5 text-sm">
            <Navigation className="h-4 w-4" /> Navigate
          </Button>
        </a>

        {!isArrived && (
          <Button size="sm" className="gap-1.5 text-sm" onClick={handleArrived} disabled={arriving}>
            <MapPin className="h-4 w-4" />
            {arriving ? 'Marking...' : 'Arrived'}
          </Button>
        )}

        {isArrived && (
          <>
            <label>
              <Button variant="outline" size="sm" className="gap-1.5 text-sm" asChild disabled={uploading}>
                <span>
                  <Camera className="h-4 w-4" />
                  {uploading ? 'Uploading...' : stop.stop_type === 'pickup' ? 'Load Pictures' : 'Upload POD'}
                </span>
              </Button>
              <input type="file" accept="image/*,application/pdf" capture="environment" multiple className="hidden" onChange={handleFileUpload} />
            </label>
            <Button variant="default" size="sm" className="gap-1.5 text-sm" onClick={() => setScannerOpen(true)}>
              <Camera className="h-4 w-4" />
              {stop.stop_type === 'pickup' ? 'Scanear BOL' : 'Scanear POD'}
            </Button>
          </>
        )}
      </div>

      {isArrived && stop.stop_type === 'pickup' && loadStatus !== 'picked_up' && loadStatus !== 'on_site_delivery' && loadStatus !== 'delivered' && loadStatus !== 'paid' && (
        <div className="flex justify-end">
          <Button size="sm" className="gap-1.5 text-sm bg-primary hover:bg-primary/90" onClick={handlePickedUp} disabled={changingStatus}>
            <PackageCheck className="h-4 w-4" />
            {changingStatus ? 'Updating...' : 'Picked Up'}
          </Button>
        </div>
      )}

      {isArrived && stop.stop_type === 'delivery' && isLastDelivery && loadStatus !== 'delivered' && loadStatus !== 'paid' && (
        <div className="flex justify-end">
          <Button size="sm" className="gap-1.5 text-sm bg-success hover:bg-success/90 text-success-foreground" onClick={handleDelivered} disabled={changingStatus}>
            <CheckCircle2 className="h-4 w-4" />
            {changingStatus ? 'Updating...' : 'Delivered'}
          </Button>
        </div>
      )}

      {stopPods.length > 0 && (
        <div className="flex flex-wrap gap-2 pt-1">
          {stopPods.map(doc => (
            <div key={doc.id} className="relative group">
              <button onClick={() => handleOpenPod(doc)} type="button">
                <div className="w-16 h-16 rounded-lg border overflow-hidden bg-muted flex items-center justify-center">
                  {resolvedUrls[doc.id] && (doc.file_name.match(/\.(jpg|jpeg|png|gif|webp)/i) || (doc as any).file_type === 'image') ? (
                    <img src={resolvedUrls[doc.id]} alt={doc.file_name} className="w-full h-full object-cover" />
                  ) : resolvingUrls ? (
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  ) : (
                    <Image className="h-5 w-5 text-muted-foreground" />
                  )}
                </div>
              </button>
              {deletingId === doc.id ? (
                <div className="absolute -top-1 -right-1 flex gap-0.5">
                  <button
                    type="button"
                    className="bg-destructive text-destructive-foreground rounded-full w-5 h-5 flex items-center justify-center text-[10px] font-bold shadow"
                    onClick={async () => {
                      await handleDeletePod(doc as any);
                      setDeletingId(null);
                    }}
                  >
                    ✓
                  </button>
                  <button
                    type="button"
                    className="bg-muted text-muted-foreground rounded-full w-5 h-5 flex items-center justify-center text-[10px] font-bold shadow border"
                    onClick={() => setDeletingId(null)}
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full w-5 h-5 flex items-center justify-center shadow opacity-0 group-active:opacity-100 transition-opacity"
                  onClick={() => setDeletingId(doc.id)}
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              )}
            </div>
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
