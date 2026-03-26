import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { CheckCircle2, Loader2 } from 'lucide-react';
import PdfViewer from '@/components/signing/PdfViewer';
import GuidedForm from '@/components/signing/GuidedForm';
import SignatureModal from '@/components/signing/SignatureModal';
import { getDocument, saveDocument } from '@/store/signing-documents';
import type { SignDocument, DocumentField } from '@/types/document';

export default function Sign() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [doc, setDoc] = useState<SignDocument | null>(null);
  const [loading, setLoading] = useState(true);
  const [fields, setFields] = useState<DocumentField[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [signerName, setSignerName] = useState('');
  const [showSigModal, setShowSigModal] = useState(false);
  const [sigFieldId, setSigFieldId] = useState<string | null>(null);
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
      setFields(d.fields);
      setLoading(false);
    })();
  }, [id, navigate]);

  const updateFieldValue = useCallback((fieldId: string, value: string) => {
    setFields(prev => prev.map(f => f.id === fieldId ? { ...f, value } : f));
  }, []);

  const openSignature = (fieldId: string) => {
    setSigFieldId(fieldId);
    setShowSigModal(true);
  };

  const handleSignatureSave = (dataUrl: string) => {
    if (sigFieldId) {
      updateFieldValue(sigFieldId, dataUrl);
    }
    setShowSigModal(false);
    setSigFieldId(null);
  };

  const handleSubmit = async () => {
    if (!doc) return;
    const required = fields.filter(f => f.required !== false);
    const missing = required.filter(f => !f.value);
    if (missing.length > 0) {
      toast.error(`Faltan ${missing.length} campos requeridos`);
      return;
    }

    setSubmitting(true);
    try {
      const updated: SignDocument = {
        ...doc,
        fields,
        status: 'signed',
        signedAt: Date.now(),
        signerData: {
          name: signerName || undefined,
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
          onPageChange={setCurrentPage}
          onTotalPages={setTotalPages}
        />
      </div>

      {/* Form */}
      <GuidedForm
        fields={fields}
        onUpdateValue={updateFieldValue}
        onOpenSignature={openSignature}
        signerName={signerName}
        onSignerNameChange={setSignerName}
      />

      <div className="flex justify-end">
        <Button onClick={handleSubmit} disabled={submitting} size="lg" className="gap-2">
          {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <CheckCircle2 className="h-5 w-5" />}
          Firmar y enviar
        </Button>
      </div>

      <SignatureModal
        open={showSigModal}
        onClose={() => setShowSigModal(false)}
        onSave={handleSignatureSave}
      />
    </div>
  );
}
