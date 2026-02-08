import type { DbPayment } from '@/hooks/usePayments';
import type { DbPaymentAdjustment } from '@/hooks/usePaymentAdjustments';
import { ADJUSTMENT_REASONS } from '@/hooks/usePaymentAdjustments';

const reasonLabel = (r: string) => ADJUSTMENT_REASONS.find(a => a.value === r)?.label || r;

export function generatePaymentReceipt(
  payment: DbPayment,
  adjustments: DbPaymentAdjustment[],
  totalAdjustment: number,
  finalAmount: number,
) {
  const date = payment.payment_date || new Date().toISOString().split('T')[0];
  const baseAmount = Number(payment.amount);

  let adjRows = '';
  adjustments.forEach(a => {
    const sign = a.adjustment_type === 'addition' ? '+' : '-';
    adjRows += `
      <tr>
        <td style="padding:6px 12px;border-bottom:1px solid #eee;">${reasonLabel(a.reason)}</td>
        <td style="padding:6px 12px;border-bottom:1px solid #eee;">${a.description || '—'}</td>
        <td style="padding:6px 12px;border-bottom:1px solid #eee;text-align:right;color:${a.adjustment_type === 'addition' ? '#16a34a' : '#dc2626'}">${sign}$${Number(a.amount).toFixed(2)}</td>
      </tr>`;
  });

  const html = `
<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Recibo de Pago - ${payment.load_reference}</title>
<style>
  body { font-family: Arial, sans-serif; margin: 0; padding: 40px; color: #1a1a1a; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 30px; border-bottom: 3px solid #2563eb; padding-bottom: 20px; }
  .title { font-size: 24px; font-weight: bold; color: #2563eb; }
  .subtitle { font-size: 12px; color: #666; margin-top: 4px; }
  .section { margin-bottom: 20px; }
  .section-title { font-size: 14px; font-weight: bold; color: #374151; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.5px; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th { background: #f3f4f6; text-align: left; padding: 8px 12px; font-weight: 600; color: #374151; }
  .summary { background: #eff6ff; padding: 16px; border-radius: 8px; margin-top: 20px; }
  .total-row { font-size: 18px; font-weight: bold; color: #2563eb; }
  .footer { margin-top: 40px; text-align: center; font-size: 11px; color: #999; border-top: 1px solid #eee; padding-top: 16px; }
  @media print { body { padding: 20px; } }
</style>
</head><body>
  <div class="header">
    <div>
      <div class="title">RECIBO DE PAGO</div>
      <div class="subtitle">Ref: ${payment.load_reference} | Fecha: ${date}</div>
    </div>
    <div style="text-align:right">
      <div style="font-size:13px;color:#666;">Tipo: ${payment.recipient_type.charAt(0).toUpperCase() + payment.recipient_type.slice(1)}</div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Información del Pago</div>
    <table>
      <tr><th style="width:40%">Beneficiario</th><td style="padding:8px 12px;">${payment.recipient_name}</td></tr>
      <tr><th>Referencia de Carga</th><td style="padding:8px 12px;">${payment.load_reference}</td></tr>
      <tr><th>Tarifa Total (Rate)</th><td style="padding:8px 12px;">$${Number(payment.total_rate).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td></tr>
      <tr><th>Porcentaje Aplicado</th><td style="padding:8px 12px;">${payment.percentage_applied}%</td></tr>
      <tr><th>Monto Base</th><td style="padding:8px 12px;font-weight:600;">$${baseAmount.toFixed(2)}</td></tr>
    </table>
  </div>

  ${adjustments.length > 0 ? `
  <div class="section">
    <div class="section-title">Ajustes</div>
    <table>
      <thead><tr><th>Motivo</th><th>Descripción</th><th style="text-align:right">Monto</th></tr></thead>
      <tbody>${adjRows}</tbody>
    </table>
  </div>` : ''}

  <div class="summary">
    <table>
      <tr><td style="padding:4px 0;">Monto Base</td><td style="text-align:right;padding:4px 0;">$${baseAmount.toFixed(2)}</td></tr>
      ${totalAdjustment !== 0 ? `<tr><td style="padding:4px 0;">Ajustes</td><td style="text-align:right;padding:4px 0;color:${totalAdjustment >= 0 ? '#16a34a' : '#dc2626'}">${totalAdjustment >= 0 ? '+' : ''}$${totalAdjustment.toFixed(2)}</td></tr>` : ''}
      <tr><td colspan="2" style="border-top:2px solid #2563eb;padding-top:8px;"></td></tr>
      <tr class="total-row"><td style="padding:4px 0;">TOTAL A PAGAR</td><td style="text-align:right;padding:4px 0;">$${finalAmount.toFixed(2)}</td></tr>
    </table>
  </div>

  <div class="footer">Este documento es un recibo de pago generado automáticamente.</div>
</body></html>`;

  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const w = window.open(url, '_blank');
  if (w) {
    w.onload = () => {
      setTimeout(() => w.print(), 500);
    };
  }
}
