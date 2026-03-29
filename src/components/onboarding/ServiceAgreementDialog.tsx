import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { format } from 'date-fns';
import SignaturePad from './SignaturePad';
import { generateServiceAgreementPdf } from '@/lib/onboardingDocPdf';

interface ServiceAgreementDialogProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  driverName: string;
  onSigned: (blob: Blob) => void;
}

export default function ServiceAgreementDialog({ open, onOpenChange, driverName, onSigned }: ServiceAgreementDialogProps) {
  const [address, setAddress] = useState('');
  const [signature, setSignature] = useState<string | null>(null);

  const handleSubmit = () => {
    if (!address.trim()) { toast.error('Address is required'); return; }
    if (!signature) { toast.error('Signature is required'); return; }

    const blob = generateServiceAgreementPdf({
      driverName,
      address,
      date: format(new Date(), 'MM/dd/yyyy'),
      signature,
    });
    onSigned(blob);
    toast.success('Service Agreement signed');
  };

  const today = format(new Date(), 'MM/dd/yyyy');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Contrato de Servicios de Dispatch / Dispatch Services Contract</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 text-sm">
          <div className="bg-muted/50 p-3 rounded-lg text-xs">
            <span className="text-muted-foreground">Conductor / Driver:</span> {driverName} &nbsp;|&nbsp;
            <span className="text-muted-foreground">Fecha / Date:</span> {today}
          </div>

          <div className="space-y-2">
            <Label>Dirección / Address *</Label>
            <Input value={address} onChange={e => setAddress(e.target.value)} placeholder="Full address" />
          </div>

          {/* ═══ FULL CONTRACT TEXT — SPANISH ═══ */}
          <div className="border rounded-lg p-4 space-y-3 text-xs leading-relaxed max-h-[400px] overflow-y-auto bg-white">
            <div className="text-center mb-4">
              <p className="text-[10px] text-muted-foreground">58 Logistics LLC — 3416 N Wind Place, Charlotte, NC. 28210 — (980) 202-3130</p>
            </div>
            <h3 className="font-bold text-sm text-center">CONTRATO DE SERVICIOS DE DISPATCH</h3>

            <p>En la ciudad de Charlotte, NC, Fecha: {today}</p>

            <h4 className="font-bold">REUNIDOS:</h4>
            <p>De una parte, 58 Logistics LLC, representada por su apoderado legal, con domicilio en 3416 N Wind Place, Charlotte, NC. 28210, en adelante "LA EMPRESA".</p>
            <p>De la otra parte: <strong>{driverName}</strong>, mayor de edad, con domicilio en: <strong>{address || '_______________'}</strong>, en adelante "EL DRIVER".</p>

            <h4 className="font-bold">EXPONEN:</h4>
            <p>Que ambas partes desean formalizar la relación comercial de prestación de servicios de Dispatcher - Conducción bajo las siguientes condiciones:</p>

            <h4 className="font-bold">CLÁUSULAS:</h4>

            <h4 className="font-bold">PRIMERA. OBJETO DEL CONTRATO</h4>
            <p>LA EMPRESA contrata los servicios de EL DRIVER para operar vehículos de carga bajo nuestra Autoridad (MC#), y para realizar los transportes que le sean asignados exclusivamente por LA EMPRESA.</p>

            <h4 className="font-bold">SEGUNDA. EXCLUSIVIDAD</h4>
            <p>Durante la vigencia del presente contrato, EL DRIVER se compromete a aceptar únicamente las cargas asignadas por 58 Logistics LLC. El incumplimiento de esta obligación será causa suficiente para la terminación inmediata del contrato por parte de LA EMPRESA.</p>

            <h4 className="font-bold">TERCERA. DURACIÓN Y TERMINACIÓN DEL CONTRATO</h4>
            <p>Este contrato tendrá una duración de 6 MESES a partir de la fecha de su firma. Cualquiera de las partes podrá darlo por terminado en cualquier momento mediante notificación escrita con al menos una (1) semana de antelación.</p>
            <p>Si EL DRIVER terminara el contrato sin respetar el período de aviso indicado, LA EMPRESA podrá aplicar un descuento adicional de $100 (cien dólares) en concepto de incumplimiento del aviso previo.</p>

            <h4 className="font-bold">CUARTA. CARGOS POR RETIRO ANTICIPADO</h4>
            <p>Si EL DRIVER decide poner fin a la relación contractual antes de completar tres (3) meses de trabajo efectivo, se le descontará un monto de $300 (Trescientos dólares) que serán retenidos de su primer pago por carga trabajada.</p>
            <p>Si EL DRIVER permanece en la empresa más de tres (3) meses, se le reintegrará dicho importe.</p>

            <h4 className="font-bold">QUINTA. INSPECCIONES EN CARRETERA</h4>
            <p>En caso de que EL DRIVER sea sometido a una inspección en carretera (DOT o similar), deberá notificar a LA EMPRESA de manera inmediata. Para dicha inspección, EL DRIVER utilizará siempre la información correspondiente a su propia empresa (USDOT, MC, nombre comercial, etc.), la cual deberá estar colocada de forma visible a cada lado de su vehículo de acuerdo con las regulaciones federales. Bajo ninguna circunstancia deberá utilizar la información identificativa de LA EMPRESA.</p>
            <p>En caso de que en el reporte de la inspección aparezca el nombre de LA EMPRESA, ésta se reserva el derecho de retener el pago completo correspondiente a la carga que el DRIVER lleve en ese momento, como "liquidated damages" (daños y perjuicios liquidados).</p>
            <p>Si EL DRIVER opera bajo un Contrato de Arrendamiento (Leasing Agreement) con LA EMPRESA y durante una inspección se le emite una violación, advertencia o es puesto fuera de servicio (Out-of-Service), se aplicará una penalización de $300 (trescientos dólares). Por el contrario, si EL DRIVER recibe una inspección limpia (sin violaciones), recibirá un bono de seguridad de $100 (cien dólares) como reconocimiento.</p>

            <h4 className="font-bold">SEXTA. PENALIZACIONES</h4>
            <p>A continuación la lista de las penalizaciones y su descuento correspondiente:</p>
            <ul className="list-disc pl-5">
              <li>CANCELACIÓN DE CARGA (Sin Justificación) — $300</li>
            </ul>

            <h4 className="font-bold">SÉPTIMA. RELACIÓN COMERCIAL</h4>
            <p>El presente contrato no crea una relación laboral entre las partes. EL DRIVER actuará como contratista independiente (OWNER OPERATOR), y será el único responsable de sus impuestos, seguros, licencias, y cualquier otro gasto relacionado con su actividad.</p>

            <h4 className="font-bold">OCTAVA. CONFIDENCIALIDAD</h4>
            <p>EL DRIVER se compromete a no divulgar ni utilizar, directa o indirectamente, durante la vigencia de este contrato ni después de su terminación, ninguna información confidencial de LA EMPRESA, incluyendo pero no limitada a tarifas de carga, rutas, datos de clientes, proveedores, estrategias comerciales, o cualquier otra información reservada.</p>

            <h4 className="font-bold">NOVENA. USO ADECUADO DE LA CARGA</h4>
            <p>EL DRIVER se compromete a transportar la carga asignada en condiciones óptimas de seguridad, integridad y cumplimiento de las regulaciones vigentes. Será responsable de cualquier daño, pérdida, o deterioro causado por negligencia, mal manejo o incumplimiento de las normas de transporte.</p>

            <h4 className="font-bold">DÉCIMA. RESPONSABILIDAD POR DAÑOS O ACCIDENTES</h4>
            <p>EL DRIVER será responsable de los daños ocasionados por su negligencia o conducta dolosa al vehículo asignado, a la carga transportada, a terceros o a bienes de LA EMPRESA. LA EMPRESA se reserva el derecho de deducir de los pagos al EL DRIVER los montos que correspondan por reparación o compensación de dichos daños.</p>

            <h4 className="font-bold">DÉCIMO PRIMERA. POLÍTICA DE COMBUSTIBLE Y PEAJES</h4>
            <p>EL DRIVER será responsable de costear el combustible, peajes, estacionamientos y cualquier otro gasto operativo relacionado con los servicios prestados, salvo que se pacte por escrito una política distinta para determinadas cargas o rutas, o cualquier otro gasto que se genere de la misma actividad.</p>

            <h4 className="font-bold">DÉCIMO SEGUNDA. POLÍTICA DE RESOLUCIÓN DE CONFLICTOS (MEDIACIÓN Y ARBITRAJE)</h4>
            <p>Las partes acuerdan que, en caso de surgir cualquier conflicto relacionado con la interpretación, ejecución o cumplimiento de este contrato, intentarán resolverlo amistosamente mediante mediación. Si la mediación no resultara satisfactoria, las partes acuerdan someterse a un arbitraje de derecho administrado por un organismo competente en el estado de North Carolina, cuyo laudo será vinculante y definitivo para ambas partes.</p>

            <h4 className="font-bold">DÉCIMO TERCERA. MODIFICACIONES</h4>
            <p>Cualquier modificación al presente contrato deberá realizarse por escrito y con el consentimiento expreso de ambas partes.</p>

            <h4 className="font-bold">DÉCIMO CUARTA. JURISDICCIÓN</h4>
            <p>Para la resolución de cualquier controversia que derive de este contrato, ambas partes se someten a la jurisdicción de los tribunales competentes en el estado de North Carolina (USA).</p>

            <p>Y en prueba de conformidad, ambas partes firman el presente contrato en dos ejemplares de idéntico tenor y a un solo efecto, en el lugar y fecha indicados al inicio.</p>

            {/* ═══ ENGLISH VERSION ═══ */}
            <div className="border-t pt-4 mt-4">
              <h3 className="font-bold text-sm text-center">DISPATCHING SERVICES AGREEMENT</h3>
              <p className="mt-2">In the city of Charlotte, NC, Date: {today}</p>

              <h4 className="font-bold mt-3">PARTIES:</h4>
              <p>On one side, 58 Logistics LLC, represented by its legal representative, with address at 3416 N Wind Place, Charlotte, NC 28210, hereinafter referred to as "THE COMPANY".</p>
              <p>On the other side, <strong>{driverName}</strong>, of legal age, with address at <strong>{address || '_______________'}</strong>, hereinafter referred to as "THE DRIVER."</p>

              <h4 className="font-bold mt-3">RECITALS:</h4>
              <p>Both parties wish to formalize a commercial relationship for the provision of Dispatching – Driving services under the following conditions:</p>

              <h4 className="font-bold mt-3">CLAUSES:</h4>

              <h4 className="font-bold">FIRST. PURPOSE OF THE AGREEMENT</h4>
              <p>THE COMPANY engages THE DRIVER to operate freight vehicles under our Authority (MC#) and to perform the transportation services exclusively assigned by THE COMPANY.</p>

              <h4 className="font-bold">SECOND. EXCLUSIVITY</h4>
              <p>During the term of this agreement, THE DRIVER agrees to accept only the loads assigned by 58 Logistics LLC. Breach of this obligation shall constitute sufficient cause for the immediate termination of this agreement by THE COMPANY.</p>

              <h4 className="font-bold">THIRD. TERM AND TERMINATION</h4>
              <p>This agreement shall have a duration of six (6) months from the date of signature. Either party may terminate it at any time by giving written notice at least one (1) week in advance.</p>
              <p>If THE DRIVER terminates the agreement without respecting the notice period, THE COMPANY may apply an additional deduction of one hundred dollars (USD $100) as a penalty for non-compliance with the notice period.</p>

              <h4 className="font-bold">FOURTH. EARLY WITHDRAWAL CHARGES</h4>
              <p>If THE DRIVER decides to terminate the contractual relationship before completing three (3) months of effective work, an amount of three hundred dollars (USD $300) shall be deducted and retained from the first load payment.</p>
              <p>If THE DRIVER remains with the company for more than three (3) months, said amount will be refunded.</p>

              <h4 className="font-bold">FIFTH. ROADSIDE INSPECTIONS</h4>
              <p>In the event THE DRIVER is subject to a roadside inspection (DOT or similar), THE DRIVER must notify THE COMPANY immediately. For such inspection, THE DRIVER must always use the information corresponding to his/her own company (USDOT, MC, trade name, etc.), which must be visibly displayed on both sides of the vehicle in accordance with federal regulations. Under no circumstances shall THE DRIVER use the identifying information of THE COMPANY.</p>
              <p>If THE COMPANY's name appears on the inspection report, THE COMPANY reserves the right to withhold the full payment corresponding to the load being carried at that time as "liquidated damages."</p>
              <p>If THE DRIVER operates under a Leasing Agreement with THE COMPANY and during an inspection receives a violation, warning, or is placed Out-of-Service, a penalty of three hundred dollars (USD $300) shall apply. Conversely, if THE DRIVER receives a clean inspection (no violations), he/she shall receive a safety bonus of one hundred dollars (USD $100) as recognition.</p>

              <h4 className="font-bold">SIXTH. PENALTIES</h4>
              <p>The following penalties and deductions shall apply:</p>
              <ul className="list-disc pl-5">
                <li>LOAD CANCELLATION (Without Justification) – USD $300</li>
              </ul>

              <h4 className="font-bold">SEVENTH. COMMERCIAL RELATIONSHIP</h4>
              <p>This agreement does not create an employment relationship between the parties. THE DRIVER shall act as an independent contractor (OWNER OPERATOR) and shall be solely responsible for his/her taxes, insurance, licenses, and any other expenses related to his/her activity.</p>

              <h4 className="font-bold">EIGHTH. CONFIDENTIALITY</h4>
              <p>THE DRIVER agrees not to disclose or use, directly or indirectly, during the term of this agreement or after its termination, any confidential information of THE COMPANY, including but not limited to: freight rates, routes, customer data, suppliers, business strategies, or any other reserved information.</p>

              <h4 className="font-bold">NINTH. PROPER HANDLING OF FREIGHT</h4>
              <p>THE DRIVER agrees to transport the assigned freight under optimal conditions of safety, integrity, and compliance with current regulations. THE DRIVER shall be responsible for any damage, loss, or deterioration caused by negligence, mishandling, or non-compliance with transportation regulations.</p>

              <h4 className="font-bold">TENTH. LIABILITY FOR DAMAGES OR ACCIDENTS</h4>
              <p>THE DRIVER shall be responsible for damages caused by his/her negligence or willful misconduct to the assigned vehicle, transported freight, third parties, or THE COMPANY's property. THE COMPANY reserves the right to deduct from THE DRIVER's payments the amounts corresponding to repair or compensation for such damage.</p>

              <h4 className="font-bold">ELEVENTH. FUEL AND TOLL POLICY</h4>
              <p>THE DRIVER shall be responsible for covering the costs of fuel, tolls, parking, and any other operating expenses related to the services provided, unless otherwise agreed in writing for certain loads or routes, or any other expense arising from the same activity.</p>

              <h4 className="font-bold">TWELFTH. DISPUTE RESOLUTION POLICY (MEDIATION AND ARBITRATION)</h4>
              <p>The parties agree that, in the event of any dispute related to the interpretation, execution, or compliance of this agreement, they shall first attempt to resolve it amicably through mediation. If mediation is not successful, the parties agree to submit the matter to binding arbitration administered by a competent body in the state of North Carolina, whose award shall be final and binding on both parties.</p>

              <h4 className="font-bold">THIRTEENTH. AMENDMENTS</h4>
              <p>Any amendments to this agreement must be made in writing and with the express consent of both parties.</p>

              <h4 className="font-bold">FOURTEENTH. JURISDICTION</h4>
              <p>For the resolution of any dispute arising from this agreement, both parties submit to the jurisdiction of the competent courts of the state of North Carolina (USA).</p>

              <p>In witness whereof, both parties sign this agreement in two counterparts of identical content and for a single purpose, in the place and date indicated above.</p>
            </div>
          </div>

          <div className="border-t pt-4 space-y-2">
            <Label className="font-semibold">Firma del Conductor / Driver Signature *</Label>
            <SignaturePad onSignatureChange={setSignature} />
            <p className="text-xs text-muted-foreground">Fecha / Date: {today}</p>
          </div>

          <Button onClick={handleSubmit} className="w-full">Confirmar y Firmar / Confirm & Sign</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
