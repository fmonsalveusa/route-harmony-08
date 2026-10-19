import { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useTheme } from 'next-themes';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { ArrowLeft, CheckCircle2 } from 'lucide-react';
import PdfViewer from '@/components/signing/PdfViewer';
import GuidedForm from '@/components/signing/GuidedForm';
import { getDocument, saveDocument } from '@/store/signing-documents';
import { generateSignedPdf } from '@/lib/generateSignedPdf';
import { uploadPdf } from '@/lib/signingStorage';
import { documentStops, stopPdfPath } from '@/lib/stopSigning';
import type { SignDocument, DocumentField } from '@/types/document';

/** Solo se vuelve a pantallas de la app del driver */
const safeBack = (v: string | null) => (v && /^\/driver\//.test(v) ? v : null);

export default function Sign() {
  const { setTheme } = useTheme();

  useEffect(() => {
    setTheme('light');
  }, [setTheme]);
  const { id } = useParams<{ id: string }>();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [doc, setDoc] = useState<SignDocument | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [submitting, setSubmitting] = useState(false);

  const back = safeBack(params.get('back'));
  const stopParam = params.get('stop');
  const stop = stopParam !== null && /^\d+$/.test(stopParam) ? Number(stopParam) : null;
  const completeUrl = (docId: string) => `/documents/complete/${docId}${back ? `?back=${encodeURIComponent(back)}` : ''}`;

  useEffect(() => {
    if (!id) return;
    (async () => {
      const d = await getDocument(id);
      if (!d) {
        toast.error('Documento no encontrado');
        return;
      }
      if (d.status === 'signed') {
        navigate(completeUrl(id), { replace: true });
        return;
      }
      if (d.status === 'expired') {
        toast.error('Este documento ha expirado');
        return;
      }
      setDoc(d);
      setLoading(false);
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, navigate]);

  // Firma por paradas: cada parada llena solo sus campos (y los generales que sigan vacíos)
  const stops = doc ? documentStops(doc.fields) : [];
  const byStop = stops.length > 0;
  const signedStops = doc?.signedStops ?? [];
  const turnFields = doc && byStop && stop !== null
    ? doc.fields.filter((f) => f.stop === stop || (f.stop == null && !f.value))
    : doc?.fields ?? [];

  const handleFormComplete = async (updatedFields: DocumentField[]) => {
    if (!doc) return;
    setSubmitting(true);
    try {
      if (byStop && stop !== null) {
        // Se vuelve a estampar sobre el original con todo lo firmado hasta ahora
        const filled = new Map(updatedFields.map((f) => [f.id, f]));
        const fields = doc.fields.map((f) => filled.get(f.id) ?? f);
        const pdf = await generateSignedPdf(doc.fileData, fields);
        const path = await uploadPdf(stopPdfPath(doc.id, stop), pdf);
        const done = [...new Set([...signedStops, stop])];
        const allSigned = stops.every((s) => done.includes(s));
        await saveDocument({
          ...doc,
          fields,
          status: allSigned ? 'signed' : 'pending',
          signedAt: allSigned ? Date.now() : undefined,
          signedFileData: path,
          signedStops: done,
          signerData: { date: new Date().toISOString() },
        });
        if (allSigned) navigate(completeUrl(doc.id), { replace: true });
        else {
          toast.success('Signed ✓');
          if (back) navigate(back, { replace: true });
          else setDoc({ ...doc, fields, signedStops: done, signedFileData: pdf });
        }
        return;
      }

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
      navigate(completeUrl(doc.id), { replace: true });
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

  const backButton = back && (
    <Button variant="ghost" size="sm" className="gap-1 -ml-2" onClick={() => navigate(back, { replace: true })}>
      <ArrowLeft className="h-4 w-4" /> Back to load
    </Button>
  );

  // Enlace sin parada en un documento por paradas: se elige cuál firma ahora
  if (byStop && (stop === null || !stops.includes(stop))) {
    return (
      <div className="max-w-md mx-auto space-y-4 py-8 px-4">
        <div>
          <h1 className="text-xl font-bold">Sign document</h1>
          <p className="text-sm text-muted-foreground">{doc.fileName}</p>
        </div>
        <p className="text-sm">Choose the stop you are signing for:</p>
        <div className="space-y-2">
          {stops.map((s) => (
            <Button key={s} variant="outline" className="w-full justify-between h-12" disabled={signedStops.includes(s)}
              onClick={() => navigate(`/sign/${doc.id}?stop=${s}${back ? `&back=${encodeURIComponent(back)}` : ''}`, { replace: true })}>
              <span>Stop {s + 1}</span>
              {signedStops.includes(s) && <span className="flex items-center gap-1 text-green-700 text-xs"><CheckCircle2 className="h-4 w-4" /> Signed</span>}
            </Button>
          ))}
        </div>
      </div>
    );
  }

  if (byStop && stop !== null && signedStops.includes(stop)) {
    return (
      <div className="max-w-md mx-auto space-y-4 py-12 px-4 text-center">
        <CheckCircle2 className="h-12 w-12 text-green-600 mx-auto" />
        <p className="font-medium">Stop {stop + 1} is already signed.</p>
        <p className="text-sm text-muted-foreground">{doc.fileName}</p>
        {backButton}
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 py-6 px-4">
      <div>
        {backButton}
        <h1 className="text-2xl font-bold text-foreground">{byStop ? `Sign · Stop ${stop! + 1}` : 'Firmar documento'}</h1>
        <p className="text-sm text-muted-foreground">{doc.fileName}</p>
      </div>

      {/* PDF Preview: en firma por paradas se ve lo que ya firmaron las paradas anteriores */}
      <div className="border rounded-lg overflow-hidden bg-muted/30" style={{ minHeight: 400 }}>
        <PdfViewer
          fileData={byStop && doc.signedFileData ? doc.signedFileData : doc.fileData}
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
          onTotalPagesChange={setTotalPages}
        />
      </div>

      {/* Guided Form */}
      <GuidedForm
        key={byStop ? `stop-${stop}` : 'all'}
        fields={turnFields}
        onComplete={handleFormComplete}
        lang={byStop ? 'en' : 'es'}
      />
      {submitting && <p className="text-center text-sm text-muted-foreground">Saving…</p>}
    </div>
  );
}
