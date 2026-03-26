import { useState, useEffect } from 'react';
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
import type { SignDocument, SignTemplate } from '@/types/document';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

const Documents = () => {
  const [documents, setDocuments] = useState<SignDocument[]>([]);
  const [templates, setTemplates] = useState<SignTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'doc' | 'tpl'; id: string; name: string } | null>(null);

  const fetchAll = async () => {
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
  };

  useEffect(() => { fetchAll(); }, []);

  const copySignLink = (docId: string) => {
    navigator.clipboard.writeText(`${SIGNING_APP}/sign/${docId}`);
    toast.success('Sign link copied to clipboard');
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      if (deleteTarget.type === 'doc') await deleteDocument(deleteTarget.id);
      else await deleteTemplate(deleteTarget.id);
      toast.success(`${deleteTarget.type === 'doc' ? 'Document' : 'Template'} deleted`);
      fetchAll();
    } catch (e: any) {
      toast.error('Error deleting', { description: e.message });
    } finally {
      setDeleteTarget(null);
    }
  };

  const getStatusKey = (status: string) => {
    if (status === 'signed') return 'delivered';
    if (status === 'expired') return 'cancelled';
    return 'pending';
  };

  const getStatusLabel = (status: string) => {
    if (status === 'signed') return 'Signed';
    if (status === 'expired') return 'Expired';
    return 'Pending';
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Documents</h1>
          <p className="text-sm text-muted-foreground">Manage electronic signature documents and templates</p>
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
            Templates
          </TabsTrigger>
        </TabsList>

        {/* ── Dashboard Tab ── */}
        <TabsContent value="dashboard">
          <div className="flex justify-end mb-4">
            <Button onClick={() => window.open(`${SIGNING_APP}/upload`, '_blank')} className="gap-2">
              <Plus className="h-4 w-4" /> New Document
            </Button>
          </div>

          {loading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-muted border-t-foreground" />
            </div>
          ) : documents.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-3 opacity-40" />
              <p className="font-medium">No documents yet</p>
              <p className="text-sm">Create your first document to get started</p>
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>File</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Recipient</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {documents.map((doc) => (
                    <TableRow key={doc.id}>
                      <TableCell className="font-medium">{doc.fileName}</TableCell>
                      <TableCell>
                        <StatusBadge status={getStatusKey(doc.status)} />
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {doc.recipientEmail || '—'}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {format(new Date(doc.createdAt), 'MMM dd, yyyy')}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          {doc.status === 'pending' && (
                            <>
                              <Button variant="ghost" size="icon" onClick={() => copySignLink(doc.id)} title="Copy sign link">
                                <Copy className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="icon" onClick={() => window.open(`${SIGNING_APP}/upload?edit=${doc.id}`, '_blank')} title="Edit">
                                <Pencil className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                          {doc.status === 'signed' && (
                            <>
                              <Button variant="ghost" size="icon" onClick={() => window.open(`${SIGNING_APP}/complete/${doc.id}`, '_blank')} title="View details">
                                <Eye className="h-4 w-4" />
                              </Button>
                              {doc.signedFileData && (
                                <Button variant="ghost" size="icon" onClick={() => {
                                  const link = document.createElement('a');
                                  link.href = doc.signedFileData!;
                                  link.download = `signed-${doc.fileName}`;
                                  link.click();
                                }} title="Download signed">
                                  <Download className="h-4 w-4" />
                                </Button>
                              )}
                            </>
                          )}
                          <Button variant="ghost" size="icon" onClick={() => setDeleteTarget({ type: 'doc', id: doc.id, name: doc.fileName })} title="Delete" className="text-destructive hover:text-destructive">
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

        {/* ── Templates Tab ── */}
        <TabsContent value="templates">
          <div className="flex justify-end mb-4">
            <Button onClick={() => window.open(`${SIGNING_APP}/upload?mode=template`, '_blank')} className="gap-2">
              <Plus className="h-4 w-4" /> Create Template
            </Button>
          </div>

          {loading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-muted border-t-foreground" />
            </div>
          ) : templates.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <LayoutTemplate className="h-12 w-12 mx-auto mb-3 opacity-40" />
              <p className="font-medium">No templates yet</p>
              <p className="text-sm">Create reusable document templates</p>
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>File</TableHead>
                    <TableHead>Fields</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
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
                          <Button variant="ghost" size="icon" onClick={() => window.open(`${SIGNING_APP}/upload?mode=template&edit=${tpl.id}`, '_blank')} title="Edit template">
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => setDeleteTarget({ type: 'tpl', id: tpl.id, name: tpl.name })} title="Delete" className="text-destructive hover:text-destructive">
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

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleteTarget?.type === 'doc' ? 'Document' : 'Template'}</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deleteTarget?.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Documents;
