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

      const { data: urlData } = supabase.storage
        .from('driver-documents')
        .getPublicUrl(path);

      const fileType = file.type.startsWith('image/') ? 'image' : 'pdf';
      const tenant_id = await getTenantId();

      const { error: insertError } = await supabase
        .from('pod_documents')
        .insert({
          load_id: loadId,
          stop_id: stopId || null,
          file_url: urlData.publicUrl,
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

  return { pods, loading, uploading, uploadPod, deletePod };
}
