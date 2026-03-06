import jsPDF from 'jspdf';
import type { DbPayment } from '@/hooks/usePayments';

interface BatchPaymentItem {
  payment: DbPayment;
  adjustment: number;
  finalAmount: number;
}

export function generateBatchPaymentReceipt(
  recipientName: string,
  recipientType: string,
  items: BatchPaymentItem[],
  companyName?: string,
) {
  const doc = new jsPDF();
  const date = new Date().toISOString().split('T')[0];
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  let y = 20;

  doc.setFillColor(37, 99, 235);
  doc.rect(0, 0, pageWidth, 36, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text('BATCH PAYMENT RECEIPT', margin, 24);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Date: ${date}`, pageWidth - margin, 16, { align: 'right' });
  doc.text(`Type: ${recipientType.charAt(0).toUpperCase() + recipientType.slice(1)}`, pageWidth - margin, 24, { align: 'right' });
  doc.text(`Payments: ${items.length}`, pageWidth - margin, 32, { align: 'right' });

  y = 50;
  doc.setTextColor(55, 65, 81);

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

  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Beneficiary', margin, y);
  y += 3;
  doc.setDrawColor(37, 99, 235);
  doc.setLineWidth(0.5);
  doc.line(margin, y, pageWidth - margin, y);
  y += 10;
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text(recipientName, margin, y);
  y += 12;

  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Load Details', margin, y);
  y += 3;
  doc.setDrawColor(37, 99, 235);
  doc.line(margin, y, pageWidth - margin, y);
  y += 8;

  doc.setFontSize(9);
  doc.setFillColor(243, 244, 246);
  doc.rect(margin, y - 4, pageWidth - margin * 2, 8, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(55, 65, 81);
  doc.text('Reference', margin + 2, y);
  doc.text('Rate', margin + 45, y);
  doc.text('%', margin + 75, y);
  doc.text('Base', margin + 95, y);
  doc.text('Adjustment', margin + 120, y);
  doc.text('Total', pageWidth - margin - 2, y, { align: 'right' });
  y += 8;

  let grandTotal = 0;

  doc.setFont('helvetica', 'normal');
  items.forEach(item => {
    if (y > 260) {
      doc.addPage();
      y = 20;
    }

    const p = item.payment;
    const base = Number(p.amount);
    const adj = item.adjustment;
    const total = item.finalAmount;
    grandTotal += total;

    doc.setTextColor(55, 65, 81);
    doc.text(p.load_reference, margin + 2, y);
    doc.text(`$${Number(p.total_rate).toLocaleString('en-US', { minimumFractionDigits: 2 })}`, margin + 45, y);
    doc.text(`${p.percentage_applied}%`, margin + 75, y);
    doc.text(`$${base.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, margin + 95, y);

    if (adj !== 0) {
      doc.setTextColor(adj > 0 ? 22 : 220, adj > 0 ? 163 : 38, adj > 0 ? 74 : 38);
      doc.text(`${adj > 0 ? '+' : ''}$${adj.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, margin + 120, y);
    } else {
      doc.setTextColor(156, 163, 175);
      doc.text('—', margin + 120, y);
    }

    doc.setTextColor(55, 65, 81);
    doc.setFont('helvetica', 'bold');
    doc.text(`$${total.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, pageWidth - margin - 2, y, { align: 'right' });
    doc.setFont('helvetica', 'normal');

    y += 2;
    doc.setDrawColor(229, 231, 235);
    doc.setLineWidth(0.2);
    doc.line(margin, y, pageWidth - margin, y);
    y += 6;
  });

  y += 6;
  if (y > 250) {
    doc.addPage();
    y = 20;
  }

  doc.setFillColor(239, 246, 255);
  doc.roundedRect(margin, y - 4, pageWidth - margin * 2, 22, 3, 3, 'F');

  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(37, 99, 235);
  doc.text('TOTAL PAYABLE', margin + 6, y + 10);
  doc.text(`$${grandTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, pageWidth - margin - 6, y + 10, { align: 'right' });

  const footerY = doc.internal.pageSize.getHeight() - 15;
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(156, 163, 175);
  doc.text('This document is an automatically generated batch payment receipt.', pageWidth / 2, footerY, { align: 'center' });

  doc.save(`Batch_Receipt_${recipientName.replace(/\s+/g, '_')}_${date}.pdf`);
}
