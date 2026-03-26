import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { DocumentField } from "@/types/document";
import { Plus, X } from "lucide-react";

interface FieldSettingsDialogProps {
  open: boolean;
  field: DocumentField | null;
  onClose: () => void;
  onSave: (id: string, settings: { label?: string; required?: boolean; defaultValue?: string; options?: string[]; addressRows?: 1 | 2 }) => void;
}

const FIELD_LABELS: Record<string, string> = {
  signature: "Firma", initials: "Iniciales", name: "Nombre completo", date: "Fecha",
  company: "Empresa", jobTitle: "Cargo / Puesto", email: "Correo electrónico", phone: "Teléfono",
  address: "Dirección", notes: "Notas / Observaciones", number: "Número", shortText: "Texto corto",
  longText: "Texto largo", checkbox: "Casilla de verificación", dropdown: "Selección",
  singleChoice: "Opción única", multipleChoice: "Opción múltiple",
};

const OPTION_FIELD_TYPES = ["dropdown", "singleChoice", "multipleChoice"];

export default function FieldSettingsDialog({ open, field, onClose, onSave }: FieldSettingsDialogProps) {
  const [label, setLabel] = useState("");
  const [required, setRequired] = useState(false);
  const [defaultValue, setDefaultValue] = useState("");
  const [options, setOptions] = useState<string[]>([]);
  const [newOption, setNewOption] = useState("");
  const [addressRows, setAddressRows] = useState<1 | 2>(2);

  useEffect(() => {
    if (field) {
      setLabel(field.label || "");
      setRequired(field.required || false);
      setDefaultValue(field.defaultValue || "");
      setOptions(field.options || []);
      setNewOption("");
      setAddressRows(field.addressRows || 2);
    }
  }, [field]);

  if (!field) return null;

  const isLargeText = ["address", "notes", "longText"].includes(field.type);
  const hideDefault = ["signature", "initials", "checkbox"].includes(field.type);
  const hasOptions = OPTION_FIELD_TYPES.includes(field.type);
  const fieldTypeLabel = FIELD_LABELS[field.type] || field.type;

  const addOption = () => {
    const trimmed = newOption.trim();
    if (!trimmed || options.includes(trimmed)) return;
    setOptions((prev) => [...prev, trimmed]);
    setNewOption("");
  };

  const removeOption = (index: number) => setOptions((prev) => prev.filter((_, i) => i !== index));

  const handleKeyDown = (e: React.KeyboardEvent) => { if (e.key === "Enter") { e.preventDefault(); addOption(); } };

  const handleSave = () => {
    onSave(field.id, {
      label: label.trim() || undefined,
      required,
      defaultValue: defaultValue.trim() || undefined,
      ...(hasOptions ? { options: options.length > 0 ? options : undefined } : {}),
      ...(field.type === "address" ? { addressRows } : {}),
    });
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Configuración del campo</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="field-label">Nombre / Etiqueta</Label>
            <Input id="field-label" value={label} onChange={(e) => setLabel(e.target.value)} placeholder={fieldTypeLabel} style={{ fontSize: "16px" }} />
            <p className="text-xs text-muted-foreground">Se mostrará como identificador del campo</p>
          </div>
          <div className="flex items-center gap-3">
            <Checkbox id="field-required" checked={required} onCheckedChange={(v) => setRequired(v === true)} />
            <div>
              <Label htmlFor="field-required" className="cursor-pointer">Campo obligatorio</Label>
              <p className="text-xs text-muted-foreground">El firmante deberá completar este campo</p>
            </div>
          </div>
          {field.type === "address" && (
            <div className="space-y-2">
              <Label>Disposición</Label>
              <div className="flex gap-2">
                <Button type="button" variant={addressRows === 1 ? "default" : "outline"} size="sm" className="flex-1" onClick={() => setAddressRows(1)}>1 fila</Button>
                <Button type="button" variant={addressRows === 2 ? "default" : "outline"} size="sm" className="flex-1" onClick={() => setAddressRows(2)}>2 filas</Button>
              </div>
            </div>
          )}
          {hasOptions && (
            <div className="space-y-2">
              <Label>Opciones</Label>
              <div className="space-y-1.5 max-h-40 overflow-y-auto">
                {options.map((opt, i) => (
                  <div key={i} className="flex items-center gap-2 bg-muted/50 rounded-md px-3 py-1.5 text-sm">
                    <span className="flex-1 truncate">{opt}</span>
                    <button type="button" onClick={() => removeOption(i)} className="text-muted-foreground hover:text-destructive transition-colors"><X className="h-3.5 w-3.5" /></button>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <Input value={newOption} onChange={(e) => setNewOption(e.target.value)} onKeyDown={handleKeyDown} placeholder="Escribe una opción..." style={{ fontSize: "16px" }} />
                <Button type="button" variant="outline" size="icon" onClick={addOption} disabled={!newOption.trim()}><Plus className="h-4 w-4" /></Button>
              </div>
            </div>
          )}
          {!hideDefault && !hasOptions && (
            <div className="space-y-2">
              <Label htmlFor="field-default">Valor por defecto</Label>
              {isLargeText ? (
                <Textarea id="field-default" value={defaultValue} onChange={(e) => setDefaultValue(e.target.value)} placeholder="Pre-llenado opcional..." className="min-h-[80px]" style={{ fontSize: "16px" }} />
              ) : (
                <Input id="field-default" value={defaultValue} onChange={(e) => setDefaultValue(e.target.value)} placeholder="Pre-llenado opcional..." style={{ fontSize: "16px" }} />
              )}
            </div>
          )}
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave}>Guardar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
