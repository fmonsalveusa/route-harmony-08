import jsPDF from 'jspdf';
import type { Company } from '@/hooks/useCompanies';

interface BolData {
  bolNumber: string;
  date: string | null;
  shipperAddress: string;
  consigneeAddress: string;
  carrierName: string;
  company: Company | null;
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

  // Empty rows for content (5 rows)
  for (let r = 0; r < 5; r++) {
    const ry = y + tableH + r * 8;
    doc.setDrawColor(180);
    doc.rect(margin, ry, contentW, 8);
    let rx = margin;
    colWidths.forEach((w) => {
      doc.line(rx, ry, rx, ry + 8);
      rx += w;
    });
  }
  y += tableH + 5 * 8 + 6;

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
  const sigY = Math.max(y, pageH - 55);
  const sigW = contentW / 2 - 3;

  // Shipper signature box
  doc.setDrawColor(0);
  doc.setLineWidth(0.5);
  doc.rect(margin, sigY, sigW, 30);
  doc.setFillColor(30, 64, 120);
  doc.rect(margin, sigY, sigW, 7, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('SHIPPER', margin + 3, sigY + 5);
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.text('AUTHORIZED SIGNATURE:', margin + 3, sigY + 14);
  doc.line(margin + 40, sigY + 14.5, margin + sigW - 3, sigY + 14.5);
  doc.text('PRINT NAME:', margin + 3, sigY + 22);
  doc.line(margin + 30, sigY + 22.5, margin + sigW - 3, sigY + 22.5);

  // Carrier signature box
  const cSigX = margin + sigW + 6;
  doc.rect(cSigX, sigY, sigW, 30);
  doc.setFillColor(30, 64, 120);
  doc.rect(cSigX, sigY, sigW, 7, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('CARRIER', cSigX + 3, sigY + 5);
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text(data.carrierName || data.company?.name || '', cSigX + 3, sigY + 13);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.text('AUTHORIZED SIGNATURE:', cSigX + 3, sigY + 20);
  doc.line(cSigX + 40, sigY + 20.5, cSigX + sigW - 3, sigY + 20.5);
  doc.text('DATE:', cSigX + 3, sigY + 26);
  doc.line(cSigX + 15, sigY + 26.5, cSigX + sigW / 2 - 5, sigY + 26.5);

  // Receiver signature at bottom
  const recY = sigY + 34;
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.text('RECEIVER SIGNATURE:', margin, recY);
  doc.line(margin + 35, recY + 0.5, margin + sigW, recY + 0.5);
  doc.text('DATE:', margin + sigW + 10, recY);
  doc.line(margin + sigW + 22, recY + 0.5, pageW - margin, recY + 0.5);

  doc.save(`BOL_${data.bolNumber}.pdf`);
}
