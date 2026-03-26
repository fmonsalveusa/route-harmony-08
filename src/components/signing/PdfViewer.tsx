import { useEffect, useRef, useState } from "react";
import * as pdfjsLib from "pdfjs-dist";
import pdfjsWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

interface PdfViewerProps {
  fileData: string;
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onTotalPagesChange: (total: number) => void;
  onCanvasReady?: (canvas: HTMLCanvasElement) => void;
  onBackgroundClick?: () => void;
  children?: React.ReactNode;
}

export default function PdfViewer({
  fileData, currentPage, totalPages, onPageChange, onTotalPagesChange, onCanvasReady, onBackgroundClick, children,
}: PdfViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    if (!fileData) return;
    const loadPdf = async () => {
      try {
        const base64 = fileData.split(",")[1];
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        const pdf = await pdfjsLib.getDocument({ data: bytes }).promise;
        onTotalPagesChange(pdf.numPages);
        const page = await pdf.getPage(currentPage);
        const canvas = canvasRef.current!;
        const ctx = canvas.getContext("2d")!;
        const containerWidth = containerRef.current?.clientWidth || 800;
        const viewport = page.getViewport({ scale: 1 });
        const newScale = Math.min(containerWidth / viewport.width, 1.5);
        setScale(newScale);
        const scaledViewport = page.getViewport({ scale: newScale });
        canvas.width = scaledViewport.width;
        canvas.height = scaledViewport.height;
        await page.render({ canvasContext: ctx, viewport: scaledViewport, canvas: canvas } as any).promise;
        onCanvasReady?.(canvas);
      } catch (err) { console.error("Error rendering PDF:", err); }
    };
    loadPdf();
  }, [fileData, currentPage]);

  return (
    <div className="flex flex-col items-center">
      <div ref={containerRef} data-field-container className="relative w-full max-w-[800px] bg-muted/30 rounded-xl overflow-hidden border" onClick={(e) => { if (e.target === e.currentTarget || e.target === canvasRef.current) onBackgroundClick?.(); }}>
        <canvas ref={canvasRef} className="block mx-auto" />
        {children}
      </div>
      {totalPages > 1 && (
        <div className="flex items-center gap-3 mt-4">
          <Button variant="outline" size="icon" disabled={currentPage <= 1} onClick={() => onPageChange(currentPage - 1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm text-muted-foreground">Página {currentPage} de {totalPages}</span>
          <Button variant="outline" size="icon" disabled={currentPage >= totalPages} onClick={() => onPageChange(currentPage + 1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}

export function getScale() { return 1; }
