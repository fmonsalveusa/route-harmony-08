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
      const storagePath = `pods/${loadId}/${Date.now()}_${file.name}`;

      const { error: uploadError } = await supabase.storage
        .from('driver-documents')
        .upload(storagePath, file);

      if (uploadError) throw uploadError;

      const fileType = file.type.startsWith('image/') ? 'image' : 'pdf';
      const tenant_id = await getTenantId();

      // IMPORTANT: store permanent storage path (not a signed URL)
      const { error: insertError } = await supabase
        .from('pod_documents')
        .insert({
          load_id: loadId,
          stop_id: stopId || null,
          file_url: storagePath,
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

  const resolvePodUrl = useCallback(async (pod: PodDocument): Promise<string> => {
    // Legacy: already a full signed URL
    if (pod.file_url?.startsWith('http')) return pod.file_url;

    let storagePath = pod.file_url;

    // Repair: if storage path is missing, try to find it in storage by file name
    if (!storagePath) {
      try {
        const folder = `pods/${pod.load_id}`;
        const { data: objects, error: listError } = await supabase.storage
          .from('driver-documents')
          .list(folder, { limit: 1000 });

        if (listError) throw listError;

        const match = (objects || []).find(o =>
          o.name === pod.file_name || o.name.endsWith(`_${pod.file_name}`)
        );

        if (match) {
          storagePath = `${folder}/${match.name}`;
          await supabase
            .from('pod_documents')
            .update({ file_url: storagePath })
            .eq('id', pod.id);
        }
      } catch (e) {
        console.warn('Could not repair POD storage path:', e);
      }
    }

    if (!storagePath) return '';

    const { data, error } = await supabase.storage
      .from('driver-documents')
      .createSignedUrl(storagePath, 3600);

    if (error) {
      console.error('Error creating signed URL:', error);
      return '';
    }

    return data?.signedUrl || '';
  }, []);

  const openPod = useCallback(async (pod: PodDocument) => {
    const url = await resolvePodUrl(pod);
    if (!url) {
      toast({ title: 'Error', description: 'No se pudo abrir el archivo (ruta no encontrada)', variant: 'destructive' });
      return;
    }
    window.open(url, '_blank', 'noopener,noreferrer');
  }, [resolvePodUrl, toast]);

  const downloadPod = useCallback(async (pod: PodDocument) => {
    const url = await resolvePodUrl(pod);
    if (!url) {
      toast({ title: 'Error', description: 'No se pudo descargar el archivo (ruta no encontrada)', variant: 'destructive' });
      return;
    }
    // Use an anchor click to avoid CORS/download inconsistencies
    const a = document.createElement('a');
    a.href = url;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.download = pod.file_name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }, [resolvePodUrl, toast]);

  return { pods, loading, uploading, uploadPod, deletePod, openPod, downloadPod };
}
