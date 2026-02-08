import jsPDF from 'jspdf';
import type { Company } from '@/hooks/useCompanies';

interface InvoiceData {
  invoiceNumber: string;
  brokerName: string;
  loadRef: string;
  origin: string;
  destination: string;
  pickupDate: string | null;
  deliveryDate: string | null;
  miles: number | null;
  totalRate: number;
  company: Company | null;
  createdAt: string;
}

export function generateInvoicePdf(data: InvoiceData) {
  const doc = new jsPDF();
  const pageW = doc.internal.pageSize.getWidth();
  let y = 20;

  // Company header (right-aligned)
  if (data.company) {
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text(data.company.name, pageW - 15, y, { align: 'right' });
    y += 6;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    if (data.company.address) {
      doc.text(`${data.company.address}`, pageW - 15, y, { align: 'right' });
      y += 4;
    }
    if (data.company.city || data.company.state || data.company.zip) {
      doc.text(`${data.company.city || ''}, ${data.company.state || ''} ${data.company.zip || ''}`.trim(), pageW - 15, y, { align: 'right' });
      y += 4;
    }
    if (data.company.phone) { doc.text(`Phone: ${data.company.phone}`, pageW - 15, y, { align: 'right' }); y += 4; }
    if (data.company.email) { doc.text(`Email: ${data.company.email}`, pageW - 15, y, { align: 'right' }); y += 4; }
    if (data.company.mc_number) { doc.text(`MC# ${data.company.mc_number}`, pageW - 15, y, { align: 'right' }); y += 4; }
    if (data.company.dot_number) { doc.text(`DOT# ${data.company.dot_number}`, pageW - 15, y, { align: 'right' }); y += 4; }
  }

  // INVOICE title
  y = Math.max(y + 8, 50);
  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 64, 120);
  doc.text('INVOICE', 15, y);
  doc.setTextColor(0, 0, 0);

  // Invoice info
  y += 12;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('Invoice #:', 15, y);
  doc.setFont('helvetica', 'normal');
  doc.text(data.invoiceNumber, 55, y);
  doc.setFont('helvetica', 'bold');
  doc.text('Date:', pageW / 2 + 10, y);
  doc.setFont('helvetica', 'normal');
  doc.text(new Date(data.createdAt).toLocaleDateString('en-US'), pageW / 2 + 30, y);

  // Bill To
  y += 14;
  doc.setFillColor(240, 240, 245);
  doc.rect(15, y - 4, pageW - 30, 10, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('BILL TO', 18, y + 3);
  y += 14;
  doc.setFontSize(12);
  doc.text(data.brokerName, 18, y);
  y += 6;

  // Load details table
  y += 10;
  const colX = [15, pageW - 15];
  doc.setFillColor(30, 64, 120);
  doc.rect(15, y - 4, pageW - 30, 10, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('LOAD DETAILS', 18, y + 3);
  doc.setTextColor(0, 0, 0);
  y += 14;

  const addRow = (label: string, value: string) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text(label, 18, y);
    doc.setFont('helvetica', 'normal');
    doc.text(value, 70, y);
    y += 7;
  };

  addRow('Load Reference:', data.loadRef);
  addRow('Origin:', data.origin);
  addRow('Destination:', data.destination);
  if (data.pickupDate) addRow('Pickup Date:', new Date(data.pickupDate).toLocaleDateString('en-US'));
  if (data.deliveryDate) addRow('Delivery Date:', new Date(data.deliveryDate).toLocaleDateString('en-US'));
  if (data.miles && data.miles > 0) addRow('Miles:', data.miles.toLocaleString());

  // Total
  y += 8;
  doc.setDrawColor(200, 200, 200);
  doc.line(15, y, pageW - 15, y);
  y += 10;
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('TOTAL DUE:', 18, y);
  doc.setTextColor(30, 64, 120);
  doc.text(`$${data.totalRate.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, pageW - 18, y, { align: 'right' });
  doc.setTextColor(0, 0, 0);

  // Footer
  y += 20;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(120, 120, 120);
  doc.text('Thank you for your business!', pageW / 2, y, { align: 'center' });

  doc.save(`Invoice_${data.invoiceNumber}.pdf`);
}
