import { useState, useMemo, useEffect } from 'react';
import { useInvoices, Invoice } from '@/hooks/useInvoices';
import { useCompanies } from '@/hooks/useCompanies';
import { formatDate } from '@/lib/dateUtils';
import { generateInvoicePdf } from '@/lib/invoicePdf';
import { supabase } from '@/integrations/supabase/client';
import { StatusBadge } from '@/components/StatusBadge';
import { StatCard } from '@/components/StatCard';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { DispatchServiceTab } from '@/components/DispatchServiceTab';
import { toast } from 'sonner';

import { FileText, DollarSign, AlertTriangle, CheckCircle, Search, Trash2, Pencil, Download, Send, Image, ExternalLink, Mail, Loader2, ChevronDown } from 'lucide-react';
import type { PodDocument } from '@/hooks/usePodDocuments';

const Invoices = () => {
  const { invoices, loading, updateInvoice, deleteInvoice } = useInvoices();
  const { companies } = useCompanies();
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [editInvoice, setEditInvoice] = useState<Invoice | null>(null);
  const [editForm, setEditForm] = useState({ invoice_number: '', broker_name: '', amount: '', notes: '' });
  const [loadDataMap, setLoadDataMap] = useState<Record<string, any>>({});
  const [podViewLoadId, setPodViewLoadId] = useState<string | null>(null);
  const [podDocs, setPodDocs] = useState<PodDocument[]>([]);
  const [podLoading, setPodLoading] = useState(false);
  
  // Email state
  const [emailInvoice, setEmailInvoice] = useState<Invoice | null>(null);
  const [brokerEmail, setBrokerEmail] = useState('');
  const [sendingEmail, setSendingEmail] = useState(false);

  const openPodViewer = async (loadId: string) => {
    setPodViewLoadId(loadId);
    setPodLoading(true);
    const { data } = await supabase.from('pod_documents').select('*').eq('load_id', loadId).order('created_at');
    setPodDocs((data as PodDocument[]) || []);
    setPodLoading(false);
  };

  // Fetch load data for PDF generation
  useEffect(() => {
    const loadIds = [...new Set(invoices.map(i => i.load_id))];
    if (loadIds.length === 0) return;
    supabase.from('loads').select('id, reference_number, origin, destination, pickup_date, delivery_date, miles, total_rate, broker_client, pdf_url').in('id', loadIds).then(({ data }) => {
      if (data) {
        const map: Record<string, any> = {};
        data.forEach(l => { map[l.id] = l; });
        setLoadDataMap(map);
      }
    });
  }, [invoices]);

  const openEdit = (inv: Invoice) => {
    setEditInvoice(inv);
    setEditForm({ invoice_number: inv.invoice_number, broker_name: inv.broker_name, amount: String(inv.amount), notes: inv.notes || '' });
  };

  const handleSaveEdit = async () => {
    if (!editInvoice) return;
    await updateInvoice(editInvoice.id, {
      invoice_number: editForm.invoice_number,
      broker_name: editForm.broker_name,
      amount: Number(editForm.amount),
      notes: editForm.notes || null,
    });
    setEditInvoice(null);
  };

  const handleDownloadPdf = (inv: Invoice) => {
    const load = loadDataMap[inv.load_id];
    const company = companies.length > 0 ? (inv.company_id ? companies.find(c => c.id === inv.company_id) || companies[0] : companies[0]) : null;
    generateInvoicePdf({
      invoiceNumber: inv.invoice_number,
      brokerName: inv.broker_name,
      loadRef: load?.reference_number || inv.invoice_number,
      origin: load?.origin || '',
      destination: load?.destination || '',
      pickupDate: load?.pickup_date || null,
      deliveryDate: load?.delivery_date || null,
      miles: load?.miles ? Number(load.miles) : null,
      totalRate: Number(inv.amount),
      company: company || null,
      createdAt: inv.created_at,
    });
  };

  const handleSendEmail = async () => {
    if (!emailInvoice || !brokerEmail) return;
    setSendingEmail(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-invoice-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ invoiceId: emailInvoice.id, brokerEmail }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Error sending email');
      toast.success(`Email enviado a ${brokerEmail}`);
      setEmailInvoice(null);
      setBrokerEmail('');
    } catch (e: any) {
      toast.error(e.message || 'Error enviando email');
    } finally {
      setSendingEmail(false);
    }
  };

  const filtered = useMemo(() => {
    let result = invoices;
    if (statusFilter !== 'all') result = result.filter(i => i.status === statusFilter);
    if (search) result = result.filter(i =>
      i.invoice_number.toLowerCase().includes(search.toLowerCase()) ||
      i.broker_name.toLowerCase().includes(search.toLowerCase()) ||
      (i.company_name || '').toLowerCase().includes(search.toLowerCase())
    );
    return result;
  }, [invoices, statusFilter, search]);

  const pending = invoices.filter(i => i.status === 'pending');
  const sent = invoices.filter(i => i.status === 'sent');
  const paid = invoices.filter(i => i.status === 'paid');
  const totalPending = pending.reduce((s, i) => s + Number(i.amount), 0);
  const totalPaid = paid.reduce((s, i) => s + Number(i.amount), 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-header">Facturación</h1>
        <p className="page-description">Gestión de facturas</p>
      </div>

      <Tabs defaultValue="broker" className="w-full">
        <TabsList>
          <TabsTrigger value="broker">Broker Invoices</TabsTrigger>
          <TabsTrigger value="dispatch_service">Dispatch Service</TabsTrigger>
        </TabsList>

        <TabsContent value="broker">
        <div className="space-y-6">

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <StatCard title="Pendientes" value={`$${totalPending.toLocaleString()}`} icon={AlertTriangle} iconClassName="bg-warning/10 text-warning" />
        <StatCard title="Enviadas" value={sent.length} icon={Send} iconClassName="bg-info/10 text-info" />
        <StatCard title="Cobradas" value={`$${totalPaid.toLocaleString()}`} icon={CheckCircle} iconClassName="bg-success/10 text-success" />
        <StatCard title="Total Facturas" value={invoices.length} icon={FileText} />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search by number, broker or company..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="sent">Sent</SelectItem>
            <SelectItem value="paid">Paid</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="glass-card overflow-hidden">
        <div className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-[15px]">
              <thead><tr className="border-b glass-table-header">
                <th className="text-left p-3 font-medium text-muted-foreground">Invoice #</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Broker</th>
                <th className="text-left p-3 font-medium text-muted-foreground hidden md:table-cell">Company</th>
                <th className="text-right p-3 font-medium text-muted-foreground">Amount</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Status</th>
                <th className="text-left p-3 font-medium text-muted-foreground hidden lg:table-cell">Date</th>
                <th className="text-right p-3 font-medium text-muted-foreground">Actions</th>
              </tr></thead>
              <tbody>
                {filtered.length === 0 && !loading && (
                  <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">
                    {invoices.length === 0 ? 'No invoices generated. Generate one from the Loads page.' : 'No results found.'}
                  </td></tr>
                )}
                {filtered.map(inv => (
                  <tr key={inv.id} className="border-b last:border-0 glass-row">
                    <td className="p-3 font-medium text-primary">{inv.invoice_number}</td>
                    <td className="p-3">{inv.broker_name}</td>
                    <td className="p-3 hidden md:table-cell text-muted-foreground">{inv.company_name || '—'}</td>
                    <td className="p-3 text-right font-semibold">${Number(inv.amount).toLocaleString()}</td>
                    <td className="p-3">
                      <Select value={inv.status} onValueChange={val => updateInvoice(inv.id, { status: val })}>
                        <SelectTrigger className="h-8 w-[155px] border-0 p-0 shadow-none focus:ring-0 [&>svg]:hidden bg-transparent">
                          <span className="flex items-center justify-between w-full gap-1">
                            <StatusBadge status={`invoice_${inv.status}`} className="text-[11px] px-3 py-1.5" />
                            <span className="inline-flex h-5 w-5 items-center justify-center rounded border border-border bg-muted/40 text-muted-foreground ml-auto">
                              <ChevronDown className="h-3 w-3 shrink-0" />
                            </span>
                          </span>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pending"><StatusBadge status="invoice_pending" /></SelectItem>
                          <SelectItem value="sent"><StatusBadge status="invoice_sent" /></SelectItem>
                          <SelectItem value="paid"><StatusBadge status="invoice_paid" /></SelectItem>
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="p-3 hidden lg:table-cell text-muted-foreground">{formatDate(inv.created_at)}</td>
                    <td className="p-3 text-right">
                      <div className="flex justify-end gap-1.5">
                        <button className="glass-action-btn tint-green inline-flex items-center" onClick={() => handleDownloadPdf(inv)} title="PDF">
                          <Download className="h-4 w-4" /> PDF
                        </button>
                        {loadDataMap[inv.load_id]?.pdf_url && (
                          <a className="glass-action-btn tint-blue inline-flex items-center" href={loadDataMap[inv.load_id].pdf_url} target="_blank" rel="noopener noreferrer" title="Rate Conf.">
                            <FileText className="h-4 w-4" /> Rate
                          </a>
                        )}
                        <button className="glass-action-btn tint-purple inline-flex items-center" onClick={() => openPodViewer(inv.load_id)} title="PODs">
                          <Image className="h-4 w-4" /> POD
                        </button>
                        <button className="glass-action-btn tint-blue inline-flex items-center" onClick={() => { setEmailInvoice(inv); setBrokerEmail(''); }} title="Enviar por Email">
                          <Mail className="h-4 w-4" /> Mail
                        </button>
                        <button className="glass-action-btn tint-amber inline-flex items-center" onClick={() => openEdit(inv)} title="Edit">
                          <Pencil className="h-4 w-4" /> Edit
                        </button>
                        <button className="glass-action-btn tint-red inline-flex items-center" onClick={async () => { if (window.confirm(`¿Eliminar factura ${inv.invoice_number}? Esta acción es permanente.`)) { await deleteInvoice(inv.id); } }} title="Delete">
                          <Trash2 className="h-4 w-4" /> Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* POD Viewer Dialog */}
      <Dialog open={!!podViewLoadId} onOpenChange={() => setPodViewLoadId(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Image className="h-5 w-5" /> Proof of Delivery (POD)
            </DialogTitle>
          </DialogHeader>
          {podLoading ? (
            <p className="text-center text-muted-foreground py-8">Cargando documentos...</p>
          ) : podDocs.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No hay PODs cargados para esta carga.</p>
          ) : (
            <div className="grid gap-4">
              {podDocs.map(pod => (
                <div key={pod.id} className="flex items-center gap-4 p-3 rounded-lg border bg-muted/30">
                  {pod.file_type === 'image' ? (
                    <img src={pod.file_url} alt={pod.file_name} className="w-20 h-20 object-cover rounded-md border" />
                  ) : (
                    <div className="w-20 h-20 flex items-center justify-center rounded-md border bg-muted">
                      <FileText className="h-8 w-8 text-muted-foreground" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{pod.file_name}</p>
                    <p className="text-xs text-muted-foreground">{formatDate(pod.created_at)}</p>
                  </div>
                  <div className="flex gap-1.5">
                    <Button variant="outline" size="sm" className="h-8 px-2 text-xs border-sky-400 bg-white text-sky-600 hover:bg-sky-50 hover:text-sky-700 gap-1" asChild title="View">
                      <a href={pod.file_url} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-4 w-4" /> View
                      </a>
                    </Button>
                    <Button variant="outline" size="sm" className="h-8 px-2 text-xs border-emerald-400 bg-white text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700 gap-1" asChild title="Download">
                      <a href={pod.file_url} download={pod.file_name}>
                        <Download className="h-4 w-4" /> Download
                      </a>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editInvoice} onOpenChange={() => setEditInvoice(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Editar Invoice</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div><Label>Invoice #</Label><Input value={editForm.invoice_number} onChange={e => setEditForm(f => ({ ...f, invoice_number: e.target.value }))} /></div>
            <div><Label>Broker</Label><Input value={editForm.broker_name} onChange={e => setEditForm(f => ({ ...f, broker_name: e.target.value }))} /></div>
            <div><Label>Monto</Label><Input type="number" value={editForm.amount} onChange={e => setEditForm(f => ({ ...f, amount: e.target.value }))} /></div>
            <div><Label>Notas</Label><Input value={editForm.notes} onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditInvoice(null)}>Cancelar</Button>
            <Button onClick={handleSaveEdit}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Email Dialog */}
      <Dialog open={!!emailInvoice} onOpenChange={() => setEmailInvoice(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" /> Enviar Factura por Email
            </DialogTitle>
          </DialogHeader>
          {emailInvoice && (
            <div className="grid gap-4 py-2">
              <div className="text-sm space-y-1">
                <p><span className="font-medium">Invoice:</span> {emailInvoice.invoice_number}</p>
                <p><span className="font-medium">Broker:</span> {emailInvoice.broker_name}</p>
                <p><span className="font-medium">Monto:</span> ${Number(emailInvoice.amount).toLocaleString()}</p>
              </div>
              <div className="text-xs text-muted-foreground bg-muted/50 p-2 rounded">
                Se adjuntará: Invoice PDF, Rate Confirmation y PODs (si existen).
              </div>
              <div>
                <Label>Email del Broker</Label>
                <Input type="email" placeholder="broker@example.com" value={brokerEmail} onChange={e => setBrokerEmail(e.target.value)} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEmailInvoice(null)} disabled={sendingEmail}>Cancelar</Button>
            <Button onClick={handleSendEmail} disabled={sendingEmail || !brokerEmail}>
              {sendingEmail ? <><Loader2 className="h-4 w-4 animate-spin mr-1" /> Enviando...</> : <><Send className="h-4 w-4 mr-1" /> Enviar</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
        </div>
        </TabsContent>

        <TabsContent value="dispatch_service">
          <DispatchServiceTab />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Invoices;
