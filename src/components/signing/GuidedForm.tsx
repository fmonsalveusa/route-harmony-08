import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import SignatureModal from "@/components/signing/SignatureModal";
import { DocumentField, FieldType } from "@/types/document";
import { Pen, User, Calendar, Building2, Briefcase, Mail, Phone, MapPin, StickyNote, Hash, Type, AlignLeft, CheckSquare, FileText, PenLine } from "lucide-react";
import { computeColorIndices, FIELD_COLOR_PALETTE } from "@/lib/field-colors";

const US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","DC","FL","GA","HI","ID","IL","IN",
  "IA","KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH",
  "NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT",
  "VT","VA","WA","WV","WI","WY",
];

interface GuidedFormProps {
  fields: DocumentField[];
  onComplete: (updatedFields: DocumentField[]) => void;
}

interface UniqueField {
  key: string;
  type: FieldType;
  groupId?: string;
  fieldIds: string[];
  value?: string;
  label?: string;
  required?: boolean;
  defaultValue?: string;
}

const FIELD_ICONS: Record<string, React.ElementType> = {
  signature: Pen, initials: PenLine, name: User, date: Calendar, company: Building2,
  jobTitle: Briefcase, email: Mail, phone: Phone, address: MapPin, notes: StickyNote,
  number: Hash, shortText: Type, longText: AlignLeft, checkbox: CheckSquare,
};

const FIELD_LABELS: Record<string, string> = {
  signature: "Firma", initials: "Iniciales", name: "Nombre completo", date: "Fecha",
  company: "Empresa", jobTitle: "Cargo / Puesto", email: "Correo electrónico", phone: "Teléfono",
  address: "Dirección", notes: "Notas / Observaciones", number: "Número", shortText: "Texto corto",
  longText: "Texto largo", checkbox: "Casilla de verificación", dropdown: "Selección",
  singleChoice: "Opción única", multipleChoice: "Opción múltiple",
};

export default function GuidedForm({ fields, onComplete }: GuidedFormProps) {
  const [sigModalOpen, setSigModalOpen] = useState(false);
  const [activeSigKey, setActiveSigKey] = useState<string | null>(null);
  const [activeSigTitle, setActiveSigTitle] = useState<string | undefined>();

  const uniqueFields = useMemo<UniqueField[]>(() => {
    const seen = new Map<string, UniqueField>();
    const result: UniqueField[] = [];
    for (const f of fields) {
      const key = f.groupId || f.id;
      if (seen.has(key)) { seen.get(key)!.fieldIds.push(f.id); }
      else {
        const uf: UniqueField = { key, type: f.type, groupId: f.groupId, fieldIds: [f.id], value: f.value, label: f.label, required: f.required, defaultValue: f.defaultValue };
        seen.set(key, uf);
        result.push(uf);
      }
    }
    return result;
  }, [fields]);

  const [values, setValues] = useState<Record<string, string | undefined>>(() => {
    const init: Record<string, string | undefined> = {};
    for (const uf of uniqueFields) {
      if (uf.type === "date") init[uf.key] = uf.value || uf.defaultValue || new Date().toLocaleDateString("es-ES");
      else init[uf.key] = uf.value || uf.defaultValue;
    }
    return init;
  });

  useEffect(() => {
    setValues((prev) => {
      const next = { ...prev };
      for (const uf of uniqueFields) {
        if (uf.type === "date" && !next[uf.key]) next[uf.key] = new Date().toLocaleDateString("es-ES");
      }
      return next;
    });
  }, [uniqueFields]);

  const setValue = (key: string, val: string | undefined) => setValues((prev) => ({ ...prev, [key]: val }));

  const completedCount = uniqueFields.filter((uf) => {
    const v = values[uf.key];
    if (uf.type === "checkbox") return true;
    if (!uf.required) return true;
    return !!v;
  }).length;

  const requiredComplete = uniqueFields.filter((uf) => uf.required).every((uf) => {
    const v = values[uf.key];
    return uf.type === "checkbox" ? true : !!v;
  });

  const allComplete = requiredComplete && uniqueFields.length > 0;
  const progress = uniqueFields.length > 0 ? (completedCount / uniqueFields.length) * 100 : 0;

  const handleComplete = () => {
    const updatedFields = fields.map((f) => { const key = f.groupId || f.id; return { ...f, value: values[key] }; });
    onComplete(updatedFields);
  };

  const handleSigClick = (key: string, type: FieldType) => {
    setActiveSigKey(key);
    setActiveSigTitle(type === "initials" ? "Escribe tus iniciales" : undefined);
    setSigModalOpen(true);
  };

  const handleSigConfirm = (dataUrl: string) => { if (activeSigKey) setValue(activeSigKey, dataUrl); setSigModalOpen(false); };

  const colorMap = useMemo(() => computeColorIndices(fields), [fields]);

  const renderField = (uf: UniqueField) => {
    const Icon = FIELD_ICONS[uf.type] || FileText;
    const label = uf.label || FIELD_LABELS[uf.type] || uf.type;
    const isRequired = uf.required;
    const val = values[uf.key];
    const count = uf.fieldIds.length;
    const ci = colorMap.get(uf.key);
    const borderColor = ci !== undefined ? FIELD_COLOR_PALETTE[ci].split(" ")[0] : "";

    return (
      <div key={uf.key} className={`bg-card border rounded-lg p-4 ${borderColor ? `border-l-4 ${borderColor}` : ""}`}>
        <div className="flex items-center gap-2 mb-2">
          <Icon className="h-4 w-4 text-primary shrink-0" />
          <span className="font-medium text-sm">
            {label}
            {isRequired && <span className="text-destructive ml-0.5">*</span>}
          </span>
          {count > 1 && <span className="text-xs text-muted-foreground ml-auto">×{count} campos</span>}
        </div>

        {uf.type === "date" && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-muted text-sm">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span>{val}</span>
            <span className="text-xs text-muted-foreground ml-auto">Auto</span>
          </div>
        )}

        {(uf.type === "signature" || uf.type === "initials") && (
          <div>
            {val ? (
              <div className="space-y-2">
                <div className="border rounded-md p-2 bg-muted flex items-center justify-center">
                  <img src={val} alt={label} className="max-h-16 object-contain" />
                </div>
                <Button variant="outline" size="sm" className="w-full" onClick={() => handleSigClick(uf.key, uf.type)}>Cambiar {label.toLowerCase()}</Button>
              </div>
            ) : (
              <Button variant="outline" className="w-full h-16 border-dashed border-2 text-muted-foreground hover:text-foreground hover:border-primary" onClick={() => handleSigClick(uf.key, uf.type)}>
                <Pen className="h-4 w-4 mr-2" />
                Toca para {uf.type === "initials" ? "escribir iniciales" : "firmar"}
              </Button>
            )}
          </div>
        )}

        {uf.type === "checkbox" && (
          <div className="flex items-center gap-3">
            <Checkbox checked={val === "checked"} onCheckedChange={(checked) => setValue(uf.key, checked ? "checked" : undefined)} />
            <span className="text-sm text-muted-foreground">Marcar casilla</span>
          </div>
        )}

        {uf.type === "address" && (() => {
          let parsed = { street: "", city: "", state: "", zip: "" };
          try { if (val) parsed = { ...parsed, ...JSON.parse(val) }; } catch { if (val) parsed.street = val; }
          const update = (patch: Partial<typeof parsed>) => { const next = { ...parsed, ...patch }; setValue(uf.key, JSON.stringify(next)); };
          return (
            <div className="space-y-2">
              <Input value={parsed.street} onChange={(e) => update({ street: e.target.value })} placeholder="Street Address" className="h-11" style={{ fontSize: "16px" }} />
              <div className="grid grid-cols-3 gap-2">
                <Input value={parsed.city} onChange={(e) => update({ city: e.target.value })} placeholder="City" className="h-11" style={{ fontSize: "16px" }} />
                <Select value={parsed.state} onValueChange={(v) => update({ state: v })}>
                  <SelectTrigger className="h-11" style={{ fontSize: "16px" }}><SelectValue placeholder="State" /></SelectTrigger>
                  <SelectContent>{US_STATES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
                <Input value={parsed.zip} onChange={(e) => update({ zip: e.target.value })} placeholder="Zip Code" className="h-11" style={{ fontSize: "16px" }} />
              </div>
            </div>
          );
        })()}

        {(uf.type === "notes" || uf.type === "longText") && (
          <Textarea value={val || ""} onChange={(e) => setValue(uf.key, e.target.value)} placeholder={label} className="min-h-[80px]" style={{ fontSize: "16px" }} />
        )}

        {(uf.type === "name" || uf.type === "company" || uf.type === "jobTitle" || uf.type === "shortText" || uf.type === "dropdown" || uf.type === "singleChoice" || uf.type === "multipleChoice") && (
          <Input value={val || ""} onChange={(e) => setValue(uf.key, e.target.value)} placeholder={label} className="h-11" style={{ fontSize: "16px" }} />
        )}

        {uf.type === "email" && <Input type="email" value={val || ""} onChange={(e) => setValue(uf.key, e.target.value)} placeholder="correo@ejemplo.com" className="h-11" style={{ fontSize: "16px" }} />}
        {uf.type === "phone" && <Input type="tel" value={val || ""} onChange={(e) => setValue(uf.key, e.target.value)} placeholder="+52 555 123 4567" className="h-11" style={{ fontSize: "16px" }} />}
        {uf.type === "number" && <Input type="number" value={val || ""} onChange={(e) => setValue(uf.key, e.target.value)} placeholder="0" className="h-11" style={{ fontSize: "16px" }} />}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full">
      <div className="bg-card border-b px-4 py-3">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="text-muted-foreground">Campos completados</span>
            <span className="font-semibold">{completedCount} de {uniqueFields.length}</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-4">
        <div className="max-w-lg mx-auto space-y-3">
          <div className="text-center mb-4">
            <h2 className="text-lg font-semibold">Completa tus datos</h2>
            <p className="text-sm text-muted-foreground">Llena todos los campos y luego revisa el documento</p>
          </div>
          {uniqueFields.map(renderField)}
        </div>
      </div>
      <div className="sticky bottom-0 bg-card border-t p-4">
        <div className="max-w-lg mx-auto">
          <Button className="w-full h-12 text-base" disabled={!allComplete} onClick={handleComplete}>
            {allComplete ? "Completar y ver documento" : "Completa los campos obligatorios"}
          </Button>
        </div>
      </div>
      <SignatureModal open={sigModalOpen} onClose={() => setSigModalOpen(false)} onConfirm={handleSigConfirm} title={activeSigTitle} />
    </div>
  );
}
