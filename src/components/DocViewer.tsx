import { useState, useRef } from 'react';
import { FileText, ExternalLink, Loader2, Upload, X, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';

interface DocViewerProps {
  label: string;
  url: string | null;
  docKey: string;
  getDocSignedUrl?: (url: string) => Promise<string | null>;
  onUpload?: (url: string) => void;
  uploadPath?: string;
  allowUpload?: boolean;
  children?: React.ReactNode;
}

export function DocViewer({ label, url, docKey, getDocSignedUrl, onUpload, uploadPath, allowUpload = false, children }: DocViewerProps) {
  const [loadingDoc, setLoadingDoc] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const resolveUrl = async (rawUrl: string): Promise<string> => {
    if (!getDocSignedUrl) return rawUrl;
    try {
      const signed = await getDocSignedUrl(rawUrl);
      return signed || rawUrl;
    } catch {
      return rawUrl;
    }
  };

  const handleView = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (!url) return;
    setLoadingDoc(true);
    try {
      const resolved = await resolveUrl(url);
      // Small delay to ensure the click event cycle is complete before opening dialog
      setTimeout(() => setPreviewUrl(resolved), 10);
    } finally {
      setLoadingDoc(false);
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !uploadPath || !onUpload) return;
    setUploading(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `${uploadPath}_${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from('driver-documents').upload(path, file);
      if (error) throw error;
      const { data } = await supabase.storage.from('driver-documents').createSignedUrl(path, 31536000);
      if (data?.signedUrl) onUpload(data.signedUrl);
    } catch (e: any) {
      console.error('Upload error:', e);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const isPdf = (u: string) => u.toLowerCase().includes('.pdf') || u.toLowerCase().includes('pdf');

  return (
    <>
      <div className="flex items-center gap-1.5 px-2.5 py-1.5 border rounded-md text-xs bg-background">
        <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        <span className="font-medium">{label}</span>

        {url ? (
          <>
            <button
              onClick={handleView}
              className="text-primary underline flex items-center gap-0.5 hover:text-primary/80"
              disabled={loadingDoc}
            >
              {loadingDoc ? <Loader2 className="h-3 w-3 animate-spin" /> : <><Eye className="h-3 w-3" /> View</>}
            </button>
            {allowUpload && (
              <button
                onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
                className="text-muted-foreground hover:text-foreground ml-1"
                title="Replace document"
                disabled={uploading}
              >
                {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
              </button>
            )}
            {children}
          </>
        ) : (
          <>
            <span className="text-muted-foreground">—</span>
            {allowUpload && (
              <button
                onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
                className="text-primary hover:text-primary/80 ml-1 flex items-center gap-0.5"
                title="Upload document"
                disabled={uploading}
              >
                {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <><Upload className="h-3 w-3" /> Upload</>}
              </button>
            )}
          </>
        )}

        {allowUpload && (
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,.pdf"
            className="hidden"
            onChange={handleUpload}
          />
        )}
      </div>

      {/* Preview Dialog */}
      <Dialog open={!!previewUrl} onOpenChange={(open) => !open && setPreviewUrl(null)}>
        <DialogContent className="max-w-3xl" onClick={e => e.stopPropagation()}>
          <DialogHeader>
            <DialogTitle>{label}</DialogTitle>
          </DialogHeader>
          {previewUrl && (
            <div className="flex justify-center">
              {isPdf(previewUrl) ? (
                <iframe src={previewUrl} className="w-full h-[70vh] rounded border" title={label} />
              ) : (
                <img src={previewUrl} alt={label} className="max-w-full max-h-[70vh] object-contain rounded" />
              )}
            </div>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setPreviewUrl(null)}>Cerrar</Button>
            {previewUrl && (
              <Button asChild>
                <a href={previewUrl} target="_blank" rel="noopener noreferrer">
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
