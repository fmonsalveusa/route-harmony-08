import { useEffect, useRef, useState } from 'react';
import { X, FileDown, Loader2, Crop } from 'lucide-react';
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

interface Page {
  bw: string;
  color: string;
}

type Step =
  | { kind: 'crop'; index: number; redo: boolean }
  | { kind: 'preview' };

interface Props {
  /** Fotos en el orden en que deben quedar las páginas del PDF */
  imageUrls: string[];
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

export function PhotoToScannedPdf({ imageUrls, fileName, onSave, onClose }: Props) {
  const total = imageUrls.length;
  const [sources, setSources] = useState<Record<number, string>>({});
  const [pages, setPages] = useState<Record<number, Page>>({});
  const [step, setStep] = useState<Step>({ kind: 'crop', index: 0, redo: false });
  const [selected, setSelected] = useState(0);
  const [mode, setMode] = useState<Mode>('bw');
  const [busy, setBusy] = useState<string | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const urlsRef = useRef(imageUrls);
  urlsRef.current = imageUrls;

  const cropIndex = step.kind === 'crop' ? step.index : -1;

  // Carga (y reduce) la foto que toca recortar, solo una vez por foto
  useEffect(() => {
    if (cropIndex < 0 || sources[cropIndex]) return;
    let cancelled = false;
    setBusy(total > 1 ? `Cargando foto ${cropIndex + 1} de ${total}...` : 'Cargando imagen...');
    (async () => {
      try {
        const raw = await urlToDataUrl(urlsRef.current[cropIndex]);
        const resized = await resizeForCrop(raw, 2048);
        if (cancelled) return;
        setSources(prev => ({ ...prev, [cropIndex]: resized }));
        setBusy(null);
      } catch (e) {
        console.error('[scan-pdf] load error:', e);
        toast.error('No se pudo cargar la imagen');
        onCloseRef.current();
      }
    })();
    return () => { cancelled = true; };
  }, [cropIndex, total, sources]);

  const applyCrop = async (index: number, redo: boolean, corners: Corners | null) => {
    const source = sources[index];
    if (!source) return;
    setBusy(total > 1 ? `Enderezando foto ${index + 1} de ${total}...` : 'Enderezando documento...');
    try {
      const straight = corners ? await perspectiveTransform(source, corners) : source;
      const [bw, color] = await Promise.all([enhanceImage(straight), enhanceImageColor(straight)]);
      setPages(prev => ({ ...prev, [index]: { bw, color } }));

      if (!redo && index + 1 < total) {
        setStep({ kind: 'crop', index: index + 1, redo: false });
      } else {
        setSelected(index);
        setStep({ kind: 'preview' });
      }
    } catch (e) {
      console.error('[scan-pdf] crop error:', e);
      toast.error('Error procesando la imagen');
    } finally {
      setBusy(null);
    }
  };

  const handleSave = async () => {
    setBusy('Generando PDF...');
    try {
      const ordered = imageUrls.map((_, i) => pages[i]?.[mode]).filter(Boolean) as string[];
      const blob = await scanToPdf(ordered);
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

  if (step.kind === 'crop') {
    const source = sources[step.index];
    if (!source) return null;
    return (
      <>
        <EdgeCropOverlay
          key={step.index}
          imageUrl={source}
          corners={DEFAULT_CORNERS}
          detecting={false}
          onConfirm={(c) => applyCrop(step.index, step.redo, c)}
          onSkip={() => applyCrop(step.index, step.redo, null)}
        />
        {total > 1 && (
          <div className="fixed top-3 left-3 z-[101] px-3 py-1 rounded-full bg-primary text-primary-foreground text-xs font-semibold">
            Página {step.index + 1} de {total}
          </div>
        )}
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

  const current = pages[selected];

  return (
    <div className="fixed inset-0 z-[100] bg-black flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 bg-black/90">
        <h2 className="text-white font-semibold text-sm">
          Vista previa del escaneo {total > 1 && `· ${total} páginas`}
        </h2>
        <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center hover:bg-white/40">
          <X className="h-5 w-5 text-white" />
        </button>
      </div>

      <div className="flex-1 flex items-center justify-center p-4 overflow-hidden">
        {current && (
          <img src={current[mode]} alt={`Página ${selected + 1}`} className="max-w-full max-h-full object-contain bg-white shadow-2xl" />
        )}
      </div>

      {total > 1 && (
        <div className="flex gap-2 justify-center px-4 pb-3 overflow-x-auto">
          {imageUrls.map((_, i) => (
            <button
              key={i}
              onClick={() => setSelected(i)}
              className={`relative flex-shrink-0 w-16 h-20 rounded overflow-hidden border-2 bg-white ${
                selected === i ? 'border-primary' : 'border-white/20 opacity-60 hover:opacity-100'
              }`}
            >
              {pages[i] && <img src={pages[i][mode]} alt="" className="w-full h-full object-cover" />}
              <span className="absolute bottom-0 inset-x-0 bg-black/70 text-white text-[10px] text-center">{i + 1}</span>
            </button>
          ))}
        </div>
      )}

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
          className="text-xs gap-1.5 bg-white/10 border-white/20 text-white hover:bg-white/20"
          onClick={() => setStep({ kind: 'crop', index: selected, redo: true })}
        >
          <Crop className="h-3.5 w-3.5" />
          {total > 1 ? `Ajustar página ${selected + 1}` : 'Ajustar recorte'}
        </Button>
        <Button size="sm" className="text-xs gap-1.5" onClick={handleSave}>
          <FileDown className="h-3.5 w-3.5" /> Guardar PDF
        </Button>
      </div>
    </div>
  );
}
