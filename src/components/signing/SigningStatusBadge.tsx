import { DocumentStatus } from "@/types/document";

const config: Record<DocumentStatus, { label: string; className: string }> = {
  signed: { label: "Firmado", className: "bg-primary text-primary-foreground" },
  pending: { label: "Pendiente", className: "bg-[hsl(var(--warning-bg))] text-[hsl(var(--warning-foreground))]" },
  expired: { label: "Expirado", className: "bg-[hsl(var(--danger-bg))] text-[hsl(var(--danger-text))]" },
};

export default function SigningStatusBadge({ status }: { status: DocumentStatus }) {
  const c = config[status];
  return (
    <span className={`inline-flex items-center rounded-full px-3 py-0.5 text-xs font-medium ${c.className}`}>
      {c.label}
    </span>
  );
}
