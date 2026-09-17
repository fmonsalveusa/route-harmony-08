import { supabase } from '@/integrations/supabase/client';

const money = (n: number) => '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export function singlePaymentCaption(amount: number, loadReference: string) {
  return `Pago procesado por ${money(amount)} — Carga #${loadReference}. Adjunto el recibo de pago.`;
}

export function batchPaymentCaption(amount: number) {
  return `Pago procesado por ${money(amount)}. Anexo el recibo de pago con el detalle de las cargas incluidas en este pago.`;
}

export type ReceiptSendResult = 'sent' | 'no_group' | 'error';

/** Envía el recibo en PDF al grupo de WhatsApp del beneficiario */
export async function sendReceiptWhatsApp(params: {
  recipientType: string;
  recipientId: string | null;
  recipientName: string;
  blob: Blob;
  fileName: string;
  caption: string;
}): Promise<ReceiptSendResult> {
  try {
    const { data, error } = await supabase.functions.invoke('send-payment-receipt-whatsapp', {
      body: {
        recipient_type: params.recipientType,
        recipient_id: params.recipientId,
        recipient_name: params.recipientName,
        file_name: params.fileName,
        caption: params.caption,
        pdf_base64: await blobToBase64(params.blob),
      },
    });
    if (error || data?.error) {
      console.error('[sendReceiptWhatsApp]', data?.error || error);
      return 'error';
    }
    return data?.skipped ? 'no_group' : 'sent';
  } catch (e) {
    console.error('[sendReceiptWhatsApp]', e);
    return 'error';
  }
}
