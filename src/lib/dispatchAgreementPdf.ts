import jsPDF from 'jspdf';
import { format } from 'date-fns';
import type { DispatchCompanyData } from '@/components/onboarding/DispatchServiceOnboarding';

interface Options {
  company: DispatchCompanyData;
  signerName: string;
  signatureDataUrl: string; // PNG data URL
}

// Clausulas del Dispatch Service Agreement (mismo texto que DispatchAgreementFullText.tsx)
const CLAUSES: Array<{ num: string; titleEn: string; titleEs: string; en: string; es: string }> = [
  { num: '1', titleEn: 'PARTIES', titleEs: 'PARTES',
    en: `This Dispatch Service Agreement ("Agreement") is entered into between 58 Logistics LLC, 11634 N Wind Place Apt 206, Charlotte, NC 28210, Phone: (704) 727-6015, Email: 58logisticsllc@gmail.com ("Dispatcher"), and {CLIENT} ("Client" or "Carrier").`,
    es: `El presente Contrato de Servicios de Dispatch ("Contrato") se celebra entre 58 Logistics LLC, 11634 N Wind Place Apt 206, Charlotte, NC 28210, Teléfono: (704) 727-6015, Email: 58logisticsllc@gmail.com ("Dispatcher"), y {CLIENT} ("Cliente" o "Carrier").` },
  { num: '2', titleEn: 'PURPOSE AND NATURE OF SERVICES', titleEs: 'PROPÓSITO Y NATURALEZA DE LOS SERVICIOS',
    en: `Dispatcher will provide dispatch and load-sourcing services to Client as an independent service provider. Dispatcher will assist Client in identifying, evaluating, negotiating, booking, coordinating, and following up on transportation opportunities on Client's behalf. The parties intend this Agreement to establish a dispatch/bona fide agent relationship and not a broker-carrier relationship. Dispatcher does not take possession or control of freight and does not assume responsibility for transportation operations.`,
    es: `El Dispatcher prestará servicios de dispatch y búsqueda de cargas al Cliente como proveedor independiente. El Dispatcher ayudará al Cliente a identificar, evaluar, negociar, reservar, coordinar y dar seguimiento a oportunidades de transporte en representación del Cliente. Las partes tienen la intención de establecer una relación de dispatch/agente de buena fe y no una relación de broker-carrier. El Dispatcher no toma posesión ni control de la carga y no asume responsabilidad por las operaciones de transporte.` },
  { num: '3', titleEn: 'SERVICES INCLUDED', titleEs: 'SERVICIOS INCLUIDOS',
    en: `Searching for available loads; presenting load options to Client; negotiating rates and terms with brokers; booking loads approved by Client; communicating with brokers, shippers, and receivers as appropriate; reviewing rate confirmations and load instructions; forwarding load information and rate confirmations to Client/driver; following up on pickup and delivery status; assisting with detention, layover, TONU, accessorials, and reasonable load-related issues; assisting with preparation/submission of documents to Client's factoring company when requested.`,
    es: `Buscar cargas disponibles; presentar opciones de carga al Cliente; negociar tarifas y condiciones con brokers; reservar cargas aprobadas por el Cliente; comunicarse con brokers, shippers y receivers cuando corresponda; revisar rate confirmations e instrucciones; enviar información y rate confirmations al Cliente/driver; dar seguimiento al pickup y delivery; ayudar con detention, layover, TONU, accessorials y problemas razonables relacionados con la carga; ayudar a preparar y enviar documentos al factoring del Cliente cuando sea solicitado.` },
  { num: '4', titleEn: "CLIENT'S FINAL DECISION", titleEs: 'DECISIÓN FINAL DEL CLIENTE',
    en: `Dispatcher will present available load options and relevant information to Client. The Client/driver has the sole and final authority to accept or reject any load. Dispatcher will not require Client to accept a load.`,
    es: `El Dispatcher presentará al Cliente las opciones de carga disponibles y la información relevante. El Cliente/driver tendrá la autoridad única y final para aceptar o rechazar cualquier carga. El Dispatcher no obligará al Cliente a aceptar una carga.` },
  { num: '5', titleEn: 'CLIENT-FIRST REPRESENTATION', titleEs: 'REPRESENTACIÓN EN EL MEJOR INTERÉS DEL CLIENTE',
    en: `Dispatcher will work as part of Client's team and will make reasonable efforts to support Client's success. Dispatcher will advocate for Client's legitimate interests when communicating and negotiating with brokers, while maintaining professionalism, objectivity, and good-faith judgment based on the facts and documentation available. Dispatcher will not automatically assume that either the Client or the broker is correct in a dispute. Dispatcher will evaluate the circumstances objectively and seek a fair and commercially reasonable resolution while protecting Client's legitimate position.`,
    es: `El Dispatcher trabajará como parte del equipo del Cliente y realizará esfuerzos razonables para apoyar el éxito del Cliente. El Dispatcher defenderá los intereses legítimos del Cliente al comunicarse y negociar con brokers, manteniendo profesionalismo, objetividad y buen juicio de buena fe basado en los hechos y documentos disponibles. El Dispatcher no asumirá automáticamente que el Cliente o el broker tiene la razón en una disputa. El Dispatcher evaluará objetivamente las circunstancias y buscará una solución justa y comercialmente razonable, protegiendo la posición legítima del Cliente.` },
  { num: '6', titleEn: 'DISPATCH FEE AND WEEKLY BILLING', titleEs: 'COMISIÓN DE DISPATCH Y FACTURACIÓN SEMANAL',
    en: `Client agrees to pay Dispatcher a fee equal to 8% of the gross amount of each load accepted/booked through Dispatcher. The 8% is calculated on the total gross rate payable for the load, including additional transportation compensation added after booking. Example: Load $2,000 → Dispatch Fee 8% = $160. Client receives payment for transportation services directly from its factoring company or other payer. Dispatcher issues one invoice weekly covering the 8% fees for loads taken/booked during the preceding work week. Unless otherwise stated on an invoice, invoices are due within 7 calendar days (Net 7). No late fee, penalty, or termination penalty will be charged.`,
    es: `El Cliente acepta pagar al Dispatcher una comisión equivalente al 8% del monto bruto de cada carga aceptada/reservada a través del Dispatcher. El 8% se calculará sobre la tarifa bruta total pagadera por la carga, incluyendo compensación adicional de transporte agregada posteriormente. Ejemplo: Load $2,000 → Dispatch Fee 8% = $160. El Cliente recibe el pago de sus servicios directamente de su factoring company u otro pagador. El Dispatcher emitirá una factura semanal por las comisiones del 8% correspondientes a las cargas tomadas/reservadas durante la semana anterior. Salvo que se indique lo contrario, las facturas deben pagarse dentro de 7 días calendario (Net 7). No se cobrará cargo por mora, penalidad ni penalidad por terminación.` },
  { num: '7', titleEn: 'FACTORING ASSISTANCE', titleEs: 'ASISTENCIA CON FACTORING',
    en: `At Client's request, Dispatcher may assist with preparing, organizing, and transmitting invoices, rate confirmations, BOLs, PODs, and other required documents to Client's factoring company. This assistance is included within the 8% dispatch fee and does not create a separate factoring fee payable to Dispatcher. All factoring-company fees, discounts, reserves, chargebacks, recourse amounts, administrative charges, or other costs imposed by the factoring company remain the sole responsibility of Client.`,
    es: `A solicitud del Cliente, el Dispatcher podrá ayudar a preparar, organizar y enviar invoices, rate confirmations, BOLs, PODs y demás documentos requeridos al factoring company. Esta asistencia está incluida dentro del 8% de dispatch y no genera un cargo adicional de factoring por parte del Dispatcher. Todos los fees, descuentos, reserves, chargebacks, recourse amounts, cargos administrativos u otros costos impuestos por el factoring company serán responsabilidad exclusiva del Cliente.` },
  { num: '8', titleEn: 'EXCLUSIVITY', titleEs: 'EXCLUSIVIDAD',
    en: `During the term of this Agreement, Client appoints Dispatcher as its exclusive dispatch service provider for obtaining and arranging loads. Client agrees not to use another dispatch service or independently solicit/book transportation loads that fall within the dispatch services covered by this Agreement. The exclusivity provision applies to recurring business and broker relationships obtained or developed through Dispatcher during the term. Nothing prevents Client from operating its transportation business after termination.`,
    es: `Durante la vigencia de este Contrato, el Cliente designa al Dispatcher como su proveedor exclusivo de servicios de dispatch para obtener y coordinar cargas. El Cliente acepta no utilizar otro servicio de dispatch ni solicitar/reservar independientemente cargas comprendidas dentro de los servicios cubiertos. La exclusividad se aplica a negocios recurrentes y relaciones con brokers obtenidas o desarrolladas a través del Dispatcher durante la vigencia. Nada impide al Cliente operar su empresa después de la terminación.` },
  { num: '9', titleEn: 'LOADS BOOKED BEFORE TERMINATION', titleEs: 'CARGAS RESERVADAS ANTES DE LA TERMINACIÓN',
    en: `If this Agreement is terminated after Dispatcher has negotiated, arranged, or booked a load for Client, the 8% fee for that load remains payable even if pickup or delivery occurs after termination.`,
    es: `Si este Contrato termina después de que el Dispatcher haya negociado, coordinado o reservado una carga para el Cliente, la comisión del 8% seguirá siendo pagadera aunque el pickup o delivery ocurra después de la terminación.` },
  { num: '10', titleEn: 'NO GUARANTEE OF LOADS OR REVENUE', titleEs: 'NO GARANTÍA DE CARGAS O INGRESOS',
    en: `Dispatcher does not guarantee any minimum number of loads, revenue, miles, rate per mile, utilization, profit, or other financial result. Load availability, rates, lanes, and market conditions vary. Client independently chooses which opportunities to accept.`,
    es: `El Dispatcher no garantiza un número mínimo de cargas, ingresos, millas, tarifa por milla, utilización, ganancias ni otro resultado financiero. La disponibilidad de cargas, tarifas, rutas y condiciones del mercado varían. El Cliente decide qué oportunidades aceptar.` },
  { num: '11', titleEn: 'INDEPENDENT CONTRACTOR; OPERATIONAL CONTROL', titleEs: 'CONTRATISTA INDEPENDIENTE; CONTROL OPERACIONAL',
    en: `Client is an independent transportation business and independent contractor. Nothing creates an employment relationship, partnership, joint venture, or ownership relationship between the parties. Client retains exclusive operational control and responsibility over its equipment, drivers, dispatch decisions, safety, insurance, permits, taxes, licenses, registrations, FMCSA/DOT compliance, ELD, HOS, maintenance, fuel, tolls, tickets, and transportation operations.`,
    es: `El Cliente es una empresa de transporte independiente y contratista independiente. Nada crea una relación laboral, sociedad, joint venture o relación de propiedad entre las partes. El Cliente mantiene control y responsabilidad operacional exclusiva sobre equipos, conductores, decisiones de dispatch, seguridad, seguros, permisos, impuestos, licencias, registros, cumplimiento FMCSA/DOT, ELD, HOS, mantenimiento, combustible, peajes, multas y operaciones.` },
  { num: '12', titleEn: 'LIABILITY AND CLAIMS', titleEs: 'RESPONSABILIDAD Y RECLAMACIONES',
    en: `Dispatcher is not responsible for accidents, injuries, cargo loss or damage, cargo claims, delays caused by Client or its driver, missed appointments, mechanical breakdowns, traffic violations, HOS violations, ELD violations, DOT violations, vehicle defects, driver conduct, insurance matters, or any operational act or omission of Client or its drivers. Dispatcher does not guarantee broker payment, factoring approval, broker creditworthiness, load profitability, or third-party performance. Dispatcher will nevertheless make reasonable efforts to communicate, document, and advocate for Client when issues arise.`,
    es: `El Dispatcher no será responsable por accidentes, lesiones, pérdida o daño de carga, cargo claims, retrasos causados por el Cliente o su conductor, citas perdidas, fallas mecánicas, infracciones de tránsito, violaciones HOS, ELD o DOT, defectos del vehículo, conducta del conductor, seguros ni actos u omisiones operacionales del Cliente o sus conductores. El Dispatcher no garantiza el pago del broker, aprobación del factoring, solvencia del broker, rentabilidad de la carga ni desempeño de terceros. No obstante, realizará esfuerzos razonables para comunicarse, documentar y defender al Cliente cuando surjan problemas.` },
  { num: '13', titleEn: 'DOCUMENTATION AND CLIENT COOPERATION', titleEs: 'DOCUMENTACIÓN Y COOPERACIÓN DEL CLIENTE',
    en: `Client agrees to provide accurate and timely information and documentation reasonably required to dispatch loads and process invoices, including rate confirmations, BOLs, PODs, receipts, accessorial documentation, and other load-related records.`,
    es: `El Cliente acepta proporcionar información y documentación precisa y oportuna razonablemente necesaria para despachar cargas y procesar invoices, incluyendo rate confirmations, BOLs, PODs, recibos, documentación de accessorials y demás registros relacionados.` },
  { num: '14', titleEn: 'TERM AND TERMINATION', titleEs: 'VIGENCIA Y TERMINACIÓN',
    en: `This Agreement remains effective until terminated by either party. Either party may terminate this Agreement at any time, with or without cause, without prior notice and without penalty. Termination does not cancel fees already earned or obligations that expressly survive termination.`,
    es: `Este Contrato permanecerá vigente hasta que cualquiera de las partes lo termine. Cualquiera de las partes podrá terminarlo en cualquier momento, con o sin causa, sin aviso previo y sin penalización. La terminación no cancela comisiones ya devengadas ni obligaciones que sobrevivan.` },
  { num: '15', titleEn: 'CONFIDENTIALITY', titleEs: 'CONFIDENCIALIDAD',
    en: `Each party agrees to use reasonable care with the other party's non-public business, financial, customer, broker, factoring, and operational information and not disclose it except as reasonably necessary to perform this Agreement or as required by law.`,
    es: `Cada parte acepta proteger razonablemente la información comercial, financiera, de clientes, brokers, factoring y operaciones que no sea pública de la otra parte y no divulgarla salvo cuando sea necesario para cumplir este Contrato o cuando la ley lo exija.` },
  { num: '16', titleEn: 'GOVERNING LAW AND VENUE', titleEs: 'LEY APLICABLE Y JURISDICCIÓN',
    en: `This Agreement shall be governed by the laws of the State of North Carolina, without regard to conflict-of-law principles. Any dispute arising from this Agreement shall be brought in a court of competent jurisdiction in North Carolina, unless the parties agree otherwise in writing.`,
    es: `Este Contrato se regirá por las leyes del Estado de North Carolina, sin considerar principios de conflicto de leyes. Cualquier disputa derivada de este Contrato deberá presentarse ante un tribunal competente en North Carolina, salvo acuerdo escrito distinto.` },
  { num: '17', titleEn: 'ENTIRE AGREEMENT; AMENDMENTS', titleEs: 'ACUERDO COMPLETO; MODIFICACIONES',
    en: `This Agreement constitutes the entire agreement between the parties concerning the dispatch services described herein and supersedes prior oral or written understandings concerning those services. Any amendment must be in writing and accepted by both parties.`,
    es: `Este Contrato constituye el acuerdo completo entre las partes respecto de los servicios descritos y reemplaza entendimientos previos relacionados con ellos. Toda modificación deberá constar por escrito y ser aceptada por ambas partes.` },
  { num: '18', titleEn: 'SEVERABILITY & LANGUAGE', titleEs: 'DIVISIBILIDAD E IDIOMA',
    en: `If any provision is determined invalid or unenforceable, the remaining provisions remain in full force to the fullest extent permitted by law. This Agreement is provided in English and Spanish for convenience. Both versions are intended to express the same terms. In the event of a material conflict in interpretation, the English version shall control.`,
    es: `Si alguna disposición se determina inválida o inaplicable, las demás permanecerán en pleno vigor en la máxima medida permitida por la ley. Este Contrato se proporciona en inglés y español para conveniencia. Ambas versiones pretenden expresar los mismos términos. En caso de conflicto material de interpretación, prevalecerá la versión en inglés.` },
];

export function generateDispatchAgreementPdf({ company, signerName, signatureDataUrl }: Options): Blob {
  const doc = new jsPDF({ unit: 'pt', format: 'letter' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 40;
  const contentW = pageW - margin * 2;
  const today = format(new Date(), 'MM/dd/yyyy');
  const legal = company.legal_business_name || '__________________';
  const dba = company.dba || '';
  const mc = company.mc_number || '__________';
  const dot = company.dot_number || '__________';
  const address = [company.address, company.city, company.state, company.zip].filter(Boolean).join(', ') || '__________________';
  const phone = company.phone || '__________';
  const email = company.email || '__________';
  const owner = signerName || company.owner_full_name || '__________________';

  let y = margin;

  const checkPageBreak = (needed: number) => {
    if (y + needed > pageH - margin) {
      doc.addPage();
      y = margin;
    }
  };

  const addText = (text: string, opts: { size?: number; bold?: boolean; italic?: boolean; color?: [number, number, number]; lineGap?: number } = {}) => {
    doc.setFontSize(opts.size ?? 10);
    doc.setFont('helvetica', opts.bold ? 'bold' : opts.italic ? 'italic' : 'normal');
    if (opts.color) doc.setTextColor(...opts.color);
    else doc.setTextColor(0, 0, 0);
    const lines = doc.splitTextToSize(text, contentW);
    for (const line of lines) {
      checkPageBreak(12);
      doc.text(line, margin, y);
      y += (opts.size ?? 10) * 1.2;
    }
    y += opts.lineGap ?? 4;
  };

  // Header
  doc.setFillColor(38, 106, 173);
  doc.rect(0, 0, pageW, 60, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text('58 LOGISTICS LLC', pageW / 2, 28, { align: 'center' });
  doc.setFontSize(11);
  doc.text('DISPATCH SERVICE AGREEMENT / CONTRATO DE SERVICIOS DE DISPATCH', pageW / 2, 45, { align: 'center' });
  y = 80;
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'italic');
  doc.text('Bilingual English–Spanish Agreement', pageW / 2, y, { align: 'center' });
  y += 20;

  addText(`Effective Date / Fecha de Vigencia: ${today}`, { size: 10, bold: true, lineGap: 8 });

  // Client info box
  doc.setDrawColor(200, 200, 200);
  doc.setFillColor(245, 245, 245);
  const boxY = y;
  doc.roundedRect(margin, boxY, contentW, 100, 4, 4, 'FD');
  y += 14;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(100, 100, 100);
  doc.text('CLIENT / CLIENTE', margin + 10, y);
  y += 14;
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  const clientRows: Array<[string, string]> = [
    ['Legal Business Name:', legal],
    ['DBA:', dba || '—'],
    ['MC #:', mc],
    ['USDOT #:', dot],
    ['Address:', address],
    ['Phone:', phone],
    ['Email:', email],
    ['Owner / Rep:', owner],
  ];
  const col1 = margin + 10;
  const col2 = margin + 110;
  for (const [label, val] of clientRows) {
    doc.setTextColor(100, 100, 100);
    doc.text(label, col1, y);
    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'bold');
    const wrapped = doc.splitTextToSize(String(val), contentW - 120);
    doc.text(wrapped[0] || '—', col2, y);
    doc.setFont('helvetica', 'normal');
    y += 10;
  }
  y = boxY + 110;

  // Cláusulas
  for (const clause of CLAUSES) {
    checkPageBreak(60);
    const enText = clause.en.replace(/\{CLIENT\}/g, legal);
    const esText = clause.es.replace(/\{CLIENT\}/g, legal);

    addText(`${clause.num}. ${clause.titleEn} / ${clause.titleEs}`, { size: 10, bold: true, color: [38, 106, 173], lineGap: 4 });
    addText(enText, { size: 9, lineGap: 3 });
    addText(esText, { size: 9, italic: true, color: [100, 100, 100], lineGap: 8 });
  }

  // Firma
  checkPageBreak(160);
  y += 10;
  doc.setDrawColor(180, 180, 180);
  doc.line(margin, y, pageW - margin, y);
  y += 14;
  addText('SIGNATURES / FIRMAS', { size: 11, bold: true, lineGap: 6 });
  addText('By signing below, the parties acknowledge that they have read, understood, and voluntarily agree to the terms of this Agreement.', { size: 8, italic: true, color: [100, 100, 100], lineGap: 10 });

  // Dos columnas: 58 Logistics (left) / Cliente (right)
  const sigColW = contentW / 2 - 10;
  const sigStartY = y;

  // Columna izquierda — 58 Logistics
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(0, 0, 0);
  doc.text('58 LOGISTICS LLC', margin, y);
  y += 12;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 100, 100);
  doc.text('Authorized Representative:', margin, y);
  y += 10;
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'bold');
  doc.text('Francisco Monsalve', margin, y);
  y += 20;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 100, 100);
  doc.text('Signature:', margin, y);
  y += 30;
  doc.setDrawColor(180, 180, 180);
  doc.line(margin, y, margin + sigColW, y);
  y += 10;
  doc.setFontSize(8);
  doc.setTextColor(100, 100, 100);
  doc.text(`Date: ${today}`, margin, y);

  // Columna derecha — Cliente
  y = sigStartY;
  const rightX = margin + contentW / 2 + 10;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(0, 0, 0);
  doc.text('CLIENT / CLIENTE', rightX, y);
  y += 12;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 100, 100);
  doc.text('Legal Business Name:', rightX, y);
  y += 10;
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'bold');
  doc.text(legal, rightX, y);
  y += 12;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 100, 100);
  doc.text('Authorized Representative:', rightX, y);
  y += 10;
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'bold');
  doc.text(owner, rightX, y);
  y += 14;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 100, 100);
  doc.text('Signature:', rightX, y);
  y += 4;

  // Embeber firma como imagen
  if (signatureDataUrl && signatureDataUrl.startsWith('data:image/')) {
    try {
      doc.addImage(signatureDataUrl, 'PNG', rightX, y, 140, 40);
    } catch (e) {
      console.error('Error adding signature to PDF:', e);
    }
  }
  y += 44;
  doc.setDrawColor(180, 180, 180);
  doc.line(rightX, y, rightX + sigColW, y);
  y += 10;
  doc.setFontSize(8);
  doc.setTextColor(100, 100, 100);
  doc.text(`Date: ${today}`, rightX, y);

  // Footer disclaimer
  y = pageH - margin;
  doc.setFontSize(7);
  doc.setTextColor(150, 150, 150);
  doc.setFont('helvetica', 'italic');
  const disclaimer = 'IMPORTANT: This document is a business contract template and is not a substitute for advice from a licensed attorney.';
  doc.text(disclaimer, pageW / 2, y, { align: 'center' });

  return doc.output('blob');
}
