import { useCallback, useState } from "react";
import { Upload, FileText, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface FileUploadProps {
  onFileSelected: (file: File, dataUrl: string) => void;
}

export default function FileUpload({ onFileSelected }: FileUploadProps) {
  const [dragging, setDragging] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileSize, setFileSize] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const formatSize = (bytes: number) => {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const processFile = useCallback((file: File) => {
    if (file.type !== "application/pdf") { toast.error("Solo se aceptan archivos PDF"); return; }
    if (file.size > 10 * 1024 * 1024) { toast.error("El archivo no puede superar los 10MB"); return; }
    setLoading(true);
    setFileName(file.name);
    setFileSize(formatSize(file.size));
    const reader = new FileReader();
    reader.onload = (e) => { onFileSelected(file, e.target?.result as string); setLoading(false); };
    reader.readAsDataURL(file);
  }, [onFileSelected]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  }, [processFile]);

  return (
    <div
      className={`border-2 border-dashed rounded-lg p-12 text-center transition-all duration-150 ${dragging ? "border-primary bg-accent" : "border-border hover:border-primary/50"}`}
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
    >
      {fileName ? (
        <div className="flex items-center justify-center gap-3">
          <FileText className="h-8 w-8 text-primary" />
          <div className="text-left">
            <p className="font-medium text-foreground">{fileName}</p>
            <p className="text-sm text-muted-foreground">{loading ? "Cargando..." : fileSize}</p>
          </div>
          <Button variant="ghost" size="icon" className="ml-2" onClick={() => { setFileName(null); setFileSize(null); }}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <>
          <Upload className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-foreground font-medium mb-1">Arrastra tu PDF aquí</p>
          <p className="text-sm text-muted-foreground mb-4">o haz clic para seleccionar (máx 10MB)</p>
          <Button variant="outline" asChild className="rounded-md">
            <label className="cursor-pointer">
              Seleccionar archivo
              <input type="file" accept=".pdf" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; if (file) processFile(file); }} />
            </label>
          </Button>
        </>
      )}
    </div>
  );
}
