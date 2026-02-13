import jsPDF from 'jspdf';

function addSignatureImage(doc: jsPDF, sigDataUrl: string, x: number, y: number, w: number, h: number) {
  try {
    doc.addImage(sigDataUrl, 'PNG', x, y, w, h);
  } catch {
    // fallback: draw placeholder
    doc.setFontSize(8);
    doc.text('[Signature on file]', x, y + h / 2);
  }
}

// ─── W-9 PDF ───
export function generateW9Pdf(data: {
  name: string; businessName: string; taxClassification: string;
  exemptions: string; address: string; cityStateZip: string;
  ssn: string; ein: string; date: string; signature: string;
}): Blob {
  const doc = new jsPDF();
  const m = 20; // margin
  let y = 20;

  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Form W-9', m, y);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text('Request for Taxpayer Identification Number and Certification', m, y + 6);
  doc.text('(Rev. October 2018) — Department of the Treasury / Internal Revenue Service', m, y + 11);
  y += 22;

  doc.setDrawColor(0);
  doc.line(m, y, 190, y);
  y += 8;

  const field = (label: string, value: string) => {
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text(label, m, y);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text(value || '—', m, y + 5);
    y += 12;
  };

  field('1  Name (as shown on your income tax return)', data.name);
  field('2  Business name / disregarded entity name', data.businessName);
  field('3  Federal tax classification', data.taxClassification);
  field('4  Exemptions', data.exemptions);
  field('5  Address (number, street, and apt. or suite no.)', data.address);
  field('6  City, state, and ZIP code', data.cityStateZip);

  y += 4;
  doc.line(m, y, 190, y);
  y += 8;

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text('Part I — Taxpayer Identification Number (TIN)', m, y);
  y += 6;

  if (data.ssn) {
    doc.setFontSize(9);
    doc.text(`Social Security Number: ${data.ssn}`, m, y);
    y += 6;
  }
  if (data.ein) {
    doc.setFontSize(9);
    doc.text(`Employer Identification Number: ${data.ein}`, m, y);
    y += 6;
  }

  y += 6;
  doc.line(m, y, 190, y);
  y += 8;

  doc.setFontSize(8);
  doc.text('Part II — Certification', m, y);
  y += 5;
  doc.setFontSize(7);
  const cert = 'Under penalties of perjury, I certify that: (1) The number shown on this form is my correct taxpayer identification number, (2) I am not subject to backup withholding, (3) I am a U.S. citizen or other U.S. person, (4) The FATCA code(s) entered on this form (if any) indicating that I am exempt from FATCA reporting is correct.';
  const lines = doc.splitTextToSize(cert, 170);
  doc.text(lines, m, y);
  y += lines.length * 3.5 + 8;

  doc.setFontSize(9);
  doc.text('Signature:', m, y);
  addSignatureImage(doc, data.signature, m + 25, y - 8, 60, 20);
  doc.text(`Date: ${data.date}`, 140, y);

  return doc.output('blob');
}

// ─── LEASING AGREEMENT PDF ───
export function generateLeasingPdf(data: {
  driverName: string; companyName: string;
  make: string; model: string; vin: string; year: number;
  date: string; signatures: { contract: string; eld: string; hos: string };
}): Blob {
  const doc = new jsPDF();
  const m = 20;
  let y = 20;

  // Title
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('OWNER OPERATOR LEASE AGREEMENT', m, y);
  y += 10;

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(`Date: ${data.date}`, m, y);
  y += 5;
  doc.text(`Owner Operator: ${data.driverName}`, m, y);
  if (data.companyName) { y += 5; doc.text(`Company: ${data.companyName}`, m, y); }
  y += 5;
  doc.text(`Vehicle: ${data.year} ${data.make} ${data.model}  |  VIN: ${data.vin || 'N/A'}`, m, y);
  y += 10;

  const clauses = [
    ['1. PURPOSE', 'Owner Operator agrees to lease the vehicle described above to Carrier (58 Logistics LLC) for transportation services under Carrier\'s operating authority.'],
    ['2. TERM', 'This agreement shall remain in effect until terminated by either party with written notice.'],
    ['3. COMPENSATION', 'Owner Operator shall be compensated per the agreed pay percentage for each load completed.'],
    ['4. EQUIPMENT', 'Owner Operator warrants that the vehicle is in good mechanical condition and meets all DOT requirements.'],
    ['5. INSURANCE', 'Carrier will maintain liability and cargo insurance. Owner Operator is responsible for physical damage coverage.'],
    ['6. MAINTENANCE', 'Owner Operator is responsible for all maintenance, fuel, tolls, and operational expenses.'],
    ['7. COMPLIANCE', 'Both parties agree to comply with all applicable federal, state, and local regulations.'],
    ['8. INDEPENDENT CONTRACTOR', 'Owner Operator is an independent contractor, not an employee of Carrier.'],
    ['9. TERMINATION', 'Either party may terminate this agreement with 30 days written notice.'],
  ];

  for (const [title, text] of clauses) {
    if (y > 265) { doc.addPage(); y = 20; }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text(title, m, y);
    y += 5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    const lines = doc.splitTextToSize(text, 170);
    doc.text(lines, m, y);
    y += lines.length * 4 + 4;
  }

  y += 5;
  doc.setFontSize(9);
  doc.text('Owner Operator Signature:', m, y);
  addSignatureImage(doc, data.signatures.contract, m + 50, y - 8, 60, 20);
  doc.text(`Date: ${data.date}`, 140, y);

  // ELD Policy page
  doc.addPage();
  y = 20;
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text('ELD COMPLIANCE POLICY', m, y);
  y += 10;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  const eldText = `As an Owner Operator leased to 58 Logistics LLC, I, ${data.driverName}, acknowledge and agree to comply with the FMCSA Electronic Logging Device (ELD) mandate.\n\nRequirements:\n• Maintain a functioning ELD in the vehicle at all times during operation.\n• Ensure accurate recording of all driving hours and duty status changes.\n• Make ELD records available for inspection by law enforcement upon request.\n• Report any ELD malfunctions to Carrier within 24 hours.\n• Not tamper with, disable, or falsify ELD records.\n\nViolations of this policy may result in immediate termination of the lease agreement.`;
  const eldLines = doc.splitTextToSize(eldText, 170);
  doc.text(eldLines, m, y);
  y += eldLines.length * 4 + 10;

  doc.text('Owner Operator Signature:', m, y);
  addSignatureImage(doc, data.signatures.eld, m + 50, y - 8, 60, 20);
  doc.text(`Date: ${data.date}`, 140, y);

  // HOS Policy page
  doc.addPage();
  y = 20;
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text('HOURS OF SERVICE (HOS) POLICY', m, y);
  y += 10;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  const hosText = `As an Owner Operator leased to 58 Logistics LLC, I, ${data.driverName}, acknowledge and agree to comply with the FMCSA Hours of Service regulations.\n\nKey Rules:\n• 11-Hour Driving Limit: May drive a maximum of 11 hours after 10 consecutive hours off duty.\n• 14-Hour Limit: May not drive beyond the 14th consecutive hour after coming on duty.\n• 30-Minute Break: Must take a 30-minute break after 8 cumulative hours of driving.\n• 60/70-Hour Limit: May not drive after 60/70 hours on duty in 7/8 consecutive days.\n• Sleeper Berth: May split the required 10-hour off-duty period as permitted by regulations.\n\nViolations of HOS regulations may result in fines, out-of-service orders, and termination of this agreement.`;
  const hosLines = doc.splitTextToSize(hosText, 170);
  doc.text(hosLines, m, y);
  y += hosLines.length * 4 + 10;

  doc.text('Owner Operator Signature:', m, y);
  addSignatureImage(doc, data.signatures.hos, m + 50, y - 8, 60, 20);
  doc.text(`Date: ${data.date}`, 140, y);

  return doc.output('blob');
}

// ─── SERVICE AGREEMENT PDF ───
export function generateServiceAgreementPdf(data: {
  driverName: string; address: string; date: string; signature: string;
}): Blob {
  const doc = new jsPDF();
  const m = 20;
  let y = 20;

  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text('CONTRATO DE SERVICIOS DE DISPATCH', 105, y, { align: 'center' });
  y += 6;
  doc.text('DISPATCH SERVICES CONTRACT', 105, y, { align: 'center' });
  y += 12;

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(`Fecha / Date: ${data.date}`, m, y);
  y += 5;
  doc.text(`Conductor / Driver: ${data.driverName}`, m, y);
  y += 5;
  doc.text(`Dirección / Address: ${data.address}`, m, y);
  y += 10;

  const clauses = [
    ['CLÁUSULA 1 - PARTES / PARTIES', `Este contrato se celebra entre 58 Logistics LLC ("La Empresa") y ${data.driverName} ("El Conductor"). / This contract is entered into between 58 Logistics LLC ("The Company") and ${data.driverName} ("The Driver").`],
    ['CLÁUSULA 2 - OBJETO / PURPOSE', 'La Empresa proporcionará servicios de dispatch al Conductor, incluyendo la búsqueda y negociación de cargas. / The Company will provide dispatch services to the Driver, including load searching and negotiation.'],
    ['CLÁUSULA 3 - OBLIGACIONES DE LA EMPRESA / COMPANY OBLIGATIONS', 'Buscar cargas que se ajusten al equipo del Conductor, negociar tarifas competitivas, proporcionar soporte operativo. / Search for loads suitable for the Driver\'s equipment, negotiate competitive rates, provide operational support.'],
    ['CLÁUSULA 4 - OBLIGACIONES DEL CONDUCTOR / DRIVER OBLIGATIONS', 'Mantener el equipo en condiciones operativas, cumplir con DOT y FMCSA, comunicar problemas oportunamente. / Maintain equipment in operational condition, comply with DOT and FMCSA, communicate issues promptly.'],
    ['CLÁUSULA 5 - COMPENSACIÓN / COMPENSATION', 'El porcentaje de servicio de dispatch será acordado por separado y deducido de las ganancias de cada carga. / The dispatch service percentage will be agreed separately and deducted from each load\'s earnings.'],
    ['CLÁUSULA 6 - DURACIÓN / DURATION', 'Este contrato permanecerá vigente hasta que cualquiera de las partes lo termine con aviso por escrito. / This contract shall remain in effect until either party terminates it with written notice.'],
    ['CLÁUSULA 7 - TERMINACIÓN / TERMINATION', 'Cualquiera de las partes puede terminar este contrato con 30 días de aviso por escrito. / Either party may terminate this contract with 30 days written notice.'],
    ['CLÁUSULA 8 - CONFIDENCIALIDAD / CONFIDENTIALITY', 'Ambas partes acuerdan mantener confidencial toda la información comercial. / Both parties agree to keep all business information confidential.'],
    ['CLÁUSULA 9 - LEY APLICABLE / GOVERNING LAW', 'Este contrato se regirá por las leyes del Estado de Texas. / This contract shall be governed by the laws of the State of Texas.'],
  ];

  for (const [title, text] of clauses) {
    if (y > 260) { doc.addPage(); y = 20; }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text(title, m, y);
    y += 5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    const lines = doc.splitTextToSize(text, 170);
    doc.text(lines, m, y);
    y += lines.length * 4 + 5;
  }

  y += 10;
  if (y > 250) { doc.addPage(); y = 20; }
  doc.setFontSize(9);
  doc.text('Firma del Conductor / Driver Signature:', m, y);
  addSignatureImage(doc, data.signature, m + 60, y - 8, 60, 20);
  y += 15;
  doc.text(`Fecha / Date: ${data.date}`, m, y);

  return doc.output('blob');
}
