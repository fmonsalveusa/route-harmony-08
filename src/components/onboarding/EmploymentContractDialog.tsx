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
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col rounded-[28px] border-0 bg-[#f8fafd] dark:bg-background [&_label]:text-xs [&_label]:font-medium [&_label]:text-[#444746] dark:[&_label]:text-muted-foreground [&_input:not([type=checkbox]):not([type=radio]):not([type=file])]:rounded-lg [&_input]:shadow-none [&_input:not([type=checkbox]):not([type=radio])]:bg-white dark:[&_input]:bg-card [&_input]:border-[#c4c7c5] dark:[&_input]:border-border [&_input:focus-visible]:ring-1 [&_input:focus-visible]:ring-[#0b57d0] [&_input:focus-visible]:border-[#0b57d0] [&_button[role=combobox]]:rounded-lg [&_button[role=combobox]]:shadow-none [&_button[role=combobox]]:bg-white dark:[&_button[role=combobox]]:bg-card [&_button[role=combobox]]:border-[#c4c7c5] dark:[&_button[role=combobox]]:border-border [&_textarea]:rounded-lg [&_textarea]:shadow-none [&_textarea]:bg-white dark:[&_textarea]:bg-card [&_textarea]:border-[#c4c7c5]">
        <DialogHeader>
          <DialogTitle className="text-[22px] leading-7 font-normal text-[#1f1f1f] dark:text-foreground">Employment Contract / Contrato de Trabajo</DialogTitle>
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
            <Button className="rounded-full px-4 shadow-none border-[#747775] dark:border-border text-[#0b57d0] dark:text-blue-300 hover:bg-[#e8f0fe] hover:text-[#0b57d0] font-medium bg-transparent" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button className="rounded-full px-5 bg-[#0b57d0] hover:bg-[#0842a0] text-white font-medium shadow-none" onClick={handleSign} disabled={!signature || signing}>
              {signing ? 'Signing...' : 'Sign Contract'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
