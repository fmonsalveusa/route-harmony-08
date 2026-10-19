import { useRef, useState } from "react";
import SignatureCanvas from "react-signature-canvas";
import { Button } from "@/components/ui/button";
import { Eraser, Check, X } from "lucide-react";

export interface SignatureModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (dataUrl: string) => void;
  title?: string;
  lang?: "es" | "en";
}

/** Firma recortada a lo dibujado (getTrimmedCanvas de la librería falla con algunos bundlers) */
function trimmedPng(canvas: HTMLCanvasElement): string {
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas.toDataURL("image/png");
  const { width, height } = canvas;
  const px = ctx.getImageData(0, 0, width, height).data;
  let top = height, left = width, right = -1, bottom = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (px[(y * width + x) * 4 + 3] === 0) continue;
      if (x < left) left = x;
      if (x > right) right = x;
      if (y < top) top = y;
      if (y > bottom) bottom = y;
    }
  }
  if (right < 0) return canvas.toDataURL("image/png");
  const out = document.createElement("canvas");
  out.width = right - left + 1;
  out.height = bottom - top + 1;
  out.getContext("2d")!.drawImage(canvas, left, top, out.width, out.height, 0, 0, out.width, out.height);
  return out.toDataURL("image/png");
}

export default function SignatureModal({ open, onClose, onConfirm, title, lang = "es" }: SignatureModalProps) {
  const en = lang === "en";
  const sigRef = useRef<SignatureCanvas>(null);
  const [isEmpty, setIsEmpty] = useState(true);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/60 backdrop-blur-sm p-4">
      <div className="bg-card rounded-lg w-full max-w-lg shadow-2xl animate-fade-in-up">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="font-semibold text-foreground">{title || (en ? "Draw your signature" : "Dibuja tu firma")}</h3>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="h-5 w-5" /></Button>
        </div>
        <div className="p-4">
          <div className="border-2 border-dashed border-border rounded-lg bg-muted/20 overflow-hidden">
            <SignatureCanvas ref={sigRef} canvasProps={{ className: "w-full", style: { width: "100%", height: 200, touchAction: "none" } }} onBegin={() => setIsEmpty(false)} />
          </div>
          <p className="text-xs text-muted-foreground text-center mt-2">{en ? "Sign with your finger" : "Dibuja tu firma con el dedo o mouse"}</p>
        </div>
        <div className="flex gap-3 p-4 border-t">
          <Button variant="outline" className="flex-1 rounded-md" onClick={() => { sigRef.current?.clear(); setIsEmpty(true); }}>
            <Eraser className="mr-2 h-4 w-4" /> {en ? "Clear" : "Limpiar"}
          </Button>
          <Button className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground rounded-md" disabled={isEmpty} onClick={() => { if (sigRef.current) onConfirm(trimmedPng(sigRef.current.getCanvas())); }}>
            <Check className="mr-2 h-4 w-4" /> {en ? "Confirm" : "Confirmar firma"}
          </Button>
        </div>
      </div>
    </div>
  );
}
