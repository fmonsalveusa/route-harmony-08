import { useState, useRef } from 'react';
import { Pencil, Trash2, RotateCcw, ChevronDown, ChevronRight, History, Gauge, DollarSign, Image, X, Check, Loader2, Camera } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DbTruckMaintenance } from '@/hooks/useTruckMaintenance';
import { useServiceLog, DbServiceLog } from '@/hooks/useServiceLog';
import { getMaintenanceTypeConfig, getStatusColor } from './maintenanceConstants';
import { formatDate } from '@/lib/dateUtils';
import { supabase } from '@/integrations/supabase/client';

interface AllServicesTableProps {
  items: DbTruckMaintenance[];
  getTruckLabel: (id: string) => string;
  onEdit: (item: DbTruckMaintenance) => void;
  onDelete: (id: string) => void;
  onLogService: (item: DbTruckMaintenance) => void;
  onViewHistory: (item: DbTruckMaintenance) => void;
}

function ServiceHistoryRow({ maintenanceId, onViewPhoto }: { maintenanceId: string; onViewPhoto: (url: string) => void }) {
  const { logs, isLoading, deleteLog, updateLog } = useServiceLog(maintenanceId);
  const [editingLog, setEditingLog] = useState<DbServiceLog | null>(null);
  const [editDate, setEditDate] = useState('');
  const [editMiles, setEditMiles] = useState('');
  const [editCost, setEditCost] = useState('');
  const [editVendor, setEditVendor] = useState('');
  const [editPhotoUrl, setEditPhotoUrl] = useState<string | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);

  const startEdit = (log: DbServiceLog) => {
    setEditingLog(log);
    setEditDate(log.performed_at);
    setEditMiles(String(log.odometer_miles));
    setEditCost(log.cost != null ? String(log.cost) : '');
    setEditVendor(log.vendor || '');
    setEditPhotoUrl((log as any).invoice_photo_url || null);
  };

  const handleSaveEdit = async () => {
    if (!editingLog) return;
    setSavingEdit(true);
    await updateLog(editingLog.id, {
      performed_at: editDate,
      odometer_miles: Number(editMiles) || 0,
      cost: editCost ? Number(editCost) : null,
      vendor: editVendor || null,
      invoice_photo_url: editPhotoUrl,
    });
    setSavingEdit(false);
    setEditingLog(null);
  };

  const handleDelete = async (logId: string) => {
    if (!confirm('¿Eliminar este registro de servicio?')) return;
    setDeletingId(logId);
    await deleteLog(logId);
    setDeletingId(null);
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingPhoto(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `maintenance/invoices/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
      const { error } = await supabase.storage.from('driver-documents').upload(path, file);
      if (error) throw error;
      const { data } = await supabase.storage.from('driver-documents').createSignedUrl(path, 31536000);
      setEditPhotoUrl(data?.signedUrl || null);
    } catch (e: any) {
      console.error('Upload error:', e);
    } finally {
      setUploadingPhoto(false);
    }
  };

  if (isLoading) {
    return (
      <TableRow>
        <TableCell colSpan={11} className="py-4 text-center text-muted-foreground text-xs">
          Loading history…
        </TableCell>
      </TableRow>
    );
  }

  if (logs.length === 0) {
    return (
      <TableRow>
        <TableCell colSpan={11} className="py-4 text-center text-muted-foreground text-xs">
          No service history recorded yet.
        </TableCell>
      </TableRow>
    );
  }

  return (
    <>
      {/* Edit Dialog */}
      <Dialog open={!!editingLog} onOpenChange={(open) => !open && setEditingLog(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Service Log</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Date</Label>
              <Input type="date" value={editDate} onChange={e => setEditDate(e.target.value)} />
            </div>
            <div>
              <Label>Odometer (miles)</Label>
              <Input type="number" value={editMiles} onChange={e => setEditMiles(e.target.value)} />
            </div>
            <div>
              <Label>Cost ($)</Label>
              <Input type="number" value={editCost} onChange={e => setEditCost(e.target.value)} placeholder="0.00" />
            </div>
            <div>
              <Label>Vendor</Label>
              <Input value={editVendor} onChange={e => setEditVendor(e.target.value)} />
            </div>
            <div>
              <Label>Invoice Photo</Label>
              {editPhotoUrl ? (
                <div className="flex items-center gap-2 mt-1">
                  <a href={editPhotoUrl} target="_blank" rel="noopener noreferrer">
                    <img src={editPhotoUrl} alt="Invoice" className="h-16 w-auto rounded border object-cover" />
                  </a>
                  <Button variant="ghost" size="icon" className="text-destructive" onClick={() => setEditPhotoUrl(null)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <Button variant="outline" size="sm" className="gap-2 mt-1" onClick={() => photoInputRef.current?.click()} disabled={uploadingPhoto}>
                  {uploadingPhoto ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Camera className="h-3.5 w-3.5" />}
                  {uploadingPhoto ? 'Uploading...' : 'Upload Photo'}
                </Button>
              )}
              <input ref={photoInputRef} type="file" accept="image/*,.pdf" className="hidden" onChange={handlePhotoUpload} />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setEditingLog(null)}>Cancel</Button>
            <Button onClick={handleSaveEdit} disabled={savingEdit}>
              {savingEdit ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {logs.map((log) => (
        <TableRow key={log.id} className="bg-muted/30">
          <TableCell className="py-1.5 pl-10 text-xs text-muted-foreground whitespace-nowrap">
            {formatDate(log.performed_at)}
          </TableCell>
          <TableCell className="py-1.5 text-xs text-muted-foreground" />
          <TableCell className="py-1.5 text-xs text-muted-foreground italic" colSpan={2}>
            <div className="flex items-center gap-1">
              <History className="h-3 w-3" />
              Service Log
            </div>
          </TableCell>
          <TableCell className="py-1.5" />
          <TableCell className="py-1.5 text-xs text-right tabular-nums text-muted-foreground">
            <span className="flex items-center justify-end gap-1">
              <Gauge className="h-3 w-3" />
              {Number(log.odometer_miles).toLocaleString()} mi
            </span>
          </TableCell>
          <TableCell className="py-1.5" />
          <TableCell className="py-1.5" />
          <TableCell className="py-1.5 text-xs text-right tabular-nums text-muted-foreground">
            {log.cost != null ? (
              <span className="flex items-center justify-end gap-1">
                <DollarSign className="h-3 w-3" />
                ${Number(log.cost).toFixed(2)}
              </span>
            ) : '—'}
          </TableCell>
          <TableCell className="py-1.5 text-xs text-muted-foreground">
            {log.vendor || '—'}
          </TableCell>
          <TableCell className="py-1.5">
            <div className="flex items-center gap-1">
              {(log as any).invoice_photo_url && (
                <Button variant="ghost" size="icon" className="h-6 w-6 text-blue-500" onClick={() => onViewPhoto((log as any).invoice_photo_url)} title="Ver factura">
                  <Image className="h-3 w-3" />
                </Button>
              )}
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => startEdit(log)} title="Editar">
                <Pencil className="h-3 w-3" />
              </Button>
              <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => handleDelete(log.id)} disabled={deletingId === log.id} title="Eliminar">
                {deletingId === log.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
              </Button>
            </div>
          </TableCell>
        </TableRow>
      ))}
    </>
  );
}

export function AllServicesTable({ items, getTruckLabel, onEdit, onDelete, onLogService, onViewHistory }: AllServicesTableProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);

  const sorted = [...items].sort((a, b) =>
    new Date(b.last_performed_at).getTime() - new Date(a.last_performed_at).getTime()
  );

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (sorted.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        No maintenance records match your filters.
      </div>
    );
  }

  return (
    <>
    <div className="rounded-md border overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Truck</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Description</TableHead>
            <TableHead>Recurring</TableHead>
            <TableHead className="text-right">Odometer</TableHead>
            <TableHead className="text-right">Miles Accum.</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Cost</TableHead>
            <TableHead>Vendor</TableHead>
            <TableHead className="w-[140px]" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.map((item) => {
            const config = getMaintenanceTypeConfig(item.maintenance_type);
            const Icon = config.icon;
            const isRecurring = !!(item.interval_miles || item.interval_days);
            const statusColor = getStatusColor(item.status);
            const isExpanded = expandedIds.has(item.id);

            return (
              <>
                <TableRow key={item.id}>
                  <TableCell className="py-2 text-sm whitespace-nowrap">
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5 shrink-0"
                        onClick={() => toggleExpand(item.id)}
                      >
                        {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                      </Button>
                      {new Date(item.last_performed_at).toLocaleDateString()}
                    </div>
                  </TableCell>
                  <TableCell className="py-2 text-sm font-medium whitespace-nowrap">
                    {getTruckLabel(item.truck_id)}
                  </TableCell>
                  <TableCell className="py-2">
                    <div className="flex items-center gap-2">
                      <Icon className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">{config.label}</span>
                    </div>
                  </TableCell>
                  <TableCell className="py-2 text-sm text-muted-foreground max-w-[180px] truncate">
                    {item.description || '—'}
                  </TableCell>
                  <TableCell className="py-2">
                    <Badge variant={isRecurring ? 'default' : 'secondary'} className="text-xs">
                      {isRecurring ? 'Yes' : 'No'}
                    </Badge>
                  </TableCell>
                  <TableCell className="py-2 text-sm text-right tabular-nums">
                    {item.last_miles.toLocaleString()} mi
                  </TableCell>
                  <TableCell className="py-2 text-sm text-right tabular-nums">
                    {isRecurring ? `${(item.miles_accumulated ?? 0).toLocaleString()} mi` : '—'}
                  </TableCell>
                  <TableCell className="py-2">
                    {isRecurring ? (
                      <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${statusColor.text}`}>
                        <span className={`h-2 w-2 rounded-full ${statusColor.dot}`} />
                        {item.status.toUpperCase()}
                      </span>
                    ) : '—'}
                  </TableCell>
                  <TableCell className="py-2 text-sm text-right tabular-nums">
                    {item.cost ? `$${item.cost.toLocaleString()}` : '—'}
                  </TableCell>
                  <TableCell className="py-2 text-sm text-muted-foreground">
                    {item.vendor || '—'}
                  </TableCell>
                  <TableCell className="py-2">
                    <div className="flex items-center gap-1">
                      {(item as any).invoice_photo_url && (
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-blue-500" onClick={() => setPhotoUrl((item as any).invoice_photo_url)} title="Ver factura">
                          <Image className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      {isRecurring && (
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onLogService(item)} title="Log Service">
                          <RotateCcw className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEdit(item)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => onDelete(item.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
                {isExpanded && <ServiceHistoryRow maintenanceId={item.id} onViewPhoto={setPhotoUrl} />}
              </>
            );
          })}
        </TableBody>
      </Table>
    </div>

    {/* Dialog para ver foto de factura */}
    <Dialog open={!!photoUrl} onOpenChange={(open) => !open && setPhotoUrl(null)}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Invoice Photo</DialogTitle>
        </DialogHeader>
        {photoUrl && (
          <div className="flex justify-center">
            {photoUrl.match(/\.(jpg|jpeg|png|gif|webp)$/i) || photoUrl.includes('image') ? (
              <img src={photoUrl} alt="Invoice" className="max-w-full max-h-[70vh] object-contain rounded" />
            ) : (
              <iframe src={photoUrl} className="w-full h-[70vh] rounded border" title="Invoice PDF" />
            )}
          </div>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setPhotoUrl(null)}>Cerrar</Button>
          {photoUrl && (
            <Button asChild>
              <a href={photoUrl} target="_blank" rel="noopener noreferrer">Abrir en nueva pestaña</a>
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
    </>
  );
}
