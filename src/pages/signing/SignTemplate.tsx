import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTheme } from 'next-themes';
import { toast } from 'sonner';
import GuidedForm from '@/components/signing/GuidedForm';
import PdfViewer from '@/components/signing/PdfViewer';
import { getTemplate } from '@/store/signing-templates';
import { saveDocument } from '@/store/signing-documents';
import { generateSignedPdf } from '@/lib/generateSignedPdf';
import type { SignTemplate, DocumentField } from '@/types/document';

export default function SignTemplate() {
  const { setTheme } = useTheme();
  useEffect(() => { setTheme('light'); }, [setTheme]);

  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [template, setTemplate] = useState<SignTemplate | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!id) return;
    (async () => {
      const t = await getTemplate(id);
      if (!t) {
        toast.error('Plantilla no encontrada');
        setLoading(false);
        return;
      }
      setTemplate(t);
      setLoading(false);
    })();
  }, [id]);

  const handleFormComplete = async (updatedFields: DocumentField[]) => {
    if (!template) return;
    setSubmitting(true);
    try {
      // Generar PDF firmado con los valores llenados
      const signedPdfData = await generateSignedPdf(template.fileData, updatedFields);

      // Crear un documento nuevo desde la plantilla
      const newDoc = {
        id: crypto.randomUUID(),
        fileName: template.fileName,
        fileData: template.fileData,
        fields: updatedFields,
        status: 'signed' as const,
        createdAt: Date.now(),
        signedAt: Date.now(),
        signedFileData: signedPdfData,
        signerData: { date: new Date().toISOString() },
        templateId: template.id,
        templateName: template.name,
        expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000, // 30 días
      };

      await saveDocument(newDoc as any);
      navigate(`/documents/complete/${newDoc.id}`, { replace: true });
    } catch (e: any) {
      toast.error('Error al firmar', { description: e.message });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-muted border-t-foreground" />
      </div>
    );
  }

  if (!template) {
    return (
      <div className="text-center py-20 text-muted-foreground">
        <p className="font-medium">Plantilla no encontrada</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 py-6 px-4">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Completar documento</h1>
        <p className="text-sm text-muted-foreground">{template.name} — {template.fileName}</p>
      </div>

      {/* PDF Preview */}
      <div className="border rounded-lg overflow-hidden bg-muted/30" style={{ minHeight: 400 }}>
        <PdfViewer
          fileData={template.fileData}
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
          onTotalPagesChange={setTotalPages}
        />
      </div>

      {/* Guided Form */}
      <GuidedForm
        fields={template.fields}
        onComplete={handleFormComplete}
      />
    </div>
  );
}
