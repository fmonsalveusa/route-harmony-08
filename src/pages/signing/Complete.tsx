import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle2, Download, ArrowLeft, FileText } from 'lucide-react';
import { format } from 'date-fns';
import { getDocument } from '@/store/signing-documents';
import type { SignDocument } from '@/types/document';

export default function Complete() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [doc, setDoc] = useState<SignDocument | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    (async () => {
      const d = await getDocument(id);
      setDoc(d || null);
      setLoading(false);
    })();
  }, [id]);

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
        <p className="font-medium">Documento no encontrado</p>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto py-12 px-4 space-y-6">
      <Card>
        <CardHeader className="text-center">
          <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <CheckCircle2 className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="text-xl">
            {doc.status === 'signed' ? 'Documento firmado' : 'Detalles del documento'}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
            <FileText className="h-5 w-5 text-muted-foreground" />
            <div className="flex-1 min-w-0">
              <p className="font-medium truncate">{doc.fileName}</p>
              <p className="text-xs text-muted-foreground">
                Creado: {format(new Date(doc.createdAt), 'dd/MM/yyyy HH:mm')}
              </p>
              {doc.signedAt && (
                <p className="text-xs text-muted-foreground">
                  Firmado: {format(new Date(doc.signedAt), 'dd/MM/yyyy HH:mm')}
                </p>
              )}
            </div>
          </div>

          {doc.signerData?.name && (
            <div className="text-sm">
              <span className="text-muted-foreground">Firmante:</span>{' '}
              <span className="font-medium">{doc.signerData.name}</span>
            </div>
          )}

          {doc.recipientEmail && (
            <div className="text-sm">
              <span className="text-muted-foreground">Email:</span>{' '}
              <span className="font-medium">{doc.recipientEmail}</span>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <Button variant="outline" className="flex-1 gap-2" onClick={() => navigate('/documents')}>
              <ArrowLeft className="h-4 w-4" />
              Volver
            </Button>
            {doc.signedFileData && (
              <Button className="flex-1 gap-2" onClick={() => {
                const link = document.createElement('a');
                link.href = doc.signedFileData!;
                link.download = `signed-${doc.fileName}`;
                link.click();
              }}>
                <Download className="h-4 w-4" />
                Descargar
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
