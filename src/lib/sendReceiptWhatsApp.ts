import { supabase } from '@/integrations/supabase/client';

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export type ReceiptSendResult = 'sent' | 'no_group' | 'disabled' | 'error';

/** Envía el recibo en PDF al grupo de WhatsApp del beneficiario. El texto sale de la plantilla editable. */
export async function sendReceiptWhatsApp(params: {
  recipientType: string;
  recipientId: string | null;
  recipientName: string;
  blob: Blob;
  fileName: string;
  kind: 'single' | 'batch';
  amount: number;
  loadReference?: string;
  count?: number;
}): Promise<ReceiptSendResult> {
  try {
    const { data, error } = await supabase.functions.invoke('send-payment-receipt-whatsapp', {
      body: {
        recipient_type: params.recipientType,
        recipient_id: params.recipientId,
        recipient_name: params.recipientName,
        file_name: params.fileName,
        pdf_base64: await blobToBase64(params.blob),
        kind: params.kind,
        amount: params.amount,
        load_reference: params.loadReference ?? null,
        count: params.count ?? null,
      },
    });
    if (error || data?.error) {
      console.error('[sendReceiptWhatsApp]', data?.error || error);
      return 'error';
    }
    if (data?.skipped === 'disabled') return 'disabled';
    return data?.skipped ? 'no_group' : 'sent';
  } catch (e) {
    console.error('[sendReceiptWhatsApp]', e);
    return 'error';
  }
}
