import { useState, useRef, useCallback, useEffect, useId } from 'react';
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

interface ImageRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

export const EdgeCropOverlay = ({
  imageUrl,
  corners: initialCorners,
  detecting,
  onConfirm,
  onSkip,
}: EdgeCropOverlayProps) => {
  const [corners, setCorners] = useState<Corners>(initialCorners);
  const [dragging, setDragging] = useState<keyof Corners | null>(null);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgRect, setImgRect] = useState<ImageRect | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const maskId = useId().replace(/:/g, '_');

  useEffect(() => {
    setCorners(initialCorners);
  }, [initialCorners]);


  const updateImageRect = useCallback(() => {
    const container = containerRef.current;
    const img = imgRef.current;
    if (!container || !img) return;

    const containerBounds = container.getBoundingClientRect();
    const imgBounds = img.getBoundingClientRect();

    const width = Math.round(imgBounds.width);
    const height = Math.round(imgBounds.height);

    if (width <= 0 || height <= 0) {
      setImgRect(null);
      return;
    }

    setImgRect({
      left: imgBounds.left - containerBounds.left,
      top: imgBounds.top - containerBounds.top,
      width,
      height,
    });
  }, []);

  useEffect(() => {
    setImgLoaded(false);
    setImgRect(null);

    const frame = window.requestAnimationFrame(() => {
      const img = imgRef.current;
      if (img && img.complete && img.naturalWidth > 0) {
        setImgLoaded(true);
        updateImageRect();
      }
    });

    return () => window.cancelAnimationFrame(frame);
  }, [imageUrl, updateImageRect]);

  useEffect(() => {
    if (!imgLoaded) return;

    updateImageRect();

    const onResize = () => updateImageRect();
    window.addEventListener('resize', onResize);

    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined' && containerRef.current) {
      resizeObserver = new ResizeObserver(() => updateImageRect());
      resizeObserver.observe(containerRef.current);
      if (imgRef.current) resizeObserver.observe(imgRef.current);
    }

    return () => {
      window.removeEventListener('resize', onResize);
      resizeObserver?.disconnect();
    };
  }, [imgLoaded, updateImageRect]);

  const getRelativePos = useCallback(
    (clientX: number, clientY: number): Point | null => {
      const container = containerRef.current;
      if (!container || !imgRect) return null;

      const containerBounds = container.getBoundingClientRect();
      const x = (clientX - containerBounds.left - imgRect.left) / imgRect.width;
      const y = (clientY - containerBounds.top - imgRect.top) / imgRect.height;

      return {
        x: clamp(x, 0, 1),
        y: clamp(y, 0, 1),
      };
    },
    [imgRect]
  );

  const moveCorner = useCallback(
    (clientX: number, clientY: number) => {
      if (!dragging) return;
      const pos = getRelativePos(clientX, clientY);
      if (!pos) return;
      setCorners((prev) => ({ ...prev, [dragging]: pos }));
    },
    [dragging, getRelativePos]
  );

  const handlePointerDown = useCallback(
    (corner: keyof Corners) => (e: React.PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragging(corner);
    },
    []
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      moveCorner(e.clientX, e.clientY);
    },
    [moveCorner]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      moveCorner(e.clientX, e.clientY);
    },
    [moveCorner]
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!dragging) return;
      const touch = e.touches[0];
      if (!touch) return;
      moveCorner(touch.clientX, touch.clientY);
    },
    [dragging, moveCorner]
  );

  const stopDragging = useCallback(() => {
    setDragging(null);
  }, []);

  const cornerKeys: (keyof Corners)[] = ['topLeft', 'topRight', 'bottomRight', 'bottomLeft'];

  return (
    <div className="fixed inset-0 z-[100] bg-black flex flex-col">
      <div className="px-4 py-3 bg-black/90 text-center flex-shrink-0">
        <h2 className="text-white font-semibold text-sm">
          {detecting ? 'Detectando bordes...' : 'Ajusta las esquinas del documento'}
        </h2>
        <p className="text-white/50 text-xs mt-1">Arrastra los puntos para ajustar el área de recorte</p>
      </div>

      <div className="absolute left-0 right-0 top-[60px] z-20 px-4 py-3">
        <div className="flex gap-3 justify-center">
          <Button
            variant="outline"
            size="sm"
            onClick={onSkip}
            className="gap-1.5 text-xs bg-white/10 border-white/20 text-white hover:bg-white/20"
          >
            <SkipForward className="h-4 w-4" /> Omitir recorte
          </Button>
          <Button size="sm" onClick={() => onConfirm(corners)} disabled={detecting} className="gap-1.5 text-xs">
            <Check className="h-4 w-4" /> Confirmar recorte
          </Button>
        </div>
      </div>

      <div
        ref={containerRef}
        className="flex-1 relative flex items-center justify-center overflow-hidden min-h-0 pt-16"
        onPointerMove={handlePointerMove}
        onPointerUp={stopDragging}
        onPointerCancel={stopDragging}
        onMouseMove={handleMouseMove}
        onMouseUp={stopDragging}
        onMouseLeave={stopDragging}
        onTouchMove={handleTouchMove}
        onTouchEnd={stopDragging}
        onTouchCancel={stopDragging}
      >
        <img
          ref={imgRef}
          src={imageUrl}
          alt="Documento"
          className="max-w-full max-h-full object-contain"
          draggable={false}
          onLoad={() => {
            setImgLoaded(true);
            requestAnimationFrame(updateImageRect);
          }}
        />

        {detecting && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-30">
            <div className="flex flex-col items-center gap-2 text-white">
              <Loader2 className="h-8 w-8 animate-spin" />
              <span className="text-sm">Detectando bordes...</span>
            </div>
          </div>
        )}

        {!detecting && imgLoaded && imgRect && (
          <>
            <svg
              className="absolute pointer-events-none z-10"
              style={{
                left: imgRect.left,
                top: imgRect.top,
                width: imgRect.width,
                height: imgRect.height,
              }}
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
            >
              <defs>
                <mask id={maskId}>
                  <rect width="100" height="100" fill="white" />
                  <polygon
                    points={cornerKeys.map((k) => `${corners[k].x * 100},${corners[k].y * 100}`).join(' ')}
                    fill="black"
                  />
                </mask>
              </defs>

              <rect width="100" height="100" fill="rgba(0,0,0,0.5)" mask={`url(#${maskId})`} />
              <polygon
                points={cornerKeys.map((k) => `${corners[k].x * 100},${corners[k].y * 100}`).join(' ')}
                fill="none"
                stroke="hsl(var(--primary))"
                strokeWidth="0.45"
                vectorEffect="non-scaling-stroke"
              />
            </svg>

            {cornerKeys.map((key) => {
              const c = corners[key];
              return (
                <div
                  key={key}
                  onPointerDown={handlePointerDown(key)}
                  className="absolute z-20 touch-none"
                  style={{
                    left: imgRect.left + c.x * imgRect.width - 15,
                    top: imgRect.top + c.y * imgRect.height - 15,
                    width: 30,
                    height: 30,
                  }}
                >
                  <div className="w-full h-full rounded-full bg-primary border-2 border-white shadow-lg cursor-grab active:cursor-grabbing" />
                </div>
              );
            })}
          </>
        )}
      </div>
    </div>
  );
};
