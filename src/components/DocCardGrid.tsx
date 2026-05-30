import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Image, FileText, Download, Trash2, Upload, Loader2, Eye } from 'lucide-react';

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
  uploadBasePath?: string; // e.g. "driver-id" or "trucks/truck-id"
}

// Resuelve URL firmada
async function resolveUrl(url: string, getDocSignedUrl?: (u: string) => Promise<string | null>): Promise<string> {
  if (!url) return '';
  if (getDocSignedUrl) {
    try { return (await getDocSignedUrl(url)) || url; } catch { return url; }
  }
  return url;
}

function isImage(url: string): boolean {
  const u = url.toLowerCase();
  return u.includes('.jpg') || u.includes('.jpeg') || u.includes('.png') || u.includes('.webp') || u.includes('.gif');
}

// Thumbnail card
function DocCard({
  item,
  getDocSignedUrl,
  allowUpload,
  onUpload,
  uploadBasePath,
}: {
  item: DocItem;
  getDocSignedUrl?: (url: string) => Promise<string | null>;
  allowUpload?: boolean;
  onUpload?: (key: string, url: string) => void;
  uploadBasePath?: string;
}) {
  const [thumbSrc, setThumbSrc] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const img = item.url ? isImage(item.url) : false;

  useEffect(() => {
    if (!item.url || !img) return;
    setLoading(true);
    resolveUrl(item.url, getDocSignedUrl).then(url => { setThumbSrc(url); setLoading(false); });
  }, [item.url]);

  const handleView = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!item.url) return;
    const resolved = await resolveUrl(item.url, getDocSignedUrl);
    window.open(resolved, '_blank');
  };

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

  const shortName = item.label.length > 14 ? item.label.slice(0, 12) + '…' : item.label;

  return (
    <div className="relative flex flex-col rounded-lg border overflow-hidden transition-all hover:border-primary/50 hover:shadow-sm border-border" style={{ width: 80 }}>
      {/* Thumbnail */}
      <div className="h-12 bg-muted/30 relative">
        {item.url ? (
          img ? (
            <button onClick={handleView} className="w-full h-full group relative overflow-hidden" type="button">
              {loading ? (
                <div className="w-full h-full flex items-center justify-center">
                  <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                </div>
              ) : thumbSrc ? (
                <>
                  <img src={thumbSrc} alt={item.label} className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                    <Eye className="h-3 w-3 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </>
              ) : <Image className="h-4 w-4 text-muted-foreground m-auto" />}
            </button>
          ) : (
            <button onClick={handleView} className="w-full h-full flex flex-col items-center justify-center gap-0.5 text-primary hover:bg-muted/50 transition-colors" type="button">
              <FileText className="h-5 w-5" />
              <span className="text-[8px] text-muted-foreground">PDF</span>
            </button>
          )
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            {img ? <Image className="h-4 w-4 text-muted-foreground/40" /> : <FileText className="h-4 w-4 text-muted-foreground/40" />}
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
        <div className="flex items-center justify-between mt-0.5">
          {item.url ? (
            <button onClick={handleView} className="text-muted-foreground hover:text-foreground" type="button" title="Ver">
              <Eye className="h-2.5 w-2.5" />
            </button>
          ) : <span />}
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
  return (
    <div className="flex flex-wrap gap-2">
      {docs.map(item => (
        <DocCard
          key={item.key}
          item={item}
          getDocSignedUrl={getDocSignedUrl}
          allowUpload={allowUpload}
          onUpload={onUpload}
          uploadBasePath={uploadBasePath}
        />
      ))}
    </div>
  );
}
