import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import SignaturePad from './SignaturePad';
import { generateEmploymentContractPdf } from '@/lib/onboardingDocPdf';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  driverName: string;
  onSigned: (blob: Blob) => void;
}

export default function EmploymentContractDialog({ open, onOpenChange, driverName, onSigned }: Props) {
  const [signature, setSignature] = useState<string | null>(null);
  const [signing, setSigning] = useState(false);
  const today = new Date().toLocaleDateString('en-US');

  const handleSign = () => {
    if (!signature) return;
    setSigning(true);
    try {
      const blob = generateEmploymentContractPdf({ driverName, signatureDataUrl: signature, date: today });
      onSigned(blob);
    } finally {
      setSigning(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Employment Contract / Contrato de Trabajo</DialogTitle>
        </DialogHeader>
        <ScrollArea className="flex-1 pr-4">
          <div className="space-y-4 text-sm leading-relaxed">
            <h3 className="font-bold text-center">EMPLOYMENT CONTRACT / CONTRATO DE TRABAJO</h3>
            <p>This Employment Contract ("Agreement") is entered into on {today}, between the Company and {driverName || '[Driver Name]'} ("Employee").</p>
            <p>Este Contrato de Trabajo ("Acuerdo") se celebra el {today}, entre la Empresa y {driverName || '[Nombre del Conductor]'} ("Empleado").</p>

            <h4 className="font-semibold">1. POSITION & DUTIES / PUESTO Y FUNCIONES</h4>
            <p>The Employee is hired as a Company Driver responsible for operating commercial motor vehicles for the transportation of goods. The Employee agrees to follow all DOT/FMCSA regulations, company policies, and applicable laws.</p>
            <p>El Empleado es contratado como Conductor de Empresa responsable de operar vehículos motorizados comerciales para el transporte de mercancías. El Empleado acepta cumplir con todas las regulaciones DOT/FMCSA, políticas de la empresa y leyes aplicables.</p>

            <h4 className="font-semibold">2. COMPENSATION / COMPENSACIÓN</h4>
            <p>The Employee will receive compensation as determined by the Company's pay schedule. Payment details will be provided separately.</p>
            <p>El Empleado recibirá compensación según lo determinado por el calendario de pagos de la Empresa. Los detalles del pago se proporcionarán por separado.</p>

            <h4 className="font-semibold">3. EMPLOYMENT RELATIONSHIP / RELACIÓN LABORAL</h4>
            <p>The Employee acknowledges that they are an employee of the Company, not an independent contractor. The Company will provide the vehicle, insurance, and necessary equipment for operations.</p>
            <p>El Empleado reconoce que es un empleado de la Empresa, no un contratista independiente. La Empresa proporcionará el vehículo, seguro y equipo necesario para las operaciones.</p>

            <h4 className="font-semibold">4. TERMINATION / TERMINACIÓN</h4>
            <p>Either party may terminate this Agreement with written notice. The Company reserves the right to terminate immediately for cause, including but not limited to: safety violations, failed drug tests, or material breach of this Agreement.</p>
            <p>Cualquiera de las partes puede terminar este Acuerdo con notificación por escrito. La Empresa se reserva el derecho de terminar inmediatamente por causa justificada, incluyendo pero no limitado a: violaciones de seguridad, pruebas de drogas fallidas o incumplimiento material de este Acuerdo.</p>

            <h4 className="font-semibold">5. ACKNOWLEDGMENT / RECONOCIMIENTO</h4>
            <p>By signing below, the Employee acknowledges having read, understood, and agreed to all terms of this Employment Contract.</p>
            <p>Al firmar a continuación, el Empleado reconoce haber leído, entendido y aceptado todos los términos de este Contrato de Trabajo.</p>
          </div>
        </ScrollArea>

        <div className="border-t pt-4 space-y-3">
          <SignaturePad onSignatureChange={setSignature} />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={handleSign} disabled={!signature || signing}>
              {signing ? 'Signing...' : 'Sign Contract'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
