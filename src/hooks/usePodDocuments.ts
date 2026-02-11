import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { getTenantId } from '@/hooks/useTenantId';

export interface PodDocument {
  id: string;
  load_id: string;
  stop_id: string | null;
  file_url: string;
  file_name: string;
  file_type: string;
  created_at: string;
}

export function usePodDocuments(loadId: string) {
  const [pods, setPods] = useState<PodDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const { toast } = useToast();

  const fetchPods = useCallback(async () => {
    const { data, error } = await supabase
      .from('pod_documents')
      .select('*')
      .eq('load_id', loadId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching PODs:', error);
    } else {
      setPods((data as PodDocument[]) || []);
    }
    setLoading(false);
  }, [loadId]);

  useEffect(() => {
    fetchPods();
  }, [fetchPods]);

  const uploadPod = useCallback(async (file: File, stopId?: string) => {
    setUploading(true);
    try {
      const path = `pods/${loadId}/${Date.now()}_${file.name}`;

      const { error: uploadError } = await supabase.storage
        .from('driver-documents')
        .upload(path, file);

      if (uploadError) throw uploadError;

      const fileType = file.type.startsWith('image/') ? 'image' : 'pdf';
      const tenant_id = await getTenantId();

      const { error: insertError } = await supabase
        .from('pod_documents')
        .insert({
          load_id: loadId,
          stop_id: stopId || null,
          file_url: path,
          file_name: file.name,
          file_type: fileType,
          tenant_id,
        } as any);

      if (insertError) throw insertError;

      toast({ title: 'POD uploaded', description: file.name });
      await fetchPods();
    } catch (err: any) {
      console.error('Error uploading POD:', err);
      toast({ title: 'Error', description: 'Failed to upload file', variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  }, [loadId, fetchPods, toast]);

  const deletePod = useCallback(async (podId: string) => {
    const { error } = await supabase
      .from('pod_documents')
      .delete()
      .eq('id', podId);

    if (error) {
      toast({ title: 'Error', description: 'Failed to delete', variant: 'destructive' });
    } else {
      toast({ title: 'POD deleted' });
      await fetchPods();
    }
  }, [fetchPods, toast]);

  const getSignedUrl = useCallback(async (fileUrl: string): Promise<string> => {
    // If it's already a full URL (legacy), return as-is
    if (fileUrl.startsWith('http')) return fileUrl;
    // Otherwise it's a storage path — generate a fresh signed URL
    const { data, error } = await supabase.storage
      .from('driver-documents')
      .createSignedUrl(fileUrl, 3600);
    if (error || !data?.signedUrl) {
      console.error('Error creating signed URL:', error);
      return '';
    }
    return data.signedUrl;
  }, []);

  const downloadPod = useCallback(async (pod: PodDocument) => {
    try {
      const url = await getSignedUrl(pod.file_url);
      if (!url) throw new Error('No URL');
      const res = await fetch(url);
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = pod.file_name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    } catch (err) {
      console.error('Error downloading POD:', err);
      toast({ title: 'Error', description: 'No se pudo descargar el archivo', variant: 'destructive' });
    }
  }, [getSignedUrl, toast]);

  return { pods, loading, uploading, uploadPod, deletePod, downloadPod, getSignedUrl };
}
