import jsPDF from 'jspdf';

function addSignatureImage(doc: jsPDF, sigDataUrl: string, x: number, y: number, w: number, h: number) {
  try {
    doc.addImage(sigDataUrl, 'PNG', x, y, w, h);
  } catch {
    doc.setFontSize(8);
    doc.text('[Signature on file]', x, y + h / 2);
  }
}

/** Helper: write a block of text, auto-paging if needed. Returns new y. */
function writeBlock(doc: jsPDF, text: string, m: number, y: number, fontSize: number, maxWidth: number, bold = false, lineSpacing = 4): number {
  doc.setFontSize(fontSize);
  doc.setFont('helvetica', bold ? 'bold' : 'normal');
  const lines = doc.splitTextToSize(text, maxWidth);
  for (const line of lines) {
    if (y > 275) { doc.addPage(); y = 20; }
    doc.text(line, m, y);
    y += lineSpacing;
  }
  return y;
}

function writeHeading(doc: jsPDF, text: string, m: number, y: number, fontSize = 9): number {
  if (y > 265) { doc.addPage(); y = 20; }
  doc.setFontSize(fontSize);
  doc.setFont('helvetica', 'bold');
  doc.text(text, m, y);
  return y + 5;
}

// ─── W-9 PDF ───
export function generateW9Pdf(data: {
  name: string; businessName: string; taxClassification: string;
  exemptions: string; address: string; cityStateZip: string;
  ssn: string; ein: string; date: string; signature: string;
}): Blob {
  const doc = new jsPDF();
  const m = 20;
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

// ─── LEASING AGREEMENT PDF (FULL LEGAL TEXT) ───
export function generateLeasingPdf(data: {
  driverName: string; companyName: string;
  make: string; model: string; vin: string; year: number;
  date: string; signatures: { contract: string; eld: string; hos: string };
}): Blob {
  const doc = new jsPDF();
  const m = 20;
  const w = 170;
  let y = 20;

  // ═══ PAGE 1: LEASE AGREEMENT ═══
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('OWNER OPERATOR LEASE AGREEMENT', 105, y, { align: 'center' });
  y += 12;

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  y = writeBlock(doc, `THIS agreement, entered into this day ${data.date} Between 58 LOGISTICS LLC DOT#: 4364896 MC#: 1708664 Address: 1634 N Wind Pl. Apt 206. Charlotte, NC. 28210 (Hereinafter designated as "Carrier"), and the Owner Operator Company Name: ${data.companyName || '_______________'}`, m, y, 9, w);
  y += 2;
  y = writeBlock(doc, `Owner Operator Name: ${data.driverName}`, m, y, 9, w, true);
  y += 2;
  y = writeBlock(doc, 'On this agreement is included a Vehicle:', m, y, 9, w);
  y += 2;

  // Vehicle table
  const vRows = [
    ['MAKE:', data.make || '_______________'],
    ['MODEL:', data.model || '_______________'],
    ['VIN:', data.vin || '_______________'],
    ['YEAR:', data.year ? String(data.year) : '_______________'],
  ];
  for (const [label, val] of vRows) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text(label, m, y);
    doc.setFont('helvetica', 'normal');
    doc.text(val, m + 25, y);
    y += 5;
  }
  y += 4;

  // WITNESSETH
  y = writeHeading(doc, 'WITNESSETH:', m, y);
  y = writeBlock(doc, 'WHEREAS, Owner Operator is engaged in the transportation of general freights of all kinds (FAK) by motor vehicle as a contract Carrier and desires to transport goods for Carrier; and WHEREAS, to facilitate such transportation and for the convenience in handling such transaction, the parties have agreed to the terms and conditions under which transportation shall be made, as hereinafter set forth.', m, y, 8, w);
  y += 2;
  y = writeBlock(doc, 'NOW THEREFORE, in consideration of the premises and the mutual promises and conditions herein contained it is hereby agreed as follows:', m, y, 8, w);
  y += 4;

  // (1) GENERAL PROVISIONS
  y = writeHeading(doc, '(1) GENERAL PROVISIONS:', m, y);

  y = writeBlock(doc, '(a) Owner Operator, in its operations hereunder, shall secure all permits, licenses and approvals necessary for the accomplishment of the work to be done hereunder and shall comply fully with all applicable laws, rules, orders and regulation of all governments and agencies thereof, whether federal, state or local, and shall furnish Carrier with satisfactory evidence thereof whenever requested to do so. Among other things, Owner Operator shall provide to Federal Motor Carrier Safety Administration certificate showing Owner Operator holds contract authority from such commission covering the commodities and transportation routes to which this agreement relates, and Owner Operator shall give immediate notice to Carrier of any cancellation or modification of such authority. When transporting hazardous wastes, substances or materials pursuant this agreement, Owner Operator shall comply with all applicable federal, state and local hazardous wastes, substances or materials laws and regulations and shall furnish Carrier with satisfactory evidence thereof whenever requested to do so.', m, y, 8, w);
  y += 2;

  y = writeBlock(doc, '(b) The Owner Operator hereby agrees to deliver for the Carrier for transportation, not less than the following amount: one shipment of freight of all kinds (FAK) during a period of 6 Months. The Owner Operator further agrees, subject to availability and loading tendered for transportation by Carrier.', m, y, 8, w);
  y += 2;

  y = writeBlock(doc, '(c) All such cargo shall be transported hereunder in accordance with this agreement and the provisions of Carrier\'s tariffs or service contracts applicable to such cargo. Cargo shall include any containers in which goods are packed when received by Owner Operator hereunder.', m, y, 8, w);
  y += 2;

  y = writeBlock(doc, '(d) This agreement shall not be modified or altered unless in writing, signed by both parties to this agreement.', m, y, 8, w);
  y += 2;

  y = writeBlock(doc, '(e) This contract shall terminate all previous contracts between the parties hereto relating to the transportation Freight all kinds (FAK) and shall remain in full force and effect for the term of this agreement.', m, y, 8, w);
  y += 2;

  y = writeBlock(doc, '(f) It is to be clearly understood and it is the intention of the parties hereto that Owner Operator shall employ all persons operating trucks hereunder, that such persons shall be and remain the employees of the Owner Operator, that the Owner Operator shall be an independent contractor of the Carrier and that nothing herein contained shall be construed to be inconsistent with that relation or status.', m, y, 8, w);
  y += 2;

  y = writeBlock(doc, '(g) It is further to be clearly understood that where the Owner Operator engages any subcontractor for any portion of the work hereunder, such engagement will not alter the relationship of the Owner Operator to the Carrier as an independent contractor and shall not establish any relationship or obligation between Carrier and any subcontractor. Owner Operator will continue to be solely responsible for compliance with or performance for any subcontractors actually doing such work and will otherwise defend, indemnify and save harmless the Carrier, its agents and servants from any such claims, liabilities, penalties and fines (whether criminal or civil), judgments outlays and expenses (including attorney\'s fees).', m, y, 8, w);
  y += 2;

  y = writeBlock(doc, '(h) Owner Operator shall defend, indemnify and save harmless the Carrier, its agents and servants from any and all liabilities, penalties and fines (whether criminal or civil), judgments, outlays and expenses (including attorney\'s fees) resulting from Owner Operator\'s failure or the failure of Owner Operator\'s agents, employees, subcontractors or representatives to comply with any applicable laws and regulations, whether federal, state or local, or property arising out of the performance of this agreement caused by the acts, failure to act or negligence of Owner Operator, subcontractors, its agent, employees, or representatives.', m, y, 8, w);
  y += 2;

  y = writeBlock(doc, '1. Owner Operator will assume all liability for and will otherwise defend, indemnify and save harmless the Carrier, its agents or servants from any and all liabilities, penalties and fines (whether criminal or civil). Judgments, outlays and expenses (including attorney\'s fees) resulting from any release or discharge of hazardous wastes, substances or materials that occurs during transportation and Owner Operator will assume all responsibility and liability for cleanup of any release or discharge of hazardous wastes, substances or materials that occurs during transportation and will otherwise defend indemnify and save harmless the Shipper, its agents and servants from any and all liabilities, penalties and fines (whether criminal or civil), judgments, outlays and expenses (including attorney fees) resulting from the cleanup of any such release or discharge.', m, y, 8, w);
  y += 2;

  y = writeBlock(doc, '2. Owner Operator will defend, indemnify and save harmless the Carrier, its agents and servants from any and all liabilities, penalties and fines (whether criminal or civil in nature), judgments, outlays and expenses (including attorney\'s fees) resulting from the Owner Operator\'s failure or the failure of Carrier\'s agents, employees, subcontractors or representatives to perform any of the terms, conditions, promises or covenants contained in this contract.', m, y, 8, w);
  y += 2;

  y = writeBlock(doc, '3. Carrier shall have full responsibility for all payments, benefits, and rights of whatsoever nature to or on behalf of any of its employees and to ensure that its subcontractor shall have the same responsibility.', m, y, 8, w);
  y += 2;

  y = writeBlock(doc, '4. It is further agreed by the parties hereto that Owner Operator is not to display the name of Carrier upon or about any of the Owner Operator\'s vehicles, without Carrier\'s written consent.', m, y, 8, w);
  y += 2;

  y = writeBlock(doc, '5. Any limitation on or exemption from liability in any tariff, receipt, bill of lading, or other document issued by or on behalf of Owner Operator shall have no legal effect and shall not otherwise apply with respect to shipments tendered by or on behalf of Carrier unless specifically agreed in writing by the Owner Operator. Any limitations on or exemptions from liability contained in a Owner Operator\'s tariff, receipt, bill of lading, or other document issued in conjunction with a specific shipment moving under this Contract shall have no legal effect and shall not otherwise be applicable to such shipments.', m, y, 8, w);
  y += 4;

  // 2. RECEIPTS OF GOODS
  y = writeHeading(doc, '2. RECEIPTS OF GOODS:', m, y);
  y = writeBlock(doc, '(a) Owner Operator agrees, upon receipt from Carrier of such quantities of Carrier\'s goods as may be tendered from time to time under this agreement by Carrier or by a third party on behalf of Carrier to give Carrier a written receipt thereof, which shall be prima facie evidence of receipt of such goods in good order and condition unless otherwise noted upon the face of such receipt; and, in the case of transportation of hazardous wastes, substances or materials such written receipt shall be prima facie evidence of receipt of such wastes, substances or materials in a condition and manner which complies with all applicable laws and regulations, whether federal, state or local. In the event that Owner Operator elects to use a tariff, bill of lading, manifest or other form of freight receipt or contract, any terms, conditions and provisions of such bill of lading, manifest or other form shall be subject and subordinate to the terms, conditions and provisions of this Agreement, and in the event of a conflict between the terms, conditions and provisions of such tariff, bill of lading, manifest or other form and this Agreement, the terms, conditions and provisions of this Agreement shall govern.', m, y, 8, w);
  y += 2;
  y = writeBlock(doc, '(b) Owner Operator agrees to take signed receipts upon forms satisfactory to Carrier from all persons to whom deliveries shall be made, which receipts shall be retained by Owner Operator for at least two (2) years and shall be available for inspection and use of Shipper.', m, y, 8, w);
  y += 4;

  // 3. CARE AND CUSTODY
  y = writeHeading(doc, '3. CARE AND CUSTODY OF MERCHANDISE:', m, y);
  y = writeBlock(doc, '(a) Owner Operator hereby assume the liability of an insurer of the prompt and safe transportation of all goods entrusted to its care, and shall be responsible to Carrier for all loss or damage of whatever kind and nature and howsoever, caused to any and all goods entrusted to Owner Operator hereunder occurring, while same remains in the care, custody or control of Owner Operator or to any other persons to whom the Owner Operator may have entrusted said goods and before said goods are delivered as herein provided or returned to Carrier.', m, y, 8, w);
  y += 2;
  y = writeBlock(doc, '(b) On occasion, Owner Operator will be requested to transport reefer cargo refrigerated containers. On all occasions, refrigerated containers must be transported with an attached generator set (nose mounted or under-slung) unless specifically advised by Carrier in writing that a generator set is not required. It is the Carrier\'s responsibility to ensure a generator set is attached and running properly at the assigned temperature at the time of interchange.', m, y, 8, w);
  y += 4;

  // 4. INSURANCE
  y = writeHeading(doc, '4. INSURANCE:', m, y);
  y = writeBlock(doc, '(a) Owner Operator agrees to be a motor Carrier member in good standing in the Uniform Intermodal Interchange Agreement (UIIA). Owner Operator further agrees to comply with the insurance requirements of the Federal Motor Carrier Safety Administration and the states through which the Owner Operator operates. Owner Operator\'s insurance coverage shall, at a minimum, comply with the minimum requirements as stated in the UIIA.', m, y, 8, w);
  y += 2;
  y = writeBlock(doc, '(b) The Owner Operator agrees to carry cargo, personal injury, death, equipment and general insurance and will promptly reimburse Carrier for the value of any goods (including containers) lost or destroyed during the period of Owner Operator\'s responsibility under clause (3)(a). All such insurance shall be as additional insured.', m, y, 8, w);
  y += 2;
  y = writeBlock(doc, '(c) The Owner Operator agrees to provide the UIIA with appropriate certification and a copy of each policy of insurance and renewals thereof or other satisfactory evidence that Owner Operator has obtained insurance in compliance with the requirements and terms of this agreement.', m, y, 8, w);
  y += 2;
  y = writeBlock(doc, '(d) The Owner Operator will arrange with its broker and/or insurance Carrier(s) that notice of coverage and limits will be sent directly to the UIIA, as well and cancellation notices and amendments to coverage(s).', m, y, 8, w);
  y += 4;

  // 5. ASSIGNMENTS
  y = writeHeading(doc, '5. ASSIGNMENTS:', m, y);
  y = writeBlock(doc, 'This contract cannot be assigned by Owner Operator without the written consent of Carrier.', m, y, 8, w);
  y += 4;

  // 6. COMPENSATION
  y = writeHeading(doc, '6. COMPENSATION, COMMODITIES, TERRITORY:', m, y);
  y = writeBlock(doc, '(a) Acceptable rates and charges, rules and regulations, the commodities to be transported, and the points from and to which they shall be transported, are to be furnished the Carrier, the Federal Motor Carrier Safety Administration and other regulatory bodies as may be required, as set forth in the rate schedule attached hereto and made a part hereof. Carrier agrees to pay Owner Operator as full compensation for services to be performed by Carrier under said rules and regulations the rates and charges set forth in the rate schedule, within sixty (60) days of invoice date.', m, y, 8, w);
  y += 2;
  y = writeBlock(doc, '(b) This agreement is to become effective upon signature by Carrier and Owner Operator.', m, y, 8, w);
  y += 4;

  // 7. CONFIDENTIALITY
  y = writeHeading(doc, '7. CONFIDENTIALITY:', m, y);
  y = writeBlock(doc, 'Owner Operator shall treat as confidential, and not to disclose to third parties, the terms of this agreement or any information concerning the Carrier\'s business including information regarding suppliers, products and customers without in each instance obtaining Carrier\'s written consent in advance.', m, y, 8, w);
  y += 4;

  // 8. NOTICES
  y = writeHeading(doc, '8. NOTICES:', m, y);
  y = writeBlock(doc, 'All notices given pursuant to this agreement shall be given in writing by certified or registered mail, return receipt requested, and addressed as directed by the parties from time to time.', m, y, 8, w);
  y += 4;

  // 9. APPLICABLE LAW
  y = writeHeading(doc, '9. APPLICABLE LAW:', m, y);
  y = writeBlock(doc, 'To the extent state law applies, this agreement shall be governed by and interpreted in accordance with the laws of the state of NORTH CAROLINA.', m, y, 8, w);
  y += 8;

  // SIGNATURES
  y = writeHeading(doc, 'SIGNATURES', m, y, 11);
  y += 2;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text('OWNER OPERATOR:', m, y);
  doc.text('CARRIER:', 120, y);
  y += 4;
  addSignatureImage(doc, data.signatures.contract, m, y - 2, 60, 20);
  doc.text('Francisco Monsalve', 120, y + 10);
  y += 22;
  doc.text(data.driverName, m, y);
  doc.text(`Date: ${data.date}`, m + 80, y);

  // ═══ ELD POLICY ═══
  doc.addPage();
  y = 20;
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text('ELECTRONIC LOGGING DEVICES (ELD)', 105, y, { align: 'center' });
  y += 12;

  y = writeHeading(doc, 'Before You Start Driving', m, y);

  y = writeBlock(doc, '1. Ensure your device functions correctly. Check that your ELD functions correctly. In the case of portable or phone ELD devices, check that the battery is fully charged. If you have any questions about whether your device is working correctly, report it to your carrier and put it in writing if possible. Putting it in writing gives you proof that you brought the issue to the attention of your carrier, in the event that it becomes a malfunction later.', m, y, 8, w);
  y += 2;

  y = writeBlock(doc, '2. Verify ELD documentation accessible. Ensure you have the 3 required ELD documents in the cab/accessible electronically: Transfer guide, ELD manual, Malfunction guide. Your ELD manufacturer should have these documents available.', m, y, 8, w);
  y += 2;

  y = writeBlock(doc, '3. Keep backup paper logs on board. Ensure you have at least 8 days worth of blank paper logs on hand in case of an issue with your ELD. These 4 elements (the 3 ELD documents listed above and additional blank paper logs) are required to be on board all times. You may be in violation if you don\'t have them available.', m, y, 8, w);
  y += 2;

  y = writeBlock(doc, '4. Check the driver interface and placement. Make sure your driver interface (the screen you use to enter RODs, view time remaining, etc.) is mounted to the vehicle and in line of sight, while also maintaining compliance with other state rules such as no windshield mounting. Keeping the ELD device appropriately mounted and in line of sight is an ELD requirement.', m, y, 8, w);
  y += 4;

  y = writeHeading(doc, 'Roadside Inspections', m, y);
  y = writeBlock(doc, 'If you are asked to show your logs during a roadside inspection, your first action should be to ask the officer what method of transfer they support. Some states may support both transfer mechanisms: 1) "local" – USB or Bluetooth transfer, 2) "telematics" – wireless transfer through the ELD provider and email. Telematics transfer is emerging as the method of choice for many jurisdictions.', m, y, 8, w);
  y += 2;

  y = writeBlock(doc, 'If your ELD does NOT support the option the officer requests OR fails to transfer the logs for any reason, then refer to your ELD manual for instructions on the secondary option, which will be an on-screen display or printout. This backup option is compliant with the mandate, and you cannot be cited for using it, if the primary method fails.', m, y, 8, w);
  y += 2;

  y = writeBlock(doc, 'If the ELD gives you an error during transfer, make note of the display, as most ELD systems will note what went wrong – and in case of missing or having incorrect information, will want to let your carrier\'s administration know so that it can be fixed.', m, y, 8, w);
  y += 4;

  y = writeHeading(doc, 'Driver Responsibility:', m, y);
  const eldResponsibilities = [
    'REPORT ANY MALFUNCTIONS in writing IMMEDIATELY TO THE COMPANY. Driver is required to report within 24 hours of any malfunction.',
    'Driver is responsible for ensuring they have at least 8 days\' worth of blank paper logs in case of malfunction.',
    'Driver needs to ensure to have the following documents: USER MANUAL, TROUBLESHOOTING & MALFUNCTION GUIDE, TRANSFER GUIDE.',
    'Devices are not tampered with, disconnected, or damaged.',
    'Driver is required to log in and out of the device at appropriate time and is required to have a secure username and password (not share with others).',
    'Drivers are required to certify their logs within 24 hours.',
  ];
  for (const resp of eldResponsibilities) {
    y = writeBlock(doc, `• ${resp}`, m + 4, y, 8, w - 4);
    y += 1;
  }
  y += 4;

  y = writeBlock(doc, 'I understand that my signature below acknowledges that I have read and understand the regulations & rules of 58 LOGISTICS LLC regarding Electronic Logging Device. I also understand that failure to comply with the above mentioned, can result in termination of my employment.', m, y, 8, w, true);
  y += 6;

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text('Driver\'s Signature:', m, y);
  addSignatureImage(doc, data.signatures.eld, m + 40, y - 8, 60, 20);
  doc.text(`Date: ${data.date}`, 140, y);

  // ═══ HOS POLICY ═══
  doc.addPage();
  y = 20;
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text('HOURS OF SERVICE POLICY', 105, y, { align: 'center' });
  y += 12;

  y = writeBlock(doc, 'All drivers must follow the following driving regulations:', m, y, 9, w, true);
  y += 2;

  const hosRules = [
    '1. Drivers are required to drive no more than a maximum of 11 hours within a 24-hour period.',
    '2. After which the driver is required a total of 10 consecutive of OFF DUTY hours before starting to drive again. (Drivers may split their required 10-hour off-duty period, as long as one off-duty period (whether in or out of the sleeper berth) is at least 2 hours long and the other involves at least 7 consecutive hours spent in the sleeper berth. All sleeper berth pairings MUST add up to at least 10 hours. When used together, neither time period counts against the maximum 14-hour driving window.)',
    '3. May not drive beyond the 14th consecutive hour after coming on duty, following 10 consecutive hours off-duty.',
    '4. Drivers must take a 30-minute break when they have driven for a period of 8 cumulative hours without at least a 30-minute interruption. The break may be satisfied by any non-driving period of 30 consecutive minutes (i.e., on-duty not driving, off-duty, sleeper berth, or any combination of these taken consecutively).',
    '5. All drivers may not drive after 60/70 hours on-duty in 7/8 consecutive days. A driver may restart a 7/8 consecutive day period after taking 34 or more consecutive hours off-duty.',
    '6. Drivers are allowed to extend the 11-hour maximum driving limit and 14-hour driving window by up to 2 hours when adverse driving conditions are encountered.',
  ];
  for (const rule of hosRules) {
    y = writeBlock(doc, rule, m, y, 8, w);
    y += 2;
  }
  y += 2;

  y = writeBlock(doc, 'Drivers that are cited during roadside or scale inspections for violations of the 11-hour, 14 hour or working beyond the 60/70 hours, will be:', m, y, 8, w);
  y += 2;
  const offenses = [
    '• 1st offense – Written up and re-trained',
    '• 2nd offense – Written up and suspension for one day',
    '• 3rd offense – Written up, pay a fine and suspension for a week',
    '• 4th offense – Termination of contract',
  ];
  for (const o of offenses) {
    y = writeBlock(doc, o, m + 4, y, 8, w - 4);
    y += 1;
  }
  y += 4;

  y = writeHeading(doc, 'Completion of logs', m, y);
  y = writeBlock(doc, 'All commercial drivers are required to login to an ELD and complete a daily vehicle record (log) for all 365 days of the year. – NO EXCEPTIONS.', m, y, 8, w);
  y += 2;
  y = writeBlock(doc, 'If a driver is off-duty for a day, weekend, a holiday period of several days, or even a month\'s vacation, driver must complete a log for the entire period. Enter dates in the Remarks section and show the off-duty time on the ridge/log.', m, y, 8, w);
  y += 2;

  const logRules = [
    'If working as team, each driver must login using their own login information and complete their logs. NO EXCEPTIONS.',
    'Drivers must keep their daily logs current to the time shown for the last change of duty status.',
    'Drivers must sign and acknowledge that all entries input into daily log book are correct by the end of the day.',
    'Driver is to use Personal Conveyance for personal use or personal as off-duty only when the driver is relieved from work and all responsibility for performing work by the motor carrier. NO EXCEPTIONS.',
    'If the ELD is malfunctioning, driver must: write a note on the ELD, notify his safety manager right away and use his 7 days of blank paper log until the device is working.',
    'If problem exceeds 7 days, safety manager will have to get approval of the FMCSA to continue using paper logs.',
    'Daily Vehicle Inspection Reports (DVIR\'s) must be completed by the driver. If defect(s) or services are found, driver must document it on the Daily Vehicle Inspection and provide supporting documentation of completed services/repairs.',
    'Drivers MUST make sure that they document on their logs the exact time, date and location where they fueled, as listed on their fuel receipts.',
    'Drivers must document all road and scale inspections; make sure to list on log the location and time.',
  ];
  for (const rule of logRules) {
    y = writeBlock(doc, `• ${rule}`, m + 4, y, 8, w - 4);
    y += 1;
  }
  y += 2;

  y = writeBlock(doc, 'The proper completion of logs is expected of all drivers. Drivers must make sure that each log must have the following information:', m, y, 8, w);
  y += 2;
  const logItems = [
    '1. Name of the driver', '2. Date', '3. Total miles driving in a day (24-hour period)',
    '4. Truck or tractor and trailer numbers', '5. Name of Motor Carrier/Company',
    '6. Carrier\'s main office address', '7. Name of co-driver (if applicable)',
    '8. Total hours for each duty status (Off-duty, Sleeper/Berth, Driving and On-duty)',
    '9. Shipping document number(s), or name of shipper and commodity',
    '10. In the Remarks section, the driver must indicate the location (city) for changes in duty status',
    '11. Acknowledgment of completed ELD by the end of the day',
  ];
  for (const item of logItems) {
    y = writeBlock(doc, item, m + 4, y, 8, w - 4);
    y += 1;
  }
  y += 2;

  y = writeBlock(doc, 'Drivers will be held accountable for the completion of their logs correctly and submitted on a timely basis.', m, y, 8, w);
  y += 2;
  y = writeBlock(doc, 'Drivers that incur violations for not having or completing logs properly. The driver will be responsible for the payment of the fines associated to those violations.', m, y, 8, w);
  y += 4;

  y = writeHeading(doc, '1. Log Requirements', m, y);
  y = writeBlock(doc, 'THE DRIVER is required to have the last 6 months of logs for all active and terminated drivers for audits. It is important all drivers are aware of this and complete their daily logs properly and on time.', m, y, 8, w);
  y += 4;

  y = writeHeading(doc, '2. Falsification of Logs', m, y);
  y = writeBlock(doc, 'THE DRIVER will not make any logs that are grossly falsified. Drivers will be subjected to disciplinary action, suspension and up to termination for falsification of logs.', m, y, 8, w);
  y += 4;

  y = writeHeading(doc, '3. Acknowledgment', m, y);
  y = writeBlock(doc, 'Driver has read and understands all requirements relating to their duty of records (logs).', m, y, 8, w, true);
  y += 6;

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text('Driver\'s Signature:', m, y);
  addSignatureImage(doc, data.signatures.hos, m + 40, y - 8, 60, 20);
  doc.text(`Date: ${data.date}`, 140, y);

  return doc.output('blob');
}

// ─── SERVICE AGREEMENT PDF (FULL BILINGUAL TEXT) ───
export function generateServiceAgreementPdf(data: {
  driverName: string; address: string; date: string; signature: string;
}): Blob {
  const doc = new jsPDF();
  const m = 20;
  const w = 170;
  let y = 20;

  // Header
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text('58 Logistics LLC — 3416 N Wind Place, Charlotte, NC. 28210 — (980) 202-3130', 105, y, { align: 'center' });
  y += 10;

  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text('CONTRATO DE SERVICIOS DE DISPATCH', 105, y, { align: 'center' });
  y += 12;

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  y = writeBlock(doc, `En la ciudad de Charlotte, NC, Fecha: ${data.date}`, m, y, 9, w);
  y += 2;

  y = writeHeading(doc, 'REUNIDOS:', m, y);
  y = writeBlock(doc, 'De una parte, 58 Logistics LLC, representada por su apoderado legal, con domicilio en 3416 N Wind Place, Charlotte, NC. 28210, en adelante "LA EMPRESA".', m, y, 8, w);
  y += 2;
  y = writeBlock(doc, `De la otra parte: ${data.driverName}, mayor de edad, con domicilio en: ${data.address}, en adelante "EL DRIVER".`, m, y, 8, w);
  y += 4;

  y = writeHeading(doc, 'EXPONEN:', m, y);
  y = writeBlock(doc, 'Que ambas partes desean formalizar la relación comercial de prestación de servicios de Dispatcher - Conducción bajo las siguientes condiciones:', m, y, 8, w);
  y += 4;

  // Spanish clauses
  const spClauses: [string, string][] = [
    ['PRIMERA. OBJETO DEL CONTRATO', 'LA EMPRESA contrata los servicios de EL DRIVER para operar vehículos de carga bajo nuestra Autoridad (MC#), y para realizar los transportes que le sean asignados exclusivamente por LA EMPRESA.'],
    ['SEGUNDA. EXCLUSIVIDAD', 'Durante la vigencia del presente contrato, EL DRIVER se compromete a aceptar únicamente las cargas asignadas por 58 Logistics LLC. El incumplimiento de esta obligación será causa suficiente para la terminación inmediata del contrato por parte de LA EMPRESA.'],
    ['TERCERA. DURACIÓN Y TERMINACIÓN DEL CONTRATO', 'Este contrato tendrá una duración de 6 MESES a partir de la fecha de su firma. Cualquiera de las partes podrá darlo por terminado en cualquier momento mediante notificación escrita con al menos una (1) semana de antelación.\n\nSi EL DRIVER terminara el contrato sin respetar el período de aviso indicado, LA EMPRESA podrá aplicar un descuento adicional de $100 (cien dólares) en concepto de incumplimiento del aviso previo.'],
    ['CUARTA. CARGOS POR RETIRO ANTICIPADO', 'Si EL DRIVER decide poner fin a la relación contractual antes de completar tres (3) meses de trabajo efectivo, se le descontará un monto de $300 (Trescientos dólares) que serán retenidos de su primer pago por carga trabajada.\n\nSi EL DRIVER permanece en la empresa más de tres (3) meses, se le reintegrará dicho importe.'],
    ['QUINTA. INSPECCIONES EN CARRETERA', 'En caso de que EL DRIVER sea sometido a una inspección en carretera (DOT o similar), deberá notificar a LA EMPRESA de manera inmediata. Para dicha inspección, EL DRIVER utilizará siempre la información correspondiente a su propia empresa (USDOT, MC, nombre comercial, etc.), la cual deberá estar colocada de forma visible a cada lado de su vehículo de acuerdo con las regulaciones federales. Bajo ninguna circunstancia deberá utilizar la información identificativa de LA EMPRESA.\n\nEn caso de que en el reporte de la inspección aparezca el nombre de LA EMPRESA, ésta se reserva el derecho de retener el pago completo correspondiente a la carga que el DRIVER lleve en ese momento, como "liquidated damages" (daños y perjuicios liquidados).\n\nSi EL DRIVER opera bajo un Contrato de Arrendamiento (Leasing Agreement) con LA EMPRESA y durante una inspección se le emite una violación, advertencia o es puesto fuera de servicio (Out-of-Service), se aplicará una penalización de $300 (trescientos dólares). Por el contrario, si EL DRIVER recibe una inspección limpia (sin violaciones), recibirá un bono de seguridad de $100 (cien dólares) como reconocimiento.'],
    ['SEXTA. PENALIZACIONES', 'A continuación la lista de las penalizaciones y su descuento correspondiente:\n• CANCELACIÓN DE CARGA (Sin Justificación) — $300'],
    ['SÉPTIMA. RELACIÓN COMERCIAL', 'El presente contrato no crea una relación laboral entre las partes. EL DRIVER actuará como contratista independiente (OWNER OPERATOR), y será el único responsable de sus impuestos, seguros, licencias, y cualquier otro gasto relacionado con su actividad.'],
    ['OCTAVA. CONFIDENCIALIDAD', 'EL DRIVER se compromete a no divulgar ni utilizar, directa o indirectamente, durante la vigencia de este contrato ni después de su terminación, ninguna información confidencial de LA EMPRESA, incluyendo pero no limitada a tarifas de carga, rutas, datos de clientes, proveedores, estrategias comerciales, o cualquier otra información reservada.'],
    ['NOVENA. USO ADECUADO DE LA CARGA', 'EL DRIVER se compromete a transportar la carga asignada en condiciones óptimas de seguridad, integridad y cumplimiento de las regulaciones vigentes. Será responsable de cualquier daño, pérdida, o deterioro causado por negligencia, mal manejo o incumplimiento de las normas de transporte.'],
    ['DÉCIMA. RESPONSABILIDAD POR DAÑOS O ACCIDENTES', 'EL DRIVER será responsable de los daños ocasionados por su negligencia o conducta dolosa al vehículo asignado, a la carga transportada, a terceros o a bienes de LA EMPRESA. LA EMPRESA se reserva el derecho de deducir de los pagos al EL DRIVER los montos que correspondan por reparación o compensación de dichos daños.'],
    ['DÉCIMO PRIMERA. POLÍTICA DE COMBUSTIBLE Y PEAJES', 'EL DRIVER será responsable de costear el combustible, peajes, estacionamientos y cualquier otro gasto operativo relacionado con los servicios prestados, salvo que se pacte por escrito una política distinta para determinadas cargas o rutas, o cualquier otro gasto que se genere de la misma actividad.'],
    ['DÉCIMO SEGUNDA. POLÍTICA DE RESOLUCIÓN DE CONFLICTOS (MEDIACIÓN Y ARBITRAJE)', 'Las partes acuerdan que, en caso de surgir cualquier conflicto relacionado con la interpretación, ejecución o cumplimiento de este contrato, intentarán resolverlo amistosamente mediante mediación. Si la mediación no resultara satisfactoria, las partes acuerdan someterse a un arbitraje de derecho administrado por un organismo competente en el estado de North Carolina, cuyo laudo será vinculante y definitivo para ambas partes.'],
    ['DÉCIMO TERCERA. MODIFICACIONES', 'Cualquier modificación al presente contrato deberá realizarse por escrito y con el consentimiento expreso de ambas partes.'],
    ['DÉCIMO CUARTA. JURISDICCIÓN', 'Para la resolución de cualquier controversia que derive de este contrato, ambas partes se someten a la jurisdicción de los tribunales competentes en el estado de North Carolina (USA).'],
  ];

  for (const [title, text] of spClauses) {
    y = writeHeading(doc, title, m, y);
    y = writeBlock(doc, text, m, y, 8, w);
    y += 3;
  }

  y = writeBlock(doc, 'Y en prueba de conformidad, ambas partes firman el presente contrato en dos ejemplares de idéntico tenor y a un solo efecto, en el lugar y fecha indicados al inicio.', m, y, 8, w);
  y += 8;

  // ═══ ENGLISH VERSION ═══
  if (y > 240) { doc.addPage(); y = 20; }
  doc.setDrawColor(150);
  doc.line(m, y, 190, y);
  y += 8;

  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text('DISPATCHING SERVICES AGREEMENT', 105, y, { align: 'center' });
  y += 12;

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  y = writeBlock(doc, `In the city of Charlotte, NC, Date: ${data.date}`, m, y, 9, w);
  y += 2;

  y = writeHeading(doc, 'PARTIES:', m, y);
  y = writeBlock(doc, 'On one side, 58 Logistics LLC, represented by its legal representative, with address at 3416 N Wind Place, Charlotte, NC 28210, hereinafter referred to as "THE COMPANY".', m, y, 8, w);
  y += 2;
  y = writeBlock(doc, `On the other side, ${data.driverName}, of legal age, with address at ${data.address}, hereinafter referred to as "THE DRIVER."`, m, y, 8, w);
  y += 4;

  y = writeHeading(doc, 'RECITALS:', m, y);
  y = writeBlock(doc, 'Both parties wish to formalize a commercial relationship for the provision of Dispatching – Driving services under the following conditions:', m, y, 8, w);
  y += 4;

  const enClauses: [string, string][] = [
    ['FIRST. PURPOSE OF THE AGREEMENT', 'THE COMPANY engages THE DRIVER to operate freight vehicles under our Authority (MC#) and to perform the transportation services exclusively assigned by THE COMPANY.'],
    ['SECOND. EXCLUSIVITY', 'During the term of this agreement, THE DRIVER agrees to accept only the loads assigned by 58 Logistics LLC. Breach of this obligation shall constitute sufficient cause for the immediate termination of this agreement by THE COMPANY.'],
    ['THIRD. TERM AND TERMINATION', 'This agreement shall have a duration of six (6) months from the date of signature. Either party may terminate it at any time by giving written notice at least one (1) week in advance.\n\nIf THE DRIVER terminates the agreement without respecting the notice period, THE COMPANY may apply an additional deduction of one hundred dollars (USD $100) as a penalty for non-compliance with the notice period.'],
    ['FOURTH. EARLY WITHDRAWAL CHARGES', 'If THE DRIVER decides to terminate the contractual relationship before completing three (3) months of effective work, an amount of three hundred dollars (USD $300) shall be deducted and retained from the first load payment.\n\nIf THE DRIVER remains with the company for more than three (3) months, said amount will be refunded.'],
    ['FIFTH. ROADSIDE INSPECTIONS', 'In the event THE DRIVER is subject to a roadside inspection (DOT or similar), THE DRIVER must notify THE COMPANY immediately. For such inspection, THE DRIVER must always use the information corresponding to his/her own company (USDOT, MC, trade name, etc.), which must be visibly displayed on both sides of the vehicle in accordance with federal regulations. Under no circumstances shall THE DRIVER use the identifying information of THE COMPANY.\n\nIf THE COMPANY\'s name appears on the inspection report, THE COMPANY reserves the right to withhold the full payment corresponding to the load being carried at that time as "liquidated damages."\n\nIf THE DRIVER operates under a Leasing Agreement with THE COMPANY and during an inspection receives a violation, warning, or is placed Out-of-Service, a penalty of three hundred dollars (USD $300) shall apply. Conversely, if THE DRIVER receives a clean inspection (no violations), he/she shall receive a safety bonus of one hundred dollars (USD $100) as recognition.'],
    ['SIXTH. PENALTIES', 'The following penalties and deductions shall apply:\n• LOAD CANCELLATION (Without Justification) – USD $300'],
    ['SEVENTH. COMMERCIAL RELATIONSHIP', 'This agreement does not create an employment relationship between the parties. THE DRIVER shall act as an independent contractor (OWNER OPERATOR) and shall be solely responsible for his/her taxes, insurance, licenses, and any other expenses related to his/her activity.'],
    ['EIGHTH. CONFIDENTIALITY', 'THE DRIVER agrees not to disclose or use, directly or indirectly, during the term of this agreement or after its termination, any confidential information of THE COMPANY, including but not limited to: freight rates, routes, customer data, suppliers, business strategies, or any other reserved information.'],
    ['NINTH. PROPER HANDLING OF FREIGHT', 'THE DRIVER agrees to transport the assigned freight under optimal conditions of safety, integrity, and compliance with current regulations. THE DRIVER shall be responsible for any damage, loss, or deterioration caused by negligence, mishandling, or non-compliance with transportation regulations.'],
    ['TENTH. LIABILITY FOR DAMAGES OR ACCIDENTS', 'THE DRIVER shall be responsible for damages caused by his/her negligence or willful misconduct to the assigned vehicle, transported freight, third parties, or THE COMPANY\'s property. THE COMPANY reserves the right to deduct from THE DRIVER\'s payments the amounts corresponding to repair or compensation for such damage.'],
    ['ELEVENTH. FUEL AND TOLL POLICY', 'THE DRIVER shall be responsible for covering the costs of fuel, tolls, parking, and any other operating expenses related to the services provided, unless otherwise agreed in writing for certain loads or routes, or any other expense arising from the same activity.'],
    ['TWELFTH. DISPUTE RESOLUTION POLICY (MEDIATION AND ARBITRATION)', 'The parties agree that, in the event of any dispute related to the interpretation, execution, or compliance of this agreement, they shall first attempt to resolve it amicably through mediation. If mediation is not successful, the parties agree to submit the matter to binding arbitration administered by a competent body in the state of North Carolina, whose award shall be final and binding on both parties.'],
    ['THIRTEENTH. AMENDMENTS', 'Any amendments to this agreement must be made in writing and with the express consent of both parties.'],
    ['FOURTEENTH. JURISDICTION', 'For the resolution of any dispute arising from this agreement, both parties submit to the jurisdiction of the competent courts of the state of North Carolina (USA).'],
  ];

  for (const [title, text] of enClauses) {
    y = writeHeading(doc, title, m, y);
    y = writeBlock(doc, text, m, y, 8, w);
    y += 3;
  }

  y = writeBlock(doc, 'In witness whereof, both parties sign this agreement in two counterparts of identical content and for a single purpose, in the place and date indicated above.', m, y, 8, w);
  y += 10;

  // Signatures
  if (y > 240) { doc.addPage(); y = 20; }
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text('POR 58 LOGISTICS LLC:', m, y);
  doc.text('EL DRIVER:', 120, y);
  y += 4;
  doc.text('Francisco Monsalve', m, y + 10);
  addSignatureImage(doc, data.signature, 120, y - 2, 60, 20);
  y += 22;
  doc.text(data.driverName, 120, y);
  doc.text(`Fecha / Date: ${data.date}`, m, y + 8);

  return doc.output('blob');
}

// ─── ONBOARDING SUMMARY PDF ───
export interface OnboardingSummaryData {
  driverData: {
    name: string; email: string; phone: string; license: string;
    state: string | null; license_expiry: string | null; medical_card_expiry: string | null;
  };
  truckData: {
    unit_number: string; truck_type: string; make?: string | null; model?: string | null;
    year?: number | null; vin?: string | null; license_plate?: string | null;
    max_payload_lbs?: number | null;
    insurance_expiry?: string | null; registration_expiry?: string | null;
    cargo_length_ft?: number | null; cargo_width_in?: number | null; cargo_height_in?: number | null;
    rear_door_width_in?: number | null; rear_door_height_in?: number | null;
    trailer_length_ft?: number | null; mega_ramp?: string | null;
  };
  driverDocs: string[];
  truckDocs: string[];
  signedDocs: { w9: boolean; leasing: boolean; service: boolean };
  date: string;
}

export function generateOnboardingSummaryPdf(data: OnboardingSummaryData): Blob {
  const doc = new jsPDF();
  const m = 20;
  const w = 170;
  let y = 20;

  // Header
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('DRIVER ONBOARDING SUMMARY', 105, y, { align: 'center' });
  y += 8;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(`Date: ${data.date}`, 105, y, { align: 'center' });
  y += 4;
  doc.setDrawColor(0);
  doc.line(m, y, 190, y);
  y += 8;

  const field = (label: string, value: string | number | null | undefined, yRef: { y: number }) => {
    if (!value && value !== 0) return;
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text(label, m, yRef.y);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text(String(value), m + 45, yRef.y);
    yRef.y += 6;
    if (yRef.y > 275) { doc.addPage(); yRef.y = 20; }
  };

  const yRef = { y };

  // DRIVER INFORMATION
  yRef.y = writeHeading(doc, 'DRIVER INFORMATION', m, yRef.y, 11);
  yRef.y += 2;
  field('Name:', data.driverData.name, yRef);
  field('Email:', data.driverData.email, yRef);
  field('Phone:', data.driverData.phone, yRef);
  field('License #:', data.driverData.license, yRef);
  field('State:', data.driverData.state, yRef);
  field('License Exp:', data.driverData.license_expiry, yRef);
  field('Medical Exp:', data.driverData.medical_card_expiry, yRef);

  if (data.driverDocs.length > 0) {
    yRef.y += 2;
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text('Documents:', m, yRef.y);
    yRef.y += 5;
    for (const docName of data.driverDocs) {
      doc.text(`  ✓ ${docName}`, m + 5, yRef.y);
      yRef.y += 5;
      if (yRef.y > 275) { doc.addPage(); yRef.y = 20; }
    }
  }

  yRef.y += 4;
  doc.line(m, yRef.y, 190, yRef.y);
  yRef.y += 8;

  // TRUCK INFORMATION
  yRef.y = writeHeading(doc, 'TRUCK INFORMATION', m, yRef.y, 11);
  yRef.y += 2;
  field('Unit #:', data.truckData.unit_number, yRef);
  field('Type:', data.truckData.truck_type, yRef);
  field('Make:', data.truckData.make, yRef);
  field('Model:', data.truckData.model, yRef);
  field('Year:', data.truckData.year, yRef);
  field('VIN:', data.truckData.vin, yRef);
  field('License Plate:', data.truckData.license_plate, yRef);
  if (data.truckData.max_payload_lbs) {
    field('Max Payload:', `${data.truckData.max_payload_lbs.toLocaleString()} lbs`, yRef);
  }
  field('Insurance Exp:', data.truckData.insurance_expiry, yRef);
  field('Registration Exp:', data.truckData.registration_expiry, yRef);

  // Dimensions
  const dims: string[] = [];
  if (data.truckData.cargo_length_ft) dims.push(`Cargo: ${data.truckData.cargo_length_ft}ft L`);
  if (data.truckData.cargo_width_in) dims.push(`${data.truckData.cargo_width_in}in W`);
  if (data.truckData.cargo_height_in) dims.push(`${data.truckData.cargo_height_in}in H`);
  if (data.truckData.rear_door_width_in) dims.push(`Door: ${data.truckData.rear_door_width_in}in W`);
  if (data.truckData.rear_door_height_in) dims.push(`${data.truckData.rear_door_height_in}in H`);
  if (data.truckData.trailer_length_ft) dims.push(`Trailer: ${data.truckData.trailer_length_ft}ft`);
  if (dims.length) field('Dimensions:', dims.join(' × '), yRef);
  if (data.truckData.mega_ramp) field('Mega Ramp:', data.truckData.mega_ramp, yRef);

  if (data.truckDocs.length > 0) {
    yRef.y += 2;
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text('Documents:', m, yRef.y);
    yRef.y += 5;
    for (const docName of data.truckDocs) {
      doc.text(`  ✓ ${docName}`, m + 5, yRef.y);
      yRef.y += 5;
      if (yRef.y > 275) { doc.addPage(); yRef.y = 20; }
    }
  }

  yRef.y += 4;
  doc.line(m, yRef.y, 190, yRef.y);
  yRef.y += 8;

  // SIGNED DOCUMENTS
  yRef.y = writeHeading(doc, 'SIGNED DOCUMENTS', m, yRef.y, 11);
  yRef.y += 2;
  const signedItems = [
    { label: 'W-9 Form', signed: data.signedDocs.w9 },
    { label: 'Leasing Agreement', signed: data.signedDocs.leasing },
    { label: 'Service Agreement', signed: data.signedDocs.service },
  ];
  for (const item of signedItems) {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(`${item.signed ? '✓' : '✗'} ${item.label}`, m + 5, yRef.y);
    yRef.y += 6;
  }

  return doc.output('blob');
}

// ─── TERMINATION LETTER PDF (V1.2 — EN only) ───
export function generateTerminationLetterPdf(data: {
  driverName: string;
  companyName: string;
  year: string;
  make: string;
  model: string;
  vin: string;
  licensePlate: string;
  representativeName: string;
  date: string;
  signature?: string;
}): Blob {
  const doc = new jsPDF();
  const m = 20;
  const w = 170;
  let y = 22;
  const fs = 9;
  const ls = 4.2;

  const co = data.companyName || 'Company';

  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text(co.toUpperCase(), 105, y, { align: 'center' });
  y += 7;
  doc.text('TERMINATION LETTER', 105, y, { align: 'center' });
  y += 4;
  doc.setLineWidth(0.5);
  doc.line(m, y, m + w, y);
  y += 10;

  doc.setFontSize(fs);
  doc.setFont('helvetica', 'normal');
  doc.text(`Date: ${data.date}`, m, y);
  y += 7;

  doc.text('To:', m, y);
  y += 5;
  doc.setFont('helvetica', 'bold');
  doc.text(`Driver Name: ${data.driverName}`, m, y);
  doc.setFont('helvetica', 'normal');
  y += 8;

  doc.text('Dear Sir/Madam,', m, y);
  y += 7;

  y = writeBlock(doc, `By means of this letter, ${co} hereby formally notifies you of the immediate and irrevocable termination of the lease agreement previously entered into between you and our company. This termination is effective upon receipt of this communication, and it carries with it a series of obligations that you are legally required to fulfill without delay.`, m, y, fs, w, false, ls);
  y += 5;

  y = writeBlock(doc, 'The vehicle covered under the terminated lease agreement is identified as follows:', m, y, fs, w, false, ls);
  y += 3;

  // Vehicle table
  const vehicleFields = [
    ['Year:', data.year],
    ['Make:', data.make],
    ['Model:', data.model],
    ['VIN Number:', data.vin],
    ['License Plate:', data.licensePlate],
  ];
  for (const [label, val] of vehicleFields) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(fs);
    doc.text(label, m, y);
    doc.setFont('helvetica', 'normal');
    doc.text(val || '______________________________', m + 30, y);
    y += 5.5;
  }
  y += 4;

  y = writeBlock(doc, `From this moment forward, and under no circumstance or for any reason whatsoever, you are strictly prohibited from using, displaying, reproducing, distributing, or referencing any information belonging to ${co}. This includes, but is not limited to, our company's trade name, operating authority numbers (MC/DOT), logos, seals, letterheads, dispatch documentation, bills of lading, or any other material bearing our company's identity — in any medium, format, or context. This prohibition is absolute, unconditional, and permanent.`, m, y, fs, w, false, ls);
  y += 5;

  y = writeBlock(doc, `Furthermore, you are required to immediately remove, at your own expense, all markings, decals, placards, magnetic signs, DOT numbers, MC numbers, and any other identification belonging to ${co} from the above-referenced commercial vehicle. This removal must be completed within Twelve (12) hours of receiving this letter. Continued display of our company's information on your vehicle after this period will be treated as unauthorized use of our identity and operating authority.`, m, y, fs, w, false, ls);
  y += 5;

  y = writeBlock(doc, `Please be advised that failure to comply with any of the obligations set forth in this letter will leave ${co} no choice but to pursue all legal remedies available under federal and state law. This includes, but is not limited to, the filing of formal complaints before the Federal Motor Carrier Safety Administration (FMCSA), which may result in the suspension or revocation of your Commercial Driver's License (CDL) and operating privileges; civil litigation seeking compensatory and punitive damages; criminal complaints for identity fraud and unauthorized use of commercial operating authority; and any other direct legal action against you that may be deemed necessary. ${co} will not hesitate to act swiftly and decisively to protect its rights, identity, and business interests.`, m, y, fs, w, false, ls);
  y += 5;

  y = writeBlock(doc, 'We trust that you will attend to these matters promptly and in full compliance with the terms outlined herein. Ignorance of this notice will not constitute a valid defense in any legal proceeding arising from non-compliance.', m, y, fs, w, false, ls);
  y += 8;

  doc.text('Respectfully,', m, y);
  y += 5;
  if (data.signature) {
    addSignatureImage(doc, data.signature, m, y - 2, 50, 15);
    y += 16;
  } else {
    doc.text('_______________________________', m, y);
    y += 6;
  }
  doc.setFont('helvetica', 'bold');
  doc.text(data.representativeName, m, y);
  y += 5;
  doc.setFont('helvetica', 'normal');
  doc.text('Authorized Representative', m, y);
  y += 5;
  doc.text(co, m, y);

  return doc.output('blob');
}

/** Generate Employment Contract PDF for Company Drivers */
export function generateEmploymentContractPdf(data: { driverName: string; signatureDataUrl: string; date: string }): Blob {
  const doc = new jsPDF({ unit: 'mm', format: 'letter' });
  const m = 20;
  const maxW = 170;
  let y = 25;

  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('EMPLOYMENT CONTRACT', 105, y, { align: 'center' });
  y += 6;
  doc.setFontSize(11);
  doc.text('CONTRATO DE TRABAJO', 105, y, { align: 'center' });
  y += 10;

  const sections = [
    { title: '1. POSITION & DUTIES / PUESTO Y FUNCIONES', body: 'The Employee is hired as a Company Driver responsible for operating commercial motor vehicles for the transportation of goods. The Employee agrees to follow all DOT/FMCSA regulations, company policies, and applicable laws.\n\nEl Empleado es contratado como Conductor de Empresa responsable de operar vehículos motorizados comerciales para el transporte de mercancías.' },
    { title: '2. COMPENSATION / COMPENSACIÓN', body: 'The Employee will receive compensation as determined by the Company\'s pay schedule. Payment details will be provided separately.\n\nEl Empleado recibirá compensación según lo determinado por el calendario de pagos de la Empresa.' },
    { title: '3. EMPLOYMENT RELATIONSHIP / RELACIÓN LABORAL', body: 'The Employee acknowledges that they are an employee of the Company, not an independent contractor. The Company will provide the vehicle, insurance, and necessary equipment for operations.\n\nEl Empleado reconoce que es un empleado de la Empresa, no un contratista independiente.' },
    { title: '4. TERMINATION / TERMINACIÓN', body: 'Either party may terminate this Agreement with written notice. The Company reserves the right to terminate immediately for cause, including but not limited to: safety violations, failed drug tests, or material breach of this Agreement.\n\nCualquiera de las partes puede terminar este Acuerdo con notificación por escrito.' },
  ];

  y = writeBlock(doc, `This Employment Contract is entered into on ${data.date}, between the Company and ${data.driverName} ("Employee").`, m, y, 9, maxW);
  y += 3;
  y = writeBlock(doc, `Este Contrato de Trabajo se celebra el ${data.date}, entre la Empresa y ${data.driverName} ("Empleado").`, m, y, 9, maxW);
  y += 6;

  for (const s of sections) {
    y = writeHeading(doc, s.title, m, y, 9);
    y = writeBlock(doc, s.body, m, y, 8, maxW, false, 3.5);
    y += 4;
  }

  y += 6;
  if (y > 240) { doc.addPage(); y = 25; }
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(`Date / Fecha: ${data.date}`, m, y);
  y += 8;
  doc.text('Employee Signature / Firma del Empleado:', m, y);
  y += 4;
  if (data.signatureDataUrl) {
    addSignatureImage(doc, data.signatureDataUrl, m, y, 50, 15);
    y += 18;
  }
  doc.text(data.driverName, m, y);
  y += 5;
  doc.text('Print Name / Nombre Impreso', m, y);

  return doc.output('blob');
}
