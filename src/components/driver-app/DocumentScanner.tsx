import { useState, useRef, useCallback } from 'react';
import { isNativeCamera, takeNativePhoto, pickFromGallery } from '@/lib/nativeCamera';
import { X, Upload, RotateCcw, ScanLine, Camera, ImageIcon, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { getTenantId } from '@/hooks/useTenantId';
import { createNotification } from '@/hooks/useNotifications';
import { toast } from '@/hooks/use-toast';
import { EdgeCropOverlay } from './EdgeCropOverlay';
import { perspectiveTransform, type Corners } from '@/lib/perspectiveTransform';
import {
  resizeForCrop,
  resizeForDetection,
  fileToDataUrl,
} from '@/lib/scannerImageUtils';
import { scanToPdf } from '@/lib/scanToPdf';

type DisplayMode = 'original' | 'color';

interface ScannedPage {
  original: string;
  colorEnhanced: string | null;
  displayMode: DisplayMode;
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

const MODE_LABELS: Record<DisplayMode, string> = {
  original: 'Original',
  color: 'Color HD',
};

function getPageSrc(page: ScannedPage): string {
  if (page.displayMode === 'color' && page.colorEnhanced) return page.colorEnhanced;
  return page.original;
}

export const DocumentScanner = ({ open, onClose, stop, loadRef, driverName, onUpdate }: DocumentScannerProps) => {
  const [pages, setPages] = useState<ScannedPage[]>([]);
  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const [uploading, setUploading] = useState(false);
  const [processing, setProcessing] = useState(false);

  // Edge detection state
  const [cropImage, setCropImage] = useState<string | null>(null);
  const [cropCorners, setCropCorners] = useState<Corners>(DEFAULT_CORNERS);
  const [detecting, setDetecting] = useState(false);
  const [showAddMore, setShowAddMore] = useState(false);

  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  const docLabel = stop.stop_type === 'pickup' ? 'BOL' : 'POD';
  const bottomSafePadding = '160px';

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

  // ─── Add a page (default to color mode and precompute Color HD) ───
  const addPage = useCallback((imageDataUrl: string) => {
    let newIndex = 0;
    setPages((prev) => {
      newIndex = prev.length;
      const next = [...prev, { original: imageDataUrl, colorEnhanced: null, displayMode: 'color' as DisplayMode }];
      setSelectedIndex(next.length - 1);
      return next;
    });

    void (async () => {
      try {
        const colorEnhanced = await enhanceImageColor(imageDataUrl);
        setPages((prev) =>
          prev.map((p, i) => (i === newIndex ? { ...p, colorEnhanced, displayMode: 'color' } : p))
        );
      } catch (err) {
        console.error('Color enhancement failed:', err);
      }
    })();
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
        toast({ title: 'Error procesando imagen', variant: 'destructive' });
        setProcessing(false);
      }
    },
    [detectEdges]
  );

  const handleCropConfirm = useCallback(
    async (corners: Corners) => {
      if (!cropImage) return;
      const cropped = await perspectiveTransform(cropImage, corners);
      addPage(cropped);
      setCropImage(null);
      setShowAddMore(true);
    },
    [cropImage, addPage]
  );

  const handleCropSkip = useCallback(async () => {
    if (!cropImage) return;
    addPage(cropImage);
    setCropImage(null);
    setShowAddMore(true);
  }, [cropImage, addPage]);

  const handleAddMoreYes = useCallback((source: 'camera' | 'gallery') => {
    setShowAddMore(false);
    if (source === 'camera') {
      setTimeout(() => triggerCamera(), 150);
    } else {
      setTimeout(() => triggerGallery(), 150);
    }
  }, []);

  const handleAddMoreNo = useCallback(() => {
    setShowAddMore(false);
  }, []);

  const triggerCamera = async () => {
    if (isNativeCamera()) {
      const dataUrl = await takeNativePhoto();
      if (!dataUrl) return;
      setProcessing(true);
      try {
        const resized = await resizeForCrop(dataUrl);
        setCropImage(resized);
        setCropCorners({ ...DEFAULT_CORNERS });
        setProcessing(false);
        detectEdges(resized);
      } catch (err) {
        console.error('Error processing native camera image:', err);
        toast({ title: 'Error procesando imagen', variant: 'destructive' });
        setProcessing(false);
      }
      return;
    }
    cameraRef.current?.click();
  };

  const triggerGallery = async () => {
    if (isNativeCamera()) {
      const urls = await pickFromGallery();
      if (urls.length === 0) return;
      setProcessing(true);
      try {
        const resized = await resizeForCrop(urls[0]);
        setCropImage(resized);
        setCropCorners({ ...DEFAULT_CORNERS });
        setProcessing(false);
        detectEdges(resized);
      } catch (err) {
        console.error('Error processing native gallery image:', err);
        toast({ title: 'Error procesando imagen', variant: 'destructive' });
        setProcessing(false);
      }
      return;
    }
    fileRef.current?.click();
  };

  // ─── Toggle: Color HD ↔ Original ───
  const handleEnhanceCycle = async () => {
    if (pages.length === 0) return;
    const page = pages[selectedIndex];

    if (page.displayMode === 'color') {
      setPages((prev) =>
        prev.map((p, i) => (i === selectedIndex ? { ...p, displayMode: 'original' } : p))
      );
      return;
    }

    if (!page.colorEnhanced) {
      setEnhancing(true);
      try {
        const colorEnhanced = await enhanceImageColor(page.original);
        setPages((prev) =>
          prev.map((p, i) =>
            i === selectedIndex ? { ...p, colorEnhanced, displayMode: 'color' } : p
          )
        );
      } finally {
        setEnhancing(false);
      }
      return;
    }

    setPages((prev) =>
      prev.map((p, i) => (i === selectedIndex ? { ...p, displayMode: 'color' } : p))
    );
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
    try {
      const tenant_id = await getTenantId();

      // Collect all page images in full color for final PDF
      const enhancedByIndex = new Map<number, string>();
      const imageDataUrls: string[] = [];

      for (let i = 0; i < pages.length; i++) {
        const page = pages[i];
        if (page.colorEnhanced) {
          imageDataUrls.push(page.colorEnhanced);
        } else {
          const colorEnhanced = await enhanceImageColor(page.original);
          enhancedByIndex.set(i, colorEnhanced);
          imageDataUrls.push(colorEnhanced);
        }
      }

      if (enhancedByIndex.size > 0) {
        setPages((prev) =>
          prev.map((p, i) => {
            const colorEnhanced = enhancedByIndex.get(i);
            return colorEnhanced ? { ...p, colorEnhanced, displayMode: 'color' } : p;
          })
        );
      }

      // Generate single PDF from all pages
      const pdfBlob = await scanToPdf(imageDataUrls);
      const fileName = `scan_${Date.now()}_${pages.length}p.pdf`;
      const filePath = `pods/${stop.load_id}/${stop.id}_${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('driver-documents')
        .upload(filePath, pdfBlob, { contentType: 'application/pdf' });

      if (uploadError) {
        toast({ title: 'Error', description: uploadError.message, variant: 'destructive' });
        setUploading(false);
        return;
      }

      await supabase.from('pod_documents').insert({
        load_id: stop.load_id,
        stop_id: stop.id,
        file_name: fileName,
        file_url: filePath,
        file_type: 'pdf',
        tenant_id,
      } as any);

      await createNotification({
        type: 'pod_uploaded',
        title: `${docLabel} Scanned - ${driverName}`,
        message: `${driverName} scanned ${pages.length} page(s) of ${docLabel} at ${stop.address} (Load #${loadRef})`,
        load_id: stop.load_id,
      });

      toast({ title: `PDF de ${pages.length} página(s) subido ✓` });
      setPages([]);
      setSelectedIndex(0);
      onUpdate();
      onClose();
    } catch (err) {
      console.error('Error generating/uploading PDF:', err);
      toast({ title: 'Error generando PDF', variant: 'destructive' });
    } finally {
      setUploading(false);
    }
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

  // Add-more prompt after crop
  if (showAddMore) {
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

        {/* Last scanned preview */}
        <div className="flex-1 flex flex-col px-6">
          <div className="flex-1 flex flex-col items-center justify-center gap-6">
            {pages.length > 0 && (
              <img src={getPageSrc(pages[pages.length - 1])} alt={`Página ${pages.length}`} className="max-w-[60%] max-h-[40vh] object-contain rounded-lg border-2 border-primary/50" />
            )}
            <div className="text-center space-y-2">
              <p className="text-white font-medium text-base">Página {pages.length} escaneada ✓</p>
              <p className="text-white/70 text-sm">¿Deseas escanear otra página?</p>
            </div>
          </div>

          <div className="flex flex-col gap-3 w-full max-w-xs mx-auto" style={{ paddingBottom: bottomSafePadding }}>
            <Button onClick={() => handleAddMoreYes('camera')} className="gap-2 w-full" size="lg">
              <Camera className="h-5 w-5" /> Escanear otra (Cámara)
            </Button>
            <Button onClick={() => handleAddMoreYes('gallery')} variant="outline" className="gap-2 w-full bg-white/10 border-white/20 text-white hover:bg-white/20" size="lg">
              <ImageIcon className="h-5 w-5" /> Agregar desde Galería
            </Button>
            <Button onClick={handleAddMoreNo} variant="ghost" className="gap-2 w-full text-white/70 hover:text-white hover:bg-white/10" size="lg">
              Listo, revisar páginas
            </Button>
          </div>
        </div>

        {/* Thumbnail strip */}
        {pages.length > 1 && (
          <div className="flex gap-2 px-4 py-3 bg-black/90 overflow-x-auto justify-center">
            {pages.map((p, i) => (
              <div key={i} className="w-12 h-12 rounded-lg overflow-hidden border-2 border-white/20 flex-shrink-0">
                <img src={getPageSrc(p)} className="w-full h-full object-cover" />
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  const currentPage = pages[selectedIndex];
  const currentSrc = currentPage ? getPageSrc(currentPage) : null;
  const nextModeLabel = currentPage
    ? currentPage.displayMode === 'color'
      ? 'Original'
      : 'Color HD'
    : '';

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

      {/* Mode badge */}
      {currentPage && (
        <div className="flex justify-center py-1 bg-black/90">
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-white/70">
            {MODE_LABELS[currentPage.displayMode]}
          </span>
        </div>
      )}

      {/* Preview area */}
      <div className="flex-1 flex items-center justify-center overflow-hidden bg-black">
        {currentSrc ? (
          <img src={currentSrc} alt={`Página ${selectedIndex + 1}`} className="max-w-full max-h-full object-contain" />
        ) : (
          <div className="text-center text-white/50 space-y-4 px-6">
            <ScanLine className="h-16 w-16 mx-auto" />
            <p className="text-sm">Toca un botón para escanear</p>
            <div className="flex items-start gap-2 bg-white/5 rounded-lg p-3 text-left">
              <Info className="h-4 w-4 mt-0.5 flex-shrink-0 text-primary" />
              <p className="text-xs text-white/60">
                <strong className="text-white/80">Tip:</strong> Para mejor calidad, escanea con tu app de cámara (Google, Samsung) o Adobe Scan, y luego usa <strong className="text-white/80">Galería</strong>.
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
                <img src={getPageSrc(p)} className="w-full h-full object-cover" />
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
      <div className="flex flex-wrap gap-2 px-4 pt-3 bg-black/90 justify-center" style={{ paddingBottom: bottomSafePadding }}>
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

        {currentPage && (
          <>
            <Button variant="outline" size="sm" onClick={handleEnhanceCycle} disabled={enhancing}
              className="gap-1.5 text-xs bg-white/10 border-white/20 text-white hover:bg-white/20">
              <Contrast className="h-4 w-4" />
              {enhancing ? 'Mejorando...' : nextModeLabel}
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
    </div>
  );
};
