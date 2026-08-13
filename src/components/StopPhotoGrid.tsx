import { useState, useRef, useEffect } from 'react';
import { Camera, Check, X, RefreshCw, Download, ChevronLeft, ChevronRight } from 'lucide-react';

interface StopPhotoGridProps {
  photos: Array<{ id: string; file_name: string; file_url: string }>;
  stopType: 'pickup' | 'delivery';
  loadReference: string;
  resolveUrl: (pod: any) => Promise<string>;
  onUpload: (file: File) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  uploading: boolean;
}

export function StopPhotoGrid({
  photos,
  stopType,
  loadReference,
  resolveUrl,
  onUpload,
  onDelete,
  uploading,
}: StopPhotoGridProps) {
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [zoomIndex, setZoomIndex] = useState<number | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const closeZoom = () => setZoomIndex(null);
  const showPrev = () => setZoomIndex(i => i === null ? null : (i - 1 + photos.length) % photos.length);
  const showNext = () => setZoomIndex(i => i === null ? null : (i + 1) % photos.length);

  // Teclado: flechas y Escape en el visor
  useEffect(() => {
    if (zoomIndex === null) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeZoom();
      else if (e.key === 'ArrowLeft') showPrev();
      else if (e.key === 'ArrowRight') showNext();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [zoomIndex, photos.length]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const replaceInputRef = useRef<HTMLInputElement>(null);
  const [replacingId, setReplacingId] = useState<string | null>(null);

  const prefix = stopType === 'pickup' ? 'Pick' : 'Del';

  // Resolver TODAS las URLs en paralelo al montar (rápido)
  useEffect(() => {
    let cancelled = false;
    const resolve = async () => {
      const results = await Promise.all(
        photos.map(async (p) => {
          const url = await resolveUrl(p);
          return { id: p.id, url };
        })
      );
      if (cancelled) return;
      const map: Record<string, string> = {};
      results.forEach(r => { if (r.url) map[r.id] = r.url; });
      setUrls(map);
    };
    if (photos.length > 0) resolve();
    return () => { cancelled = true; };
  }, [photos]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await onUpload(file);
    e.target.value = '';
  };

  const handleReplace = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !replacingId) return;
    await onDelete(replacingId);
    await onUpload(file);
    setReplacingId(null);
    e.target.value = '';
  };

  return (
    <div>
      {/* Contador */}
      <p className="text-xs text-muted-foreground mb-2">
        {photos.length} foto{photos.length !== 1 ? 's' : ''}
      </p>

      {/* Grilla */}
      <div className="grid grid-cols-3 lg:grid-cols-5 gap-2">
        {/* Fotos existentes */}
        {photos.map((photo, idx) => {
          const label = `${prefix} #${loadReference}-${String(idx + 1).padStart(2, '0')}`;
          const url = urls[photo.id];

          return (
            <div key={photo.id} className="relative group">
              {/* Tile */}
              <div
                className="aspect-[2/1] rounded-lg overflow-hidden bg-muted cursor-pointer border border-border hover:border-primary/50 transition-colors"
                onClick={() => { if (url) setZoomIndex(idx); }}
              >
                {url ? (
                  <img src={url} alt={label} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />
                  </div>
                )}
              </div>

              {/* ✓ verde arriba izquierda */}
              <div className="absolute top-1.5 left-1.5 w-5 h-5 rounded-full bg-[#F97316] flex items-center justify-center shadow">
                <Check className="h-3 w-3 text-white" strokeWidth={3} />
              </div>

              {/* ✕ arriba derecha para borrar */}
              <button
                onClick={(e) => { e.stopPropagation(); onDelete(photo.id); }}
                className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
              >
                <X className="h-3 w-3 text-white" strokeWidth={3} />
              </button>

              {/* Barra Cambiar */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setReplacingId(photo.id);
                  replaceInputRef.current?.click();
                }}
                className="absolute bottom-6 left-0 right-0 bg-black/50 text-white text-[10px] text-center py-0.5 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
              >
                Cambiar
              </button>

              {/* Botón de descarga */}
              <button
                onClick={async (e) => {
                  e.stopPropagation();
                  if (!url) return;
                  try {
                    const res = await fetch(url);
                    const blob = await res.blob();
                    const blobUrl = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = blobUrl;
                    a.download = photo.file_name || `${label}.jpg`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(blobUrl);
                  } catch {
                    window.open(url, '_blank');
                  }
                }}
                className="absolute bottom-6 right-0 bg-black/50 text-white p-1 rounded-bl opacity-0 group-hover:opacity-100 transition-opacity"
                title="Descargar"
              >
                <Download className="h-3 w-3" />
              </button>

              {/* Etiqueta */}
              <p className="text-[11px] text-center text-muted-foreground mt-1 truncate">{label}</p>
            </div>
          );
        })}

        {/* Tile vacío para agregar */}
        <div
          className="aspect-[2/1] rounded-lg border-2 border-dashed border-muted-foreground/30 flex flex-col items-center justify-center gap-1 cursor-pointer hover:border-primary/50 hover:bg-muted/50 transition-colors"
          onClick={() => fileInputRef.current?.click()}
        >
          {uploading ? (
            <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
          ) : (
            <>
              <Camera className="h-5 w-5 text-muted-foreground" />
              <span className="text-[10px] text-muted-foreground">Cámara o archivo</span>
            </>
          )}
        </div>
      </div>

      {/* Inputs ocultos */}
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleUpload} />
      <input ref={replaceInputRef} type="file" accept="image/*" className="hidden" onChange={handleReplace} />

      {/* Modal de zoom con navegacion */}
      {zoomIndex !== null && photos[zoomIndex] && (() => {
        const currentPhoto = photos[zoomIndex];
        const currentUrl = urls[currentPhoto.id];
        const currentLabel = `${prefix} #${loadReference}-${String(zoomIndex + 1).padStart(2, '0')}`;
        const hasMultiple = photos.length > 1;
        return (
          <div
            className="fixed inset-0 z-[60] bg-black/85 flex items-center justify-center"
            onClick={closeZoom}
          >
            {/* Cerrar */}
            <button
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/20 flex items-center justify-center hover:bg-white/40 transition-colors z-[61]"
              onClick={closeZoom}
            >
              <X className="h-5 w-5 text-white" />
            </button>

            {/* Contador y etiqueta */}
            <div className="absolute top-4 left-4 text-white text-sm z-[61] bg-black/40 px-3 py-1 rounded-full">
              {currentLabel} {hasMultiple && `(${zoomIndex + 1}/${photos.length})`}
            </div>

            {/* Prev */}
            {hasMultiple && (
              <button
                className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/20 flex items-center justify-center hover:bg-white/40 transition-colors z-[61]"
                onClick={(e) => { e.stopPropagation(); showPrev(); }}
                title="Anterior (←)"
              >
                <ChevronLeft className="h-7 w-7 text-white" />
              </button>
            )}

            {/* Next */}
            {hasMultiple && (
              <button
                className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/20 flex items-center justify-center hover:bg-white/40 transition-colors z-[61]"
                onClick={(e) => { e.stopPropagation(); showNext(); }}
                title="Siguiente (→)"
              >
                <ChevronRight className="h-7 w-7 text-white" />
              </button>
            )}

            {currentUrl ? (
              <img
                src={currentUrl}
                alt={currentLabel}
                className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg"
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <RefreshCw className="h-8 w-8 animate-spin text-white" />
            )}
          </div>
        );
      })()}
    </div>
  );
}
