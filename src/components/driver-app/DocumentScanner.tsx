import { useState, useRef, useCallback } from 'react';
import { X, Upload, RotateCcw, Contrast, ScanLine, Camera, ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { getTenantId } from '@/hooks/useTenantId';
import { createNotification } from '@/hooks/useNotifications';
import { toast } from '@/hooks/use-toast';
import { EdgeCropOverlay } from './EdgeCropOverlay';
import { perspectiveTransform, type Corners } from '@/lib/perspectiveTransform';
import { compressDataUrl } from '@/lib/imageCompression';

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

function enhanceImage(dataUrl: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;

      for (let i = 0; i < data.length; i += 4) {
        const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
        const val = gray > 140 ? 255 : gray < 60 ? 0 : Math.round((gray - 60) * (255 / 80));
        data[i] = val;
        data[i + 1] = val;
        data[i + 2] = val;
      }

      ctx.putImageData(imageData, 0, 0);
      resolve(canvas.toDataURL('image/jpeg', 0.80));
    };
    img.src = dataUrl;
  });
}

function dataUrlToBlob(dataUrl: string): Blob {
  const parts = dataUrl.split(',');
  const mime = parts[0].match(/:(.*?);/)![1];
  const bstr = atob(parts[1]);
  const u8arr = new Uint8Array(bstr.length);
  for (let i = 0; i < bstr.length; i++) u8arr[i] = bstr.charCodeAt(i);
  return new Blob([u8arr], { type: mime });
}

/** Resize image for AI detection to reduce payload size */
function resizeForDetection(dataUrl: string, maxDim = 1024): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL('image/jpeg', 0.7));
    };
    img.src = dataUrl;
  });
}

/** Resize large camera images for display/crop overlay (Android cameras can be 12MP+) */
function resizeForCrop(dataUrl: string, maxDim = 2048): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      if (img.width <= maxDim && img.height <= maxDim) {
        resolve(dataUrl);
        return;
      }
      const scale = maxDim / Math.max(img.width, img.height);
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

export const DocumentScanner = ({ open, onClose, stop, loadRef, driverName, onUpdate }: DocumentScannerProps) => {
  const [pages, setPages] = useState<ScannedPage[]>([]);
  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const [uploading, setUploading] = useState(false);
  const [enhancing, setEnhancing] = useState(false);
  const [processing, setProcessing] = useState(false);

  // Edge detection state
  const [cropImage, setCropImage] = useState<string | null>(null);
  const [cropCorners, setCropCorners] = useState<Corners>({
    topLeft: { x: 0.05, y: 0.05 },
    topRight: { x: 0.95, y: 0.05 },
    bottomRight: { x: 0.95, y: 0.95 },
    bottomLeft: { x: 0.05, y: 0.95 },
  });
  const [detecting, setDetecting] = useState(false);

  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  const docLabel = stop.stop_type === 'pickup' ? 'BOL' : 'POD';

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

  const handleCapture = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      setProcessing(true);

      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const rawDataUrl = reader.result as string;
          // Resize large Android camera images before showing crop overlay
          const dataUrl = await resizeForCrop(rawDataUrl);
          setCropImage(dataUrl);
          setCropCorners({
            topLeft: { x: 0.05, y: 0.05 },
            topRight: { x: 0.95, y: 0.05 },
            bottomRight: { x: 0.95, y: 0.95 },
            bottomLeft: { x: 0.05, y: 0.95 },
          });
          detectEdges(dataUrl);
        } catch (err) {
          console.error('Error processing image:', err);
          toast({ title: 'Error procesando imagen', variant: 'destructive' });
        } finally {
          setProcessing(false);
        }
      };
      reader.onerror = () => {
        console.error('FileReader error');
        toast({ title: 'Error leyendo imagen', variant: 'destructive' });
        setProcessing(false);
      };
      reader.readAsDataURL(file);
      e.target.value = '';
    },
    [detectEdges]
  );

  const handleCropConfirm = useCallback(
    async (corners: Corners) => {
      if (!cropImage) return;
      // Apply perspective transform then enhance
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
    // Use full image without cropping
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

  // Show processing overlay while reading/resizing image
  if (processing) {
    return (
      <div className="fixed inset-0 z-[100] bg-black flex flex-col items-center justify-center gap-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
        <p className="text-white text-sm">Procesando imagen...</p>
      </div>
    );
  }

  // Show crop overlay when in cropping mode
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
          <div className="text-center text-white/50 space-y-4">
            <ScanLine className="h-16 w-16 mx-auto" />
            <p className="text-sm">Toca el botón para escanear</p>
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
        {/* Camera button - opens camera directly on Android */}
        <Button
          variant="outline"
          size="sm"
          onClick={triggerCamera}
          className="gap-1.5 text-xs bg-white/10 border-white/20 text-white hover:bg-white/20"
        >
          <Camera className="h-4 w-4" />
          {pages.length === 0 ? 'Cámara' : '+ Cámara'}
        </Button>

        {/* Gallery button - opens file picker */}
        <Button
          variant="outline"
          size="sm"
          onClick={triggerGallery}
          className="gap-1.5 text-xs bg-white/10 border-white/20 text-white hover:bg-white/20"
        >
          <ImageIcon className="h-4 w-4" />
          {pages.length === 0 ? 'Galería' : '+ Galería'}
        </Button>

        {currentPage && (
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={handleEnhance}
              disabled={enhancing}
              className="gap-1.5 text-xs bg-white/10 border-white/20 text-white hover:bg-white/20"
            >
              <Contrast className="h-4 w-4" />
              {enhancing ? 'Mejorando...' : currentPage.showEnhanced ? 'Ver original' : 'Mejorar'}
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={handleRetake}
              className="gap-1.5 text-xs bg-white/10 border-white/20 text-white hover:bg-white/20"
            >
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

      {/* Camera input - forces camera on Android */}
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleCapture} />
      {/* Gallery input - opens file picker */}
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleCapture} />
    </div>
  );
};
