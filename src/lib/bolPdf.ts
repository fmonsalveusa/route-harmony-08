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
  driverName?: string;
  pickupDate?: string | null;
  deliveryDate?: string | null;
}

function parseAddress(address: string): { name: string; street: string; cityStateZip: string } {
  if (!address) return { name: '', street: '', cityStateZip: '' };
  const parts = address.split(',').map(p => p.trim()).filter(Boolean);
  if (parts.length >= 3) {
    return {
      name: '',
      street: parts.slice(0, parts.length - 2).join(', '),
      cityStateZip: parts.slice(parts.length - 2).join(', '),
    };
  }
  if (parts.length === 2) {
    return { name: '', street: parts[0], cityStateZip: parts[1] };
  }
  return { name: '', street: address, cityStateZip: '' };
}

function fmtDate(d: string | null | undefined): string {
  if (!d) return '';
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
}

/* ───────── helpers ───────── */
function drawLabelValue(doc: jsPDF, label: string, value: string, x: number, y: number, maxW?: number) {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.text(label, x, y);
  const labelW = doc.getTextWidth(label);
  doc.setFont('helvetica', 'normal');
  doc.text(value, x + labelW + 1, y);
}

export function generateBolPdf(data: BolData) {
  const doc = new jsPDF();
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 12;
  const contentW = pageW - margin * 2;
  const halfW = contentW / 2;
  let y = margin;

  // ═══════════════════════════════════════════════
  // TITLE
  // ═══════════════════════════════════════════════
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('STRAIGHT BILL OF LADING', pageW / 2, y + 6, { align: 'center' });
  y += 10;
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text('ORIGINAL - NOT NEGOTIABLE', pageW / 2, y + 3, { align: 'center' });
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text('Page 1 of    1', pageW - margin, y + 3, { align: 'right' });
  y += 7;

  const shipper = parseAddress(data.shipperAddress);
  const consignee = parseAddress(data.consigneeAddress);
  const rowH = 7;

  // ═══════════════════════════════════════════════
  // SHIP FROM (left) + BOL# / Carrier info (right)
  // ═══════════════════════════════════════════════
  const shipFromY = y;
  const shipFromH = rowH * 5; // 5 rows

  // Ship From header
  doc.setFillColor(0, 0, 0);
  doc.rect(margin, y, halfW, rowH, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.text('SHIP FROM', margin + 2, y + 5);
  doc.setTextColor(0, 0, 0);

  // Ship From rows
  const sfX = margin;
  let ry = y + rowH;
  doc.rect(sfX, ry, halfW, rowH); drawLabelValue(doc, 'Name:', '', sfX + 2, ry + 5); ry += rowH;
  doc.rect(sfX, ry, halfW, rowH); drawLabelValue(doc, 'Address:', shipper.street, sfX + 2, ry + 5); ry += rowH;
  doc.rect(sfX, ry, halfW, rowH); drawLabelValue(doc, 'City/State/Zip:', shipper.cityStateZip, sfX + 2, ry + 5); ry += rowH;
  doc.rect(sfX, ry, halfW, rowH);
  drawLabelValue(doc, 'SID#:', '', sfX + 2, ry + 5);
  doc.text('FOB: □', sfX + halfW - 18, ry + 5);

  // Right side: Bill of Lading Number + barcode space
  const rX = margin + halfW;
  ry = shipFromY;
  const rightBlockH = shipFromH + rowH;
  doc.rect(rX, ry, halfW, rowH * 2);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text('Bill of Lading Number:', rX + 2, ry + 5);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text(data.bolNumber, rX + 42, ry + 6);
  // Barcode space label
  doc.setFontSize(7);
  doc.setTextColor(180, 180, 180);
  doc.text('B A R  C O D E  S P A C E', rX + halfW / 2, ry + 12, { align: 'center' });
  doc.setTextColor(0, 0, 0);

  ry = shipFromY + rowH * 2;
  // remaining right rows aligned with SHIP FROM
  const remainRightH = shipFromH + rowH - rowH * 2;
  doc.rect(rX, ry, halfW, remainRightH);
  // empty space for now

  y = shipFromY + shipFromH + rowH;

  // ═══════════════════════════════════════════════
  // SHIP TO (left) + CARRIER NAME info (right)
  // ═══════════════════════════════════════════════
  const shipToY = y;

  // Ship To header
  doc.setFillColor(0, 0, 0);
  doc.rect(margin, y, halfW, rowH, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.text('SHIP TO', margin + 2, y + 5);
  doc.setTextColor(0, 0, 0);

  ry = y + rowH;
  doc.rect(sfX, ry, halfW, rowH); drawLabelValue(doc, 'Name:', '', sfX + 2, ry + 5); ry += rowH;
  doc.rect(sfX, ry, halfW, rowH); drawLabelValue(doc, 'Address:', consignee.street, sfX + 2, ry + 5); ry += rowH;
  doc.rect(sfX, ry, halfW, rowH); drawLabelValue(doc, 'City/State/Zip:', consignee.cityStateZip, sfX + 2, ry + 5); ry += rowH;
  doc.rect(sfX, ry, halfW, rowH);
  drawLabelValue(doc, 'CID#:', '', sfX + 2, ry + 5);
  doc.text('FOB: □', sfX + halfW - 18, ry + 5);

  // Right side: Carrier info
  ry = shipToY;
  doc.rect(rX, ry, halfW, rowH); drawLabelValue(doc, 'CARRIER NAME:', data.carrierName, rX + 2, ry + 5); ry += rowH;
  doc.rect(rX, ry, halfW, rowH); drawLabelValue(doc, 'Trailer number:', '', rX + 2, ry + 5); ry += rowH;
  doc.rect(rX, ry, halfW, rowH); drawLabelValue(doc, 'Seal number(s):', '', rX + 2, ry + 5); ry += rowH;
  doc.rect(rX, ry, halfW, rowH); drawLabelValue(doc, 'SCAC:', '', rX + 2, ry + 5); ry += rowH;
  doc.rect(rX, ry, halfW, rowH); drawLabelValue(doc, 'Pro number:', '', rX + 2, ry + 5);

  y = shipToY + rowH * 5 + rowH;

  // ═══════════════════════════════════════════════
  // THIRD PARTY FREIGHT CHARGES BILL TO (left) + Freight terms (right)
  // ═══════════════════════════════════════════════
  const tpY = y;
  const tpH = rowH * 4;

  doc.setFontSize(6.5);
  doc.setFont('helvetica', 'bold');
  doc.rect(margin, y, halfW, rowH);
  doc.text('THIRD PARTY FREIGHT CHARGES BILL TO:', margin + 2, y + 5);
  ry = y + rowH;
  doc.rect(margin, ry, halfW, rowH); drawLabelValue(doc, 'Name:', '', margin + 2, ry + 5); ry += rowH;
  doc.rect(margin, ry, halfW, rowH); drawLabelValue(doc, 'Address:', '', margin + 2, ry + 5); ry += rowH;
  doc.rect(margin, ry, halfW, rowH); drawLabelValue(doc, 'City/State/Zip:', '', margin + 2, ry + 5);

  // Right: Freight charge terms
  doc.rect(rX, tpY, halfW, rowH);
  doc.setTextColor(180, 180, 180);
  doc.setFontSize(7);
  doc.text('B A R  C O D E  S P A C E', rX + halfW / 2, tpY + 5, { align: 'center' });
  doc.setTextColor(0, 0, 0);
  doc.rect(rX, tpY + rowH, halfW, rowH);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.text('Freight Charge Terms:', rX + 2, tpY + rowH + 5);
  // Prepaid / Collect / 3rd Party
  doc.rect(rX, tpY + rowH * 2, halfW, rowH * 2);
  doc.setFontSize(6.5);
  doc.setFont('helvetica', 'normal');
  doc.text('Prepaid ___   Collect ___   3rd Party ___', rX + 2, tpY + rowH * 2 + 5);

  y = tpY + tpH;

  // ═══════════════════════════════════════════════
  // SPECIAL INSTRUCTIONS
  // ═══════════════════════════════════════════════
  doc.rect(margin, y, contentW, rowH);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.text('SPECIAL INSTRUCTIONS:', margin + 2, y + 5);
  y += rowH;

  // ═══════════════════════════════════════════════
  // CARRIER INFORMATION TABLE
  // ═══════════════════════════════════════════════
  doc.setFillColor(0, 0, 0);
  doc.rect(margin, y, contentW, rowH, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.text('CARRIER INFORMATION', margin + contentW / 2, y + 5, { align: 'center' });
  doc.setTextColor(0, 0, 0);
  y += rowH;

  // Table headers
  const cols = {
    huQty: 18,
    huType: 18,
    pkgQty: 18,
    pkgType: 18,
    weight: 22,
    hm: 12,
    desc: contentW - 18 - 18 - 18 - 18 - 22 - 12,
  };

  // Header row
  const hdrH = 12;
  doc.setFontSize(5.5);
  doc.setFont('helvetica', 'bold');

  let cx = margin;
  // HANDLING UNIT
  doc.rect(cx, y, cols.huQty + cols.huType, hdrH);
  doc.text('HANDLING UNIT', cx + 2, y + 3.5);
  doc.text('QTY', cx + 2, y + 8.5);
  doc.line(cx + cols.huQty, y + 4, cx + cols.huQty, y + hdrH);
  doc.text('TYPE', cx + cols.huQty + 2, y + 8.5);
  cx += cols.huQty + cols.huType;

  // PACKAGE
  doc.rect(cx, y, cols.pkgQty + cols.pkgType, hdrH);
  doc.text('PACKAGE', cx + 2, y + 3.5);
  doc.text('QTY', cx + 2, y + 8.5);
  doc.line(cx + cols.pkgQty, y + 4, cx + cols.pkgQty, y + hdrH);
  doc.text('TYPE', cx + cols.pkgQty + 2, y + 8.5);
  cx += cols.pkgQty + cols.pkgType;

  // WEIGHT
  doc.rect(cx, y, cols.weight, hdrH);
  doc.text('WEIGHT', cx + 2, y + 8.5);
  cx += cols.weight;

  // H.M.
  doc.rect(cx, y, cols.hm, hdrH);
  doc.text('H.M.', cx + 1, y + 3.5);
  doc.text('(X)', cx + 2, y + 8.5);
  cx += cols.hm;

  // COMMODITY DESCRIPTION
  doc.rect(cx, y, cols.desc, hdrH);
  doc.text('COMMODITY DESCRIPTION', cx + 2, y + 7);

  y += hdrH;

  // Data rows
  const dataRowH = 8;
  const numRows = Math.max(8, (data.items || []).length);

  for (let r = 0; r < numRows; r++) {
    cx = margin;
    doc.setDrawColor(0);
    const item = data.items?.[r];

    // Draw cells
    doc.rect(cx, y, cols.huQty, dataRowH); cx += cols.huQty;
    doc.rect(cx, y, cols.huType, dataRowH); cx += cols.huType;
    doc.rect(cx, y, cols.pkgQty, dataRowH);
    if (item) {
      doc.setFontSize(6.5);
      doc.setFont('helvetica', 'normal');
      doc.text(item.quantity || '', margin + 2, y + 5.5);
    }
    cx += cols.pkgQty;
    doc.rect(cx, y, cols.pkgType, dataRowH); cx += cols.pkgType;
    doc.rect(cx, y, cols.weight, dataRowH);
    if (item) {
      doc.setFontSize(6.5);
      doc.setFont('helvetica', 'normal');
      doc.text(item.weight_lb || '', cx + 2, y + 5.5);
    }
    cx += cols.weight;
    doc.rect(cx, y, cols.hm, dataRowH); cx += cols.hm;
    doc.rect(cx, y, cols.desc, dataRowH);
    if (item) {
      doc.setFontSize(6.5);
      doc.setFont('helvetica', 'normal');
      doc.text(item.description || '', cx + 2, y + 5.5);
    }
    cx += cols.desc;

    y += dataRowH;
  }

  // GRAND TOTAL row
  cx = margin;
  doc.setFillColor(220, 220, 220);
  doc.rect(cx, y, cols.huQty + cols.huType + cols.pkgQty + cols.pkgType, dataRowH, 'FD');
  cx += cols.huQty + cols.huType + cols.pkgQty + cols.pkgType;
  doc.setFillColor(255, 255, 255);
  doc.rect(cx, y, cols.weight, dataRowH);
  cx += cols.weight;
  doc.setFillColor(220, 220, 220);
  doc.rect(cx, y, cols.hm, dataRowH, 'FD');
  cx += cols.hm;
  doc.setFillColor(255, 255, 255);
  doc.rect(cx, y, cols.desc, dataRowH);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.text('GRAND TOTAL', cx + 2, y + 5.5);
  cx += cols.desc;
  y += dataRowH + 2;


  // ═══════════════════════════════════════════════
  // SIGNATURE SECTION (4 rows)
  // ═══════════════════════════════════════════════
  const sigRowH = 10;

  // Row 1: SHIPPER | RECEIVER SIGNATURE
  doc.setDrawColor(0);
  doc.setLineWidth(0.2);
  doc.rect(margin, y, halfW, sigRowH);
  doc.rect(margin + halfW, y, halfW, sigRowH);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.text('SHIPPER', margin + 2, y + 4);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.text('RECEIVER SIGNATURE', margin + halfW + 2, y + 4);
  y += sigRowH;

  // Row 2: AUTHORIZED SIGNATURE | PRINT NAME
  doc.rect(margin, y, halfW, sigRowH);
  doc.rect(margin + halfW, y, halfW, sigRowH);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.text('AUTHORIZED SIGNATURE', margin + 2, y + 4);
  doc.text('PRINT NAME', margin + halfW + 2, y + 4);
  y += sigRowH;

  // Row 3: DRIVER NAME | DATE | TIME
  const driverW = halfW;
  const dateW = contentW * 0.3;
  const timeW = contentW - driverW - dateW;
  doc.rect(margin, y, driverW, sigRowH * 1.3);
  doc.rect(margin + driverW, y, dateW, sigRowH * 1.3);
  doc.rect(margin + driverW + dateW, y, timeW, sigRowH * 1.3);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.text('DRIVER NAME', margin + 2, y + 4);
  if (data.driverName) {
    doc.setFontSize(12);
    doc.setFont('courier', 'bolditalic');
    doc.text(data.driverName, margin + driverW / 2, y + 11, { align: 'center' });
  }
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.text('DATE', margin + driverW + 2, y + 4);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.text('TIME', margin + driverW + dateW + 2, y + 4);
  y += sigRowH * 1.3;

  // Row 4: AUTHORIZED SIGNATURE | DATE | OBSERVATIONS
  const authW = contentW * 0.3;
  const authDateW = contentW * 0.2;
  const obsW = contentW - authW - authDateW;
  doc.rect(margin, y, authW, sigRowH);
  doc.rect(margin + authW, y, authDateW, sigRowH);
  doc.rect(margin + authW + authDateW, y, obsW, sigRowH);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.text('AUTHORIZED SIGNATURE', margin + 2, y + 4);
  doc.text('DATE', margin + authW + 2, y + 4);
  if (data.pickupDate) {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(fmtDate(data.pickupDate), margin + authW + authDateW / 2, y + 7, { align: 'center' });
  }
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.text('OBSERVATIONS', margin + authW + authDateW + 2, y + 4);

  doc.save(`BOL_${data.bolNumber}.pdf`);
}
