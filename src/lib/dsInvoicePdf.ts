import jsPDF from 'jspdf';
import dispatchUpLogo from '@/assets/dispatch-up-logo.png';

interface DSLoadItem {
  reference_number: string;
  origin: string;
  destination: string;
  total_rate: number;
  fee: number;
  driver_name: string;
  percentage: number;
}

interface DSInvoicePdfData {
  invoiceNumber: string;
  driverName: string;
  loads: DSLoadItem[];
  totalAmount: number;
  createdAt: string;
  notes?: string | null;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

export async function generateDSInvoicePdf(data: DSInvoicePdfData) {
  const doc = new jsPDF();
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  let y = 20;

  // Logo
  try {
    const img = await loadImage(dispatchUpLogo);
    doc.addImage(img, 'PNG', 15, 8, 45, 20);
  } catch (e) {
    // fallback: no logo
  }

  // Title
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 64, 120);
  doc.text('DISPATCH SERVICE INVOICE', pageW - 15, y + 8, { align: 'right' });
  doc.setTextColor(0, 0, 0);

  // Invoice info
  y += 14;
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
  doc.text(data.driverName, 18, y);
  y += 10;

  // Group loads by driver
  const driverMap: Record<string, { loads: DSLoadItem[]; percentage: number }> = {};
  data.loads.forEach(l => {
    if (!driverMap[l.driver_name]) {
      driverMap[l.driver_name] = { loads: [], percentage: l.percentage };
    }
    driverMap[l.driver_name].loads.push(l);
  });

  const driverNames = Object.keys(driverMap);

  // Table header dimensions
  const colWidths = { ref: 30, origin: 40, dest: 40, rate: 25, pct: 18, fee: 27 };
  const tableW = pageW - 30;
  const startX = 15;

  const checkNewPage = (needed: number) => {
    if (y + needed > pageH - 25) {
      doc.addPage();
      y = 20;
    }
  };

  driverNames.forEach((driverName, dIdx) => {
    const group = driverMap[driverName];
    checkNewPage(30);

    // Driver section header
    doc.setFillColor(30, 64, 120);
    doc.rect(startX, y - 4, tableW, 10, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text(`${driverName}  —  ${group.percentage}%`, startX + 3, y + 3);
    doc.setTextColor(0, 0, 0);
    y += 12;

    // Column headers
    doc.setFillColor(245, 245, 250);
    doc.rect(startX, y - 4, tableW, 8, 'F');
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    let cx = startX + 2;
    doc.text('REF #', cx, y + 1); cx += colWidths.ref;
    doc.text('ORIGIN', cx, y + 1); cx += colWidths.origin;
    doc.text('DESTINATION', cx, y + 1); cx += colWidths.dest;
    doc.text('RATE', cx + colWidths.rate - 2, y + 1, { align: 'right' }); cx += colWidths.rate;
    doc.text('%', cx + colWidths.pct - 2, y + 1, { align: 'right' }); cx += colWidths.pct;
    doc.text('FEE', cx + colWidths.fee - 2, y + 1, { align: 'right' });
    y += 8;

    // Load rows
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    let driverSubtotal = 0;

    group.loads.forEach((load, i) => {
      checkNewPage(8);
      if (i % 2 === 0) {
        doc.setFillColor(250, 250, 255);
        doc.rect(startX, y - 4, tableW, 7, 'F');
      }
      cx = startX + 2;
      doc.text(load.reference_number, cx, y);
      cx += colWidths.ref;

      // Truncate long addresses
      const truncate = (s: string, max: number) => s.length > max ? s.substring(0, max - 2) + '..' : s;
      doc.text(truncate(load.origin, 28), cx, y);
      cx += colWidths.origin;
      doc.text(truncate(load.destination, 28), cx, y);
      cx += colWidths.dest;
      doc.text(`$${Number(load.total_rate).toLocaleString()}`, cx + colWidths.rate - 2, y, { align: 'right' });
      cx += colWidths.rate;
      doc.text(`${load.percentage}%`, cx + colWidths.pct - 2, y, { align: 'right' });
      cx += colWidths.pct;
      doc.text(`$${load.fee.toFixed(2)}`, cx + colWidths.fee - 2, y, { align: 'right' });

      driverSubtotal += load.fee;
      y += 7;
    });

    // Driver subtotal
    checkNewPage(10);
    doc.setDrawColor(200, 200, 200);
    doc.line(startX, y - 2, startX + tableW, y - 2);
    y += 4;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text(`Subtotal ${driverName}:`, startX + 2, y);
    doc.text(`$${driverSubtotal.toFixed(2)}`, startX + tableW - 2, y, { align: 'right' });
    y += 12;
  });

  // Grand total
  checkNewPage(20);
  doc.setDrawColor(30, 64, 120);
  doc.setLineWidth(0.5);
  doc.line(15, y, pageW - 15, y);
  y += 10;
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('TOTAL DUE:', 18, y);
  doc.setTextColor(30, 64, 120);
  doc.text(`$${data.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, pageW - 18, y, { align: 'right' });
  doc.setTextColor(0, 0, 0);

  // Notes
  if (data.notes) {
    y += 14;
    checkNewPage(15);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('Notes:', 18, y);
    doc.setFont('helvetica', 'normal');
    doc.text(data.notes, 18, y + 6, { maxWidth: pageW - 36 });
  }

  // Footer
  y = pageH - 15;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(120, 120, 120);
  doc.text('Thank you for your business!', pageW / 2, y, { align: 'center' });

  doc.save(`DS_Invoice_${data.invoiceNumber}.pdf`);
}
