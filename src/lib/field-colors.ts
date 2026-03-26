import { DocumentField } from "@/types/document";

export const FIELD_COLOR_PALETTE = [
  "border-primary bg-primary/10 text-primary",
  "border-secondary bg-secondary/10 text-secondary",
  "border-warning bg-warning/10 text-warning",
  "border-success bg-success/10 text-success",
  "border-destructive bg-destructive/10 text-destructive",
  "border-accent bg-accent/20 text-accent-foreground",
];

export function computeColorIndices(fields: DocumentField[]): Map<string, number> {
  const typeGroups = new Map<string, string[]>();
  for (const f of fields) {
    const gid = f.groupId || f.id;
    if (!typeGroups.has(f.type)) typeGroups.set(f.type, []);
    const list = typeGroups.get(f.type)!;
    if (!list.includes(gid)) list.push(gid);
  }
  const result = new Map<string, number>();
  for (const [, groupIds] of typeGroups) {
    if (groupIds.length < 2) continue;
    groupIds.forEach((gid, idx) => { result.set(gid, idx % FIELD_COLOR_PALETTE.length); });
  }
  return result;
}
