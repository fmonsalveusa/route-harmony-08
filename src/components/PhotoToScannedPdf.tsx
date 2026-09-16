import { useEffect, useRef, useState } from 'react';
import { X, FileDown, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EdgeCropOverlay } from '@/components/driver-app/EdgeCropOverlay';
import { perspectiveTransform, type Corners } from '@/lib/perspectiveTransform';
import { enhanceImage, enhanceImageColor, resizeForCrop } from '@/lib/scannerImageUtils';
import { scanToPdf } from '@/lib/scanToPdf';
import { toast } from 'sonner';

const DEFAULT_CORNERS: Corners = {
  topLeft: { x: 0.05, y: 0.05 },
  topRight: { x: 0.95, y: 0.05 },
  bottomRight: { x: 0.95, y: 0.95 },
  bottomLeft: { x: 0.05, y: 0.95 },
};

type Mode = 'bw' | 'color';

interface Props {
  imageUrl: string;
  fileName: string;
  onSave: (file: File) => Promise<void>;
  onClose: () => void;
}

async function urlToDataUrl(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const blob = await res.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export function PhotoToScannedPdf({ imageUrl, fileName, onSave, onClose }: Props) {
  const [source, setSource] = useState<string | null>(null);
  const [cropped, setCropped] = useState<string | null>(null);
  const [previews, setPreviews] = useState<Record<Mode, string> | null>(null);
  const [mode, setMode] = useState<Mode>('bw');
  const [busy, setBusy] = useState<string | null>('Cargando imagen...');
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const raw = await urlToDataUrl(imageUrl);
        const resized = await resizeForCrop(raw, 2048);
        if (!cancelled) { setSource(resized); setBusy(null); }
      } catch (e) {
        console.error('[scan-pdf] load error:', e);
        toast.error('No se pudo cargar la imagen');
        onCloseRef.current();
      }
    })();
    return () => { cancelled = true; };
  }, [imageUrl]);

  const applyCrop = async (img: string, corners: Corners | null) => {
    setBusy('Enderezando documento...');
    try {
      const straight = corners ? await perspectiveTransform(img, corners) : img;
      const [bw, color] = await Promise.all([enhanceImage(straight), enhanceImageColor(straight)]);
      setCropped(straight);
      setPreviews({ bw, color });
    } catch (e) {
      console.error('[scan-pdf] crop error:', e);
      toast.error('Error procesando la imagen');
    } finally {
      setBusy(null);
    }
  };

  const handleSave = async () => {
    if (!previews) return;
    setBusy('Generando PDF...');
    try {
      const blob = await scanToPdf([previews[mode]]);
      await onSave(new File([blob], fileName, { type: 'application/pdf' }));
      onClose();
    } catch (e) {
      console.error('[scan-pdf] save error:', e);
      toast.error('Error generando el PDF');
      setBusy(null);
    }
  };

  if (busy) {
    return (
      <div className="fixed inset-0 z-[100] bg-black flex flex-col items-center justify-center gap-3">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="text-white text-sm">{busy}</p>
      </div>
    );
  }

  if (source && !cropped) {
    return (
      <>
        <EdgeCropOverlay
          imageUrl={source}
          corners={DEFAULT_CORNERS}
          detecting={false}
          onConfirm={(c) => applyCrop(source, c)}
          onSkip={() => applyCrop(source, null)}
        />
        <button
          onClick={onClose}
          className="fixed top-3 right-3 z-[101] w-8 h-8 rounded-full bg-white/20 flex items-center justify-center hover:bg-white/40"
          title="Cancelar"
        >
          <X className="h-5 w-5 text-white" />
        </button>
      </>
    );
  }

  if (!previews) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-black flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 bg-black/90">
        <h2 className="text-white font-semibold text-sm">Vista previa del escaneo</h2>
        <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center hover:bg-white/40">
          <X className="h-5 w-5 text-white" />
        </button>
      </div>

      <div className="flex-1 flex items-center justify-center p-4 overflow-hidden">
        <img src={previews[mode]} alt="Escaneo" className="max-w-full max-h-full object-contain bg-white shadow-2xl" />
      </div>

      <div className="flex flex-wrap items-center justify-center gap-2 px-4 py-4 bg-black/90">
        <div className="flex rounded-md overflow-hidden border border-white/20">
          <button
            onClick={() => setMode('bw')}
            className={`px-3 py-1.5 text-xs ${mode === 'bw' ? 'bg-white text-black' : 'text-white hover:bg-white/10'}`}
          >
            Blanco y negro
          </button>
          <button
            onClick={() => setMode('color')}
            className={`px-3 py-1.5 text-xs ${mode === 'color' ? 'bg-white text-black' : 'text-white hover:bg-white/10'}`}
          >
            Color
          </button>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="text-xs bg-white/10 border-white/20 text-white hover:bg-white/20"
          onClick={() => { setCropped(null); setPreviews(null); }}
        >
          Ajustar recorte
        </Button>
        <Button size="sm" className="text-xs gap-1.5" onClick={handleSave}>
          <FileDown className="h-3.5 w-3.5" /> Guardar PDF
        </Button>
      </div>
    </div>
  );
}
