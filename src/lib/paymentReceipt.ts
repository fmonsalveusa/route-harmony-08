import jsPDF from 'jspdf';
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
  const doc = new jsPDF();
  const date = payment.payment_date || new Date().toISOString().split('T')[0];
  const baseAmount = Number(payment.amount);
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  let y = 20;

  // Header bar
  doc.setFillColor(37, 99, 235); // blue
  doc.rect(0, 0, pageWidth, 36, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text('RECIBO DE PAGO', margin, 24);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Fecha: ${date}`, pageWidth - margin, 16, { align: 'right' });
  doc.text(`Ref: ${payment.load_reference}`, pageWidth - margin, 24, { align: 'right' });
  doc.text(`Tipo: ${payment.recipient_type.charAt(0).toUpperCase() + payment.recipient_type.slice(1)}`, pageWidth - margin, 32, { align: 'right' });

  y = 50;
  doc.setTextColor(55, 65, 81);

  // Section: Payment Info
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Información del Pago', margin, y);
  y += 3;
  doc.setDrawColor(37, 99, 235);
  doc.setLineWidth(0.5);
  doc.line(margin, y, pageWidth - margin, y);
  y += 10;

  doc.setFontSize(10);
  const infoRows = [
    ['Beneficiario', payment.recipient_name],
    ['Referencia de Carga', payment.load_reference],
    ['Tarifa Total (Rate)', `$${Number(payment.total_rate).toLocaleString('en-US', { minimumFractionDigits: 2 })}`],
    ['Porcentaje Aplicado', `${payment.percentage_applied}%`],
    ['Monto Base', `$${baseAmount.toFixed(2)}`],
  ];

  infoRows.forEach(([label, value]) => {
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(107, 114, 128);
    doc.text(label, margin, y);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(55, 65, 81);
    doc.text(value, margin + 60, y);
    y += 7;
  });

  // Section: Adjustments
  if (adjustments.length > 0) {
    y += 6;
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(55, 65, 81);
    doc.text('Ajustes', margin, y);
    y += 3;
    doc.setDrawColor(37, 99, 235);
    doc.line(margin, y, pageWidth - margin, y);
    y += 8;

    // Table header
    doc.setFontSize(9);
    doc.setFillColor(243, 244, 246);
    doc.rect(margin, y - 4, pageWidth - margin * 2, 8, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(55, 65, 81);
    doc.text('Tipo', margin + 2, y);
    doc.text('Motivo', margin + 30, y);
    doc.text('Descripción', margin + 70, y);
    doc.text('Monto', pageWidth - margin - 2, y, { align: 'right' });
    y += 8;

    doc.setFont('helvetica', 'normal');
    adjustments.forEach(adj => {
      const sign = adj.adjustment_type === 'addition' ? '+' : '-';
      const typeLabel = adj.adjustment_type === 'addition' ? 'Adición' : 'Deducción';

      doc.setTextColor(107, 114, 128);
      doc.text(typeLabel, margin + 2, y);
      doc.text(reasonLabel(adj.reason), margin + 30, y);
      doc.text(adj.description || '—', margin + 70, y, { maxWidth: 60 });

      if (adj.adjustment_type === 'addition') {
        doc.setTextColor(22, 163, 74); // green
      } else {
        doc.setTextColor(220, 38, 38); // red
      }
      doc.setFont('helvetica', 'bold');
      doc.text(`${sign}$${Number(adj.amount).toFixed(2)}`, pageWidth - margin - 2, y, { align: 'right' });
      doc.setFont('helvetica', 'normal');

      // Light separator
      y += 2;
      doc.setDrawColor(229, 231, 235);
      doc.setLineWidth(0.2);
      doc.line(margin, y, pageWidth - margin, y);
      y += 6;
    });
  }

  // Summary box
  y += 8;
  doc.setFillColor(239, 246, 255); // light blue bg
  doc.roundedRect(margin, y - 4, pageWidth - margin * 2, totalAdjustment !== 0 ? 34 : 22, 3, 3, 'F');

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(55, 65, 81);
  doc.text('Monto Base', margin + 6, y + 4);
  doc.text(`$${baseAmount.toFixed(2)}`, pageWidth - margin - 6, y + 4, { align: 'right' });

  if (totalAdjustment !== 0) {
    y += 8;
    doc.text('Ajustes', margin + 6, y + 4);
    if (totalAdjustment >= 0) {
      doc.setTextColor(22, 163, 74);
    } else {
      doc.setTextColor(220, 38, 38);
    }
    doc.text(`${totalAdjustment >= 0 ? '+' : ''}$${totalAdjustment.toFixed(2)}`, pageWidth - margin - 6, y + 4, { align: 'right' });
    y += 4;
  }

  // Divider
  y += 6;
  doc.setDrawColor(37, 99, 235);
  doc.setLineWidth(0.8);
  doc.line(margin + 4, y, pageWidth - margin - 4, y);
  y += 8;

  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(37, 99, 235);
  doc.text('TOTAL A PAGAR', margin + 6, y);
  doc.text(`$${finalAmount.toFixed(2)}`, pageWidth - margin - 6, y, { align: 'right' });

  // Footer
  const footerY = doc.internal.pageSize.getHeight() - 15;
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(156, 163, 175);
  doc.text('Este documento es un recibo de pago generado automáticamente.', pageWidth / 2, footerY, { align: 'center' });

  // Download
  doc.save(`Recibo_${payment.load_reference}_${payment.recipient_name.replace(/\s+/g, '_')}.pdf`);
}
