import { useRef, useState } from "react";
import SignatureCanvas from "react-signature-canvas";
import { Button } from "@/components/ui/button";
import { Eraser, Check, X } from "lucide-react";

export interface SignatureModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (dataUrl: string) => void;
  title?: string;
}

export default function SignatureModal({ open, onClose, onConfirm, title }: SignatureModalProps) {
  const sigRef = useRef<SignatureCanvas>(null);
  const [isEmpty, setIsEmpty] = useState(true);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/60 backdrop-blur-sm p-4">
      <div className="bg-card rounded-lg w-full max-w-lg shadow-2xl animate-fade-in-up">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="font-semibold text-foreground">{title || "Dibuja tu firma"}</h3>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="h-5 w-5" /></Button>
        </div>
        <div className="p-4">
          <div className="border-2 border-dashed border-border rounded-lg bg-muted/20 overflow-hidden">
            <SignatureCanvas ref={sigRef} canvasProps={{ className: "w-full", style: { width: "100%", height: 200, touchAction: "none" } }} onBegin={() => setIsEmpty(false)} />
          </div>
          <p className="text-xs text-muted-foreground text-center mt-2">Dibuja tu firma con el dedo o mouse</p>
        </div>
        <div className="flex gap-3 p-4 border-t">
          <Button variant="outline" className="flex-1 rounded-md" onClick={() => { sigRef.current?.clear(); setIsEmpty(true); }}>
            <Eraser className="mr-2 h-4 w-4" /> Limpiar
          </Button>
          <Button className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground rounded-md" disabled={isEmpty} onClick={() => { if (sigRef.current) onConfirm(sigRef.current.getTrimmedCanvas().toDataURL("image/png")); }}>
            <Check className="mr-2 h-4 w-4" /> Confirmar firma
          </Button>
        </div>
      </div>
    </div>
  );
}
