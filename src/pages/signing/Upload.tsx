import { useState, useCallback, useRef, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Save, Wand2, Loader2 } from 'lucide-react';
import PdfViewer from '@/components/signing/PdfViewer';
import FieldOverlay from '@/components/signing/FieldOverlay';
import FieldsSidebar from '@/components/signing/FieldsSidebar';
import FieldSettingsDialog from '@/components/signing/FieldSettingsDialog';
import FileUpload from '@/components/signing/FileUpload';
import { saveDocument, getDocument } from '@/store/signing-documents';
import { saveTemplate, getTemplate } from '@/store/signing-templates';
import type { DocumentField, FieldType, SignDocument, SignTemplate } from '@/types/document';
import { supabase } from '@/integrations/supabase/client';

const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;

export default function Upload() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isTemplate = searchParams.get('mode') === 'template';
  const editId = searchParams.get('edit');

  const [fileData, setFileData] = useState<string | null>(null);
  const [fileName, setFileName] = useState('');
  const [templateName, setTemplateName] = useState('');
  const [recipientEmail, setRecipientEmail] = useState('');
  const [fields, setFields] = useState<DocumentField[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
  const [settingsField, setSettingsField] = useState<DocumentField | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [saving, setSaving] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const [loading, setLoading] = useState(!!editId);
  const viewerRef = useRef<HTMLDivElement>(null);

  // Load existing document/template for editing
  useEffect(() => {
    if (!editId) return;
    (async () => {
      try {
        if (isTemplate) {
          const tpl = await getTemplate(editId);
          if (tpl) {
            setFileData(tpl.fileData);
            setFileName(tpl.fileName);
            setTemplateName(tpl.name);
            setFields(tpl.fields);
          }
        } else {
          const doc = await getDocument(editId);
          if (doc) {
            setFileData(doc.fileData);
            setFileName(doc.fileName);
            setRecipientEmail(doc.recipientEmail || '');
            setFields(doc.fields);
          }
        }
      } catch (e: any) {
        toast.error('Error loading', { description: e.message });
      } finally {
        setLoading(false);
      }
    })();
  }, [editId, isTemplate]);

  const handleFileSelect = useCallback((data: string, name: string) => {
    setFileData(data);
    setFileName(name);
    setFields([]);
    setCurrentPage(1);
  }, []);

  const addField = useCallback((type: FieldType) => {
    const field: DocumentField = {
      id: uuidv4(),
      type,
      page: currentPage,
      x: 25,
      y: 40,
      width: type === 'signature' ? 25 : type === 'longText' ? 30 : 20,
      height: type === 'signature' ? 6 : type === 'longText' ? 8 : 4,
      required: true,
    };
    setFields(prev => [...prev, field]);
    setSelectedFieldId(field.id);
  }, [currentPage]);

  const updateField = useCallback((id: string, updates: Partial<DocumentField>) => {
    setFields(prev => prev.map(f => f.id === id ? { ...f, ...updates } : f));
  }, []);

  const deleteField = useCallback((id: string) => {
    setFields(prev => prev.filter(f => f.id !== id));
    if (selectedFieldId === id) setSelectedFieldId(null);
  }, [selectedFieldId]);

  const handleDetectFields = async () => {
    if (!fileData) return;
    setDetecting(true);
    try {
      const { data, error } = await supabase.functions.invoke('detect-fields', {
        body: { imageData: fileData, pageNumber: currentPage, totalPages },
      });
      if (error) throw error;
      const detected = (data?.fields || []).map((f: any) => ({
        id: uuidv4(),
        type: f.type,
        page: currentPage,
        x: f.x,
        y: f.y,
        width: f.width,
        height: f.height,
        label: f.label,
        required: true,
      }));
      setFields(prev => [...prev, ...detected]);
      toast.success(`${detected.length} campos detectados`);
    } catch (e: any) {
      toast.error('Error detecting fields', { description: e.message });
    } finally {
      setDetecting(false);
    }
  };

  const handleSave = async () => {
    if (!fileData) return;
    setSaving(true);
    try {
      if (isTemplate) {
        const name = templateName.trim() || fileName.replace(/\.pdf$/i, '');
        const tpl: SignTemplate = {
          id: editId || uuidv4(),
          name,
          fileName,
          fileData,
          fields,
          createdAt: Date.now(),
        };
        await saveTemplate(tpl);
        toast.success('Plantilla guardada');
      } else {
        const doc: SignDocument = {
          id: editId || uuidv4(),
          fileName,
          fileData,
          status: 'pending',
          createdAt: Date.now(),
          expiresAt: Date.now() + SEVEN_DAYS,
          fields,
          recipientEmail: recipientEmail.trim() || undefined,
        };
        await saveDocument(doc);
        toast.success('Documento guardado');
      }
      navigate('/documents');
    } catch (e: any) {
      toast.error('Error saving', { description: e.message });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-muted border-t-foreground" />
      </div>
    );
  }

  if (!fileData) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/documents')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              {isTemplate ? 'Crear Plantilla' : 'Nuevo Documento'}
            </h1>
            <p className="text-sm text-muted-foreground">Sube un archivo PDF para comenzar</p>
          </div>
        </div>
        <FileUpload onFileSelect={handleFileSelect} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/documents')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-lg font-bold text-foreground">{fileName}</h1>
            <p className="text-xs text-muted-foreground">
              Página {currentPage} de {totalPages} · {fields.length} campos
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isTemplate && (
            <div className="flex items-center gap-2">
              <Label className="text-sm">Nombre:</Label>
              <Input
                value={templateName}
                onChange={e => setTemplateName(e.target.value)}
                placeholder="Nombre de la plantilla"
                className="w-48"
              />
            </div>
          )}
          {!isTemplate && (
            <div className="flex items-center gap-2">
              <Label className="text-sm">Email:</Label>
              <Input
                value={recipientEmail}
                onChange={e => setRecipientEmail(e.target.value)}
                placeholder="email@ejemplo.com"
                className="w-48"
                type="email"
              />
            </div>
          )}
          <Button variant="outline" onClick={handleDetectFields} disabled={detecting} className="gap-2">
            {detecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
            Detectar campos
          </Button>
          <Button onClick={handleSave} disabled={saving} className="gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Guardar
          </Button>
        </div>
      </div>

      {/* Editor area */}
      <div className="flex gap-4" style={{ minHeight: 'calc(100vh - 220px)' }}>
        {sidebarOpen && (
          <FieldsSidebar
            onAddField={addField}
            onClose={() => setSidebarOpen(false)}
            fieldCount={fields.length}
          />
        )}
        <div ref={viewerRef} className="flex-1 relative border rounded-lg overflow-hidden bg-muted/30">
          <PdfViewer
            fileData={fileData}
            currentPage={currentPage}
            onPageChange={setCurrentPage}
            onTotalPages={setTotalPages}
          />
          <FieldOverlay
            fields={fields.filter(f => f.page === currentPage)}
            selectedFieldId={selectedFieldId}
            onSelectField={setSelectedFieldId}
            onUpdateField={updateField}
            onDeleteField={deleteField}
            onOpenSettings={setSettingsField}
            containerRef={viewerRef}
          />
        </div>
      </div>

      {!sidebarOpen && (
        <Button
          variant="outline"
          className="fixed bottom-6 left-6 z-50"
          onClick={() => setSidebarOpen(true)}
        >
          + Agregar campo
        </Button>
      )}

      <FieldSettingsDialog
        field={settingsField}
        onClose={() => setSettingsField(null)}
        onUpdate={(id, updates) => {
          updateField(id, updates);
          setSettingsField(null);
        }}
      />
    </div>
  );
}
