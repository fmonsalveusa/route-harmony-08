import { useState, useRef, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Check, SkipForward, Loader2 } from 'lucide-react';
import type { Corners, Point } from '@/lib/perspectiveTransform';

interface EdgeCropOverlayProps {
  imageUrl: string;
  corners: Corners;
  detecting: boolean;
  onConfirm: (corners: Corners) => void;
  onSkip: () => void;
}

export const EdgeCropOverlay = ({
  imageUrl,
  corners: initialCorners,
  detecting,
  onConfirm,
  onSkip,
}: EdgeCropOverlayProps) => {
  const [corners, setCorners] = useState<Corners>(initialCorners);
  const [dragging, setDragging] = useState<keyof Corners | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    setCorners(initialCorners);
  }, [initialCorners]);

  const getRelativePos = useCallback(
    (clientX: number, clientY: number): Point | null => {
      const img = imgRef.current;
      if (!img) return null;
      const rect = img.getBoundingClientRect();
      const x = Math.min(Math.max((clientX - rect.left) / rect.width, 0), 1);
      const y = Math.min(Math.max((clientY - rect.top) / rect.height, 0), 1);
      return { x, y };
    },
    []
  );

  const handlePointerDown = useCallback(
    (corner: keyof Corners) => (e: React.PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragging(corner);
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    },
    []
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragging) return;
      const pos = getRelativePos(e.clientX, e.clientY);
      if (pos) {
        setCorners((prev) => ({ ...prev, [dragging]: pos }));
      }
    },
    [dragging, getRelativePos]
  );

  const handlePointerUp = useCallback(() => {
    setDragging(null);
  }, []);

  const cornerKeys: (keyof Corners)[] = ['topLeft', 'topRight', 'bottomRight', 'bottomLeft'];

  const svgPoints = cornerKeys
    .map((k) => {
      const c = corners[k];
      return `${c.x * 100}%,${c.y * 100}%`;
    })
    .join(' ');

  return (
    <div className="fixed inset-0 z-[100] bg-black flex flex-col">
      {/* Header */}
      <div className="px-4 py-3 bg-black/90 text-center">
        <h2 className="text-white font-semibold text-sm">
          {detecting ? 'Detectando bordes...' : 'Ajusta las esquinas del documento'}
        </h2>
        <p className="text-white/50 text-xs mt-1">
          Arrastra los puntos para ajustar el área de recorte
        </p>
      </div>

      {/* Image + overlay */}
      <div
        ref={containerRef}
        className="flex-1 relative flex items-center justify-center overflow-hidden"
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        <img
          ref={imgRef}
          src={imageUrl}
          alt="Documento"
          className="max-w-full max-h-full object-contain"
          draggable={false}
        />

        {detecting && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50">
            <div className="flex flex-col items-center gap-2 text-white">
              <Loader2 className="h-8 w-8 animate-spin" />
              <span className="text-sm">Detectando bordes...</span>
            </div>
          </div>
        )}

        {!detecting && imgRef.current && (
          <svg
            className="absolute pointer-events-none"
            style={{
              left: imgRef.current.offsetLeft,
              top: imgRef.current.offsetTop,
              width: imgRef.current.offsetWidth,
              height: imgRef.current.offsetHeight,
            }}
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
          >
            {/* Semi-transparent overlay outside the polygon */}
            <defs>
              <mask id="cropMask">
                <rect width="100" height="100" fill="white" />
                <polygon
                  points={cornerKeys.map((k) => `${corners[k].x * 100},${corners[k].y * 100}`).join(' ')}
                  fill="black"
                />
              </mask>
            </defs>
            <rect width="100" height="100" fill="rgba(0,0,0,0.5)" mask="url(#cropMask)" />

            {/* Border lines */}
            <polygon
              points={cornerKeys.map((k) => `${corners[k].x * 100},${corners[k].y * 100}`).join(' ')}
              fill="none"
              stroke="hsl(var(--primary))"
              strokeWidth="0.4"
              vectorEffect="non-scaling-stroke"
            />
          </svg>
        )}

        {/* Draggable corner handles */}
        {!detecting &&
          imgRef.current &&
          cornerKeys.map((key) => {
            const c = corners[key];
            const imgEl = imgRef.current!;
            return (
              <div
                key={key}
                onPointerDown={handlePointerDown(key)}
                className="absolute z-10 touch-none"
                style={{
                  left: imgEl.offsetLeft + c.x * imgEl.offsetWidth - 14,
                  top: imgEl.offsetTop + c.y * imgEl.offsetHeight - 14,
                  width: 28,
                  height: 28,
                }}
              >
                <div className="w-full h-full rounded-full bg-primary border-2 border-white shadow-lg cursor-grab active:cursor-grabbing" />
              </div>
            );
          })}
      </div>

      {/* Actions */}
      <div className="flex gap-3 px-4 py-3 bg-black/90 justify-center">
        <Button
          variant="outline"
          size="sm"
          onClick={onSkip}
          className="gap-1.5 text-xs bg-white/10 border-white/20 text-white hover:bg-white/20"
        >
          <SkipForward className="h-4 w-4" /> Omitir recorte
        </Button>
        <Button
          size="sm"
          onClick={() => onConfirm(corners)}
          disabled={detecting}
          className="gap-1.5 text-xs"
        >
          <Check className="h-4 w-4" /> Confirmar recorte
        </Button>
      </div>
    </div>
  );
};
