import { useState, useMemo, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { PodDocument } from '@/hooks/usePodDocuments';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Image, FileText, Download, Trash2, Copy, CheckSquare, Square, Loader2, Eye, Upload } from 'lucide-react';
import { copyImageToClipboard } from '@/lib/clipboardUtils';
import { toast } from '@/hooks/use-toast';

interface StopDocumentGroupProps {
  label: string | null;
  docs: PodDocument[];
  onOpen: (doc: PodDocument) => void;
  onDownload: (doc: PodDocument) => void;
  onDelete: (id: string) => void;
  onUpload?: (files: FileList) => void;
  uploading?: boolean;
  uploadLabel?: string;
}

// Resuelve la URL firmada de un doc
async function resolveDocUrl(doc: PodDocument): Promise<string> {
  const url = doc.file_url;
  if (!url) return '';
  if (url.startsWith('http')) {
    const match = url.match(/\/storage\/v1\/object\/sign\/driver-documents\/([^?]+)/);
    if (match?.[1]) {
      const path = decodeURIComponent(match[1]);
      const { data } = await supabase.storage.from('driver-documents').createSignedUrl(path, 3600);
      if (data?.signedUrl) return data.signedUrl;
    }
    return url;
  }
  const { data } = await supabase.storage.from('driver-documents').createSignedUrl(url, 3600);
  return data?.signedUrl || '';
}

// Thumbnail de imagen con lazy load
function ImageThumb({ doc, onClick }: { doc: PodDocument; onClick: () => void }) {
  const [src, setSrc] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    resolveDocUrl(doc).then(url => { setSrc(url); setLoading(false); });
  }, [doc.file_url]);

  return (
    <button
      onClick={onClick}
      className="relative w-full h-full flex items-center justify-center bg-muted/40 rounded overflow-hidden group"
      type="button"
      title={doc.file_name}
    >
      {loading ? (
        <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
      ) : src ? (
        <>
          <img src={src} alt={doc.file_name} className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
            <Eye className="h-3 w-3 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        </>
      ) : (
        <Image className="h-3 w-3 text-muted-foreground" />
      )}
    </button>
  );
}

// Tarjeta de documento
function DocCard({
  doc,
  selected,
  onSelect,
  onOpen,
  onDownload,
  onDelete,
}: {
  doc: PodDocument;
  selected: boolean;
  onSelect: () => void;
  onOpen: () => void;
  onDownload: () => void;
  onDelete: () => void;
}) {
  const isImage = doc.file_type === 'image';
  const shortName = doc.file_name.length > 12 ? doc.file_name.slice(0, 10) + '…' : doc.file_name;

  return (
    <div className={`relative flex flex-col rounded-lg border overflow-hidden transition-all ${
      selected
        ? 'border-primary ring-2 ring-primary/30 shadow-md'
        : 'border-border hover:border-primary/50 hover:shadow-sm'
    }`} style={{ width: 64 }}>

      {/* Thumbnail area */}
      <div className="h-8 bg-muted/30 relative">
        {isImage ? (
          <ImageThumb doc={doc} onClick={onOpen} />
        ) : (
          <button
            onClick={onOpen}
            className="w-full h-full flex flex-col items-center justify-center gap-1 text-primary hover:bg-muted/50 transition-colors"
            type="button"
          >
            <FileText className="h-4 w-4" />
            <span className="text-[8px] text-muted-foreground">PDF</span>
          </button>
        )}

        {/* Checkbox para imágenes */}
        {isImage && (
          <div className="absolute top-1 left-1">
            <Checkbox
              checked={selected}
              onCheckedChange={onSelect}
              className="h-3 w-3 bg-white/80 border-white/80"
            />
          </div>
        )}

        {/* Badge de tipo */}
        <div className={`absolute top-1 right-1 rounded-full w-3 h-3 flex items-center justify-center ${
          isImage ? 'bg-blue-500' : 'bg-rose-500'
        }`}>
          {isImage
            ? <Image className="h-2 w-2 text-white" />
            : <FileText className="h-2 w-2 text-white" />
          }
        </div>
      </div>

      {/* Footer con nombre y acciones */}
      <div className="px-1.5 py-1 bg-card border-t">
        <p className="text-[10px] text-foreground font-medium truncate" title={doc.file_name}>{shortName}</p>
        <div className="flex items-center justify-between mt-0.5">
          <button onClick={onDownload} className="text-muted-foreground hover:text-foreground" type="button" title="Descargar">
            <Download className="h-3 w-3" />
          </button>
          <button onClick={onDelete} className="text-destructive/70 hover:text-destructive" type="button" title="Eliminar">
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      </div>
    </div>
  );
}

export const StopDocumentGroup = ({ label, docs, onOpen, onDownload, onDelete, onUpload, uploading, uploadLabel }: StopDocumentGroupProps) => {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [copyIndex, setCopyIndex] = useState(0);
  const [copying, setCopying] = useState(false);
  const inputId = useMemo(() => `stop-upload-${Math.random().toString(36).slice(2)}`, []);

  const imageDocs = useMemo(() => docs.filter(d => d.file_type === 'image'), [docs]);

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
    setCopyIndex(0);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === imageDocs.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(imageDocs.map(d => d.id)));
    }
    setCopyIndex(0);
  };

  const handleDelete = (id: string) => {
    onDelete(id);
    setSelectedIds(prev => { const n = new Set(prev); n.delete(id); return n; });
  };

  const handleCopy = async () => {
    const selected = imageDocs.filter(d => selectedIds.has(d.id));
    if (selected.length === 0) return;
    const idx = copyIndex % selected.length;
    const doc = selected[idx];

    setCopying(true);
    try {
      const resolvedUrl = await resolveDocUrl(doc);
      if (!resolvedUrl) throw new Error('No URL');
      const ok = await copyImageToClipboard(resolvedUrl);
      if (ok) {
        toast({ title: `Copiada ${idx + 1} de ${selected.length}`, description: 'Pega con Ctrl+V / Cmd+V' });
        setCopyIndex(idx + 1);
      } else {
        toast({ title: 'No se pudo copiar', description: 'Se abrió en nueva pestaña', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error al copiar', variant: 'destructive' });
    } finally {
      setCopying(false);
    }
  };

  if (docs.length === 0 && !onUpload) return null;

  return (
    <div className="space-y-2">
      {(label || onUpload) && (
        <div className="flex items-center justify-between">
          {label && <p className="text-xs font-medium text-muted-foreground">{label}</p>}
          <div className="flex items-center gap-2 ml-auto">
            {imageDocs.length > 0 && (
              <button
                onClick={toggleSelectAll}
                className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                type="button"
              >
                {selectedIds.size === imageDocs.length ? <CheckSquare className="h-3 w-3" /> : <Square className="h-3 w-3" />}
                {selectedIds.size === imageDocs.length ? 'Deseleccionar' : 'Seleccionar todo'}
              </button>
            )}
            {onUpload && (
              <>
                <button
                  onClick={() => document.getElementById(inputId)?.click()}
                  disabled={uploading}
                  className="text-xs text-primary hover:text-primary/80 flex items-center gap-1 border border-border rounded px-1.5 py-0.5"
                  type="button"
                >
                  {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
                  {uploadLabel || 'Subir'}
                </button>
                <input
                  id={inputId}
                  type="file"
                  accept="image/*,.pdf"
                  multiple
                  className="hidden"
                  onChange={e => {
                    if (e.target.files) onUpload(e.target.files);
                    e.target.value = '';
                  }}
                />
              </>
            )}
          </div>
        </div>
      )}

      {docs.length === 0 && (
        <p className="text-xs text-muted-foreground italic">Sin archivos</p>
      )}

      {/* Tarjetas de documentos */}
      <div className="flex flex-wrap gap-2">
        {docs.map(doc => (
          <DocCard
            key={doc.id}
            doc={doc}
            selected={selectedIds.has(doc.id)}
            onSelect={() => toggleSelect(doc.id)}
            onOpen={() => onOpen(doc)}
            onDownload={() => onDownload(doc)}
            onDelete={() => handleDelete(doc.id)}
          />
        ))}
      </div>

      {/* Copiar al clipboard */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" className="gap-1.5 text-xs h-7" onClick={handleCopy} disabled={copying}>
            {copying ? <Loader2 className="h-3 w-3 animate-spin" /> : <Copy className="h-3 w-3" />}
            {selectedIds.size === 1
              ? 'Copiar al Clipboard'
              : copyIndex === 0
                ? `Copiar al Clipboard (${selectedIds.size})`
                : `Copiar siguiente (${(copyIndex % selectedIds.size) + 1} de ${selectedIds.size})`}
          </Button>
        </div>
      )}
    </div>
  );
};
