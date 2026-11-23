import { useState, useEffect, useCallback, useRef } from 'react';
import { MapPin, Navigation, Camera, Check, Clock, Image, Loader2, Trash2, PackageCheck, CheckCircle2, ImagePlus, ScanLine, ChevronLeft, ChevronRight, X, FileText } from 'lucide-react';
import { DocumentScanner } from './DocumentScanner';
import { openUrl } from '@/lib/openUrl';
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
  /** Dispatch Service no manda avisos al broker desde la app */
  hideBrokerButton?: boolean;
  /** Siguiente parada pendiente (se resalta) */
  isCurrent?: boolean;
}

export const StopCard = ({ stop, loadRef, driverName, onUpdate, podDocuments, loadStatus, isLastDelivery, hideBrokerButton, isCurrent }: StopCardProps) => {
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
    // Solo si la llegada no estaba marcada: el GPS puede haberla marcado mientras el botón seguía en pantalla
    const { data: updated, error } = await supabase
      .from('load_stops')
      .update({ arrived_at: new Date().toISOString() } as any)
      .eq('id', stop.id)
      .is('arrived_at', null)
      .select('id');

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else if (!updated?.length) {
      toast({ title: 'Arrived!' });
      hapticFeedback('success');
      onUpdate();
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
  const [sendingBroker, setSendingBroker] = useState(false);
  const [brokerSent, setBrokerSent] = useState<boolean | null>(null);

  // Si esta parada ya se le avisó al broker, el botón no vuelve a aparecer en la app.
  // Para reenviar está el botón del TMS.
  useEffect(() => {
    let cancelled = false;
    supabase
      .from('broker_email_queue' as any)
      .select('id')
      .eq('load_id', stop.load_id)
      .eq('kind', 'docs')
      .eq('stop_type', stop.stop_type)
      .eq('stop_order', stop.stop_order)
      .eq('status', 'sent')
      .limit(1)
      .then(({ data }) => { if (!cancelled) setBrokerSent(((data as any[]) || []).length > 0); });
    return () => { cancelled = true; };
  }, [stop.load_id, stop.stop_type, stop.stop_order]);

  // Manda al broker las fotos y el BOL/POD de esta parada, dentro del hilo de la carga
  const handleSendBroker = async () => {
    setSendingBroker(true);
    try {
      const { data, error } = await supabase.functions.invoke('broker-email', {
        body: { action: 'send_stop', load_id: stop.load_id, stop_id: stop.id },
      });
      if (error || data?.error) throw new Error(data?.error || error?.message);
      const result = data?.result ?? {};
      if (result.status === 'sent') {
        setBrokerSent(true);
      } else if (result.status === 'waiting_thread') {
        toast({ title: 'Sent to dispatch', description: 'The email thread is not linked yet; dispatch will send it.' });
      } else {
        toast({ title: 'Not sent', description: result.error || 'Contact dispatch', variant: 'destructive' });
      }
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally {
      setSendingBroker(false);
    }
  };

  // Un solo botón por parada: cambia el estado de la carga (Picked Up / Delivered) y manda los documentos al broker
  const nextStatus: 'picked_up' | 'delivered' | null =
    stop.stop_type === 'pickup'
      ? (['picked_up', 'on_site_delivery', 'delivered', 'paid'].includes(loadStatus ?? '') ? null : 'picked_up')
      : (isLastDelivery && !['delivered', 'paid'].includes(loadStatus ?? '') ? 'delivered' : null);
  const brokerPending = brokerSent === false && !hideBrokerButton;
  const showComplete = isArrived && (nextStatus !== null || brokerPending);

  const handleComplete = async () => {
    if (stopPods.length === 0) {
      toast({
        title: stop.stop_type === 'pickup' ? 'Upload the pictures and BOL first' : 'Upload the pictures and POD first',
        variant: 'destructive',
      });
      return;
    }
    setChangingStatus(true);
    try {
      if (nextStatus) {
        const changes = nextStatus === 'delivered' ? { status: 'delivered', factoring: 'pending' } : { status: 'picked_up' };
        const { error } = await supabase.from('loads').update(changes as any).eq('id', stop.load_id);
        if (error) throw error;
        await createNotification({
          type: 'status_changed',
          title: `${nextStatus === 'delivered' ? 'Delivered' : 'Picked Up'} - ${driverName}`,
          message: `${driverName} ${nextStatus === 'delivered' ? 'delivered' : 'picked up'} at ${stop.address} (Load #${loadRef})`,
          load_id: stop.load_id,
        });
      }
      // Hora de salida de la parada (detention). Si ya la puso el GPS, no se toca.
      await supabase.from('load_stops').update({ departed_at: new Date().toISOString() } as any)
        .eq('id', stop.id).is('departed_at' as any, null);
      // Si el email falla, el estado ya quedó cambiado: dispatch lo reenvía desde el TMS
      if (brokerPending) await handleSendBroker();
      toast({ title: stop.stop_type === 'pickup' ? 'Pick up completed' : 'Delivery completed' });
      hapticFeedback('success');
      onUpdate();
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally {
      setChangingStatus(false);
    }
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
      title: `${stop.stop_type === 'pickup' ? 'Pick Up Picture' : 'Delivery Picture'} - ${driverName}`,
      message: `${driverName} uploaded a ${stop.stop_type === 'pickup' ? 'Pick Up Picture' : 'Delivery Picture'} at ${stop.address} (Load #${loadRef})`,
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
        const prefix = stop.stop_type === 'pickup' ? 'PIC' : 'DEL';
        const imgCount = stopPods.filter(p => p.file_type === 'image' || p.file_name?.match(/\.(jpg|jpeg|png)/i)).length + 1;
        await uploadDataUrl(dataUrl, `${prefix} #${loadRef} ${imgCount}.jpg`);
      }
    } catch (err: any) {
      console.error('Native camera failed:', err);
      if (err?.message?.includes('PERMISSION_DENIED')) {
        toast({ title: 'Permiso de cámara denegado', description: 'Habilítalo en Configuración > Privacidad > Cámara.', variant: 'destructive' });
      } else {
        // Fallback silencioso al selector del sistema
        cameraFallbackRef.current?.click();
      }
    }
  };

  const handleNativeGallery = async () => {
    try {
      const urls = await pickFromGallery();
      const prefix = stop.stop_type === 'pickup' ? 'PIC' : 'DEL';
      let imgCount = stopPods.filter(p => p.file_type === 'image' || p.file_name?.match(/\.(jpg|jpeg|png)/i)).length;
      for (const dataUrl of urls) {
        imgCount++;
        await uploadDataUrl(dataUrl, `${prefix} #${loadRef} ${imgCount}.jpg`);
      }
    } catch (err: any) {
      console.error('Native gallery failed:', err);
      if (err?.message?.includes('PERMISSION_DENIED')) {
        toast({ title: 'Permiso de fotos denegado', description: 'Habilítalo en Configuración > Privacidad > Fotos.', variant: 'destructive' });
      } else {
        // Fallback silencioso al selector del sistema
        galleryFallbackRef.current?.click();
      }
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploading(true);

    const tenant_id = await getTenantId();
    const prefix = stop.stop_type === 'pickup' ? 'PIC' : 'DEL';
    let imgCount = stopPods.filter(p => p.file_type === 'image' || p.file_name?.match(/\.(jpg|jpeg|png)/i)).length;

    for (const file of Array.from(files)) {
      const isImage = file.type.startsWith('image/');
      const compressed = isImage ? await compressImage(file) : file;
      const ext = isImage ? 'jpg' : file.name.split('.').pop();
      const filePath = `pods/${stop.load_id}/${stop.id}_${Date.now()}.${ext}`;

      // Nombre descriptivo: PIC/DEL para imágenes, BOL/POD para PDFs
      let descriptiveName: string;
      if (isImage) {
        imgCount++;
        descriptiveName = `${prefix} #${loadRef} ${imgCount}.jpg`;
      } else {
        descriptiveName = `${stop.stop_type === 'pickup' ? 'BOL' : 'POD'} #${loadRef}.pdf`;
      }

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
        file_name: descriptiveName,
        file_url: filePath,
        file_type: file.type.startsWith('image/') ? 'image' : 'pdf',
        tenant_id,
      } as any);

      const docLabel = stop.stop_type === 'pickup'
        ? (isImage ? 'Pick Up Picture' : 'Scanned BOL')
        : (isImage ? 'Delivery Picture' : 'Scanned POD');

      await createNotification({
        type: 'pod_uploaded',
        title: `${docLabel} - ${driverName}`,
        message: `${driverName} uploaded a ${docLabel} at ${stop.address} (Load #${loadRef})`,
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

  const isPickup = stop.stop_type === 'pickup';
  const stopTime = (stop as any).time as string | null | undefined;
  const docLabel = isPickup ? 'BOL / Load pictures' : 'Proof of delivery';
  const tonalBtn = 'flex items-center justify-center gap-2 h-12 w-full rounded-full bg-[#d3e3fd] text-[#041e49] text-sm font-medium active:bg-[#c2d7fb] transition-colors';

  return (
    <div className={`rounded-[24px] bg-white p-4 space-y-3 ${isCurrent ? 'ring-2 ring-[#0b57d0]/40' : ''}`}>
      {/* Encabezado */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`px-2.5 h-6 inline-flex items-center rounded-full text-[11px] font-medium ${isPickup ? 'bg-[#c4eed0] text-[#0d652d]' : 'bg-[#f9dedc] text-[#8c1d18]'}`}>
              {isPickup ? 'Pick up' : 'Delivery'}
            </span>
            {isCurrent && !isArrived && <span className="text-[11px] font-medium text-[#0b57d0]">Next stop</span>}
          </div>
          <p className="text-base font-medium text-[#1f1f1f] mt-1.5">{stop.address}</p>
          {(stop.date || stopTime) && (
            <p className="text-sm text-[#444746] mt-0.5">
              {stop.date ? format(new Date(stop.date + (stop.date.length === 10 ? 'T12:00:00' : '')), 'EEE, MMM d') : ''}
              {stop.date && stopTime ? ' · ' : ''}{stopTime || ''}
            </p>
          )}
        </div>
        {isArrived && (
          <span className="flex-shrink-0 px-2.5 h-7 inline-flex items-center gap-1 rounded-full bg-[#c4eed0] text-[#0d652d] text-xs font-medium">
            <Check className="h-3.5 w-3.5" /> {format(new Date(stop.arrived_at!), 'h:mm a')}
          </span>
        )}
      </div>

      {/* Acciones: navegar + llegué */}
      {!isArrived ? (
        <div className="flex gap-2">
          <button type="button" onClick={() => openUrl(googleMapsUrl)}
            className="flex-1 flex items-center justify-center gap-2 h-12 rounded-full border border-[#747775] text-[#0b57d0] text-sm font-medium active:bg-[#e8f0fe]">
            <Navigation className="h-4 w-4" /> Navigate
          </button>
          <button type="button" onClick={handleArrived} disabled={arriving}
            className="flex-1 flex items-center justify-center gap-2 h-12 rounded-full bg-[#0b57d0] text-white text-sm font-medium active:bg-[#0842a0] disabled:opacity-60">
            {arriving ? <Loader2 className="h-4 w-4 animate-spin" /> : <MapPin className="h-4 w-4" />}
            {arriving ? 'Marking...' : 'I arrived'}
          </button>
        </div>
      ) : (
        <button type="button" onClick={() => openUrl(googleMapsUrl)} className="inline-flex items-center gap-1.5 text-sm font-medium text-[#0b57d0]">
          <Navigation className="h-4 w-4" /> Navigate
        </button>
      )}

      {/* Fotos / documentos: cuadrícula que marca lo que falta */}
      {isArrived && (
        <div className="rounded-[20px] bg-[#f0f4f9] p-3 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-[#1f1f1f]">{docLabel}</p>
            {isComplete ? (
              <span className="px-2.5 h-6 inline-flex items-center gap-1 rounded-full bg-[#c4eed0] text-[#0d652d] text-[11px] font-medium">
                <CheckCircle2 className="h-3.5 w-3.5" /> {stopPods.length} uploaded
              </span>
            ) : (
              <span className="px-2.5 h-6 inline-flex items-center rounded-full bg-[#f9dedc] text-[#8c1d18] text-[11px] font-medium">Missing</span>
            )}
          </div>

          <div className="grid grid-cols-3 gap-2">
            {stopPods.map((doc, idx) => (
              <div key={doc.id} className="relative group">
                <button onClick={() => setPreviewIndex(idx)} type="button" className="w-full block">
                  <div className="w-full aspect-square rounded-2xl overflow-hidden bg-white flex items-center justify-center">
                    {resolvedUrls[doc.id] && isImageDoc(doc) ? (
                      <img src={resolvedUrls[doc.id]} alt={doc.file_name} className="w-full h-full object-cover" />
                    ) : resolvingUrls ? (
                      <Loader2 className="h-5 w-5 animate-spin text-[#444746]" />
                    ) : (
                      <FileText className="h-6 w-6 text-[#444746]" />
                    )}
                  </div>
                </button>
                {(doc as any).created_at && (
                  <p className="text-[10px] text-[#444746] text-center mt-1 leading-tight">
                    {format(new Date((doc as any).created_at), 'h:mm a')}
                  </p>
                )}
                <button
                  type="button"
                  aria-label="Delete"
                  className="absolute top-1 right-1 bg-black/55 text-white rounded-full w-6 h-6 flex items-center justify-center opacity-0 group-hover:opacity-100 group-active:opacity-100 transition-opacity"
                  onClick={(e) => { e.stopPropagation(); setDeleteDoc(doc as any); }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
            {uploading && <Skeleton className="w-full aspect-square rounded-2xl" />}
            {/* Casilla vacía que indica lo que falta */}
            {stopPods.length === 0 && !uploading && (
              <button type="button" onClick={() => setScannerOpen(true)}
                className="w-full aspect-square rounded-2xl border-2 border-dashed border-[#c4c7c5] flex flex-col items-center justify-center gap-1 text-[#444746]">
                <ScanLine className="h-6 w-6" />
                <span className="text-[10px] font-medium">{isPickup ? 'BOL' : 'POD'}</span>
              </button>
            )}
          </div>

          <button
            type="button"
            className="flex items-center justify-center gap-2 h-12 w-full rounded-full bg-[#0b57d0] text-white text-sm font-medium active:bg-[#0842a0]"
            onClick={() => setScannerOpen(true)}
          >
            <ScanLine className="h-5 w-5" />
            {isPickup ? 'Scan BOL' : 'Scan POD'}
          </button>

          <div className="grid grid-cols-2 gap-2">
            {isNativeCamera() ? (
              <button onClick={handleNativeCamera} disabled={uploading} type="button" className={tonalBtn}>
                <Camera className="h-4 w-4" /> Camera
              </button>
            ) : (
              <label className={`${tonalBtn} cursor-pointer`}>
                <Camera className="h-4 w-4" /> Camera
                <input type="file" accept="image/*" className="hidden" onChange={handleFileUpload} disabled={uploading} />
              </label>
            )}
            {isNativeCamera() ? (
              <button onClick={handleNativeGallery} disabled={uploading} type="button" className={tonalBtn}>
                <ImagePlus className="h-4 w-4" /> Gallery
              </button>
            ) : (
              <label className={`${tonalBtn} cursor-pointer`}>
                <ImagePlus className="h-4 w-4" /> Gallery
                <input type="file" accept="image/*,application/pdf" multiple className="hidden" onChange={handleFileUpload} disabled={uploading} />
              </label>
            )}
            {/* Hidden fallback inputs for native camera/gallery errors */}
            <input ref={cameraFallbackRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFileUpload} />
            <input ref={galleryFallbackRef} type="file" accept="image/*,application/pdf" multiple className="hidden" onChange={handleFileUpload} />
          </div>
        </div>
      )}

      {/* Parada completada: estado de la carga + documentos al broker */}
      {showComplete && (
        <button
          type="button"
          className="flex items-center justify-center gap-2 h-14 w-full rounded-full bg-[#1e8e3e] text-white text-base font-medium active:bg-[#137333] disabled:opacity-60"
          onClick={handleComplete}
          disabled={changingStatus || sendingBroker}
        >
          {changingStatus ? <Loader2 className="h-5 w-5 animate-spin" /> : isPickup ? <PackageCheck className="h-5 w-5" /> : <CheckCircle2 className="h-5 w-5" />}
          {changingStatus ? 'Updating...' : isPickup ? 'Pick up completed' : 'Delivery completed'}
        </button>
      )}

      {/* Inline Preview Overlay */}
      {previewIndex !== null && stopPods[previewIndex] && (
        <div className="fixed inset-0 z-50 bg-black/90 flex flex-col items-center justify-center" onClick={() => setPreviewIndex(null)}>
          <button className="absolute top-4 right-4 text-white p-2 z-10" style={{ marginTop: 'env(safe-area-inset-top, 0px)' }} onClick={() => setPreviewIndex(null)}>
            <X className="h-6 w-6" />
          </button>

          <button
            className="absolute top-4 left-4 text-white p-2 z-10 bg-[#b3261e]/80 rounded-full"
            style={{ marginTop: 'env(safe-area-inset-top, 0px)' }}
            onClick={(e) => {
              e.stopPropagation();
              setDeleteDoc(stopPods[previewIndex] as any);
              setPreviewIndex(null);
            }}
          >
            <Trash2 className="h-5 w-5" />
          </button>

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
                <button
                  type="button"
                  className="h-10 px-5 rounded-full bg-white text-[#1f1f1f] text-sm font-medium"
                  onClick={() => handleOpenPod(stopPods[previewIndex])}
                >
                  Open File
                </button>
              </div>
            ) : (
              <div className="text-white text-center space-y-2">
                <Loader2 className="h-10 w-10 animate-spin mx-auto opacity-60" />
                <p className="text-sm">Loading...</p>
              </div>
            )}
          </div>

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

          <div className="text-white text-center py-3 space-y-0.5" style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 12px)' }}>
            <p className="text-sm font-medium">{previewIndex + 1} / {stopPods.length}</p>
            {(stopPods[previewIndex] as any).created_at && (
              <p className="text-xs text-white/60">{format(new Date((stopPods[previewIndex] as any).created_at), 'MMM dd, h:mm a')}</p>
            )}
          </div>
        </div>
      )}

      {/* Delete confirmation dialog */}
      <AlertDialog open={!!deleteDoc} onOpenChange={(open) => { if (!open) setDeleteDoc(null); }}>
        <AlertDialogContent className="rounded-[28px]">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete document?</AlertDialogTitle>
            <AlertDialogDescription>
              "{deleteDoc?.file_name}" will be permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-full">Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="rounded-full bg-[#b3261e] text-white hover:bg-[#8c1d18]"
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
