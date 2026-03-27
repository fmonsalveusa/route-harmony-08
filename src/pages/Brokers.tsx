import { useState } from 'react';
import { useBrokers, Broker } from '@/hooks/useBrokers';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Search, Pencil, Handshake, Loader2, Globe, Trash2, Plus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const ratingColors: Record<string, string> = {
  A: 'bg-success text-success-foreground',
  B: 'bg-success text-success-foreground',
  C: 'bg-success text-success-foreground',
  D: 'bg-warning text-warning-foreground',
  N: 'bg-orange-500 text-white',
  E: 'bg-destructive text-destructive-foreground',
  F: 'bg-black text-white',
};

const factoringLabel = (rating: string | null) => {
  if (!rating) return null;
  const upper = rating.toUpperCase();
  if (upper === 'F') return { text: 'NO USAR', class: 'bg-black/20 text-black dark:text-white border-black/30' };
  if (['A', 'B', 'C'].includes(upper)) return { text: 'FACTORING', class: 'bg-success/20 text-success border-success/30' };
  return { text: 'COBRO DIRECTO', class: 'bg-destructive/20 text-destructive border-destructive/30' };
};

export default function Brokers() {
  const { brokers, isLoading, updateBroker, deleteBroker, createBroker } = useBrokers();
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const [editBroker, setEditBroker] = useState<Broker | null>(null);
  const [deletingBroker, setDeletingBroker] = useState<Broker | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', mc_number: '', dot_number: '', address: '', rating: '', days_to_pay: '', notes: '' });
  const [lookingUp, setLookingUp] = useState(false);
  const [bulkProgress, setBulkProgress] = useState<{ current: number; total: number } | null>(null);

  const filtered = brokers.filter(b => {
    const q = search.toLowerCase();
    return b.name.toLowerCase().includes(q) || (b.mc_number || '').toLowerCase().includes(q);
  });

  const openEdit = (broker: Broker) => {
    setEditBroker(broker);
    setForm({
      name: broker.name,
      mc_number: broker.mc_number || '',
      dot_number: broker.dot_number || '',
      address: broker.address || '',
      rating: broker.rating || '',
      days_to_pay: broker.days_to_pay?.toString() || '',
      notes: broker.notes || '',
    });
  };

  const openCreate = () => {
    setShowCreate(true);
    setForm({ name: '', mc_number: '', dot_number: '', address: '', rating: '', days_to_pay: '', notes: '' });
  };

  const handleFmcsaLookup = async () => {
    if (!editBroker) return;
    setLookingUp(true);
    try {
      const { data, error } = await supabase.functions.invoke('lookup-broker-mc', {
        body: { broker_name: editBroker.name },
      });
      if (error) throw error;
      if (data?.mc_number) setForm(f => ({ ...f, mc_number: data.mc_number }));
      if (data?.dot_number) setForm(f => ({ ...f, dot_number: data.dot_number }));
      if (data?.address) setForm(f => ({ ...f, address: data.address }));
      if (!data?.mc_number && !data?.dot_number) {
        toast({ title: 'Sin resultados', description: 'No se encontró información en FMCSA para este broker' });
      } else {
        toast({ title: 'Datos encontrados', description: 'MC#, DOT# y dirección auto-rellenados desde FMCSA' });
      }
    } catch {
      toast({ title: 'Error', description: 'No se pudo consultar FMCSA', variant: 'destructive' });
    } finally {
      setLookingUp(false);
    }
  };

  const handleRatingChange = (value: string) => {
    if (value === 'F') {
      setForm(f => ({ ...f, rating: value, notes: f.notes || 'NO USAR' }));
    } else if (value === 'N') {
      setForm(f => ({ ...f, rating: value, notes: f.notes || 'COBRO DIRECTO' }));
    } else {
      setForm(f => ({ ...f, rating: value }));
    }
  };

  const handleInlineRatingChange = (brokerId: string, value: string) => {
    const updates: any = { id: brokerId, rating: value || null };
    if (value === 'F') updates.notes = 'NO USAR';
    if (value === 'N') updates.notes = 'COBRO DIRECTO';
    updateBroker.mutate(updates);
  };

  const handleSave = () => {
    if (!editBroker) return;
    updateBroker.mutate({
      id: editBroker.id,
      mc_number: form.mc_number || null,
      dot_number: form.dot_number || null,
      address: form.address || null,
      rating: form.rating || null,
      days_to_pay: form.days_to_pay ? parseInt(form.days_to_pay) : null,
      notes: form.notes || null,
    });
    setEditBroker(null);
  };

  const handleDelete = () => {
    if (!deletingBroker) return;
    deleteBroker.mutate(deletingBroker.id);
    setDeletingBroker(null);
  };

  const handleBulkFmcsaLookup = async () => {
    const pending = brokers.filter(b => !b.mc_number && !b.dot_number);
    if (pending.length === 0) {
      toast({ title: 'Todos actualizados', description: 'Todos los brokers ya tienen MC# o DOT#' });
      return;
    }
    setBulkProgress({ current: 0, total: pending.length });
    let updated = 0;
    for (let i = 0; i < pending.length; i++) {
      setBulkProgress({ current: i + 1, total: pending.length });
      if (i > 0) await new Promise(r => setTimeout(r, 1500));
      try {
        const { data, error } = await supabase.functions.invoke('lookup-broker-mc', {
          body: { broker_name: pending[i].name },
        });
        if (error) continue;
        if (data?.mc_number || data?.dot_number || data?.address) {
          await supabase
            .from('brokers' as any)
            .update({
              ...(data.mc_number ? { mc_number: data.mc_number } : {}),
              ...(data.dot_number ? { dot_number: data.dot_number } : {}),
              ...(data.address ? { address: data.address } : {}),
            } as any)
            .eq('id', pending[i].id);
          updated++;
        }
      } catch { /* skip */ }
    }
    setBulkProgress(null);
    toast({ title: 'Búsqueda masiva completada', description: `${updated} de ${pending.length} brokers actualizados desde FMCSA` });
    window.location.reload();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <Handshake className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold text-foreground">Brokers</h1>
          <Badge variant="secondary" className="text-xs">{brokers.length}</Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={handleBulkFmcsaLookup}
            disabled={!!bulkProgress}
          >
            {bulkProgress ? <Loader2 className="h-4 w-4 animate-spin" /> : <Globe className="h-4 w-4" />}
            {bulkProgress
              ? `Buscando ${bulkProgress.current}/${bulkProgress.total}...`
              : 'Actualizar todos desde FMCSA'}
          </Button>
          <div className="relative w-full max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nombre o MC#..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>
      </div>

      <div className="rounded-lg border bg-card overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Broker</TableHead>
              <TableHead>MC#</TableHead>
              <TableHead>DOT#</TableHead>
              <TableHead>Dirección</TableHead>
              <TableHead>Rating</TableHead>
              <TableHead>Factoring</TableHead>
              <TableHead className="text-right">Días de Pago</TableHead>
              <TableHead className="text-right">Cargas</TableHead>
              <TableHead>Notas</TableHead>
              <TableHead className="w-20"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={10} className="text-center py-8 text-muted-foreground">Cargando...</TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={10} className="text-center py-8 text-muted-foreground">No se encontraron brokers</TableCell></TableRow>
            ) : (
              filtered.map(broker => {
                const fl = factoringLabel(broker.rating);
                const isF = broker.rating?.toUpperCase() === 'F';
                return (
                  <TableRow key={broker.id} className={`hover:bg-muted/50 ${isF ? 'opacity-60' : ''}`}>
                    <TableCell className="font-medium">{broker.name}</TableCell>
                    <TableCell className="text-muted-foreground">{broker.mc_number || '—'}</TableCell>
                    <TableCell className="text-muted-foreground">{broker.dot_number || '—'}</TableCell>
                    <TableCell className="max-w-[350px] text-muted-foreground text-xs whitespace-normal">{broker.address || '—'}</TableCell>
                    <TableCell>
                      <Select
                        value={broker.rating?.toUpperCase() || ''}
                        onValueChange={v => handleInlineRatingChange(broker.id, v)}
                      >
                        <SelectTrigger className={`w-16 h-7 text-xs font-bold ${broker.rating ? (ratingColors[broker.rating.toUpperCase()] || '') : ''}`}>
                          <SelectValue placeholder="—" />
                        </SelectTrigger>
                        <SelectContent>
                          {['A', 'B', 'C', 'D', 'N', 'E', 'F'].map(r => (
                            <SelectItem key={r} value={r}>
                              <span className="font-bold">{r}</span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      {fl ? (
                        <Badge variant="outline" className={`text-[10px] ${fl.class}`}>{fl.text}</Badge>
                      ) : <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell className="text-right">{broker.days_to_pay ?? '—'}</TableCell>
                    <TableCell className="text-right font-medium">{broker.loads_count}</TableCell>
                    <TableCell className="max-w-[200px] truncate text-muted-foreground text-xs">{broker.notes || '—'}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(broker)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => setDeletingBroker(broker)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Edit Dialog */}
      <Dialog open={!!editBroker} onOpenChange={open => !open && setEditBroker(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Editar Broker: {editBroker?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Button
              type="button"
              variant="outline"
              className="w-full gap-2"
              onClick={handleFmcsaLookup}
              disabled={lookingUp}
            >
              {lookingUp ? <Loader2 className="h-4 w-4 animate-spin" /> : <Globe className="h-4 w-4" />}
              {lookingUp ? 'Buscando en FMCSA...' : 'Buscar en FMCSA'}
            </Button>
            <div>
              <Label>MC#</Label>
              <Input value={form.mc_number} onChange={e => setForm(f => ({ ...f, mc_number: e.target.value }))} placeholder="MC Number" />
            </div>
            <div>
              <Label>DOT#</Label>
              <Input value={form.dot_number} onChange={e => setForm(f => ({ ...f, dot_number: e.target.value }))} placeholder="DOT Number" />
            </div>
            <div>
              <Label>Dirección</Label>
              <Input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} placeholder="Dirección física" />
            </div>
            <div>
              <Label>Rating (RTS Score)</Label>
              <Select value={form.rating} onValueChange={handleRatingChange}>
                <SelectTrigger className={form.rating === 'F' ? 'bg-black text-white' : ''}>
                  <SelectValue placeholder="Seleccionar rating" />
                </SelectTrigger>
                <SelectContent>
                  {['A', 'B', 'C', 'D', 'N', 'E', 'F'].map(r => (
                    <SelectItem key={r} value={r}>{r}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Días de Pago</Label>
              <Input type="number" value={form.days_to_pay} onChange={e => setForm(f => ({ ...f, days_to_pay: e.target.value }))} placeholder="30" />
            </div>
            <div>
              <Label>Notas</Label>
              <Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditBroker(null)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={updateBroker.isPending}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deletingBroker} onOpenChange={open => !open && setDeletingBroker(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar broker?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará permanentemente el broker <strong>{deletingBroker?.name}</strong>. Esta acción no se puede deshacer.
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
    </div>
  );
}