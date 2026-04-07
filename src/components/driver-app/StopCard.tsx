import { useState, useEffect, useCallback, useRef } from 'react';
import { MapPin, Navigation, Camera, Check, Clock, Image, Loader2, Trash2, PackageCheck, CheckCircle2, ImagePlus, ScanLine, ChevronLeft, ChevronRight, X, FileText } from 'lucide-react';
import { DocumentScanner } from './DocumentScanner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { getTenantId } from '@/hooks/useTenantId';
import { createNotification } from '@/hooks/useNotifications';
import { toast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { compressImage } from '@/lib/imageCompression';
import { hapticFeedback } from '@/lib/haptics';
import { isNativeCamera, takeNativePhoto, pickFromGallery, dataUrlToFile } from '@/lib/nativeCamera';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

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
  podDocuments: { id: string; file_name: string; file_url: string; created_at?: string; file_type?: string }[];
  loadStatus?: string;
  isLastDelivery?: boolean;
}

export const StopCard = ({ stop, loadRef, driverName, onUpdate, podDocuments, loadStatus, isLastDelivery }: StopCardProps) => {
  const [arriving, setArriving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const [deleteDoc, setDeleteDoc] = useState<{ id: string; file_url: string; file_name: string } | null>(null);

  const isAndroid = /android/i.test(navigator.userAgent);
  const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(stop.address)}`;

  const isArrived = !!stop.arrived_at;
  const stopPods = podDocuments.filter(p => (p as any).stop_id === stop.id);
  const hasDocuments = stopPods.length > 0;
  const isComplete = hasDocuments; // At least 1 doc = complete

  // Resolve signed URLs for thumbnails
  const [resolvedUrls, setResolvedUrls] = useState<Record<string, string>>({});
  const [resolvingUrls, setResolvingUrls] = useState(false);

  const resolveUrls = useCallback(async () => {
    const currentStopPods = podDocuments.filter(p => (p as any).stop_id === stop.id);
    if (currentStopPods.length === 0) {
      setResolvedUrls({});
      return;
    }
    setResolvingUrls(true);
    const urls: Record<string, string> = {};
    for (const doc of currentStopPods) {
      try {
        let path = doc.file_url;
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
  }, [podDocuments, stop.id]);

  useEffect(() => {
    resolveUrls();
  }, [resolveUrls]);

  const handleArrived = async () => {
    setArriving(true);
    const { error } = await supabase
      .from('load_stops')
      .update({ arrived_at: new Date().toISOString() } as any)
      .eq('id', stop.id);

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      const newStatus = stop.stop_type === 'pickup' ? 'on_site_pickup' : 'on_site_delivery';
      await supabase.from('loads').update({ status: newStatus }).eq('id', stop.load_id);
      await createNotification({
        type: 'driver_arrived',
        title: `Arrived - ${driverName}`,
        message: `${driverName} arrived at ${stop.stop_type}: ${stop.address} (Load #${loadRef})`,
        load_id: stop.load_id,
      });
      toast({ title: 'Arrived!' });
      hapticFeedback('success');
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
      title: `Picked Up - ${driverName}`,
      message: `${driverName} picked up at ${stop.address} (Load #${loadRef})`,
      load_id: stop.load_id,
    });
    toast({ title: 'Status: Picked Up' });
    hapticFeedback('success');
    onUpdate();
    setChangingStatus(false);
  };

  const handleDelivered = async () => {
    setChangingStatus(true);
    await supabase.from('loads').update({ status: 'delivered', factoring: 'Pending' }).eq('id', stop.load_id);
    await createNotification({
      type: 'status_changed',
      title: `Delivered - ${driverName}`,
      message: `${driverName} delivered at ${stop.address} (Load #${loadRef})`,
      load_id: stop.load_id,
    });
    toast({ title: 'Marked as Delivered!' });
    hapticFeedback('success');
    onUpdate();
    setChangingStatus(false);
  };

  const uploadDataUrl = async (dataUrl: string, fileName: string) => {
    setUploading(true);
    const tenant_id = await getTenantId();
    const file = dataUrlToFile(dataUrl, fileName);
    const compressed = await compressImage(file);
    const filePath = `pods/${stop.load_id}/${stop.id}_${Date.now()}.jpg`;

    const { error: uploadError } = await supabase.storage
      .from('driver-documents')
      .upload(filePath, compressed, { contentType: 'image/jpeg' });

    if (uploadError) {
      toast({ title: 'Upload error', description: uploadError.message, variant: 'destructive' });
      setUploading(false);
      return;
    }

    await supabase.from('pod_documents').insert({
      load_id: stop.load_id,
      stop_id: stop.id,
      file_name: fileName,
      file_url: filePath,
      file_type: 'image',
      tenant_id,
    } as any);

    await createNotification({
      type: 'pod_uploaded',
      title: `POD Uploaded - ${driverName}`,
      message: `${driverName} uploaded ${stop.stop_type} doc at ${stop.address} (Load #${loadRef})`,
      load_id: stop.load_id,
    });

    toast({ title: 'Photo uploaded successfully' });
    hapticFeedback('success');
    setUploading(false);
    onUpdate();
  };

  const cameraFallbackRef = useRef<HTMLInputElement>(null);
  const galleryFallbackRef = useRef<HTMLInputElement>(null);

  const handleNativeCamera = async () => {
    try {
      const dataUrl = await takeNativePhoto();
      if (dataUrl) {
        await uploadDataUrl(dataUrl, `camera_${Date.now()}.jpg`);
      }
    } catch (err: any) {
      console.error('Native camera failed:', err);
      toast({ title: 'Error de cámara', description: 'Intentando abrir selector de archivos...', variant: 'destructive' });
      cameraFallbackRef.current?.click();
    }
  };

  const handleNativeGallery = async () => {
    try {
      const urls = await pickFromGallery();
      for (const dataUrl of urls) {
        await uploadDataUrl(dataUrl, `gallery_${Date.now()}.jpg`);
      }
    } catch (err: any) {
      console.error('Native gallery failed:', err);
      toast({ title: 'Error de galería', description: 'Intentando abrir selector de archivos...', variant: 'destructive' });
      galleryFallbackRef.current?.click();
    }
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
        title: `POD Uploaded - ${driverName}`,
        message: `${driverName} uploaded ${stop.stop_type} doc at ${stop.address} (Load #${loadRef})`,
        load_id: stop.load_id,
      });
    }

    toast({ title: 'POD(s) uploaded successfully' });
    setUploading(false);
    onUpdate();
    e.target.value = '';
  };

  const handleDeletePod = async (doc: { id: string; file_url: string; file_name: string }) => {
    let path = doc.file_url;
    if (path.startsWith('http')) {
      const match = path.match(/\/storage\/v1\/object\/sign\/driver-documents\/([^?]+)/);
      if (match?.[1]) path = decodeURIComponent(match[1]);
    }
    if (path && !path.startsWith('http')) {
      await supabase.storage.from('driver-documents').remove([path]);
    }
    const { error } = await supabase.from('pod_documents').delete().eq('id', doc.id);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Archivo eliminado' });
      onUpdate();
    }
  };

  const handleOpenPod = async (doc: { id: string; file_url: string }) => {
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

  const isImageDoc = (doc: any) =>
    doc.file_name?.match(/\.(jpg|jpeg|png|gif|webp)/i) || doc.file_type === 'image';

  const truncateName = (name: string, max = 10) => {
    if (!name) return '';
    const ext = name.includes('.') ? '.' + name.split('.').pop() : '';
    const base = name.replace(ext, '');
    if (base.length <= max) return name;
    return base.substring(0, max) + '…' + ext;
  };

  return (
    <div className={`rounded-xl border p-4 space-y-3 ${isArrived ? 'border-success/50 bg-success/5' : 'bg-card'}`}>
      {/* Header with doc counter */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2">
          <div className={`mt-0.5 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white ${stop.stop_type === 'pickup' ? 'bg-success' : 'bg-destructive'}`}>
            {stop.stop_type === 'pickup' ? 'P' : 'D'}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <p className="text-base font-semibold">{stop.stop_type === 'pickup' ? 'Pick Up' : 'Delivery'}</p>
              {stopPods.length > 0 && (
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 gap-0.5">
                  <Camera className="h-2.5 w-2.5" />
                  {stopPods.length}
                </Badge>
              )}
              {isArrived && (
                isComplete ? (
                  <CheckCircle2 className="h-4 w-4 text-success" />
                ) : (
                  <Clock className="h-4 w-4 text-warning" />
                )
              )}
            </div>
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

      {/* Action buttons */}
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
      </div>

      {/* Upload buttons - reorganized SmartHop style */}
      {isArrived && (
        <div className={`rounded-lg border-2 p-3 space-y-3 transition-colors ${isComplete ? 'border-success/40 bg-success/5' : 'border-dashed border-muted-foreground/25'}`}>
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              {stop.stop_type === 'pickup' ? 'BOL / Load Pictures' : 'Proof of Delivery'}
            </p>
            {isComplete && <CheckCircle2 className="h-4 w-4 text-success" />}
          </div>

          {/* Upload skeleton when uploading */}
          {uploading && (
            <div className="flex gap-2">
              <Skeleton className="w-20 h-20 rounded-lg" />
              <div className="space-y-2 flex-1">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-3 w-16" />
              </div>
            </div>
          )}

          {/* Document thumbnails grid - 80x80 */}
          {stopPods.length > 0 && (
            <div className="grid grid-cols-4 gap-2">
              {stopPods.map((doc, idx) => (
                <div key={doc.id} className="relative group">
                  <button
                    onClick={() => setPreviewIndex(idx)}
                    type="button"
                    className="w-full"
                  >
                    <div className="w-full aspect-square rounded-lg border overflow-hidden bg-muted flex items-center justify-center shadow-sm hover:shadow-md transition-shadow">
                      {resolvedUrls[doc.id] && isImageDoc(doc) ? (
                        <img src={resolvedUrls[doc.id]} alt={doc.file_name} className="w-full h-full object-cover" />
                      ) : resolvingUrls ? (
                        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                      ) : (
                        <FileText className="h-6 w-6 text-muted-foreground" />
                      )}
                    </div>
                  </button>
                  {/* File name */}
                  <p className="text-[10px] text-muted-foreground text-center mt-1 truncate leading-tight">
                    {truncateName(doc.file_name)}
                  </p>
                  {/* Timestamp */}
                  {(doc as any).created_at && (
                    <p className="text-[9px] text-muted-foreground/60 text-center leading-tight">
                      {format(new Date((doc as any).created_at), 'h:mm a')}
                    </p>
                  )}
                  {/* Delete button - visible on touch/hover */}
                  <button
                    type="button"
                    className="absolute -top-1.5 -right-1.5 bg-destructive text-destructive-foreground rounded-full w-5 h-5 flex items-center justify-center shadow-md opacity-0 group-hover:opacity-100 group-active:opacity-100 transition-opacity"
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteDoc(doc as any);
                    }}
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Upload action buttons */}
          <div className="grid grid-cols-2 gap-2">
            {/* Camera button */}
            {isNativeCamera() ? (
              <button onClick={handleNativeCamera} disabled={uploading} type="button">
                <div className="flex items-center justify-center gap-1.5 h-10 rounded-lg bg-info/10 text-info border border-info/20 text-sm font-medium hover:bg-info/20 transition-colors">
                  <Camera className="h-4 w-4" />
                  <span>Camera</span>
                </div>
              </button>
            ) : (
              <label className="cursor-pointer">
                <div className="flex items-center justify-center gap-1.5 h-10 rounded-lg bg-info/10 text-info border border-info/20 text-sm font-medium hover:bg-info/20 transition-colors">
                  <Camera className="h-4 w-4" />
                  <span>Camera</span>
                </div>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFileUpload}
                  disabled={uploading}
                />
              </label>
            )}

            {/* Gallery button */}
            {isNativeCamera() ? (
              <button onClick={handleNativeGallery} disabled={uploading} type="button">
                <div className="flex items-center justify-center gap-1.5 h-10 rounded-lg bg-muted text-muted-foreground border border-border text-sm font-medium hover:bg-muted/80 transition-colors">
                  <ImagePlus className="h-4 w-4" />
                  <span>Gallery</span>
                </div>
              </button>
            ) : (
              <label className="cursor-pointer">
                <div className="flex items-center justify-center gap-1.5 h-10 rounded-lg bg-muted text-muted-foreground border border-border text-sm font-medium hover:bg-muted/80 transition-colors">
                  <ImagePlus className="h-4 w-4" />
                  <span>Gallery</span>
                </div>
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  multiple
                  className="hidden"
                  onChange={handleFileUpload}
                  disabled={uploading}
                />
              </label>
            )}

            {/* Hidden fallback inputs for native camera/gallery errors */}
            <input ref={cameraFallbackRef} type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
            <input ref={galleryFallbackRef} type="file" accept="image/*,application/pdf" multiple className="hidden" onChange={handleFileUpload} />
          </div>

          {/* Scanner button - all platforms */}
          <Button
            variant="outline"
            size="sm"
            className="w-full gap-1.5 text-sm border-primary/30 text-primary hover:bg-primary/5"
            onClick={() => setScannerOpen(true)}
          >
            <ScanLine className="h-4 w-4" />
            {stop.stop_type === 'pickup' ? 'Scan BOL Document' : 'Scan POD Document'}
          </Button>
        </div>
      )}

      {/* Status change buttons */}
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

      {/* Inline Preview Overlay */}
      {previewIndex !== null && stopPods[previewIndex] && (
        <div className="fixed inset-0 z-50 bg-black/90 flex flex-col items-center justify-center" onClick={() => setPreviewIndex(null)}>
          {/* Close button */}
          <button className="absolute top-4 right-4 text-white p-2 z-10" onClick={() => setPreviewIndex(null)}>
            <X className="h-6 w-6" />
          </button>

          {/* Delete button in preview */}
          <button
            className="absolute top-4 left-4 text-white p-2 z-10 bg-destructive/80 rounded-full"
            onClick={(e) => {
              e.stopPropagation();
              setDeleteDoc(stopPods[previewIndex] as any);
              setPreviewIndex(null);
            }}
          >
            <Trash2 className="h-5 w-5" />
          </button>

          {/* Image */}
          <div className="flex-1 flex items-center justify-center w-full px-4" onClick={e => e.stopPropagation()}>
            {resolvedUrls[stopPods[previewIndex].id] && isImageDoc(stopPods[previewIndex]) ? (
              <img
                src={resolvedUrls[stopPods[previewIndex].id]}
                alt={stopPods[previewIndex].file_name}
                className="max-w-full max-h-[75vh] object-contain rounded-lg"
              />
            ) : resolvedUrls[stopPods[previewIndex].id] ? (
              <div className="text-white text-center space-y-2" onClick={e => e.stopPropagation()}>
                <FileText className="h-16 w-16 mx-auto opacity-60" />
                <p className="text-sm">{stopPods[previewIndex].file_name}</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-white border-white/30"
                  onClick={() => handleOpenPod(stopPods[previewIndex])}
                >
                  Open File
                </Button>
              </div>
            ) : (
              <div className="text-white text-center space-y-2">
                <Loader2 className="h-10 w-10 animate-spin mx-auto opacity-60" />
                <p className="text-sm">Loading...</p>
              </div>
            )}
          </div>

          {/* Nav arrows */}
          {stopPods.length > 1 && (
            <>
              {previewIndex > 0 && (
                <button
                  className="absolute left-2 top-1/2 -translate-y-1/2 bg-white/20 backdrop-blur rounded-full p-2"
                  onClick={e => { e.stopPropagation(); setPreviewIndex(previewIndex - 1); }}
                >
                  <ChevronLeft className="h-6 w-6 text-white" />
                </button>
              )}
              {previewIndex < stopPods.length - 1 && (
                <button
                  className="absolute right-2 top-1/2 -translate-y-1/2 bg-white/20 backdrop-blur rounded-full p-2"
                  onClick={e => { e.stopPropagation(); setPreviewIndex(previewIndex + 1); }}
                >
                  <ChevronRight className="h-6 w-6 text-white" />
                </button>
              )}
            </>
          )}

          {/* Counter + timestamp */}
          <div className="text-white text-center py-3 space-y-0.5">
            <p className="text-sm font-medium">{previewIndex + 1} / {stopPods.length}</p>
            {(stopPods[previewIndex] as any).created_at && (
              <p className="text-xs text-white/60">{format(new Date((stopPods[previewIndex] as any).created_at), 'MMM dd, h:mm a')}</p>
            )}
          </div>
        </div>
      )}

      {/* Delete confirmation dialog */}
      <AlertDialog open={!!deleteDoc} onOpenChange={(open) => { if (!open) setDeleteDoc(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete document?</AlertDialogTitle>
            <AlertDialogDescription>
              "{deleteDoc?.file_name}" will be permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async () => {
                if (deleteDoc) {
                  await handleDeletePod(deleteDoc);
                  setDeleteDoc(null);
                }
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
