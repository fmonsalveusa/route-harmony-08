import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { format } from 'date-fns';
import SignaturePad from './SignaturePad';
import { generateLeasingPdf, CARRIER_AG_AR, CARRIER_VENCO, CARRIER_58_LOGISTICS } from '@/lib/onboardingDocPdf';

export interface LeasingBlobs {
  main: Blob;      // AG-AR Transportation
  venco: Blob;     // VENCO
  logistics58: Blob; // 58 LOGISTICS LLC
}

interface LeasingAgreementDialogProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  driverName: string;
  truckData: { make: string; model: string; vin: string; year: number; unit_number: string };
  onSigned: (blobs: LeasingBlobs) => void;
}

export default function LeasingAgreementDialog({ open, onOpenChange, driverName, truckData, onSigned }: LeasingAgreementDialogProps) {
  const [companyName, setCompanyName] = useState('');
  const [signatures, setSignatures] = useState<{ contract: string | null; eld: string | null; hos: string | null }>({
    contract: null, eld: null, hos: null,
  });

  const handleSubmit = () => {
    if (!signatures.contract || !signatures.eld || !signatures.hos) {
      toast.error('All 3 signatures are required');
      return;
    }
    const pdfData = {
      driverName,
      companyName,
      make: truckData.make,
      model: truckData.model,
      vin: truckData.vin,
      year: truckData.year,
      date: format(new Date(), 'MM/dd/yyyy'),
      signatures: signatures as { contract: string; eld: string; hos: string },
    };
    // Generate one PDF per carrier company
    const main = generateLeasingPdf({ ...pdfData, carrier: CARRIER_AG_AR });
    const venco = generateLeasingPdf({ ...pdfData, carrier: CARRIER_VENCO });
    const logistics58 = generateLeasingPdf({ ...pdfData, carrier: CARRIER_58_LOGISTICS });
    onSigned({ main, venco, logistics58 });
    toast.success('Leasing Agreement signed (3 copies generated)');
  };

  const today = format(new Date(), 'MM/dd/yyyy');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Owner Operator Lease Agreement (3 copies — AG-AR, VENCO & 58 Logistics)</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 text-sm">
          {/* Pre-filled info */}
          <div className="bg-muted/50 p-3 rounded-lg grid grid-cols-2 gap-2 text-xs">
            <div><span className="text-muted-foreground">Owner Operator:</span> {driverName}</div>
            <div><span className="text-muted-foreground">Vehicle:</span> {truckData.year} {truckData.make} {truckData.model}</div>
            <div><span className="text-muted-foreground">VIN:</span> {truckData.vin || 'N/A'}</div>
            <div><span className="text-muted-foreground">Date:</span> {today}</div>
          </div>

          <div className="space-y-2">
            <Label>Owner Operator Company Name</Label>
            <Input value={companyName} onChange={e => setCompanyName(e.target.value)} placeholder="Your company name (if applicable)" />
          </div>

          {/* ═══ FULL LEASE AGREEMENT TEXT ═══ */}
          <div className="border rounded-lg p-4 space-y-3 text-xs leading-relaxed max-h-[400px] overflow-y-auto bg-white">
            <h3 className="font-bold text-sm text-center">OWNER OPERATOR LEASE AGREEMENT</h3>

            <p>THIS agreement, entered into this day {today} Between 58 LOGISTICS LLC DOT#: 4364896 MC#: 1708664 Address: 1634 N Wind Pl. Apt 206. Charlotte, NC. 28210 (Hereinafter designated as "Carrier"), and the Owner Operator Company Name: <strong>{companyName || '_______________'}</strong></p>
            <p>Owner Operator Name: <strong>{driverName}</strong></p>
            <p>On this agreement is included a Vehicle:</p>
            <table className="w-full border-collapse text-xs mb-2">
              <tbody>
                <tr><td className="border px-2 py-1 font-bold w-20">MAKE:</td><td className="border px-2 py-1">{truckData.make || '_______________'}</td></tr>
                <tr><td className="border px-2 py-1 font-bold">MODEL:</td><td className="border px-2 py-1">{truckData.model || '_______________'}</td></tr>
                <tr><td className="border px-2 py-1 font-bold">VIN:</td><td className="border px-2 py-1">{truckData.vin || '_______________'}</td></tr>
                <tr><td className="border px-2 py-1 font-bold">YEAR:</td><td className="border px-2 py-1">{truckData.year || '_______________'}</td></tr>
              </tbody>
            </table>

            <h4 className="font-bold">WITNESSETH:</h4>
            <p>WHEREAS, Owner Operator is engaged in the transportation of general freights of all kinds (FAK) by motor vehicle as a contract Carrier and desires to transport goods for Carrier; and WHEREAS, to facilitate such transportation and for the convenience in handling such transaction, the parties have agreed to the terms and conditions under which transportation shall be made, as hereinafter set forth.</p>
            <p>NOW THEREFORE, in consideration of the premises and the mutual promises and conditions herein contained it is hereby agreed as follows:</p>

            <h4 className="font-bold">(1) GENERAL PROVISIONS:</h4>
            <p>(a) Owner Operator, in its operations hereunder, shall secure all permits, licenses and approvals necessary for the accomplishment of the work to be done hereunder and shall comply fully with all applicable laws, rules, orders and regulation of all governments and agencies thereof, whether federal, state or local, and shall furnish Carrier with satisfactory evidence thereof whenever requested to do so. Among other things, Owner Operator shall provide to Federal Motor Carrier Safety Administration certificate showing Owner Operator holds contract authority from such commission covering the commodities and transportation routes to which this agreement relates, and Owner Operator shall give immediate notice to Carrier of any cancellation or modification of such authority. When transporting hazardous wastes, substances or materials pursuant this agreement, Owner Operator shall comply with all applicable federal, state and local hazardous wastes, substances or materials laws and regulations and shall furnish Carrier with satisfactory evidence thereof whenever requested to do so.</p>

            <p>(b) The Owner Operator hereby agrees to deliver for the Carrier for transportation, not less than the following amount: one shipment of freight of all kinds (FAK) during a period of 6 Months. The Owner Operator further agrees, subject to availability and loading tendered for transportation by Carrier.</p>

            <p>(c) All such cargo shall be transported hereunder in accordance with this agreement and the provisions of Carrier's tariffs or service contracts applicable to such cargo. Cargo shall include any containers in which goods are packed when received by Owner Operator hereunder.</p>

            <p>(d) This agreement shall not be modified or altered unless in writing, signed by both parties to this agreement.</p>

            <p>(e) This contract shall terminate all previous contracts between the parties hereto relating to the transportation Freight all kinds (FAK) and shall remain in full force and effect for the term of this agreement.</p>

            <p>(f) It is to be clearly understood and it is the intention of the parties hereto that Owner Operator shall employ all persons operating trucks hereunder, that such persons shall be and remain the employees of the Owner Operator, that the Owner Operator shall be an independent contractor of the Carrier and that nothing herein contained shall be construed to be inconsistent with that relation or status.</p>

            <p>(g) It is further to be clearly understood that where the Owner Operator engages any subcontractor for any portion of the work hereunder, such engagement will not alter the relationship of the Owner Operator to the Carrier as an independent contractor and shall not establish any relationship or obligation between Carrier and any subcontractor. Owner Operator will continue to be solely responsible for compliance with or performance for any subcontractors actually doing such work and will otherwise defend, indemnify and save harmless the Carrier, its agents and servants from any such claims, liabilities, penalties and fines (whether criminal or civil), judgments outlays and expenses (including attorney's fees).</p>

            <p>(h) Owner Operator shall defend, indemnify and save harmless the Carrier, its agents and servants from any and all liabilities, penalties and fines (whether criminal or civil), judgments, outlays and expenses (including attorney's fees) resulting from Owner Operator's failure or the failure of Owner Operator's agents, employees, subcontractors or representatives to comply with any applicable laws and regulations, whether federal, state or local, or property arising out of the performance of this agreement caused by the acts, failure to act or negligence of Owner Operator, subcontractors, its agent, employees, or representatives.</p>

            <p>1. Owner Operator will assume all liability for and will otherwise defend, indemnify and save harmless the Carrier, its agents or servants from any and all liabilities, penalties and fines (whether criminal or civil). Judgments, outlays and expenses (including attorney's fees) resulting from any release or discharge of hazardous wastes, substances or materials that occurs during transportation and Owner Operator will assume all responsibility and liability for cleanup of any release or discharge of hazardous wastes, substances or materials that occurs during transportation and will otherwise defend indemnify and save harmless the Shipper, its agents and servants from any and all liabilities, penalties and fines (whether criminal or civil), judgments, outlays and expenses (including attorney fees) resulting from the cleanup of any such release or discharge.</p>

            <p>2. Owner Operator will defend, indemnify and save harmless the Carrier, its agents and servants from any and all liabilities, penalties and fines (whether criminal or civil in nature), judgments, outlays and expenses (including attorney's fees) resulting from the Owner Operator's failure or the failure of Carrier's agents, employees, subcontractors or representatives to perform any of the terms, conditions, promises or covenants contained in this contract.</p>

            <p>3. Carrier shall have full responsibility for all payments, benefits, and rights of whatsoever nature to or on behalf of any of its employees and to ensure that its subcontractor shall have the same responsibility.</p>

            <p>4. It is further agreed by the parties hereto that Owner Operator is not to display the name of Carrier upon or about any of the Owner Operator's vehicles, without Carrier's written consent.</p>

            <p>5. Any limitation on or exemption from liability in any tariff, receipt, bill of lading, or other document issued by or on behalf of Owner Operator shall have no legal effect and shall not otherwise apply with respect to shipments tendered by or on behalf of Carrier unless specifically agreed in writing by the Owner Operator. Any limitations on or exemptions from liability contained in a Owner Operator's tariff, receipt, bill of lading, or other document issued in conjunction with a specific shipment moving under this Contract shall have no legal effect and shall not otherwise be applicable to such shipments.</p>

            <h4 className="font-bold">2. RECEIPTS OF GOODS:</h4>
            <p>(a) Owner Operator agrees, upon receipt from Carrier of such quantities of Carrier's goods as may be tendered from time to time under this agreement by Carrier or by a third party on behalf of Carrier to give Carrier a written receipt thereof, which shall be prima facie evidence of receipt of such goods in good order and condition unless otherwise noted upon the face of such receipt; and, in the case of transportation of hazardous wastes, substances or materials such written receipt shall be prima facie evidence of receipt of such wastes, substances or materials in a condition and manner which complies with all applicable laws and regulations, whether federal, state or local. In the event that Owner Operator elects to use a tariff, bill of lading, manifest or other form of freight receipt or contract, any terms, conditions and provisions of such bill of lading, manifest or other form shall be subject and subordinate to the terms, conditions and provisions of this Agreement, and in the event of a conflict between the terms, conditions and provisions of such tariff, bill of lading, manifest or other form and this Agreement, the terms, conditions and provisions of this Agreement shall govern.</p>

            <p>(b) Owner Operator agrees to take signed receipts upon forms satisfactory to Carrier from all persons to whom deliveries shall be made, which receipts shall be retained by Owner Operator for at least two (2) years and shall be available for inspection and use of Shipper.</p>

            <h4 className="font-bold">3. CARE AND CUSTODY OF MERCHANDISE:</h4>
            <p>(a) Owner Operator hereby assume the liability of an insurer of the prompt and safe transportation of all goods entrusted to its care, and shall be responsible to Carrier for all loss or damage of whatever kind and nature and howsoever, caused to any and all goods entrusted to Owner Operator hereunder occurring, while same remains in the care, custody or control of Owner Operator or to any other persons to whom the Owner Operator may have entrusted said goods and before said goods are delivered as herein provided or returned to Carrier.</p>

            <p>(b) On occasion, Owner Operator will be requested to transport reefer cargo refrigerated containers. On all occasions, refrigerated containers must be transported with an attached generator set (nose mounted or under-slung) unless specifically advised by Carrier in writing that a generator set is not required. It is the Carrier's responsibility to ensure a generator set is attached and running properly at the assigned temperature at the time of interchange.</p>

            <h4 className="font-bold">4. INSURANCE:</h4>
            <p>(a) Owner Operator agrees to be a motor Carrier member in good standing in the Uniform Intermodal Interchange Agreement (UIIA). Owner Operator further agrees to comply with the insurance requirements of the Federal Motor Carrier Safety Administration and the states through which the Owner Operator operates. Owner Operator's insurance coverage shall, at a minimum, comply with the minimum requirements as stated in the UIIA.</p>

            <p>(b) The Owner Operator agrees to carry cargo, personal injury, death, equipment and general insurance.</p>

            <h4 className="font-bold">5. INSURANCE (cont.):</h4>
            <p>and will promptly reimburse Carrier for the value of any goods (including containers) lost or destroyed during the period of Owner Operator's responsibility under clause (3)(a). All such insurance shall be as additional insured.</p>

            <p>(c) The Owner Operator agrees to provide the UIIA with appropriate certification and a copy of each policy of insurance and renewals thereof or other satisfactory evidence that Owner Operator has obtained insurance in compliance with the requirements and terms of this agreement.</p>

            <p>(d) The Owner Operator will arrange with its broker and/or insurance Carrier(s) that notice of coverage and limits will be sent directly to the UIIA, as well and cancellation notices and amendments to coverage(s).</p>

            <h4 className="font-bold">5. ASSIGNMENTS:</h4>
            <p>This contract cannot be assigned by Owner Operator without the written consent of Carrier.</p>

            <h4 className="font-bold">6. COMPENSATION, COMMODITIES, TERRITORY:</h4>
            <p>(a) Acceptable rates and charges, rules and regulations, the commodities to be transported, and the points from and to which they shall be transported, are to be furnished the Carrier, the Federal Motor Carrier Safety Administration and other regulatory bodies as may be required, as set forth in the rate schedule attached hereto and made a part hereof. Carrier agrees to pay Owner Operator as full compensation for services to be performed by Carrier under said rules and regulations the rates and charges set forth in the rate schedule, within sixty (60) days of invoice date.</p>

            <p>(b) This agreement is to become effective upon signature by Carrier and Owner Operator.</p>

            <h4 className="font-bold">7. CONFIDENTIALITY:</h4>
            <p>Owner Operator shall treat as confidential, and not to disclose to third parties, the terms of this agreement or any information concerning the Carrier's business including information regarding suppliers, products and customers without in each instance obtaining Carrier's written consent in advance.</p>

            <h4 className="font-bold">8. NOTICES:</h4>
            <p>All notices given pursuant to this agreement shall be given in writing by certified or registered mail, return receipt requested, and addressed as directed by the parties from time to time.</p>

            <h4 className="font-bold">9. APPLICABLE LAW:</h4>
            <p>To the extent state law applies, this agreement shall be governed by and interpreted in accordance with the laws of the state of NORTH CAROLINA.</p>
          </div>

          <div className="space-y-2">
            <Label className="font-semibold">Signature — Lease Agreement *</Label>
            <SignaturePad onSignatureChange={s => setSignatures(prev => ({ ...prev, contract: s }))} />
          </div>

          <Separator />

          {/* ═══ FULL ELD POLICY TEXT ═══ */}
          <div className="border rounded-lg p-4 space-y-3 text-xs leading-relaxed max-h-[400px] overflow-y-auto bg-white">
            <h3 className="font-bold text-sm text-center">ELECTRONIC LOGGING DEVICES (ELD)</h3>

            <h4 className="font-bold">Before You Start Driving</h4>
            <ol className="list-decimal pl-5 space-y-2">
              <li><strong>Ensure your device functions correctly.</strong> Check that your ELD functions correctly. In the case of portable or phone ELD devices, check that the battery is fully charged. If you have any questions about whether your device is working correctly, report it to your carrier and put it in writing if possible. Putting it in writing gives you proof that you brought the issue to the attention of your carrier, in the event that it becomes a malfunction later.</li>
              <li><strong>Verify ELD documentation accessible.</strong> Ensure you have the 3 required ELD documents in the cab/accessible electronically:
                <ul className="list-disc pl-5 mt-1">
                  <li>Transfer guide</li>
                  <li>ELD manual</li>
                  <li>Malfunction guide</li>
                </ul>
                Your ELD manufacturer should have these documents available.
              </li>
              <li><strong>Keep backup paper logs on board.</strong> Ensure you have at least 8 days worth of blank paper logs on hand in case of an issue with your ELD. These 4 elements (the 3 ELD documents listed above and additional blank paper logs) are required to be on board all times. You may be in violation if you don't have them available.</li>
              <li><strong>Check the driver interface and placement.</strong> Lastly, make sure your driver interface (the screen you use to enter RODs, view time remaining, etc.) is mounted to the vehicle and in line of sight, while also maintaining compliance with other state rules such as no windshield mounting. Keeping the ELD device appropriately mounted and in line of sight is an ELD requirement. If you see a portable tablet/phone device, ensure you have a mount for it, as officers can cite you if it isn't secured while being used as part of your ELD solution.</li>
            </ol>

            <h4 className="font-bold">Roadside Inspections</h4>
            <p>If you are asked to show your logs during a roadside inspection, your first action should be to ask the officer what method of transfer they support. Some states may support both transfer mechanisms as described by the ELD mandate:</p>
            <ol className="list-decimal pl-5">
              <li>"local" – which is a USB or Bluetooth transfer</li>
              <li>"telematics" – wireless transfer through the ELD provider and email</li>
            </ol>
            <p>However, it is far more likely that they will support only one. Telematics transfer is emerging as the method of choice for many jurisdictions. If your ELD supports the method of transfer requested, follow the instructions in the Transfer Guide.</p>

            <h4 className="font-bold">2 important notes on transfer logs and errors:</h4>
            <ul className="list-disc pl-5 space-y-2">
              <li>If your ELD does NOT support the option the officer requests OR fails to transfer the logs for any reason (error due to missing information, no cellular connection, or any other issue), then refer to your ELD manual for instructions on the secondary option, which will be an on-screen display or printout (on-screen display is more common method). Follow the instructions to show the officer the display on your device or the printout. This backup option is compliant with the mandate, and you cannot be cited for using it, if the primary method fails.</li>
              <li>If the ELD gives you an error during transfer, make note of the display, as most ELD systems will note what went wrong – and in case of missing or having incorrect information, will want to let your carrier's administration know so that it can be fixed. Something as small as a DOT number containing an improper character (like a dash) can stop the transfer from occurring.</li>
            </ul>

            <h4 className="font-bold">Keep Your ELD Top of Mind</h4>
            <p>With electronic logging, it's important to protect yourself as a driver by staying on top of your device and understanding how it functions and why. By doing so, you'll help keep yourself and your carrier out of hot water, as well as get the most out of this new age of electronic logging.</p>

            <h4 className="font-bold">Driver Responsibility:</h4>
            <ul className="list-disc pl-5 space-y-1">
              <li>REPORT ANY MALFUNCTIONS in writing IMMEDIATELY TO THE COMPANY. Driver is required to report within 24 hours of any malfunction.</li>
              <li>Driver is responsible for ensuring they have at least 8 days' worth of blank paper logs in case of malfunction.</li>
              <li>Driver needs to ensure to have the following documents and know where to locate to comply with a roadside inspection:
                <ul className="list-disc pl-5 mt-1">
                  <li>USER MANUAL</li>
                  <li>TROUBLESHOOTING &amp; MALFUNCTION GUIDE</li>
                  <li>TRANSFER GUIDE</li>
                </ul>
              </li>
              <li>Devices are not tampered with, disconnected, or damaged.</li>
              <li>Driver is required to log in and out of the device at appropriate time and is required to have a secure username and password (not share with others).</li>
              <li>Drivers are required to certify their logs within 24 hours.</li>
            </ul>

            <p className="font-bold mt-3">I understand that my signature below acknowledges that I have read and understand the regulations &amp; rules of 58 LOGISTICS LLC regarding Electronic Logging Device. I also understand that failure to comply with the above mentioned, can result in termination of my employment.</p>
          </div>

          <div className="space-y-2">
            <Label className="font-semibold">Signature — ELD Policy *</Label>
            <SignaturePad onSignatureChange={s => setSignatures(prev => ({ ...prev, eld: s }))} />
          </div>

          <Separator />

          {/* ═══ FULL HOS POLICY TEXT ═══ */}
          <div className="border rounded-lg p-4 space-y-3 text-xs leading-relaxed max-h-[400px] overflow-y-auto bg-white">
            <h3 className="font-bold text-sm text-center">HOURS OF SERVICE POLICY</h3>

            <p>All drivers must follow the following driving regulations:</p>
            <ol className="list-decimal pl-5 space-y-2">
              <li>Drivers are required to drive no more than a maximum of 11 hours within a 24-hour period.</li>
              <li>After which the driver is required a total of 10 consecutive of OFF DUTY hours before starting to drive again. (Drivers may split their required 10-hour off-duty period, as long as one off-duty period (whether in or out of the sleeper berth) is at least 2 hours long and the other involves at least 7 consecutive hours spent in the sleeper berth. All sleeper berth pairings MUST add up to at least 10 hours. When used together, neither time period counts against the maximum 14-hour driving window.)</li>
              <li>May not drive beyond the 14th consecutive hour after coming on duty, following 10 consecutive hours off-duty.</li>
              <li>Drivers must take a 30-minute break when they have driven for a period of 8 cumulative hours without at least a 30-minute interruption. The break may be satisfied by any non-driving period of 30 consecutive minutes (i.e., on-duty not driving, off-duty, sleeper berth, or any combination of these taken consecutively).</li>
              <li>All drivers may not drive after 60/70 hours on-duty in 7/8 consecutive days. A driver may restart a 7/8 consecutive day period after taking 34 or more consecutive hours off-duty.</li>
              <li>Drivers are allowed to extend the 11-hour maximum driving limit and 14-hour driving window by up to 2 hours when adverse driving conditions are encountered.</li>
            </ol>

            <p>Drivers that are cited during roadside or scale inspections for violations of the 11-hour, 14 hour or working beyond the 60/70 hours, will be:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>1st offense – Written up and re-trained</li>
              <li>2nd offense – Written up and suspension for one day</li>
              <li>3rd offense – Written up, pay a fine and suspension for a week</li>
              <li>4th offense – Termination of contract</li>
            </ul>

            <h4 className="font-bold">Completion of logs</h4>
            <p>All commercial drivers are required to login to an ELD and complete a daily vehicle record (log) for all 365 days of the year. – NO EXCEPTIONS.</p>
            <p>If a driver is off-duty for a day, weekend, a holiday period of several days, or even a month's vacation, driver must complete a log for the entire period. Enter dates in the Remarks section and show the off-duty time on the ridge/log.</p>

            <ul className="list-disc pl-5 space-y-1">
              <li>If working as team, each driver must login using their own login information and complete their logs. NO EXCEPTIONS.</li>
              <li>Drivers must keep their daily logs current to the time shown for the last change of duty status. This means that daily log must be up-to-date at all times.</li>
              <li>Drivers must sign and acknowledge that all entries input into daily log book are correct by the end of the day.</li>
              <li>Driver is to use Personal Conveyance for personal use or personal as off-duty only when the driver is relieved from work and all responsibility for performing work by the motor carrier. NO EXCEPTIONS. If clarification is needed, please contact your safety manager ASAP.</li>
              <li>If the ELD is malfunctioning, driver must: write a note on the ELD, notify his safety manager right away and use his 7 days of blank paper log until the device is working.</li>
              <li>If problem exceeds 7 days, safety manager will have to get approval of the FMCSA to continue using paper logs.</li>
              <li>Daily Vehicle Inspection Reports (DVIR's) must be completed by the driver. If defect(s) or services are found, driver must document it on the Daily Vehicle Inspection and provide supporting documentation of completed services/repairs.</li>
              <li>Drivers MUST make sure that they document on their logs the exact time, date and location where they fueled, as listed on their fuel receipts.</li>
              <li>Drivers must document all road and scale inspections; make sure to list on log the location and time.</li>
            </ul>

            <p>The proper completion of logs is expected of all drivers. Drivers must make sure that each log must have the following information:</p>
            <ol className="list-decimal pl-5 space-y-1">
              <li>Name of the driver</li>
              <li>Date</li>
              <li>Total miles driving in a day (24-hour period)</li>
              <li>Truck or tractor and trailer numbers</li>
              <li>Name of Motor Carrier/Company</li>
              <li>Carrier's main office address</li>
              <li>Name of co-driver (if applicable)</li>
              <li>Total hours for each duty status (Off-duty, Sleeper/Berth, Driving and On-duty)</li>
              <li>Shipping document number(s), or name of shipper and commodity</li>
              <li>In the Remarks section, the driver must indicate the location (city) for changes in duty status</li>
              <li>Acknowledgment of completed ELD by the end of the day</li>
            </ol>

            <p>Drivers will be held accountable for the completion of their logs correctly and submitted on a timely basis.</p>
            <p>Drivers that incur violations for not having or completing logs properly. The driver will be responsible for the payment of the fines associated to those violations.</p>

            <h4 className="font-bold">1. Log Requirements</h4>
            <p>THE DRIVER is required to have the last 6 months of logs for all active and terminated drivers for audits. It is important all drivers are aware of this and complete their daily logs properly and on time.</p>

            <h4 className="font-bold">2. Falsification of Logs</h4>
            <p>THE DRIVER will not make any logs that are grossly falsified. Drivers will be subjected to disciplinary action, suspension and up to termination for falsification of logs.</p>

            <h4 className="font-bold">3. Acknowledgment</h4>
            <p className="font-bold">Driver has read and understands all requirements relating to their duty of records (logs).</p>
          </div>

          <div className="space-y-2">
            <Label className="font-semibold">Signature — HOS Policy *</Label>
            <SignaturePad onSignatureChange={s => setSignatures(prev => ({ ...prev, hos: s }))} />
          </div>

          <Button onClick={handleSubmit} className="w-full">Confirm & Sign Leasing Agreement</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
