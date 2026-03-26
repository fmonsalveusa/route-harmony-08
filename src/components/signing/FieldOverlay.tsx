import { useRef, useCallback, useState, useEffect } from "react";
import { DocumentField, FieldType } from "@/types/document";
import { PenLine, User, Calendar, X, GripVertical, MapPin, StickyNote, Phone, Mail, Type, Building2, Briefcase, Copy, Settings, Trash2, TextCursorInput, AlignLeft, ListOrdered, CircleDot, CheckSquare, Hash } from "lucide-react";
import { Button } from "@/components/ui/button";

interface FieldOverlayProps {
  field: DocumentField;
  onRemove: (id: string) => void;
  onMove?: (id: string, x: number, y: number) => void;
  onResize?: (id: string, width: number, height: number) => void;
  onDuplicate?: (id: string) => void;
  onOpenSettings?: (field: DocumentField) => void;
  editable?: boolean;
  onClick?: () => void;
  completed?: boolean;
  colorOverride?: string;
  isSelected?: boolean;
  onSelect?: (id: string | null) => void;
}

const fieldConfig: Record<FieldType, { icon: typeof PenLine; label: string; color: string }> = {
  signature: { icon: PenLine, label: "Firma", color: "border-secondary bg-secondary/10 text-secondary" },
  name: { icon: User, label: "Nombre", color: "border-primary bg-primary/10 text-primary" },
  date: { icon: Calendar, label: "Fecha", color: "border-warning bg-warning/10 text-warning" },
  address: { icon: MapPin, label: "Dirección", color: "border-primary bg-primary/10 text-primary" },
  notes: { icon: StickyNote, label: "Notas", color: "border-muted-foreground bg-muted text-muted-foreground" },
  phone: { icon: Phone, label: "Teléfono", color: "border-primary bg-primary/10 text-primary" },
  email: { icon: Mail, label: "Email", color: "border-primary bg-primary/10 text-primary" },
  initials: { icon: Type, label: "Iniciales", color: "border-secondary bg-secondary/10 text-secondary" },
  company: { icon: Building2, label: "Empresa", color: "border-primary bg-primary/10 text-primary" },
  jobTitle: { icon: Briefcase, label: "Cargo", color: "border-primary bg-primary/10 text-primary" },
  shortText: { icon: TextCursorInput, label: "Texto corto", color: "border-primary bg-primary/10 text-primary" },
  longText: { icon: AlignLeft, label: "Texto largo", color: "border-primary bg-primary/10 text-primary" },
  dropdown: { icon: ListOrdered, label: "Dropdown", color: "border-accent bg-accent/10 text-accent-foreground" },
  singleChoice: { icon: CircleDot, label: "Opción única", color: "border-accent bg-accent/10 text-accent-foreground" },
  multipleChoice: { icon: CheckSquare, label: "Opción múltiple", color: "border-accent bg-accent/10 text-accent-foreground" },
  number: { icon: Hash, label: "Número", color: "border-primary bg-primary/10 text-primary" },
  checkbox: { icon: CheckSquare, label: "Checkbox", color: "border-secondary bg-secondary/10 text-secondary" },
};

export default function FieldOverlay({ field, onRemove, onMove, onResize, onDuplicate, onOpenSettings, editable = true, onClick, completed, colorOverride, isSelected: isSelectedProp, onSelect }: FieldOverlayProps) {
  const config = fieldConfig[field.type];
  const colorClasses = colorOverride || config.color;
  const Icon = config.icon;
  const dragging = useRef(false);
  const resizing = useRef(false);
  const startPos = useRef({ mouseX: 0, mouseY: 0, fieldX: 0, fieldY: 0, fieldW: 0, fieldH: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [isSelectedInternal, setIsSelectedInternal] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const isSelected = isSelectedProp !== undefined ? isSelectedProp : isSelectedInternal;
  const setIsSelected = (val: boolean) => {
    if (onSelect) {
      onSelect(val ? field.id : null);
    } else {
      setIsSelectedInternal(val);
    }
  };

  const displayLabel = field.label || config.label;

  useEffect(() => {
    if (!isSelected || onSelect) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsSelectedInternal(false);
      }
    };
    window.addEventListener("pointerdown", handler);
    return () => window.removeEventListener("pointerdown", handler);
  }, [isSelected, onSelect]);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (!editable || !onMove) return;
    e.preventDefault();
    e.stopPropagation();
    dragging.current = true;
    setIsDragging(true);
    setIsSelected(true);

    const parent = (e.currentTarget as HTMLElement).closest("[data-field-container]") || (e.currentTarget as HTMLElement).parentElement!;
    const parentRect = parent.getBoundingClientRect();

    startPos.current = { mouseX: e.clientX, mouseY: e.clientY, fieldX: field.x, fieldY: field.y, fieldW: field.width, fieldH: field.height };

    const handlePointerMove = (ev: PointerEvent) => {
      if (!dragging.current) return;
      const dx = ((ev.clientX - startPos.current.mouseX) / parentRect.width) * 100;
      const dy = ((ev.clientY - startPos.current.mouseY) / parentRect.height) * 100;
      const newX = Math.max(0, Math.min(100 - field.width, startPos.current.fieldX + dx));
      const newY = Math.max(0, Math.min(100 - field.height, startPos.current.fieldY + dy));
      onMove(field.id, newX, newY);
    };

    const handlePointerUp = () => {
      dragging.current = false;
      setIsDragging(false);
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
  }, [editable, onMove, field]);

  const handleResizePointerDown = useCallback((e: React.PointerEvent) => {
    if (!editable || !onResize) return;
    e.preventDefault();
    e.stopPropagation();
    resizing.current = true;
    setIsResizing(true);

    const parent = (e.currentTarget as HTMLElement).closest("[data-field-container]") || (e.currentTarget as HTMLElement).parentElement!.parentElement!;
    const parentRect = parent.getBoundingClientRect();

    startPos.current = { mouseX: e.clientX, mouseY: e.clientY, fieldX: field.x, fieldY: field.y, fieldW: field.width, fieldH: field.height };

    const handlePointerMove = (ev: PointerEvent) => {
      if (!resizing.current) return;
      const dw = ((ev.clientX - startPos.current.mouseX) / parentRect.width) * 100;
      const dh = ((ev.clientY - startPos.current.mouseY) / parentRect.height) * 100;
      const newW = Math.max(8, Math.min(100 - field.x, startPos.current.fieldW + dw));
      const newH = Math.max(3, Math.min(100 - field.y, startPos.current.fieldH + dh));
      onResize(field.id, newW, newH);
    };

    const handlePointerUp = () => {
      resizing.current = false;
      setIsResizing(false);
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
  }, [editable, onResize, field]);

  const selectedStyles = isSelected && editable;

  return (
    <div
      ref={containerRef}
      className={`absolute select-none ${isDragging ? "z-50" : isSelected ? "z-40" : ""}`}
      style={{
        left: `${field.x}%`,
        top: `${field.y}%`,
        width: `${field.width}%`,
        height: `${field.height}%`,
        minWidth: 60,
        minHeight: 24,
      }}
    >
      {selectedStyles && (
        <div className="absolute -top-6 left-1/2 -translate-x-1/2 whitespace-nowrap z-10">
          <span className="bg-foreground text-background text-[10px] font-semibold px-2 py-0.5 rounded-md shadow-sm">
            {displayLabel}
            {field.required && <span className="text-destructive ml-0.5">*</span>}
          </span>
        </div>
      )}

      <div
        className={`w-full h-full flex items-center gap-1 rounded-lg px-2 py-1 transition-colors text-xs font-medium ${
          completed ? "border-2 border-success bg-success/10 text-success" : 
          selectedStyles ? "border-2 border-dashed border-primary bg-primary/10 text-primary" : 
          `border-2 ${colorClasses}`
        } ${editable ? "cursor-grab" : "cursor-pointer"} ${isDragging ? "cursor-grabbing opacity-80 shadow-lg ring-2 ring-secondary" : ""} ${isResizing ? "opacity-80 shadow-lg ring-2 ring-accent" : ""}`}
        style={{ touchAction: "none" }}
        onPointerDown={editable ? handlePointerDown : undefined}
        onClick={!editable ? onClick : undefined}
      >
        {field.type === "address" && editable ? (
          <div className="flex flex-col gap-1 w-full h-full py-1">
            {(field.addressRows || 2) === 1 ? (
              <div className="flex gap-1 flex-1">
                <div className="flex-[2] rounded bg-primary/15 border border-dashed border-primary/40 flex items-center justify-center">
                  <span className="text-[10px] text-primary/70">Street</span>
                </div>
                <div className="flex-1 rounded bg-primary/15 border border-dashed border-primary/40 flex items-center justify-center">
                  <span className="text-[10px] text-primary/70">City</span>
                </div>
                <div className="flex-1 rounded bg-primary/15 border border-dashed border-primary/40 flex items-center justify-center">
                  <span className="text-[10px] text-primary/70">State</span>
                </div>
                <div className="flex-1 rounded bg-primary/15 border border-dashed border-primary/40 flex items-center justify-center">
                  <span className="text-[10px] text-primary/70">Zip</span>
                </div>
              </div>
            ) : (
              <>
                <div className="flex-1 rounded bg-primary/15 border border-dashed border-primary/40 flex items-center justify-center">
                  <span className="text-[10px] text-primary/70">Street Address</span>
                </div>
                <div className="flex gap-1 flex-1">
                  <div className="flex-1 rounded bg-primary/15 border border-dashed border-primary/40 flex items-center justify-center">
                    <span className="text-[10px] text-primary/70">City</span>
                  </div>
                  <div className="flex-1 rounded bg-primary/15 border border-dashed border-primary/40 flex items-center justify-center">
                    <span className="text-[10px] text-primary/70">State</span>
                  </div>
                  <div className="flex-1 rounded bg-primary/15 border border-dashed border-primary/40 flex items-center justify-center">
                    <span className="text-[10px] text-primary/70">Zip</span>
                  </div>
                </div>
              </>
            )}
          </div>
        ) : (
          <>
            {editable && <GripVertical className="h-3 w-3 opacity-50 flex-shrink-0" />}
            <Icon className="h-3.5 w-3.5 flex-shrink-0" />
            <span className="truncate">
              {field.required && editable && !isSelected && <span className="text-destructive font-bold">* </span>}
              {field.type === "checkbox" && (completed && field.value === "checked" ? "☑ " : "☐ ")}
              {completed && field.value && field.type !== "checkbox"
                ? (field.type === "signature" ? "✓ Firmado" : field.value)
                : `[${displayLabel}]`}
              {editable && field.defaultValue && !completed && (
                <span className="opacity-50 ml-1 text-[10px]">({field.defaultValue})</span>
              )}
            </span>
          </>
        )}
      </div>

      {editable && onResize && (
        <div
          className="absolute bottom-0 right-0 w-3 h-3 cursor-se-resize bg-primary/60 rounded-tl-sm hover:bg-primary"
          onPointerDown={handleResizePointerDown}
          style={{ touchAction: "none" }}
        />
      )}

      {selectedStyles && (
        <div className="absolute -bottom-9 left-1/2 -translate-x-1/2 flex items-center gap-1 z-10">
          {onOpenSettings && (
            <Button variant="outline" size="icon" className="h-7 w-7 rounded-full bg-background shadow-md border-border hover:bg-accent" onClick={(e) => { e.stopPropagation(); onOpenSettings(field); }} onPointerDown={(e) => e.stopPropagation()} title="Configuración">
              <Settings className="h-3.5 w-3.5" />
            </Button>
          )}
          {onDuplicate && (
            <Button variant="outline" size="icon" className="h-7 w-7 rounded-full bg-background shadow-md border-border hover:bg-accent" onClick={(e) => { e.stopPropagation(); onDuplicate(field.id); }} onPointerDown={(e) => e.stopPropagation()} title="Duplicar">
              <Copy className="h-3.5 w-3.5" />
            </Button>
          )}
          <Button variant="outline" size="icon" className="h-7 w-7 rounded-full bg-background shadow-md border-border hover:bg-destructive hover:text-destructive-foreground" onClick={(e) => { e.stopPropagation(); onRemove(field.id); }} onPointerDown={(e) => e.stopPropagation()} title="Eliminar">
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}
    </div>
  );
}
