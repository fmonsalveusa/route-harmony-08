import jsPDF from 'jspdf';
import type { Company } from '@/hooks/useCompanies';

export interface BolLineItem {
  quantity: string;
  description: string;
  weight_lb: string;
  weight_kg: string;
}

interface BolData {
  bolNumber: string;
  date: string | null;
  shipperAddress: string;
  consigneeAddress: string;
  carrierName: string;
  company: Company | null;
  items?: BolLineItem[];
}

/** Parse a full address string into street, city, state/province, zip, phone */
function parseAddress(address: string): { street: string; city: string; state: string; zip: string } {
  if (!address) return { street: '', city: '', state: '', zip: '' };
  const parts = address.split(',').map(p => p.trim()).filter(Boolean);
  if (parts.length >= 3) {
    const street = parts.slice(0, parts.length - 2).join(', ');
    const city = parts[parts.length - 2];
    const lastPart = parts[parts.length - 1];
    const zipMatch = lastPart.match(/(\d{5}(-\d{4})?)/);
    const zip = zipMatch ? zipMatch[1] : '';
    const state = lastPart.replace(/\d{5}(-\d{4})?/, '').trim();
    return { street, city, state, zip };
  }
  if (parts.length === 2) {
    return { street: parts[0], city: parts[1], state: '', zip: '' };
  }
  return { street: address, city: '', state: '', zip: '' };
}

export function generateBolPdf(data: BolData) {
  const doc = new jsPDF();
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 15;
  const contentW = pageW - margin * 2;
  let y = margin;

  // ═══════════════════════════════════════════════
  // TITLE
  // ═══════════════════════════════════════════════
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('STRAIGHT BILL OF LADING', pageW / 2, y + 6, { align: 'center' });
  y += 10;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text('ORIGINAL - NOT NEGOTIABLE', pageW / 2, y + 4, { align: 'center' });

  // BOL # and Date (top-right)
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text(`BOL #:  ${data.bolNumber}`, pageW - margin, margin + 6, { align: 'right' });
  const dateStr = data.date
    ? new Date(data.date + 'T00:00:00').toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })
    : '';
  doc.text(`Date:  ${dateStr}`, pageW - margin, margin + 14, { align: 'right' });

  y += 14;

  // ═══════════════════════════════════════════════
  // SHIPPER (FROM)
  // ═══════════════════════════════════════════════
  const boxH = 38;
  const halfW = contentW / 2 - 3;

  // Shipper box
  doc.setDrawColor(0);
  doc.setLineWidth(0.5);
  doc.rect(margin, y, halfW, boxH);

  doc.setFillColor(30, 64, 120);
  doc.rect(margin, y, halfW, 8, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('SHIPPER (FROM)', margin + 3, y + 6);
  doc.setTextColor(0, 0, 0);

  const shipper = parseAddress(data.shipperAddress);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  let sy = y + 14;
  doc.text(`STREET: ${shipper.street}`, margin + 3, sy); sy += 6;
  doc.text(`CITY: ${shipper.city}`, margin + 3, sy);
  doc.text(`STATE: ${shipper.state}`, margin + halfW / 2, sy); sy += 6;
  doc.text(`ZIP: ${shipper.zip}`, margin + 3, sy);

  // ═══════════════════════════════════════════════
  // CONSIGNEE (TO)
  // ═══════════════════════════════════════════════
  const consX = margin + halfW + 6;
  doc.rect(consX, y, halfW, boxH);

  doc.setFillColor(30, 64, 120);
  doc.rect(consX, y, halfW, 8, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('CONSIGNEE (TO)', consX + 3, y + 6);
  doc.setTextColor(0, 0, 0);

  const consignee = parseAddress(data.consigneeAddress);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  let cy2 = y + 14;
  doc.text(`STREET: ${consignee.street}`, consX + 3, cy2); cy2 += 6;
  doc.text(`CITY: ${consignee.city}`, consX + 3, cy2);
  doc.text(`STATE: ${consignee.state}`, consX + halfW / 2, cy2); cy2 += 6;
  doc.text(`ZIP: ${consignee.zip}`, consX + 3, cy2);

  y += boxH + 8;

  // ═══════════════════════════════════════════════
  // ITEMS TABLE
  // ═══════════════════════════════════════════════
  const tableHeaders = ['Quantity', 'Class/HM', 'Description of Articles', 'NMFC No.', 'Lb', 'Kg'];
  const colWidths = [22, 20, contentW - 22 - 20 - 22 - 18 - 18, 22, 18, 18];
  const tableH = 8;

  // Header row
  doc.setFillColor(30, 64, 120);
  doc.rect(margin, y, contentW, tableH, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  let tx = margin;
  tableHeaders.forEach((h, i) => {
    doc.text(h, tx + 2, y + 5.5);
    tx += colWidths[i];
  });
  doc.setTextColor(0, 0, 0);

  // Data rows (items or empty)
  const rowCount = Math.max(5, (data.items || []).length);
  for (let r = 0; r < rowCount; r++) {
    const ry = y + tableH + r * 8;
    doc.setDrawColor(180);
    doc.rect(margin, ry, contentW, 8);
    let rx = margin;
    colWidths.forEach((w) => {
      doc.line(rx, ry, rx, ry + 8);
      rx += w;
    });
    // Fill in item data if available
    const item = data.items?.[r];
    if (item) {
      doc.setFontSize(7);
      doc.setFont('helvetica', 'normal');
      let ix = margin;
      doc.text(item.quantity || '', ix + 2, ry + 5.5);
      ix += colWidths[0]; // Class/HM - skip
      ix += colWidths[1];
      doc.text(item.description || '', ix + 2, ry + 5.5);
      ix += colWidths[2]; // NMFC - skip
      ix += colWidths[3];
      doc.text(item.weight_lb || '', ix + 2, ry + 5.5);
      ix += colWidths[4];
      doc.text(item.weight_kg || '', ix + 2, ry + 5.5);
    }
  }
  y += tableH + rowCount * 8 + 6;

  // ═══════════════════════════════════════════════
  // COD SECTION
  // ═══════════════════════════════════════════════
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('COD AMOUNT: $______________', margin, y);
  y += 6;
  doc.setFont('helvetica', 'normal');
  doc.text('REMIT COD TO: ____________________________', margin, y);
  y += 10;

  // ═══════════════════════════════════════════════
  // LIABILITY SECTION (condensed)
  // ═══════════════════════════════════════════════
  doc.setFontSize(6.5);
  doc.setFont('helvetica', 'bold');
  doc.text('Carrier liability with shipment originating within the United States:', margin, y);
  y += 4;
  doc.setFont('helvetica', 'normal');
  const liabilityText = "Carrier's liability shall be based on actual NMFC class of the shipment and is limited between $1.00 and $25.00 per pound. Carrier's highest level of liability is $25.00 per pound per individual lost or damaged piece within the shipment, subject to $150,000.00 maximum total liability per shipment.";
  const lines = doc.splitTextToSize(liabilityText, contentW);
  doc.text(lines, margin, y);
  y += lines.length * 3.5 + 4;

  doc.setFont('helvetica', 'bold');
  doc.text('Carrier liability with shipment originating within Canada:', margin, y);
  y += 4;
  doc.setFont('helvetica', 'normal');
  const canadaText = "Unless the Shipper completes the Special Agreement below, Carrier's maximum liability is CAN$2.00 per pound (CAN$4.41 per kilogram) per individual lost or damaged piece within the shipment, subject to a maximum total liability per shipment of CAN$20,000.00.";
  const lines2 = doc.splitTextToSize(canadaText, contentW);
  doc.text(lines2, margin, y);
  y += lines2.length * 3.5 + 8;

  // ═══════════════════════════════════════════════
  // SIGNATURES
  // ═══════════════════════════════════════════════
  const rowH = 10;
  const sigY = Math.max(y, pageH - 52);

  // Row 1: SHIPPER | RECEIVER SIGNATURE
  doc.setDrawColor(0);
  doc.setLineWidth(0.3);
  doc.rect(margin, sigY, contentW / 2, rowH);
  doc.rect(margin + contentW / 2, sigY, contentW / 2, rowH);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text('SHIPPER', margin + 2, sigY + 4);
  doc.text('RECEIVER SIGNATURE', margin + contentW / 2 + 2, sigY + 4);

  // Row 2: AUTHORIZED SIGNATURE | PRINT NAME
  const r2 = sigY + rowH;
  doc.rect(margin, r2, contentW / 2, rowH);
  doc.rect(margin + contentW / 2, r2, contentW / 2, rowH);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.text('AUTHORIZED  SIGNATURE', margin + 2, r2 + 4);
  doc.line(margin + 38, r2 + 4.5, margin + contentW / 2 - 3, r2 + 4.5);
  doc.text('PRINT NAME', margin + contentW / 2 + 2, r2 + 4);
  doc.line(margin + contentW / 2 + 25, r2 + 4.5, margin + contentW - 3, r2 + 4.5);

  // Row 3: CARRIER (with company name) | DATE | TIME
  const r3 = r2 + rowH;
  const carrierW = contentW * 0.5;
  const dateW = contentW * 0.3;
  const timeW = contentW * 0.2;
  doc.rect(margin, r3, carrierW, rowH * 1.4);
  doc.rect(margin + carrierW, r3, dateW, rowH * 1.4);
  doc.rect(margin + carrierW + dateW, r3, timeW, rowH * 1.4);

  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.text('CARRIER', margin + 2, r3 + 4);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text('DATE', margin + carrierW + 2, r3 + 4);
  doc.text('TIME', margin + carrierW + dateW + 2, r3 + 4);

  // Row 4: AUTHORIZED SIGNATURE | DATE | OBSERVATIONS
  const r4 = r3 + rowH * 1.4;
  const authSigW = contentW * 0.3;
  const authDateW = contentW * 0.2;
  const obsW = contentW * 0.5;
  doc.rect(margin, r4, authSigW, rowH);
  doc.rect(margin + authSigW, r4, authDateW, rowH);
  doc.rect(margin + authSigW + authDateW, r4, obsW, rowH);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.text('AUTHORIZED  SIGNATURE', margin + 2, r4 + 4);
  doc.text('DATE', margin + authSigW + 2, r4 + 4);
  doc.text('OBSERVATIONS', margin + authSigW + authDateW + 2, r4 + 4);

  doc.save(`BOL_${data.bolNumber}.pdf`);
}
