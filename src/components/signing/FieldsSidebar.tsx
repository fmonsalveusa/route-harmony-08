import { FieldType } from "@/types/document";
import { PenLine, User, Calendar, MapPin, StickyNote, Phone, Mail, Type, Building2, Briefcase, X, TextCursorInput, AlignLeft, ListOrdered, CircleDot, CheckSquare, Hash } from "lucide-react";

interface FieldsSidebarProps {
  onAddField: (type: FieldType) => void;
  onClose: () => void;
  fieldCount: number;
}

const fieldCategories = [
  {
    label: "ELEMENTOS BÁSICOS",
    fields: [
      { type: "name" as FieldType, icon: User, label: "Nombre" },
      { type: "email" as FieldType, icon: Mail, label: "Email" },
      { type: "shortText" as FieldType, icon: TextCursorInput, label: "Texto corto" },
      { type: "longText" as FieldType, icon: AlignLeft, label: "Texto largo" },
      { type: "date" as FieldType, icon: Calendar, label: "Fecha" },
      { type: "address" as FieldType, icon: MapPin, label: "Dirección" },
      { type: "phone" as FieldType, icon: Phone, label: "Teléfono" },
    ],
  },
  {
    label: "ELEMENTOS DE FIRMA",
    fields: [
      { type: "signature" as FieldType, icon: PenLine, label: "Firma" },
      { type: "initials" as FieldType, icon: Type, label: "Iniciales" },
    ],
  },
  {
    label: "ELEMENTOS DE SELECCIÓN",
    fields: [
      { type: "checkbox" as FieldType, icon: CheckSquare, label: "Checkbox" },
      { type: "dropdown" as FieldType, icon: ListOrdered, label: "Dropdown" },
      { type: "singleChoice" as FieldType, icon: CircleDot, label: "Opción única" },
      { type: "multipleChoice" as FieldType, icon: CheckSquare, label: "Opción múltiple" },
      { type: "number" as FieldType, icon: Hash, label: "Número" },
    ],
  },
  {
    label: "ELEMENTOS COMUNES",
    fields: [
      { type: "company" as FieldType, icon: Building2, label: "Empresa" },
      { type: "jobTitle" as FieldType, icon: Briefcase, label: "Cargo" },
      { type: "notes" as FieldType, icon: StickyNote, label: "Notas" },
    ],
  },
];

export default function FieldsSidebar({ onAddField, onClose, fieldCount }: FieldsSidebarProps) {
  return (
    <div className="w-64 flex-shrink-0 bg-[hsl(220,25%,18%)] text-white rounded-xl overflow-hidden flex flex-col shadow-xl">
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <h3 className="font-semibold text-sm">Elementos del documento</h3>
        <button onClick={onClose} className="p-1 rounded hover:bg-white/10 transition-colors">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-2 pb-4 space-y-4">
        {fieldCategories.map((cat) => (
          <div key={cat.label}>
            <p className="text-[10px] font-semibold tracking-wider text-primary/80 px-2 mb-1.5">{cat.label}</p>
            <div className="space-y-0.5">
              {cat.fields.map((f) => (
                <button key={f.type} onClick={() => onAddField(f.type)} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium hover:bg-white/10 transition-colors text-left">
                  <f.icon className="h-4.5 w-4.5 flex-shrink-0 opacity-90" />
                  {f.label}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
      {fieldCount > 0 && (
        <div className="px-4 py-3 border-t border-white/10 text-xs text-white/60">
          {fieldCount} campo{fieldCount !== 1 ? "s" : ""} añadido{fieldCount !== 1 ? "s" : ""}
        </div>
      )}
    </div>
  );
}
