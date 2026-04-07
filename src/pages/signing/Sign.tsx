import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTheme } from 'next-themes';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { CheckCircle2, Loader2 } from 'lucide-react';
import PdfViewer from '@/components/signing/PdfViewer';
import GuidedForm from '@/components/signing/GuidedForm';
import { getDocument, saveDocument } from '@/store/signing-documents';
import { generateSignedPdf } from '@/lib/generateSignedPdf';
import type { SignDocument, DocumentField } from '@/types/document';

export default function Sign() {
  const { setTheme } = useTheme();

  useEffect(() => {
    setTheme('light');
  }, [setTheme]);
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [doc, setDoc] = useState<SignDocument | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!id) return;
    (async () => {
      const d = await getDocument(id);
      if (!d) {
        toast.error('Documento no encontrado');
        return;
      }
      if (d.status === 'signed') {
        navigate(`/documents/complete/${id}`, { replace: true });
        return;
      }
      if (d.status === 'expired') {
        toast.error('Este documento ha expirado');
        return;
      }
      setDoc(d);
      setLoading(false);
    })();
  }, [id, navigate]);

  const handleFormComplete = async (updatedFields: DocumentField[]) => {
    if (!doc) return;
    setSubmitting(true);
    try {
      // Generate signed PDF with field values stamped on
      const signedPdfData = await generateSignedPdf(doc.fileData, updatedFields);

      const updated: SignDocument = {
        ...doc,
        fields: updatedFields,
        status: 'signed',
        signedAt: Date.now(),
        signedFileData: signedPdfData,
        signerData: {
          date: new Date().toISOString(),
        },
      };
      await saveDocument(updated);
      navigate(`/documents/complete/${doc.id}`, { replace: true });
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

  if (!doc) {
    return (
      <div className="text-center py-20 text-muted-foreground">
        <p className="font-medium">Documento no encontrado o expirado</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 py-6 px-4">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Firmar documento</h1>
        <p className="text-sm text-muted-foreground">{doc.fileName}</p>
      </div>

      {/* PDF Preview */}
      <div className="border rounded-lg overflow-hidden bg-muted/30" style={{ minHeight: 400 }}>
        <PdfViewer
          fileData={doc.fileData}
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
          onTotalPagesChange={setTotalPages}
        />
      </div>

      {/* Guided Form */}
      <GuidedForm
        fields={doc.fields}
        onComplete={handleFormComplete}
      />
    </div>
  );
}
