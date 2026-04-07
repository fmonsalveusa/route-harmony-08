import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Table, TableHeader, TableHead, TableRow, TableBody, TableCell } from '@/components/ui/table';
import { StatusBadge } from '@/components/StatusBadge';
import { FileText, Copy, Pencil, Eye, Download, Trash2, Plus, LayoutTemplate } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { getDocuments, deleteDocument } from '@/store/signing-documents';
import { getTemplates, deleteTemplate } from '@/store/signing-templates';
import { supabase } from '@/integrations/supabase/client';
import { getSigningUrl } from '@/lib/signing-url';
import type { SignDocument, SignTemplate } from '@/types/document';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';

function dataUriToBlob(dataUri: string): Blob {
  const [header, base64] = dataUri.split(',');
  const mime = header.match(/:(.*?);/)?.[1] || 'application/pdf';
  const bytes = atob(base64);
  const arr = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

function PdfBlobIframe({ dataUri }: { dataUri: string }) {
  const blobUrl = useMemo(() => {
    if (!dataUri) return '';
    return URL.createObjectURL(dataUriToBlob(dataUri));
  }, [dataUri]);

  useEffect(() => {
    return () => { if (blobUrl) URL.revokeObjectURL(blobUrl); };
  }, [blobUrl]);

  if (!blobUrl) return null;
  return (
    <iframe
      src={blobUrl}
      className="w-full rounded border"
      style={{ height: '75vh' }}
      title="PDF Preview"
    />
  );
}

const Documents = () => {
  const navigate = useNavigate();
  const [documents, setDocuments] = useState<SignDocument[]>([]);
  const [templates, setTemplates] = useState<SignTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'doc' | 'tpl'; id: string; name: string } | null>(null);
  const [previewDoc, setPreviewDoc] = useState<SignDocument | null>(null);
  const [editingRecipient, setEditingRecipient] = useState<{ id: string; email: string } | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [docs, tpls] = await Promise.all([getDocuments(), getTemplates()]);
      setDocuments(docs);
      setTemplates(tpls);
    } catch (e: any) {
      toast.error('Error loading data', { description: e.message });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Realtime: listen for document status changes to "signed"
  useEffect(() => {
    const channel = supabase
      .channel('documents-signing-updates')
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'documents',
      }, (payload) => {
        const row = payload.new as any;
        if (row.status === 'signed') {
          toast.success('📄 Documento firmado', {
            description: `"${row.file_name}" ha sido firmado exitosamente.`,
            duration: 8000,
          });
          fetchAll();
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [fetchAll]);

  const copySignLink = (docId: string) => {
    const link = getSigningUrl(docId);
    navigator.clipboard.writeText(link);
    toast.success('Enlace de firma copiado');
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      if (deleteTarget.type === 'doc') await deleteDocument(deleteTarget.id);
      else await deleteTemplate(deleteTarget.id);
      toast.success(`${deleteTarget.type === 'doc' ? 'Documento' : 'Plantilla'} eliminado`);
      fetchAll();
    } catch (e: any) {
      toast.error('Error al eliminar', { description: e.message });
    } finally {
      setDeleteTarget(null);
    }
  };

  const getStatusLabel = (status: string) => {
    if (status === 'signed') return 'completed';
    if (status === 'expired') return 'cancelled';
    return 'pending';
  };

  const openPdfPreview = (doc: SignDocument) => {
    setPreviewDoc(doc);
  };

  const saveRecipientName = async () => {
    if (!editingRecipient) return;
    const name = editingRecipient.email.trim();
    const { error } = await supabase.from('documents').update({ recipient_email: name || null }).eq('id', editingRecipient.id);
    if (error) { toast.error('Error al guardar'); return; }
    setDocuments(prev => prev.map(d => d.id === editingRecipient.id ? { ...d, recipientEmail: name || null } : d));
    setEditingRecipient(null);
    toast.success('Destinatario actualizado');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Documentos</h1>
          <p className="text-sm text-muted-foreground">Gestiona documentos de firma electrónica y plantillas</p>
        </div>
      </div>

      <Tabs defaultValue="dashboard">
        <TabsList>
          <TabsTrigger value="dashboard" className="gap-2">
            <FileText className="h-4 w-4" />
            Dashboard
          </TabsTrigger>
          <TabsTrigger value="templates" className="gap-2">
            <LayoutTemplate className="h-4 w-4" />
            Plantillas
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard">
          <div className="flex justify-end mb-4">
            <Button onClick={() => navigate('/documents/upload')} className="gap-2">
              <Plus className="h-4 w-4" /> Nuevo Documento
            </Button>
          </div>

          {loading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-muted border-t-foreground" />
            </div>
          ) : documents.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-3 opacity-40" />
              <p className="font-medium">Sin documentos aún</p>
              <p className="text-sm">Crea tu primer documento para comenzar</p>
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Archivo</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Destinatario</TableHead>
                    <TableHead>Creado</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {documents.map((doc) => (
                    <TableRow key={doc.id}>
                      <TableCell className="font-medium">{doc.fileName}</TableCell>
                      <TableCell>
                        <StatusBadge status={getStatusLabel(doc.status)} />
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {editingRecipient?.id === doc.id ? (
                          <div className="flex items-center gap-1">
                            <input
                              type="text"
                              className="border rounded px-2 py-1 text-sm w-48 bg-background text-foreground"
                              value={editingRecipient.email}
                              onChange={e => setEditingRecipient({ ...editingRecipient, email: e.target.value })}
                              onKeyDown={e => { if (e.key === 'Enter') saveRecipientName(); if (e.key === 'Escape') setEditingRecipient(null); }}
                              autoFocus
                              placeholder="Nombre del destinatario"
                            />
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={saveRecipientName}>
                              <Pencil className="h-3 w-3" />
                            </Button>
                          </div>
                        ) : (
                          <span
                            className="cursor-pointer hover:text-foreground hover:underline"
                            onClick={() => setEditingRecipient({ id: doc.id, email: doc.recipientEmail || '' })}
                            title="Click para editar"
                          >
                            {doc.recipientEmail || '—'}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {format(new Date(doc.createdAt), 'MMM dd, yyyy')}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          {doc.status === 'pending' && (
                            <>
                              <Button variant="ghost" size="icon" onClick={() => copySignLink(doc.id)} title="Copiar enlace">
                                <Copy className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="icon" onClick={() => navigate(`/documents/upload?edit=${doc.id}`)} title="Editar">
                                <Pencil className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                          {doc.status === 'signed' && (
                            <>
                              {(doc.signedFileData || doc.fileData) && (
                                <Button variant="ghost" size="icon" onClick={() => openPdfPreview(doc)} title="Ver PDF">
                                  <Eye className="h-4 w-4" />
                                </Button>
                              )}
                              <Button variant="ghost" size="icon" onClick={() => navigate(`/documents/complete/${doc.id}`)} title="Ver detalles">
                                <FileText className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="icon" onClick={() => {
                                const pdfData = doc.signedFileData || doc.fileData;
                                const link = document.createElement('a');
                                link.href = pdfData;
                                link.download = `signed-${doc.fileName}`;
                                link.click();
                              }} title="Descargar PDF">
                                <Download className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                          <Button variant="ghost" size="icon" onClick={() => setDeleteTarget({ type: 'doc', id: doc.id, name: doc.fileName })} title="Eliminar" className="text-destructive hover:text-destructive">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="templates">
          <div className="flex justify-end mb-4">
            <Button onClick={() => navigate('/documents/upload?mode=template')} className="gap-2">
              <Plus className="h-4 w-4" /> Crear Plantilla
            </Button>
          </div>

          {loading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-muted border-t-foreground" />
            </div>
          ) : templates.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <LayoutTemplate className="h-12 w-12 mx-auto mb-3 opacity-40" />
              <p className="font-medium">Sin plantillas aún</p>
              <p className="text-sm">Crea plantillas reutilizables de documentos</p>
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Archivo</TableHead>
                    <TableHead>Campos</TableHead>
                    <TableHead>Creado</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {templates.map((tpl) => (
                    <TableRow key={tpl.id}>
                      <TableCell className="font-medium">{tpl.name}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{tpl.fileName}</TableCell>
                      <TableCell className="text-sm">{tpl.fields.length}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {format(new Date(tpl.createdAt), 'MMM dd, yyyy')}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" onClick={() => navigate(`/documents/upload?mode=template&edit=${tpl.id}`)} title="Editar plantilla">
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => setDeleteTarget({ type: 'tpl', id: tpl.id, name: tpl.name })} title="Eliminar" className="text-destructive hover:text-destructive">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>
      </Tabs>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar {deleteTarget?.type === 'doc' ? 'Documento' : 'Plantilla'}</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Estás seguro de eliminar "{deleteTarget?.name}"? Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* PDF Preview Dialog */}
      <Dialog open={!!previewDoc} onOpenChange={(open) => !open && setPreviewDoc(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] p-0 overflow-hidden">
          <DialogHeader className="p-4 pb-2">
            <DialogTitle className="truncate">{previewDoc?.fileName}</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-auto px-4 pb-4" style={{ maxHeight: 'calc(90vh - 80px)' }}>
            {previewDoc && <PdfBlobIframe dataUri={previewDoc.signedFileData || previewDoc.fileData} />}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Documents;
