import { useState, useRef, useCallback } from 'react';
import { X, Upload, RotateCcw, ScanLine, Camera, ImageIcon, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { getTenantId } from '@/hooks/useTenantId';
import { createNotification } from '@/hooks/useNotifications';
import { toast } from '@/hooks/use-toast';
import { EdgeCropOverlay } from './EdgeCropOverlay';
import { perspectiveTransform, type Corners } from '@/lib/perspectiveTransform';
import { fileToDataUrl } from '@/lib/scannerImageUtils';
import { scanToPdf } from '@/lib/scanToPdf';

// ─── Note on approach ───────────────────────────────────────────────────────
// We intentionally do NOT use the Capacitor Camera plugin here.
// On iOS WKWebView with a remote server.url, Capacitor Camera can:
//   • Return null silently (broad 'User' catch in takeNativePhoto)
//   • Hang on createImageBitmap when processing the result
// Using <input type="file" capture="environment"> is 100 % reliable on iOS
// WKWebView — the native camera opens, the File arrives via onChange, React's
// synthetic event system handles the rest with no Capacitor involvement.
// ────────────────────────────────────────────────────────────────────────────

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
  topLeft:     { x: 0.05, y: 0.05 },
  topRight:    { x: 0.95, y: 0.05 },
  bottomRight: { x: 0.95, y: 0.95 },
  bottomLeft:  { x: 0.05, y: 0.95 },
};

const MODE_LABELS: Record<DisplayMode, string> = {
  original: 'Original',
  color: 'Color completo',
};

function getPageSrc(page: ScannedPage): string {
  if (page.displayMode === 'color' && page.colorEnhanced) return page.colorEnhanced;
  return page.original;
}

/**
 * Resize a dataUrl using new Image() + Canvas 2D.
 * Does NOT use createImageBitmap — safe on iOS WKWebView with remote server.url.
 */
function resizeViaImage(dataUrl: string, maxDim = 2048): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const w = img.width  || 1;
      const h = img.height || 1;
      const scale = Math.min(1, maxDim / Math.max(w, h));
      if (scale >= 1) { resolve(dataUrl); return; }
      const tw = Math.round(w * scale);
      const th = Math.round(h * scale);
      const canvas = document.createElement('canvas');
      canvas.width  = tw;
      canvas.height = th;
      canvas.getContext('2d')!.drawImage(img, 0, 0, tw, th);
      try {
        resolve(canvas.toDataURL('image/jpeg', 0.85));
      } catch {
        resolve(dataUrl); // toDataURL failed (tainted canvas?) — use original
      }
    };
    img.onerror = () => resolve(dataUrl); // can't decode — use original
    img.src = dataUrl;
  });
}

export const DocumentScanner = ({ open, onClose, stop, loadRef, driverName, onUpdate }: DocumentScannerProps) => {
  const [pages,         setPages]         = useState<ScannedPage[]>([]);
  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const [uploading,     setUploading]     = useState(false);
  const [processing,    setProcessing]    = useState(false);
  const [processingMsg, setProcessingMsg] = useState('Procesando imagen...');

  // Crop state
  const [cropImage,   setCropImage]   = useState<string | null>(null);
  const [cropCorners, setCropCorners] = useState<Corners>(DEFAULT_CORNERS);
  const [showAddMore, setShowAddMore] = useState(false);

  // Two always-mounted hidden file inputs:
  //   cameraRef — capture="environment" opens the native camera
  //   galleryRef — no capture, opens the photo library / file picker
  const cameraRef  = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  const docLabel        = stop.stop_type === 'pickup' ? 'BOL' : 'POD';
  const isAndroid       = typeof navigator !== 'undefined' && /android/i.test(navigator.userAgent);
  const bottomSafePad   = isAndroid ? '84px' : '32px';

  // ─── Image capture (camera & gallery) ────────────────────────────────────
  // All capture paths go through this handler — camera, gallery, retake, add-more.
  // resizeViaImage uses only new Image() + Canvas 2D; no createImageBitmap.
  const handleCapture = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      e.target.value = ''; // reset so same file can be selected again

      setProcessingMsg('Procesando imagen...');
      setProcessing(true);
      try {
        const raw    = await fileToDataUrl(file);         // ArrayBuffer → base64 (Android-safe)
        const resized = await resizeViaImage(raw, 2048);  // cap at 2048 px — new Image() only
        setCropImage(resized);
        setCropCorners({ ...DEFAULT_CORNERS });
      } catch (err) {
        console.error('[scanner] handleCapture error:', err);
        toast({ title: 'Error procesando imagen', variant: 'destructive' });
      } finally {
        setProcessing(false);
      }
    },
    []
  );

  // ─── Trigger helpers (called from onClick — user-gesture context preserved) ─
  const openCamera  = () => cameraRef.current?.click();
  const openGallery = () => galleryRef.current?.click();

  // ─── Crop actions ─────────────────────────────────────────────────────────
  const addPage = useCallback((imageDataUrl: string) => {
    setPages((prev) => {
      const next = [
        ...prev,
        { original: imageDataUrl, colorEnhanced: imageDataUrl, displayMode: 'color' as DisplayMode },
      ];
      setSelectedIndex(next.length - 1);
      return next;
    });
  }, []);

  const handleCropConfirm = useCallback(
    async (corners: Corners) => {
      if (!cropImage) return;
      setProcessingMsg('Aplicando recorte...');
      setProcessing(true);
      try {
        const cropped = await perspectiveTransform(cropImage, corners);
        addPage(cropped);
        setCropImage(null);
        setShowAddMore(true);
      } catch (err) {
        console.error('[scanner] perspectiveTransform error:', err);
        // Fallback: add original image without transform
        addPage(cropImage);
        setCropImage(null);
        setShowAddMore(true);
      } finally {
        setProcessing(false);
      }
    },
    [cropImage, addPage]
  );

  const handleCropSkip = useCallback(() => {
    if (!cropImage) return;
    addPage(cropImage);
    setCropImage(null);
    setShowAddMore(true);
  }, [cropImage, addPage]);

  // ─── Add-more prompt ──────────────────────────────────────────────────────
  // Called directly from onClick — DO NOT wrap in setTimeout; that breaks
  // the user-gesture chain and iOS refuses the file-input click.
  const handleAddMoreCamera  = () => { setShowAddMore(false); openCamera();  };
  const handleAddMoreGallery = () => { setShowAddMore(false); openGallery(); };
  const handleAddMoreNo      = () => setShowAddMore(false);

  // ─── Page management ──────────────────────────────────────────────────────
  const handleRetake = () => {
    setPages((prev) => prev.filter((_, i) => i !== selectedIndex));
    setSelectedIndex((i) => Math.max(0, i - 1));
    openCamera();
  };

  const handleDeletePage = (idx: number) => {
    setPages((prev) => prev.filter((_, i) => i !== idx));
    setSelectedIndex((i) => Math.min(i, pages.length - 2));
  };

  // ─── Upload ───────────────────────────────────────────────────────────────
  const handleUploadAll = async () => {
    if (pages.length === 0) return;
    setUploading(true);
    try {
      const tenant_id      = await getTenantId();
      const imageDataUrls  = pages.map((p) => p.colorEnhanced ?? p.original);
      const pdfBlob        = await scanToPdf(imageDataUrls);
      const fileName       = `scan_${Date.now()}_${pages.length}p.pdf`;
      const filePath       = `pods/${stop.load_id}/${stop.id}_${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('driver-documents')
        .upload(filePath, pdfBlob, { contentType: 'application/pdf' });

      if (uploadError) {
        toast({ title: 'Error', description: uploadError.message, variant: 'destructive' });
        setUploading(false);
        return;
      }

      await supabase.from('pod_documents').insert({
        load_id:   stop.load_id,
        stop_id:   stop.id,
        file_name: fileName,
        file_url:  filePath,
        file_type: 'pdf',
        tenant_id,
      } as any);

      await createNotification({
        type:    'pod_uploaded',
        title:   `${docLabel} Scanned - ${driverName}`,
        message: `${driverName} scanned ${pages.length} page(s) of ${docLabel} at ${stop.address} (Load #${loadRef})`,
        load_id: stop.load_id,
      });

      toast({ title: `PDF de ${pages.length} página(s) subido ✓` });
      setPages([]);
      setSelectedIndex(0);
      onUpdate();
      onClose();
    } catch (err) {
      console.error('[scanner] upload error:', err);
      toast({ title: 'Error generando PDF', variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };

  const handleClose = () => {
    setPages([]);
    setSelectedIndex(0);
    setCropImage(null);
    setShowAddMore(false);
    onClose();
  };

  // ─── Render ───────────────────────────────────────────────────────────────
  if (!open) return null;

  // Always-mounted hidden inputs — present regardless of which screen is active.
  // This lets us call .click() from any state (retake, add-more, etc.) without
  // worrying about whether the inputs are currently in the DOM.
  const hiddenInputs = (
    <>
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleCapture}
      />
      <input
        ref={galleryRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleCapture}
      />
    </>
  );

  // ── Processing overlay ──
  if (processing) {
    return (
      <>
        {hiddenInputs}
        <div className="fixed inset-0 z-[100] bg-black flex flex-col items-center justify-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
          <p className="text-white text-sm">{processingMsg}</p>
        </div>
      </>
    );
  }

  // ── Crop overlay ──
  if (cropImage) {
    return (
      <>
        {hiddenInputs}
        <EdgeCropOverlay
          imageUrl={cropImage}
          corners={cropCorners}
          detecting={false}
          onConfirm={handleCropConfirm}
          onSkip={handleCropSkip}
        />
      </>
    );
  }

  // ── Add-more prompt ──
  if (showAddMore) {
    return (
      <>
        {hiddenInputs}
        <div className="fixed inset-0 z-[100] bg-black flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 bg-black/90" style={{ paddingTop: 'max(12px, env(safe-area-inset-top))' }}>
            <h2 className="text-white font-semibold text-sm">Escanear {docLabel} ({pages.length} pág.)</h2>
            <button onClick={handleClose} className="text-white/70 hover:text-white">
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="flex-1 flex flex-col px-6">
            <div className="flex-1 flex flex-col items-center justify-center gap-6">
              {pages.length > 0 && (
                <img
                  src={getPageSrc(pages[pages.length - 1])}
                  alt={`Página ${pages.length}`}
                  className="max-w-[60%] max-h-[40vh] object-contain rounded-lg border-2 border-primary/50"
                />
              )}
              <div className="text-center space-y-2">
                <p className="text-white font-medium text-base">Página {pages.length} escaneada ✓</p>
                <p className="text-white/70 text-sm">¿Deseas escanear otra página?</p>
              </div>
            </div>

            <div className="flex flex-col gap-3 w-full max-w-xs mx-auto" style={{ paddingBottom: bottomSafePad }}>
              <Button onClick={handleAddMoreCamera} className="gap-2 w-full" size="lg">
                <Camera className="h-5 w-5" /> Escanear otra (Cámara)
              </Button>
              <Button
                onClick={handleAddMoreGallery}
                variant="outline"
                className="gap-2 w-full bg-white/10 border-white/20 text-white hover:bg-white/20"
                size="lg"
              >
                <ImageIcon className="h-5 w-5" /> Agregar desde Galería
              </Button>
              <Button
                onClick={handleAddMoreNo}
                variant="ghost"
                className="gap-2 w-full text-white/70 hover:text-white hover:bg-white/10"
                size="lg"
              >
                Listo, revisar páginas
              </Button>
            </div>
          </div>

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
      </>
    );
  }

  // ── Main screen ──
  const currentPage = pages[selectedIndex];
  const currentSrc  = currentPage ? getPageSrc(currentPage) : null;

  return (
    <>
      {hiddenInputs}
      <div className="fixed inset-0 z-[100] bg-black flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-black/90" style={{ paddingTop: 'max(12px, env(safe-area-inset-top))' }}>
          <h2 className="text-white font-semibold text-sm">Escanear {docLabel} ({pages.length} pág.)</h2>
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
                  <strong className="text-white/80">Tip:</strong> Para mejor calidad, toma la foto desde "Cámara"
                  manteniendo el documento plano y bien iluminado.
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

        {/* Action buttons */}
        <div
          className="flex flex-wrap gap-2 px-4 pt-3 bg-black/90 justify-center"
          style={{ paddingBottom: bottomSafePad }}
        >
          <Button
            variant="outline"
            size="sm"
            onClick={openCamera}
            className="gap-1.5 text-xs bg-white/10 border-white/20 !text-white hover:bg-white/20 min-h-[44px] min-w-[44px]"
          >
            <Camera className="h-5 w-5 text-white" />
            <span className="text-white">{pages.length === 0 ? 'Cámara' : '+ Cámara'}</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={openGallery}
            className="gap-1.5 text-xs bg-white/10 border-white/20 !text-white hover:bg-white/20 min-h-[44px] min-w-[44px]"
          >
            <ImageIcon className="h-5 w-5 text-white" />
            <span className="text-white">{pages.length === 0 ? 'Galería' : '+ Galería'}</span>
          </Button>

          {currentPage && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleRetake}
              className="gap-1.5 text-xs bg-white/10 border-white/20 text-white hover:bg-white/20"
            >
              <RotateCcw className="h-4 w-4" /> Re-tomar
            </Button>
          )}

          {pages.length > 0 && (
            <Button size="sm" onClick={handleUploadAll} disabled={uploading} className="gap-1.5 text-xs">
              <Upload className="h-4 w-4" />
              {uploading ? 'Subiendo...' : `Subir todo (${pages.length})`}
            </Button>
          )}
        </div>
      </div>
    </>
  );
};
