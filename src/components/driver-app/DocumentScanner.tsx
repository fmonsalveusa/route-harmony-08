import { useState, useRef, useCallback } from 'react';
import { X, Upload, RotateCcw, Contrast, ScanLine, Camera, ImageIcon, Zap, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { getTenantId } from '@/hooks/useTenantId';
import { createNotification } from '@/hooks/useNotifications';
import { toast } from '@/hooks/use-toast';
import { EdgeCropOverlay } from './EdgeCropOverlay';
import { perspectiveTransform, type Corners } from '@/lib/perspectiveTransform';
import { compressImage, compressDataUrl } from '@/lib/imageCompression';
import {
  enhanceImage,
  resizeForCrop,
  resizeForDetection,
  fileToDataUrl,
  dataUrlToBlob,
} from '@/lib/scannerImageUtils';

interface ScannedPage {
  original: string;
  enhanced: string | null;
  showEnhanced: boolean;
}

interface DocumentScannerProps {
  open: boolean;
  onClose: () => void;
  stop: {
    id: string;
    load_id: string;
    stop_type: string;
    address: string;
  };
  loadRef: string;
  driverName: string;
  onUpdate: () => void;
}

const DEFAULT_CORNERS: Corners = {
  topLeft: { x: 0.05, y: 0.05 },
  topRight: { x: 0.95, y: 0.05 },
  bottomRight: { x: 0.95, y: 0.95 },
  bottomLeft: { x: 0.05, y: 0.95 },
};

export const DocumentScanner = ({ open, onClose, stop, loadRef, driverName, onUpdate }: DocumentScannerProps) => {
  const [pages, setPages] = useState<ScannedPage[]>([]);
  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const [uploading, setUploading] = useState(false);
  const [enhancing, setEnhancing] = useState(false);
  const [processing, setProcessing] = useState(false);

  // Edge detection state
  const [cropImage, setCropImage] = useState<string | null>(null);
  const [cropCorners, setCropCorners] = useState<Corners>(DEFAULT_CORNERS);
  const [detecting, setDetecting] = useState(false);

  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const directRef = useRef<HTMLInputElement>(null);

  const docLabel = stop.stop_type === 'pickup' ? 'BOL' : 'POD';

  // ─── Upload a single file directly (no processing) ───
  const uploadFileDirect = useCallback(
    async (file: File) => {
      setUploading(true);
      const tenant_id = await getTenantId();

      try {
        const compressed = await compressImage(file, { maxDimension: 1600, quality: 0.80 });
        const fileName = `direct_${Date.now()}.jpg`;
        const filePath = `pods/${stop.load_id}/${stop.id}_${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('driver-documents')
          .upload(filePath, compressed, { contentType: 'image/jpeg' });

        if (uploadError) {
          toast({ title: 'Error', description: uploadError.message, variant: 'destructive' });
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
          title: `${docLabel} subido`,
          message: `${driverName} subió ${docLabel} directo en ${stop.address} (Load ${loadRef})`,
          load_id: stop.load_id,
        });

        toast({ title: `${docLabel} subido correctamente` });
        onUpdate();
        onClose();
      } catch (err) {
        console.error('Direct upload failed:', err);
        toast({ title: 'Error al subir', variant: 'destructive' });
      } finally {
        setUploading(false);
      }
    },
    [stop, docLabel, driverName, loadRef, onUpdate, onClose]
  );

  // ─── Edge detection ───
  const detectEdges = useCallback(async (dataUrl: string) => {
    setDetecting(true);
    try {
      const small = await resizeForDetection(dataUrl);
      const { data, error } = await supabase.functions.invoke('detect-document-edges', {
        body: { image: small },
      });
      if (!error && data?.corners) {
        setCropCorners(data.corners);
      }
    } catch (err) {
      console.error('Edge detection failed:', err);
    } finally {
      setDetecting(false);
    }
  }, []);

  // ─── Full pipeline capture (camera/gallery) ───
  const handleCapture = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      setProcessing(true);
      e.target.value = '';

      try {
        const rawDataUrl = await fileToDataUrl(file);
        const dataUrl = await resizeForCrop(rawDataUrl);
        setCropImage(dataUrl);
        setCropCorners({ ...DEFAULT_CORNERS });
        setProcessing(false);
        detectEdges(dataUrl);
      } catch (err) {
        console.error('Error processing image:', err);
        // Fallback: upload directly if pipeline fails
        toast({ title: 'Pipeline falló, subiendo directo...', description: 'El procesamiento de imagen no funcionó en este dispositivo.' });
        setProcessing(false);
        await uploadFileDirect(file);
      }
    },
    [detectEdges, uploadFileDirect]
  );

  // ─── Direct upload handler ───
  const handleDirectCapture = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      e.target.value = '';
      await uploadFileDirect(file);
    },
    [uploadFileDirect]
  );

  const handleCropConfirm = useCallback(
    async (corners: Corners) => {
      if (!cropImage) return;
      const cropped = await perspectiveTransform(cropImage, corners);
      const enhanced = await enhanceImage(cropped);
      setPages((prev) => {
        const next = [...prev, { original: cropped, enhanced, showEnhanced: true }];
        setSelectedIndex(next.length - 1);
        return next;
      });
      setCropImage(null);
    },
    [cropImage]
  );

  const handleCropSkip = useCallback(async () => {
    if (!cropImage) return;
    const enhanced = await enhanceImage(cropImage);
    setPages((prev) => {
      const next = [...prev, { original: cropImage, enhanced, showEnhanced: true }];
      setSelectedIndex(next.length - 1);
      return next;
    });
    setCropImage(null);
  }, [cropImage]);

  const triggerCamera = () => cameraRef.current?.click();
  const triggerGallery = () => fileRef.current?.click();
  const triggerDirect = () => directRef.current?.click();

  const handleEnhance = async () => {
    if (pages.length === 0) return;
    const page = pages[selectedIndex];
    if (page.enhanced) {
      setPages((prev) => prev.map((p, i) => (i === selectedIndex ? { ...p, showEnhanced: !p.showEnhanced } : p)));
      return;
    }
    setEnhancing(true);
    const enhanced = await enhanceImage(page.original);
    setPages((prev) => prev.map((p, i) => (i === selectedIndex ? { ...p, enhanced, showEnhanced: true } : p)));
    setEnhancing(false);
  };

  const handleRetake = () => {
    setPages((prev) => prev.filter((_, i) => i !== selectedIndex));
    setSelectedIndex((i) => Math.max(0, i - 1));
    triggerCamera();
  };

  const handleDeletePage = (idx: number) => {
    setPages((prev) => prev.filter((_, i) => i !== idx));
    setSelectedIndex((i) => Math.min(i, pages.length - 2));
  };

  const handleUploadAll = async () => {
    if (pages.length === 0) return;
    setUploading(true);
    const tenant_id = await getTenantId();

    for (let i = 0; i < pages.length; i++) {
      const page = pages[i];
      const rawSrc = page.showEnhanced && page.enhanced ? page.enhanced : page.original;
      const src = await compressDataUrl(rawSrc);
      const blob = dataUrlToBlob(src);
      const fileName = `scan_${Date.now()}_p${i + 1}.jpg`;
      const filePath = `pods/${stop.load_id}/${stop.id}_${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('driver-documents')
        .upload(filePath, blob, { contentType: 'image/jpeg' });

      if (uploadError) {
        toast({ title: 'Error', description: uploadError.message, variant: 'destructive' });
        continue;
      }

      await supabase.from('pod_documents').insert({
        load_id: stop.load_id,
        stop_id: stop.id,
        file_name: fileName,
        file_url: filePath,
        file_type: 'image',
        tenant_id,
      } as any);
    }

    await createNotification({
      type: 'pod_uploaded',
      title: `${docLabel} escaneado`,
      message: `${driverName} escaneó ${pages.length} pág(s) de ${docLabel} en ${stop.address} (Load ${loadRef})`,
      load_id: stop.load_id,
    });

    toast({ title: `${pages.length} página(s) subida(s)` });
    setPages([]);
    setSelectedIndex(0);
    setUploading(false);
    onUpdate();
    onClose();
  };

  const handleClose = () => {
    setPages([]);
    setSelectedIndex(0);
    setCropImage(null);
    onClose();
  };

  if (!open) return null;

  // Processing overlay
  if (processing) {
    return (
      <div className="fixed inset-0 z-[100] bg-black flex flex-col items-center justify-center gap-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
        <p className="text-white text-sm">Procesando imagen...</p>
      </div>
    );
  }

  // Uploading overlay
  if (uploading && pages.length === 0) {
    return (
      <div className="fixed inset-0 z-[100] bg-black flex flex-col items-center justify-center gap-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
        <p className="text-white text-sm">Subiendo documento...</p>
      </div>
    );
  }

  // Crop overlay
  if (cropImage) {
    return (
      <EdgeCropOverlay
        imageUrl={cropImage}
        corners={cropCorners}
        detecting={detecting}
        onConfirm={handleCropConfirm}
        onSkip={handleCropSkip}
      />
    );
  }

  const currentPage = pages[selectedIndex];
  const currentSrc = currentPage
    ? currentPage.showEnhanced && currentPage.enhanced
      ? currentPage.enhanced
      : currentPage.original
    : null;

  return (
    <div className="fixed inset-0 z-[100] bg-black flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-black/90">
        <h2 className="text-white font-semibold text-sm">
          Escanear {docLabel} ({pages.length} pág.)
        </h2>
        <button onClick={handleClose} className="text-white/70 hover:text-white">
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Preview area */}
      <div className="flex-1 flex items-center justify-center overflow-hidden bg-black">
        {currentSrc ? (
          <img src={currentSrc} alt={`Página ${selectedIndex + 1}`} className="max-w-full max-h-full object-contain" />
        ) : (
          <div className="text-center text-white/50 space-y-4 px-6">
            <ScanLine className="h-16 w-16 mx-auto" />
            <p className="text-sm">Toca un botón para escanear o subir</p>
            <div className="flex items-start gap-2 bg-white/5 rounded-lg p-3 text-left">
              <Info className="h-4 w-4 mt-0.5 flex-shrink-0 text-primary" />
              <p className="text-xs text-white/60">
                <strong className="text-white/80">Tip:</strong> Para mejor calidad, escanea con tu app de cámara (Google, Samsung) o Adobe Scan, y luego usa <strong className="text-white/80">Galería</strong>. Si tienes problemas, usa <strong className="text-white/80">Subir directo</strong>.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Thumbnail strip */}
      {pages.length > 0 && (
        <div className="flex gap-2 px-4 py-2 bg-black/90 overflow-x-auto">
          {pages.map((p, i) => (
            <div key={i} className="relative flex-shrink-0">
              <button
                onClick={() => setSelectedIndex(i)}
                className={`w-14 h-14 rounded-lg overflow-hidden border-2 ${i === selectedIndex ? 'border-primary' : 'border-white/20'}`}
              >
                <img src={p.showEnhanced && p.enhanced ? p.enhanced : p.original} className="w-full h-full object-cover" />
              </button>
              <button
                onClick={() => handleDeletePage(i)}
                className="absolute -top-1 -right-1 bg-destructive rounded-full p-0.5"
              >
                <X className="h-3 w-3 text-white" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-wrap gap-2 px-4 py-3 bg-black/90 justify-center">
        <Button variant="outline" size="sm" onClick={triggerCamera}
          className="gap-1.5 text-xs bg-white/10 border-white/20 text-white hover:bg-white/20">
          <Camera className="h-4 w-4" />
          {pages.length === 0 ? 'Cámara' : '+ Cámara'}
        </Button>

        <Button variant="outline" size="sm" onClick={triggerGallery}
          className="gap-1.5 text-xs bg-white/10 border-white/20 text-white hover:bg-white/20">
          <ImageIcon className="h-4 w-4" />
          {pages.length === 0 ? 'Galería' : '+ Galería'}
        </Button>

        {/* Direct upload - skips all processing */}
        <Button variant="outline" size="sm" onClick={triggerDirect} disabled={uploading}
          className="gap-1.5 text-xs bg-primary/20 border-primary/40 text-primary hover:bg-primary/30">
          <Zap className="h-4 w-4" />
          Subir directo
        </Button>

        {currentPage && (
          <>
            <Button variant="outline" size="sm" onClick={handleEnhance} disabled={enhancing}
              className="gap-1.5 text-xs bg-white/10 border-white/20 text-white hover:bg-white/20">
              <Contrast className="h-4 w-4" />
              {enhancing ? 'Mejorando...' : currentPage.showEnhanced ? 'Ver original' : 'Mejorar'}
            </Button>
            <Button variant="outline" size="sm" onClick={handleRetake}
              className="gap-1.5 text-xs bg-white/10 border-white/20 text-white hover:bg-white/20">
              <RotateCcw className="h-4 w-4" /> Re-tomar
            </Button>
          </>
        )}

        {pages.length > 0 && (
          <Button size="sm" onClick={handleUploadAll} disabled={uploading} className="gap-1.5 text-xs">
            <Upload className="h-4 w-4" />
            {uploading ? 'Subiendo...' : `Subir todo (${pages.length})`}
          </Button>
        )}
      </div>

      {/* Camera input */}
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleCapture} />
      {/* Gallery input */}
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleCapture} />
      {/* Direct upload input */}
      <input ref={directRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleDirectCapture} />
    </div>
  );
};
