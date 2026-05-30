import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Image, FileText, Upload, Loader2, Eye, X, ExternalLink } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

export interface DocItem {
  key: string;
  label: string;
  url: string | null;
}

interface Props {
  docs: DocItem[];
  getDocSignedUrl?: (url: string) => Promise<string | null>;
  allowUpload?: boolean;
  onUpload?: (key: string, url: string) => void;
  uploadBasePath?: string;
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
        <div className="flex items-center justify-end mt-0.5">
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

export function DocCardGrid({ docs, getDocSignedUrl, allowUpload, onUpload, uploadBasePath }: Props) {
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

      {/* Preview Dialog */}
      <Dialog open={!!preview || loadingPreview} onOpenChange={(open) => { if (!open) setPreview(null); }}>
        <DialogContent className="max-w-3xl" onClick={e => e.stopPropagation()}>
          <DialogHeader>
            <DialogTitle>{preview?.item.label}</DialogTitle>
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
            <Button variant="outline" onClick={() => setPreview(null)}>Cerrar</Button>
            {preview && (
              <Button asChild>
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
