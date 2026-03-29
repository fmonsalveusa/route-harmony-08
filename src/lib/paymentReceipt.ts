import jsPDF from 'jspdf';
import type { DbPayment } from '@/hooks/usePayments';
import type { DbPaymentAdjustment } from '@/hooks/usePaymentAdjustments';
import { ADJUSTMENT_REASONS } from '@/hooks/usePaymentAdjustments';
import { loadPdfLogo } from './pdfLogoLoader';

const reasonLabel = (r: string) => ADJUSTMENT_REASONS.find(a => a.value === r)?.label || r;

/** Extract "City, ST" from a full address */
const extractCityState = (address: string): string => {
  if (!address) return '—';
  const parts = address.split(',').map(p => p.trim());
  for (let i = parts.length - 1; i >= 0; i--) {
    const stateMatch = parts[i].match(/\b([A-Z]{2})\b/);
    if (stateMatch && i > 0) {
      const city = parts[i - 1];
      return `${city}, ${stateMatch[1]}`;
    }
  }
  return parts.length >= 2 ? `${parts[0]}, ${parts[1]}` : address;
};

export interface DispatcherLoadItem {
  load_reference: string;
  origin: string;
  destination: string;
  total_rate: number;
  percentage_applied: number;
  amount: number;
}

export async function generatePaymentReceipt(
  payment: DbPayment,
  adjustments: DbPaymentAdjustment[],
  totalAdjustment: number,
  finalAmount: number,
  dispatcherLoadItems?: DispatcherLoadItem[],
  loadOrigin?: string,
  loadDestination?: string,
  pickupDate?: string | null,
  deliveryDate?: string | null,
  companyName?: string,
) {
  const doc = new jsPDF();
  const rawDate = payment.payment_date || new Date().toISOString().split('T')[0];
  const dateParts = rawDate.split('T')[0].split('-');
  const date = dateParts.length === 3 ? `${dateParts[1]}/${dateParts[2]}/${dateParts[0]}` : rawDate;
  const baseAmount = Number(payment.amount);
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  let y = 20;

  // Blue banner
  doc.setFillColor(37, 99, 235);
  doc.rect(0, 0, pageWidth, 36, 'F');

  // Logo in banner
  try {
    const logoData = await loadPdfLogo();
    doc.addImage(logoData, 'PNG', margin, 3, 40, 12);
  } catch {}

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text('PAYMENT RECEIPT', margin, 28);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Date: ${date}`, pageWidth - margin, 16, { align: 'right' });
  doc.text(`Ref: ${payment.load_reference}`, pageWidth - margin, 24, { align: 'right' });
  doc.text(`Type: ${payment.recipient_type.charAt(0).toUpperCase() + payment.recipient_type.slice(1)}`, pageWidth - margin, 32, { align: 'right' });

  y = 50;

  // Company banner
  if (companyName) {
    doc.setFillColor(243, 244, 246);
    doc.roundedRect(margin, y - 4, pageWidth - margin * 2, 12, 2, 2, 'F');
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(55, 65, 81);
    doc.text(`Company: ${companyName}`, margin + 6, y + 4);
    y += 16;
  }
  doc.setTextColor(55, 65, 81);

  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Payment Information', margin, y);
  y += 3;
  doc.setDrawColor(37, 99, 235);
  doc.setLineWidth(0.5);
  doc.line(margin, y, pageWidth - margin, y);
  y += 10;

  doc.setFontSize(10);
  const infoRows = [
    ['Beneficiary', payment.recipient_name],
    ['Load Reference', payment.load_reference],
    ['Total Rate', `$${Number(payment.total_rate).toLocaleString('en-US', { minimumFractionDigits: 2 })}`],
    ['Percentage Applied', `${payment.percentage_applied}%`],
    ['Base Amount', `$${baseAmount.toFixed(2)}`],
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

  // Single-load details for driver/investor
  if (!dispatcherLoadItems && (loadOrigin || loadDestination)) {
    y += 6;
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(55, 65, 81);
    doc.text('Load Details', margin, y);
    y += 3;
    doc.setDrawColor(37, 99, 235);
    doc.setLineWidth(0.5);
    doc.line(margin, y, pageWidth - margin, y);
    y += 10;

    doc.setFontSize(10);
    const fmtDate = (d: string | null | undefined) => {
      if (!d) return '—';
      const [yr, m, day] = d.split('-');
      return `${m}/${day}/${yr}`;
    };

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(107, 114, 128);
    doc.text('Origin:', margin, y);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(55, 65, 81);
    doc.text(extractCityState(loadOrigin || ''), margin + 60, y);
    y += 7;
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(107, 114, 128);
    doc.text('Pick up:', margin, y);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(55, 65, 81);
    doc.text(fmtDate(pickupDate), margin + 60, y);
    y += 10;

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(107, 114, 128);
    doc.text('Destination:', margin, y);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(55, 65, 81);
    doc.text(extractCityState(loadDestination || ''), margin + 60, y);
    y += 7;
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(107, 114, 128);
    doc.text('Delivered:', margin, y);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(55, 65, 81);
    doc.text(fmtDate(deliveryDate), margin + 60, y);
    y += 10;
  }

  // Dispatcher consolidated load details
  if (dispatcherLoadItems && dispatcherLoadItems.length > 0) {
    y += 6;
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(55, 65, 81);
    doc.text('Load Details', margin, y);
    y += 3;
    doc.setDrawColor(37, 99, 235);
    doc.setLineWidth(0.5);
    doc.line(margin, y, pageWidth - margin, y);
    y += 8;

    doc.setFontSize(8);
    doc.setFillColor(243, 244, 246);
    doc.rect(margin, y - 4, pageWidth - margin * 2, 8, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(55, 65, 81);
    doc.text('Load #', margin + 2, y);
    doc.text('Origin', margin + 28, y);
    doc.text('Destination', margin + 72, y);
    doc.text('Rate', margin + 116, y);
    doc.text('%', margin + 138, y);
    doc.text('Payment', pageWidth - margin - 2, y, { align: 'right' });
    y += 8;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    dispatcherLoadItems.forEach(item => {
      if (y > 260) {
        doc.addPage();
        y = 20;
      }

      doc.setTextColor(55, 65, 81);
      doc.text(item.load_reference, margin + 2, y);
      doc.text(extractCityState(item.origin).substring(0, 22), margin + 28, y);
      doc.text(extractCityState(item.destination).substring(0, 22), margin + 72, y);
      doc.text(`$${Number(item.total_rate).toLocaleString('en-US', { minimumFractionDigits: 2 })}`, margin + 116, y);
      doc.text(`${item.percentage_applied}%`, margin + 138, y);
      doc.setFont('helvetica', 'bold');
      doc.text(`$${Number(item.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}`, pageWidth - margin - 2, y, { align: 'right' });
      doc.setFont('helvetica', 'normal');

      y += 2;
      doc.setDrawColor(229, 231, 235);
      doc.setLineWidth(0.2);
      doc.line(margin, y, pageWidth - margin, y);
      y += 6;
    });
  }

  if (adjustments.length > 0) {
    y += 6;
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(55, 65, 81);
    doc.text('Adjustments', margin, y);
    y += 3;
    doc.setDrawColor(37, 99, 235);
    doc.line(margin, y, pageWidth - margin, y);
    y += 8;

    doc.setFontSize(9);
    doc.setFillColor(243, 244, 246);
    doc.rect(margin, y - 4, pageWidth - margin * 2, 8, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(55, 65, 81);
    doc.text('Type', margin + 2, y);
    doc.text('Reason', margin + 30, y);
    doc.text('Description', margin + 70, y);
    doc.text('Amount', pageWidth - margin - 2, y, { align: 'right' });
    y += 8;

    doc.setFont('helvetica', 'normal');
    adjustments.forEach(adj => {
      const sign = adj.adjustment_type === 'addition' ? '+' : '-';
      const typeLabel = adj.adjustment_type === 'addition' ? 'Addition' : 'Deduction';

      doc.setTextColor(107, 114, 128);
      doc.text(typeLabel, margin + 2, y);
      doc.text(reasonLabel(adj.reason), margin + 30, y);
      doc.text(adj.description || '—', margin + 70, y, { maxWidth: 60 });

      if (adj.adjustment_type === 'addition') {
        doc.setTextColor(22, 163, 74);
      } else {
        doc.setTextColor(220, 38, 38);
      }
      doc.setFont('helvetica', 'bold');
      doc.text(`${sign}$${Number(adj.amount).toFixed(2)}`, pageWidth - margin - 2, y, { align: 'right' });
      doc.setFont('helvetica', 'normal');

      y += 2;
      doc.setDrawColor(229, 231, 235);
      doc.setLineWidth(0.2);
      doc.line(margin, y, pageWidth - margin, y);
      y += 6;
    });
  }

  y += 8;
  doc.setFillColor(239, 246, 255);
  doc.roundedRect(margin, y - 4, pageWidth - margin * 2, totalAdjustment !== 0 ? 34 : 22, 3, 3, 'F');

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(55, 65, 81);
  doc.text('Base Amount', margin + 6, y + 4);
  doc.text(`$${baseAmount.toFixed(2)}`, pageWidth - margin - 6, y + 4, { align: 'right' });

  if (totalAdjustment !== 0) {
    y += 8;
    doc.text('Adjustments', margin + 6, y + 4);
    if (totalAdjustment >= 0) {
      doc.setTextColor(22, 163, 74);
    } else {
      doc.setTextColor(220, 38, 38);
    }
    doc.text(`${totalAdjustment >= 0 ? '+' : ''}$${totalAdjustment.toFixed(2)}`, pageWidth - margin - 6, y + 4, { align: 'right' });
    y += 4;
  }

  y += 6;
  doc.setDrawColor(37, 99, 235);
  doc.setLineWidth(0.8);
  doc.line(margin + 4, y, pageWidth - margin - 4, y);
  y += 8;

  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(37, 99, 235);
  doc.text('TOTAL PAYABLE', margin + 6, y);
  doc.text(`$${finalAmount.toFixed(2)}`, pageWidth - margin - 6, y, { align: 'right' });

  const footerY = doc.internal.pageSize.getHeight() - 15;
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(156, 163, 175);
  doc.text('This document is an automatically generated payment receipt.', pageWidth / 2, footerY, { align: 'center' });

  doc.save(`Receipt_${payment.load_reference}_${payment.recipient_name.replace(/\s+/g, '_')}.pdf`);
}
