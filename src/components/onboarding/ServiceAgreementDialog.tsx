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

          <div className="border rounded-lg p-4 space-y-3 text-xs leading-relaxed max-h-72 overflow-y-auto bg-white">
            <h3 className="font-bold text-sm text-center">CONTRATO DE SERVICIOS DE DISPATCH<br />DISPATCH SERVICES CONTRACT</h3>

            <p><strong>CLÁUSULA 1 - PARTES / PARTIES:</strong> Este contrato se celebra entre 58 Logistics LLC ("La Empresa") y <strong>{driverName}</strong> ("El Conductor"). / This contract is entered into between 58 Logistics LLC ("The Company") and <strong>{driverName}</strong> ("The Driver").</p>

            <p><strong>CLÁUSULA 2 - OBJETO / PURPOSE:</strong> La Empresa proporcionará servicios de dispatch al Conductor, incluyendo la búsqueda y negociación de cargas. / The Company will provide dispatch services to the Driver, including load searching and negotiation.</p>

            <p><strong>CLÁUSULA 3 - OBLIGACIONES DE LA EMPRESA / COMPANY OBLIGATIONS:</strong> Buscar cargas que se ajusten al equipo del Conductor, negociar tarifas competitivas, proporcionar soporte operativo durante el trayecto. / Search for loads suitable for the Driver's equipment, negotiate competitive rates, provide operational support during transit.</p>

            <p><strong>CLÁUSULA 4 - OBLIGACIONES DEL CONDUCTOR / DRIVER OBLIGATIONS:</strong> Mantener el equipo en condiciones operativas, cumplir con las regulaciones de DOT y FMCSA, comunicar cualquier problema operativo de manera oportuna. / Maintain equipment in operational condition, comply with DOT and FMCSA regulations, communicate any operational issues promptly.</p>

            <p><strong>CLÁUSULA 5 - COMPENSACIÓN / COMPENSATION:</strong> El porcentaje de servicio de dispatch será acordado por separado y deducido de las ganancias de cada carga. / The dispatch service percentage will be agreed upon separately and deducted from each load's earnings.</p>

            <p><strong>CLÁUSULA 6 - DURACIÓN / DURATION:</strong> Este contrato permanecerá vigente hasta que cualquiera de las partes lo termine con aviso por escrito. / This contract shall remain in effect until either party terminates it with written notice.</p>

            <p><strong>CLÁUSULA 7 - TERMINACIÓN / TERMINATION:</strong> Cualquiera de las partes puede terminar este contrato con 30 días de aviso por escrito. / Either party may terminate this contract with 30 days written notice.</p>

            <p><strong>CLÁUSULA 8 - CONFIDENCIALIDAD / CONFIDENTIALITY:</strong> Ambas partes acuerdan mantener confidencial toda la información comercial. / Both parties agree to keep all business information confidential.</p>

            <p><strong>CLÁUSULA 9 - LEY APLICABLE / GOVERNING LAW:</strong> Este contrato se regirá por las leyes del Estado de Texas. / This contract shall be governed by the laws of the State of Texas.</p>
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
