import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Image, FileText, Upload, Loader2, Eye, X, ExternalLink, Trash2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

export interface DocItem {
  key: string;
  label: string;
  url: string | null;
  // Solo si el item se puede borrar (ej: leasings agregados en la tabla driver_leasing_agreements).
  // Los documentos fijos del driver (licencia, W9, etc.) no traen esta funcion.
  onDelete?: () => Promise<void>;
}

interface Props {
  docs: DocItem[];
  getDocSignedUrl?: (url: string) => Promise<string | null>;
  allowUpload?: boolean;
  onUpload?: (key: string, url: string) => void;
  uploadBasePath?: string;
  /** 'tiles': lista de tarjetas con miniatura, estado (cargado / falta) y botones Ver / Subir */
  /** 'cards': cuadrícula con vista previa grande y botones de ícono (aprovecha el ancho) */
  variant?: 'thumbs' | 'tiles' | 'cards';
}

async function resolveUrl(url: string, getDocSignedUrl?: (u: string) => Promise<string | null>): Promise<string> {
  if (!url) return '';
  if (getDocSignedUrl) {
    try { return (await getDocSignedUrl(url)) || url; } catch { return url; }
  }
  return url;
}

function isImageUrl(url: string): boolean {
  const u = url.toLowerCase();
  return u.includes('.jpg') || u.includes('.jpeg') || u.includes('.png') || u.includes('.webp') || u.includes('.gif') || u.includes('image');
}

function isPdfUrl(url: string): boolean {
  return url.toLowerCase().includes('.pdf') || url.toLowerCase().includes('pdf');
}

function ImageThumb({ url, label, getDocSignedUrl }: { url: string; label: string; getDocSignedUrl?: (u: string) => Promise<string | null> }) {
  const [src, setSrc] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    resolveUrl(url, getDocSignedUrl).then(r => { setSrc(r); setLoading(false); });
  }, [url]);

  if (loading) return <div className="w-full h-full flex items-center justify-center"><Loader2 className="h-3 w-3 animate-spin text-muted-foreground" /></div>;
  if (!src) return <Image className="h-4 w-4 text-muted-foreground m-auto" />;
  return <img src={src} alt={label} className="w-full h-full object-cover" />;
}

function DocCard({
  item,
  getDocSignedUrl,
  allowUpload,
  onUpload,
  uploadBasePath,
  onPreview,
}: {
  item: DocItem;
  getDocSignedUrl?: (url: string) => Promise<string | null>;
  allowUpload?: boolean;
  onUpload?: (key: string, url: string) => void;
  uploadBasePath?: string;
  onPreview: (item: DocItem) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const img = item.url ? isImageUrl(item.url) : false;
  const shortName = item.label.length > 14 ? item.label.slice(0, 12) + '…' : item.label;

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !onUpload) return;
    setUploading(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `${uploadBasePath}/${item.key}_${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from('driver-documents').upload(path, file);
      if (error) throw error;
      const { data } = await supabase.storage.from('driver-documents').createSignedUrl(path, 31536000);
      if (data?.signedUrl) onUpload(item.key, data.signedUrl);
    } catch (err) {
      console.error('Upload error:', err);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <div
      className="relative flex flex-col rounded-lg border overflow-hidden transition-all hover:border-primary/50 hover:shadow-sm border-border cursor-pointer"
      style={{ width: 80 }}
      onClick={e => { e.stopPropagation(); if (item.url) onPreview(item); }}
    >
      {/* Thumbnail */}
      <div className="h-12 bg-muted/30 relative group">
        {item.url ? (
          img ? (
            <>
              <ImageThumb url={item.url} label={item.label} getDocSignedUrl={getDocSignedUrl} />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                <Eye className="h-3 w-3 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </>
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center gap-0.5 text-primary hover:bg-muted/50 transition-colors">
              <FileText className="h-5 w-5" />
              <span className="text-[8px] text-muted-foreground">PDF</span>
            </div>
          )
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            {img ? <Image className="h-4 w-4 text-muted-foreground/30" /> : <FileText className="h-4 w-4 text-muted-foreground/30" />}
          </div>
        )}

        {/* Type badge */}
        {item.url && (
          <div className={`absolute top-0.5 right-0.5 rounded-full w-3 h-3 flex items-center justify-center ${img ? 'bg-blue-500' : 'bg-rose-500'}`}>
            {img ? <Image className="h-1.5 w-1.5 text-white" /> : <FileText className="h-1.5 w-1.5 text-white" />}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-1 py-0.5 bg-card border-t">
        <p className="text-[9px] text-foreground font-medium truncate" title={item.label}>{shortName}</p>
        <div className="flex items-center justify-end gap-1 mt-0.5">
          {item.onDelete && (
            <button
              onClick={async e => {
                e.stopPropagation();
                if (!confirm(`Borrar ${item.label}?`)) return;
                try { await item.onDelete!(); } catch (err) { console.error('Delete error:', err); }
              }}
              className="text-destructive hover:text-destructive/80"
              type="button"
              title="Borrar"
            >
              <Trash2 className="h-2.5 w-2.5" />
            </button>
          )}
          {allowUpload && (
            <button
              onClick={e => { e.stopPropagation(); fileRef.current?.click(); }}
              className="text-primary hover:text-primary/80"
              type="button"
              title={item.url ? 'Reemplazar' : 'Subir'}
              disabled={uploading}
            >
              {uploading ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : <Upload className="h-2.5 w-2.5" />}
            </button>
          )}
        </div>
      </div>

      {allowUpload && (
        <input ref={fileRef} type="file" accept="image/*,.pdf" className="hidden" onChange={handleUpload} />
      )}
    </div>
  );
}

/** Tarjeta de documento en fila: miniatura, nombre, estado y botones visibles */
function DocTile({
  item, getDocSignedUrl, allowUpload, onUpload, uploadBasePath, onPreview, card,
}: {
  card?: boolean;
  item: DocItem;
  getDocSignedUrl?: (url: string) => Promise<string | null>;
  allowUpload?: boolean;
  onUpload?: (key: string, url: string) => void;
  uploadBasePath?: string;
  onPreview: (item: DocItem) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const img = item.url ? isImageUrl(item.url) : false;

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !onUpload) return;
    setUploading(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `${uploadBasePath}/${item.key}_${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from('driver-documents').upload(path, file);
      if (error) throw error;
      const { data } = await supabase.storage.from('driver-documents').createSignedUrl(path, 31536000);
      if (data?.signedUrl) onUpload(item.key, data.signedUrl);
    } catch (err) {
      console.error('Upload error:', err);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const ICON_BTN = 'h-6 w-6 shrink-0 rounded-full flex items-center justify-center';
  if (card) {
    return (
      <div className="group flex flex-col rounded-2xl bg-[#f8fafd] dark:bg-muted/40 border border-[#e3e3e3] dark:border-border overflow-hidden">
        <button
          type="button"
          disabled={!item.url}
          onClick={e => { e.stopPropagation(); if (item.url) onPreview(item); }}
          className="relative h-12 w-full bg-white dark:bg-card flex items-center justify-center overflow-hidden"
        >
          {item.url ? (
            img ? <ImageThumb url={item.url} label={item.label} getDocSignedUrl={getDocSignedUrl} />
              : <span className="flex flex-col items-center gap-1 text-[#d93025]"><FileText className="h-5 w-5" /><span className="text-[9px] font-bold tracking-wide leading-none">PDF</span></span>
          ) : (
            <span className="flex flex-col items-center gap-1 text-[#c4c7c5]"><FileText className="h-5 w-5" /></span>
          )}
          {item.url && (
            <span className="absolute inset-0 bg-black/0 group-hover:bg-black/25 transition-colors flex items-center justify-center">
              <Eye className="h-4 w-4 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
            </span>
          )}
        </button>
        <div className="px-2 pt-1 pb-1 border-t border-[#e3e3e3] dark:border-border">
          <p className="text-xs text-[#1f1f1f] dark:text-foreground truncate" title={item.label}>{item.label}</p>
          <div className="flex items-center gap-0.5">
            <span className={`flex-1 min-w-0 text-[11px] flex items-center gap-1 ${item.url ? 'text-[#188038] dark:text-emerald-400' : 'text-[#b3261e] dark:text-red-300'}`}>
              <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${item.url ? 'bg-[#188038]' : 'bg-[#d93025]'}`} />
              <span className="truncate">{item.url ? (img ? 'Foto' : 'PDF') : 'Falta'}</span>
            </span>
            {item.url && (
              <button type="button" title="Ver" onClick={e => { e.stopPropagation(); onPreview(item); }}
                className={`${ICON_BTN} text-[#0b57d0] dark:text-blue-300 hover:bg-[#e8f0fe] dark:hover:bg-muted`}>
                <Eye className="h-3.5 w-3.5" />
              </button>
            )}
            {allowUpload && (
              <button type="button" title={item.url ? 'Cambiar' : 'Subir'} disabled={uploading} onClick={e => { e.stopPropagation(); fileRef.current?.click(); }}
                className={`${ICON_BTN} text-[#0b57d0] dark:text-blue-300 hover:bg-[#e8f0fe] dark:hover:bg-muted`}>
                {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
              </button>
            )}
            {item.onDelete && (
              <button type="button" title="Borrar"
                onClick={async e => {
                  e.stopPropagation();
                  if (!confirm(`Borrar ${item.label}?`)) return;
                  try { await item.onDelete!(); } catch (err) { console.error('Delete error:', err); }
                }}
                className={`${ICON_BTN} text-[#b3261e] hover:bg-[#fce8e6] dark:hover:bg-red-950/40`}>
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
        {allowUpload && <input ref={fileRef} type="file" accept="image/*,.pdf" className="hidden" onChange={handleUpload} />}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 rounded-2xl bg-[#f8fafd] dark:bg-muted/40 px-2 py-1.5">
      <button
        type="button"
        disabled={!item.url}
        onClick={e => { e.stopPropagation(); if (item.url) onPreview(item); }}
        className="h-11 w-11 shrink-0 rounded-xl overflow-hidden bg-white dark:bg-card border border-[#e3e3e3] dark:border-border flex items-center justify-center"
      >
        {item.url ? (
          img ? <ImageThumb url={item.url} label={item.label} getDocSignedUrl={getDocSignedUrl} />
            : <FileText className="h-5 w-5 text-[#d93025]" />
        ) : (
          <FileText className="h-5 w-5 text-[#c4c7c5]" />
        )}
      </button>
      <div className="min-w-0 flex-1">
        <p className="text-sm text-[#1f1f1f] dark:text-foreground truncate">{item.label}</p>
        <p className={`text-[11px] flex items-center gap-1 ${item.url ? 'text-[#188038] dark:text-emerald-400' : 'text-[#b3261e] dark:text-red-300'}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${item.url ? 'bg-[#188038]' : 'bg-[#d93025]'}`} />
          {item.url ? (img ? 'Cargado · Foto' : 'Cargado · PDF') : 'Falta'}
        </p>
      </div>
      {item.url && (
        <button type="button" onClick={e => { e.stopPropagation(); onPreview(item); }}
          className="h-8 px-3 rounded-full text-xs font-medium text-[#0b57d0] dark:text-blue-300 hover:bg-[#e8f0fe] dark:hover:bg-muted inline-flex items-center gap-1">
          <Eye className="h-3.5 w-3.5" /> Ver
        </button>
      )}
      {item.onDelete && (
        <button type="button" title="Borrar"
          onClick={async e => {
            e.stopPropagation();
            if (!confirm(`Borrar ${item.label}?`)) return;
            try { await item.onDelete!(); } catch (err) { console.error('Delete error:', err); }
          }}
          className="h-8 w-8 rounded-full flex items-center justify-center text-[#b3261e] hover:bg-[#fce8e6] dark:hover:bg-red-950/40">
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      )}
      {allowUpload && (
        <>
          <button type="button" disabled={uploading} onClick={e => { e.stopPropagation(); fileRef.current?.click(); }}
            className="h-8 px-3 rounded-full text-xs font-medium border border-[#747775] dark:border-border text-[#0b57d0] dark:text-blue-300 hover:bg-[#e8f0fe] dark:hover:bg-muted inline-flex items-center gap-1">
            {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />} {item.url ? 'Cambiar' : 'Subir'}
          </button>
          <input ref={fileRef} type="file" accept="image/*,.pdf" className="hidden" onChange={handleUpload} />
        </>
      )}
    </div>
  );
}

export function DocCardGrid({ docs, getDocSignedUrl, allowUpload, onUpload, uploadBasePath, variant = 'thumbs' }: Props) {
  const [preview, setPreview] = useState<{ item: DocItem; resolvedUrl: string } | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);

  const handlePreview = async (item: DocItem) => {
    if (!item.url) return;
    setLoadingPreview(true);
    const resolved = await resolveUrl(item.url, getDocSignedUrl);
    setPreview({ item, resolvedUrl: resolved });
    setLoadingPreview(false);
  };

  const isPdf = preview ? isPdfUrl(preview.resolvedUrl) : false;

  return (
    <>
      {variant === 'tiles' || variant === 'cards' ? (
        <div className={variant === 'cards' ? 'grid grid-cols-[repeat(auto-fill,minmax(118px,1fr))] gap-2' : 'space-y-1.5'}>
          {docs.map(item => (
            <DocTile
              card={variant === 'cards'}
              key={item.key}
              item={item}
              getDocSignedUrl={getDocSignedUrl}
              allowUpload={allowUpload}
              onUpload={onUpload}
              uploadBasePath={uploadBasePath}
              onPreview={handlePreview}
            />
          ))}
        </div>
      ) : (
      <div className="flex flex-wrap gap-2">
        {docs.map(item => (
          <DocCard
            key={item.key}
            item={item}
            getDocSignedUrl={getDocSignedUrl}
            allowUpload={allowUpload}
            onUpload={onUpload}
            uploadBasePath={uploadBasePath}
            onPreview={handlePreview}
          />
        ))}
      </div>
      )}

      {/* Preview Dialog */}
      <Dialog open={!!preview || loadingPreview} onOpenChange={(open) => { if (!open) setPreview(null); }}>
        <DialogContent className="max-w-3xl rounded-[28px] border-0 bg-[#f8fafd] dark:bg-background [&_label]:text-xs [&_label]:font-medium [&_label]:text-[#444746] dark:[&_label]:text-muted-foreground [&_input:not([type=checkbox]):not([type=radio]):not([type=file])]:rounded-lg [&_input]:shadow-none [&_input:not([type=checkbox]):not([type=radio])]:bg-white dark:[&_input]:bg-card [&_input]:border-[#c4c7c5] dark:[&_input]:border-border [&_input:focus-visible]:ring-1 [&_input:focus-visible]:ring-[#0b57d0] [&_input:focus-visible]:border-[#0b57d0] [&_button[role=combobox]]:rounded-lg [&_button[role=combobox]]:shadow-none [&_button[role=combobox]]:bg-white dark:[&_button[role=combobox]]:bg-card [&_button[role=combobox]]:border-[#c4c7c5] dark:[&_button[role=combobox]]:border-border [&_textarea]:rounded-lg [&_textarea]:shadow-none [&_textarea]:bg-white dark:[&_textarea]:bg-card [&_textarea]:border-[#c4c7c5]" onClick={e => e.stopPropagation()}>
          <DialogHeader>
            <DialogTitle className="text-[22px] leading-7 font-normal text-[#1f1f1f] dark:text-foreground">{preview?.item.label}</DialogTitle>
          </DialogHeader>
          {loadingPreview ? (
            <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
          ) : preview && (
            <div className="flex justify-center">
              {isPdf ? (
                <iframe src={preview.resolvedUrl} className="w-full h-[70vh] rounded border" title={preview.item.label} />
              ) : (
                <img src={preview.resolvedUrl} alt={preview.item.label} className="max-w-full max-h-[70vh] object-contain rounded" />
              )}
            </div>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button className="rounded-full px-4 shadow-none border-[#747775] dark:border-border text-[#0b57d0] dark:text-blue-300 hover:bg-[#e8f0fe] hover:text-[#0b57d0] font-medium bg-transparent" variant="outline" onClick={() => setPreview(null)}>Cerrar</Button>
            {preview && (
              <Button className="rounded-full px-5 bg-[#0b57d0] hover:bg-[#0842a0] text-white font-medium shadow-none" asChild>
                <a href={preview.resolvedUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4 mr-2" /> Abrir en nueva pestaña
                </a>
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
