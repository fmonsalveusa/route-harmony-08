import { useState, useEffect, useMemo } from 'react';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear, isWithinInterval, parseISO } from 'date-fns';
import { formatDate } from '@/lib/dateUtils';
import { usePayments, type DbPayment } from '@/hooks/usePayments';
import { StatTiles, SolidStatusPill, PILL_INPUT, TABLE_CARD, TABLE_HEAD_ROW, TABLE_ROW } from '@/components/StatTiles';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { PaymentEditDialog } from '@/components/PaymentEditDialog';
import { Input } from '@/components/ui/input';
import { DollarSign, CheckCircle, Clock, Download, Pencil, Trash2, FileText, CheckCheck, X, PlusCircle, Search, ChevronDown } from 'lucide-react';

const PAYMENT_STATUS: Record<string, { label: string; color: string; border: string }> = {
  pending: { label: 'Pending', color: 'bg-amber-500', border: 'border-l-amber-500' },
  in_process: { label: 'In Process', color: 'bg-blue-600', border: 'border-l-blue-600' },
  paid: { label: 'Paid', color: 'bg-green-600', border: 'border-l-green-600' },
};
const paymentPill = (status: string) => (
  <SolidStatusPill label={PAYMENT_STATUS[status]?.label ?? status} color={PAYMENT_STATUS[status]?.color ?? 'bg-gray-500'} />
);
import { generatePaymentReceipt, type DispatcherLoadItem } from '@/lib/paymentReceipt';
import { sendReceiptWhatsApp, type ReceiptSendResult } from '@/lib/sendReceiptWhatsApp';
import { generateBatchPaymentReceipt } from '@/lib/batchPaymentReceipt';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

import { ManualDispatcherPaymentDialog } from '@/components/ManualDispatcherPaymentDialog';
import { ManualPaymentDialog } from '@/components/ManualPaymentDialog';
import { RecurringDeductionDialog } from '@/components/RecurringDeductionDialog';
import { AnnualPaymentsReportDialog } from '@/components/AnnualPaymentsReportDialog';
import { RefreshCw } from 'lucide-react';

const handleGenerateReceipt = async (p: DbPayment, options?: { save?: boolean }) => {
  const { data } = await supabase.from('payment_adjustments').select('*').eq('payment_id', p.id).order('created_at', { ascending: true });
  const adjustments = (data as any[]) || [];
  const totalAdj = adjustments.reduce((sum: number, a: any) => sum + (a.adjustment_type === 'addition' ? Number(a.amount) : -Number(a.amount)), 0);

  // For dispatcher payments, fetch load item details
  let dispatcherItems: DispatcherLoadItem[] | undefined;
  let loadOrigin: string | undefined;
  let loadDestination: string | undefined;
  let companyName: string | undefined;

  if (p.recipient_type === 'dispatcher') {
    const { data: items } = await supabase
      .from('dispatcher_payment_items')
      .select('load_id, load_reference, total_rate, percentage_applied, amount')
      .eq('payment_id', p.id);

    if (items && items.length > 0) {
      const loadIds = (items as any[]).map((i: any) => i.load_id);
      const { data: loads } = await supabase
        .from('loads')
        .select('id, origin, destination, company_id')
        .in('id', loadIds);

      const loadMap: Record<string, { origin: string; destination: string }> = {};
      (loads as any[] || []).forEach((l: any) => { loadMap[l.id] = { origin: l.origin, destination: l.destination }; });

      // Get company from first load with a company_id
      const firstCompanyId = (loads as any[] || []).find((l: any) => l.company_id)?.company_id;
      if (firstCompanyId) {
        const { data: comp } = await supabase.from('companies').select('name').eq('id', firstCompanyId).maybeSingle();
        if (comp) companyName = (comp as any).name;
      }

      dispatcherItems = (items as any[]).map((i: any) => ({
        load_reference: i.load_reference,
        origin: loadMap[i.load_id]?.origin || '—',
        destination: loadMap[i.load_id]?.destination || '—',
        total_rate: i.total_rate,
        percentage_applied: i.percentage_applied,
        amount: i.amount,
      }));
    }
  } else {
    // For driver/investor payments, fetch origin/destination + dates from the load
    const { data: load } = await supabase
      .from('loads')
      .select('origin, destination, pickup_date, delivery_date, company_id')
      .eq('id', p.load_id)
      .maybeSingle();
    if (load) {
      loadOrigin = (load as any).origin;
      loadDestination = (load as any).destination;
      if ((load as any).company_id) {
        const { data: comp } = await supabase.from('companies').select('name').eq('id', (load as any).company_id).maybeSingle();
        if (comp) companyName = (comp as any).name;
      }
    }
    return generatePaymentReceipt(p, adjustments, totalAdj, Number(p.amount) + totalAdj, dispatcherItems, loadOrigin, loadDestination, (load as any)?.pickup_date, (load as any)?.delivery_date, companyName, options);
  }

  return generatePaymentReceipt(p, adjustments, totalAdj, Number(p.amount) + totalAdj, dispatcherItems, undefined, undefined, undefined, undefined, companyName, options);
};

interface PaymentsSectionProps {
  type: 'driver' | 'investor' | 'dispatcher';
  refreshKey?: number;
  onCreateManual?: () => void;
  createLabel?: string;
}

const PaymentsSection = ({ type, refreshKey, onCreateManual, createLabel = 'Create Manual Payment' }: PaymentsSectionProps) => {
  const { payments: allPayments, loading, updatePaymentStatus, refetch } = usePayments();
  const [statusFilter, setStatusFilter] = useState('pending');
  const [editPayment, setEditPayment] = useState<DbPayment | null>(null);
  const [deletePaymentId, setDeletePaymentId] = useState<string | null>(null);
  
  const [adjMap, setAdjMap] = useState<Record<string, number>>({});
  const [adjRefresh, setAdjRefresh] = useState(0);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [batchProcessing, setBatchProcessing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [beneficiaryFilter, setBeneficiaryFilter] = useState('all');
  const [weekFilter, setWeekFilter] = useState('all');
  const [monthFilter, setMonthFilter] = useState('all');
  const [yearFilter, setYearFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Fetch adjustments en chunks de 100 para evitar límite de URL de PostgREST
  const doFetchAdjustments = async () => {
    const ids = allPayments.filter(p => p.recipient_type === type).map(p => p.id);
    if (ids.length === 0) return;

    const chunkSize = 100;
    const allData: any[] = [];

    for (let i = 0; i < ids.length; i += chunkSize) {
      const chunk = ids.slice(i, i + chunkSize);
      const { data } = await supabase
        .from('payment_adjustments' as any)
        .select('payment_id, adjustment_type, amount')
        .in('payment_id', chunk);
      if (data) allData.push(...(data as any[]));
    }

    const map: Record<string, number> = {};
    allData.forEach(a => {
      const val = a.adjustment_type === 'addition' ? Number(a.amount) : -Number(a.amount);
      map[a.payment_id] = (map[a.payment_id] || 0) + val;
    });
    setAdjMap(map);
  };

  useEffect(() => {
    if (allPayments.length > 0) doFetchAdjustments();
  }, [allPayments, adjRefresh, type]);

  // Build date map from payment created_at (payments are generated when load is marked delivered)
  const paymentDateMap = useMemo(() => {
    const map: Record<string, string> = {};
    allPayments.filter(p => p.recipient_type === type).forEach(p => {
      map[p.id] = p.created_at;
    });
    return map;
  }, [allPayments, type]);
  useEffect(() => { setSelectedIds(new Set()); }, [statusFilter, beneficiaryFilter, weekFilter, monthFilter, yearFilter, dateFrom, dateTo]);
  useEffect(() => { if (refreshKey && refreshKey > 0) refetch(); }, [refreshKey, refetch]);

  const allTypePayments = allPayments.filter(p => p.recipient_type === type);

  const uniqueBeneficiaries = useMemo(() => {
    const names = [...new Set(allTypePayments.map(p => p.recipient_name))];
    return names.sort();
  }, [allTypePayments]);

  const getISOWeek = (d: Date) => {
    const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
    return Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  };

  const dateOptions = useMemo(() => {
    const dates = allTypePayments
      .map(p => paymentDateMap[p.id])
      .filter(Boolean)
      .map(d => parseISO(d));
    
    const weeks = new Set<string>();
    const months = new Set<string>();
    const years = new Set<string>();

    dates.forEach(d => {
      weeks.add(`${d.getFullYear()}-W${String(getISOWeek(d)).padStart(2, '0')}`);
      months.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
      years.add(String(d.getFullYear()));
    });

    return {
      weeks: [...weeks].sort().reverse(),
      months: [...months].sort().reverse(),
      years: [...years].sort().reverse(),
    };
  }, [allTypePayments, paymentDateMap]);

  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  const filteredPayments = useMemo(() => {
    let result = statusFilter === 'all' ? allTypePayments : allTypePayments.filter(p => p.status === statusFilter);

    if (beneficiaryFilter !== 'all') {
      result = result.filter(p => p.recipient_name === beneficiaryFilter);
    }

    if (weekFilter !== 'all' || monthFilter !== 'all' || yearFilter !== 'all' || dateFrom || dateTo) {
      result = result.filter(p => {
        const dateStr = paymentDateMap[p.id];
        if (!dateStr) return false;
        const d = parseISO(dateStr);

        if (yearFilter !== 'all' && String(d.getFullYear()) !== yearFilter) return false;
        if (monthFilter !== 'all') {
          const m = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
          if (m !== monthFilter) return false;
        }
        if (weekFilter !== 'all') {
          const w = `${d.getFullYear()}-W${String(getISOWeek(d)).padStart(2, '0')}`;
          if (w !== weekFilter) return false;
        }
        if (dateFrom && dateStr < dateFrom) return false;
        if (dateTo && dateStr > dateTo) return false;
        return true;
      });
    }

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter(p =>
        p.load_reference.toLowerCase().includes(q) ||
        p.recipient_name.toLowerCase().includes(q)
      );
    }

    // Paid: más recientes primero por payment_date. Resto: ascendente
    if (statusFilter === 'paid') {
      result.sort((a, b) => {
        const dateA = a.payment_date ? new Date(a.payment_date).getTime() : 0;
        const dateB = b.payment_date ? new Date(b.payment_date).getTime() : 0;
        return dateB - dateA;
      });
    } else {
      result.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    }
    return result;
  }, [allTypePayments, statusFilter, beneficiaryFilter, weekFilter, monthFilter, yearFilter, dateFrom, dateTo, paymentDateMap, searchQuery]);

  const payments = filteredPayments;

  const pendingCount = allTypePayments.filter(p => p.status === 'pending').length;
  const inProcessCount = allTypePayments.filter(p => p.status === 'in_process').length;
  const paidCount = allTypePayments.filter(p => p.status === 'paid').length;

  const totalPending = allTypePayments.filter(p => p.status === 'pending' || p.status === 'in_process').reduce((s, p) => s + Number(p.amount) + (adjMap[p.id] || 0), 0);
  const totalPaid = allTypePayments.filter(p => p.status === 'paid').reduce((s, p) => s + Number(p.amount) + (adjMap[p.id] || 0), 0);

  const hasActiveFilters = beneficiaryFilter !== 'all' || weekFilter !== 'all' || monthFilter !== 'all' || yearFilter !== 'all' || dateFrom || dateTo;

  const clearFilters = () => {
    setBeneficiaryFilter('all');
    setWeekFilter('all');
    setMonthFilter('all');
    setYearFilter('all');
    setDateFrom('');
    setDateTo('');
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === payments.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(payments.map(p => p.id)));
    }
  };

  const selectedPayments = payments.filter(p => selectedIds.has(p.id));
  // Normalize names: trim + lowercase so minor spacing/casing differences don't break grouping.
  // Also note: investor payments store driver.id as recipient_id, so we always compare by name.
  const selectedNamesNormalized = selectedPayments.map(p => (p.recipient_name || '').trim().toLowerCase());
  const uniqueSelectedNames = [...new Set(selectedPayments.map(p => p.recipient_name || ''))];
  const canBatchPay = selectedPayments.length > 0 && new Set(selectedNamesNormalized).size === 1;
  const selectedTotal = selectedPayments.reduce((s, p) => s + Number(p.amount) + (adjMap[p.id] || 0), 0);

  const notifyReceiptResult = (result: ReceiptSendResult) => {
    if (result === 'disabled') return;
    if (result === 'sent') toast({ title: 'Recibo enviado por WhatsApp' });
    else if (result === 'no_group') toast({ title: 'Sin grupo de WhatsApp', description: 'El beneficiario no tiene grupo asignado; no se envió el recibo.' });
    else toast({ title: 'No se pudo enviar el recibo por WhatsApp', variant: 'destructive' });
  };

  // Al pasar un pago a Paid se envía el recibo al grupo de WhatsApp del beneficiario
  const handleStatusChange = async (p: DbPayment, status: string) => {
    const ok = await updatePaymentStatus(p.id, status);
    if (!ok || status !== 'paid' || p.status === 'paid') return;
    const today = new Date().toISOString().split('T')[0];
    const receipt = await handleGenerateReceipt({ ...p, status: 'paid', payment_date: today }, { save: false });
    const amount = Number(p.amount) + (adjMap[p.id] || 0);
    notifyReceiptResult(await sendReceiptWhatsApp({
      recipientType: p.recipient_type,
      recipientId: p.recipient_id,
      recipientName: p.recipient_name,
      blob: receipt.blob,
      fileName: receipt.fileName,
      kind: p.recipient_type === 'dispatcher' ? 'batch' : 'single',
      amount,
      loadReference: p.load_reference,
    }));
  };

  const handleBatchPayAndReceipt = async () => {
    if (!canBatchPay) {
      toast({ title: 'Error', description: 'Select payments from the same beneficiary.', variant: 'destructive' });
      return;
    }
    setBatchProcessing(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      // Update all payments in parallel (faster than sequential await)
      await Promise.all(
        selectedPayments.map(p =>
          supabase.from('payments').update({ status: 'paid', payment_date: today }).eq('id', p.id)
        )
      );
      const items = selectedPayments.map(p => ({
        payment: p,
        adjustment: adjMap[p.id] || 0,
        finalAmount: Number(p.amount) + (adjMap[p.id] || 0),
      }));
      const receipt = await generateBatchPaymentReceipt(selectedPayments[0].recipient_name, selectedPayments[0].recipient_type, items);
      toast({ title: `${selectedPayments.length} payment(s) marked as paid`, description: 'Batch receipt generated.' });
      notifyReceiptResult(await sendReceiptWhatsApp({
        recipientType: selectedPayments[0].recipient_type,
        recipientId: selectedPayments[0].recipient_id,
        recipientName: selectedPayments[0].recipient_name,
        blob: receipt.blob,
        fileName: receipt.fileName,
        kind: 'batch',
        amount: selectedTotal,
        count: selectedPayments.length,
      }));
      setSelectedIds(new Set());
      refetch();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setBatchProcessing(false);
    }
  };

  const handleBatchReceiptOnly = async () => {
    if (!canBatchPay) {
      toast({ title: 'Error', description: 'Select payments from the same beneficiary.', variant: 'destructive' });
      return;
    }
    const items = selectedPayments.map(p => ({
      payment: p,
      adjustment: adjMap[p.id] || 0,
      finalAmount: Number(p.amount) + (adjMap[p.id] || 0),
    }));
    await generateBatchPaymentReceipt(selectedPayments[0].recipient_name, selectedPayments[0].recipient_type, items);
    toast({ title: 'Batch receipt generated' });
  };

  const confirmDelete = async () => {
    const id = deletePaymentId;
    if (!id) return;
    // Delete associated dispatcher payment items first so loads become available again
    await supabase.from('dispatcher_payment_items').delete().eq('payment_id', id);
    const { error } = await supabase.from('payments').delete().eq('id', id);
    setDeletePaymentId(null);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Payment deleted' });
      refetch();
    }
  };

  return (
    <div className="space-y-3">

      <Tabs value={statusFilter} onValueChange={setStatusFilter}>
        <div className="flex items-center gap-4 flex-wrap">
          <TabsList className="w-full justify-start rounded-none sm:rounded-none border-x-0 border-t-0 flex-nowrap border-b border-[#e3e3e3] dark:border-border bg-transparent h-12 p-0 px-1 overflow-x-auto overflow-y-hidden w-auto">
            <TabsTrigger className="h-12 rounded-none border-b-[3px] border-transparent px-4 gap-2 text-sm font-medium text-[#444746] dark:text-muted-foreground data-[state=active]:border-[#0b57d0] data-[state=active]:text-[#0b57d0] dark:data-[state=active]:text-blue-300 data-[state=active]:shadow-none data-[state=active]:bg-transparent" value="pending">
              Pending
              <span className={`inline-flex items-center justify-center rounded-full text-[11px] font-medium min-w-[20px] h-5 px-1.5 ${pendingCount > 0 ? 'bg-[#b3261e] text-white' : 'bg-[#f0f4f9] dark:bg-muted text-[#444746] dark:text-muted-foreground'}`}>{pendingCount}</span>
            </TabsTrigger>
            <TabsTrigger className="h-12 rounded-none border-b-[3px] border-transparent px-4 gap-2 text-sm font-medium text-[#444746] dark:text-muted-foreground data-[state=active]:border-[#0b57d0] data-[state=active]:text-[#0b57d0] dark:data-[state=active]:text-blue-300 data-[state=active]:shadow-none data-[state=active]:bg-transparent" value="in_process">
              In Process
              <span className={`inline-flex items-center justify-center rounded-full text-[11px] font-medium min-w-[20px] h-5 px-1.5 ${inProcessCount > 0 ? 'bg-[#b3261e] text-white' : 'bg-[#f0f4f9] dark:bg-muted text-[#444746] dark:text-muted-foreground'}`}>{inProcessCount}</span>
            </TabsTrigger>
            <TabsTrigger className="h-12 rounded-none border-b-[3px] border-transparent px-4 gap-2 text-sm font-medium text-[#444746] dark:text-muted-foreground data-[state=active]:border-[#0b57d0] data-[state=active]:text-[#0b57d0] dark:data-[state=active]:text-blue-300 data-[state=active]:shadow-none data-[state=active]:bg-transparent" value="paid">
              Paid
              <span className="ml-1.5 inline-flex items-center justify-center rounded-full text-[11px] font-medium min-w-[20px] h-5 px-1.5 bg-[#f0f4f9] dark:bg-muted text-[#444746] dark:text-muted-foreground">{paidCount}</span>
            </TabsTrigger>
            <TabsTrigger className="h-12 rounded-none border-b-[3px] border-transparent px-4 gap-2 text-sm font-medium text-[#444746] dark:text-muted-foreground data-[state=active]:border-[#0b57d0] data-[state=active]:text-[#0b57d0] dark:data-[state=active]:text-blue-300 data-[state=active]:shadow-none data-[state=active]:bg-transparent" value="all">
              All
              <span className="ml-1.5 inline-flex items-center justify-center rounded-full text-[11px] font-medium min-w-[20px] h-5 px-1.5 bg-[#f0f4f9] dark:bg-muted text-[#444746] dark:text-muted-foreground">{allTypePayments.length}</span>
            </TabsTrigger>
          </TabsList>
          {onCreateManual && (
            <div className="ml-auto">
              <Button className="h-10 rounded-2xl px-5 gap-2 bg-[#c2e7ff] hover:bg-[#b3dcf5] text-[#001d35] font-medium shadow-[0_1px_2px_rgba(60,64,67,.3),0_1px_3px_1px_rgba(60,64,67,.15)]" onClick={onCreateManual}>
                <PlusCircle className="h-5 w-5" /> {createLabel}
              </Button>
            </div>
          )}
        </div>
      </Tabs>

      {/* Search & Filters */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-9 h-9 w-[220px] text-sm rounded-full bg-white dark:bg-card border-[#e3e3e3] dark:border-border shadow-none"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-[#444746] dark:text-muted-foreground">Beneficiary</label>
          <Select value={beneficiaryFilter} onValueChange={setBeneficiaryFilter}>
            <SelectTrigger className="rounded-lg shadow-none font-medium bg-white dark:bg-card border-[#c4c7c5] dark:border-border text-[#444746] dark:text-muted-foreground h-8 w-[180px] text-xs">
              <SelectValue placeholder="All" />
            </SelectTrigger>
            <SelectContent className="bg-popover z-50">
              <SelectItem value="all">All</SelectItem>
              {uniqueBeneficiaries.map(name => (
                <SelectItem key={name} value={name}>{name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-[#444746] dark:text-muted-foreground">Week</label>
          <Select value={weekFilter} onValueChange={setWeekFilter}>
            <SelectTrigger className="rounded-lg shadow-none font-medium bg-white dark:bg-card border-[#c4c7c5] dark:border-border text-[#444746] dark:text-muted-foreground h-8 w-[140px] text-xs">
              <SelectValue placeholder="All" />
            </SelectTrigger>
            <SelectContent className="bg-popover z-50">
              <SelectItem value="all">All</SelectItem>
              {dateOptions.weeks.map(w => (
                <SelectItem key={w} value={w}>{w}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-[#444746] dark:text-muted-foreground">Month</label>
          <Select value={monthFilter} onValueChange={setMonthFilter}>
            <SelectTrigger className="rounded-lg shadow-none font-medium bg-white dark:bg-card border-[#c4c7c5] dark:border-border text-[#444746] dark:text-muted-foreground h-8 w-[140px] text-xs">
              <SelectValue placeholder="All" />
            </SelectTrigger>
            <SelectContent className="bg-popover z-50">
              <SelectItem value="all">All</SelectItem>
              {dateOptions.months.map(m => {
                const [y, mo] = m.split('-');
                return <SelectItem key={m} value={m}>{monthNames[parseInt(mo) - 1]} {y}</SelectItem>;
              })}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-[#444746] dark:text-muted-foreground">Year</label>
          <Select value={yearFilter} onValueChange={setYearFilter}>
            <SelectTrigger className="rounded-lg shadow-none font-medium bg-white dark:bg-card border-[#c4c7c5] dark:border-border text-[#444746] dark:text-muted-foreground h-8 w-[100px] text-xs">
              <SelectValue placeholder="All" />
            </SelectTrigger>
            <SelectContent className="bg-popover z-50">
              <SelectItem value="all">All</SelectItem>
              {dateOptions.years.map(y => (
                <SelectItem key={y} value={y}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-[#444746] dark:text-muted-foreground">From</label>
          <Input type="date" className="rounded-lg shadow-none font-medium bg-white dark:bg-card border-[#c4c7c5] dark:border-border text-[#444746] dark:text-muted-foreground h-8 w-[150px] text-xs" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-[#444746] dark:text-muted-foreground">To</label>
          <Input type="date" className="rounded-lg shadow-none font-medium bg-white dark:bg-card border-[#c4c7c5] dark:border-border text-[#444746] dark:text-muted-foreground h-8 w-[150px] text-xs" value={dateTo} onChange={e => setDateTo(e.target.value)} />
        </div>

        {hasActiveFilters && (
          <Button variant="ghost" size="sm" className="h-8 rounded-full px-3 gap-1 text-xs text-[#0b57d0] hover:text-[#0b57d0] hover:bg-[#e8f0fe] dark:text-blue-300 font-medium" onClick={clearFilters}>
            <X className="h-3.5 w-3.5" /> Clear
          </Button>
        )}
        <Button variant="outline" size="sm" className="h-9 rounded-full px-4 gap-1.5 text-xs ml-auto shadow-none border-[#747775] dark:border-border text-[#0b57d0] dark:text-blue-300 hover:bg-[#e8f0fe] hover:text-[#0b57d0] font-medium" onClick={() => {
          if (payments.length === 0) {
            toast({ title: 'No data to export', variant: 'destructive' });
            return;
          }
          const headers = ['Reference', 'Beneficiary', 'Type', 'Rate', '%', 'Base Amount', 'Adjustment', 'Total', 'Status', 'Delivered Date', 'Paid Date'];
          const rows = payments.map(p => {
            const adj = adjMap[p.id] || 0;
            const total = Number(p.amount) + adj;
            const deliveredDate = paymentDateMap[p.id] ? format(parseISO(paymentDateMap[p.id]), 'yyyy-MM-dd') : '';
            return [
              p.load_reference,
              p.recipient_name,
              p.recipient_type,
              Number(p.total_rate).toFixed(2),
              p.percentage_applied,
              Number(p.amount).toFixed(2),
              adj.toFixed(2),
              total.toFixed(2),
              p.status,
              deliveredDate,
              p.payment_date || '',
            ].map(v => `"${v}"`).join(',');
          });
          const csv = [headers.join(','), ...rows].join('\n');
          const blob = new Blob([csv], { type: 'text/csv' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `payments_${type}_${new Date().toISOString().split('T')[0]}.csv`;
          a.click();
          URL.revokeObjectURL(url);
          toast({ title: `${payments.length} payment(s) exported` });
        }}>
          <Download className="h-3.5 w-3.5" /> Export CSV
        </Button>
      </div>

      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 px-4 py-2.5 rounded-2xl bg-[#e8f0fe] dark:bg-blue-950/40 text-[#041e49] dark:text-blue-100">
          <span className="text-sm font-medium">{selectedIds.size} selected</span>
          <span className="text-sm text-muted-foreground">•</span>
          <span className="text-sm font-semibold">${selectedTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
          {selectedPayments.length > 0 && canBatchPay && (
            <span className="text-xs text-primary font-medium ml-1">— {uniqueSelectedNames[0]}</span>
          )}
          {!canBatchPay && selectedPayments.length > 0 && (
            <span className="text-xs text-destructive ml-2">
              ⚠ Different beneficiaries: {uniqueSelectedNames.join(' · ')}
            </span>
          )}
          {selectedPayments.length === 0 && selectedIds.size > 0 && (
            <span className="text-xs text-muted-foreground ml-2">⚠ Selected items not visible in current filter</span>
          )}
          <div className="ml-auto flex items-center gap-2">
            <Button size="sm" variant="outline" className="h-9 rounded-full px-4 gap-1.5 shadow-none bg-white dark:bg-card border-[#747775] text-[#0b57d0] hover:bg-[#f8fafd] hover:text-[#0b57d0] font-medium" onClick={handleBatchReceiptOnly} disabled={!canBatchPay}>
              <FileText className="h-3.5 w-3.5" /> Receipt
            </Button>
            <Button size="sm" className="h-9 rounded-full px-4 gap-1.5 bg-[#0b57d0] hover:bg-[#0842a0] text-white font-medium" onClick={handleBatchPayAndReceipt} disabled={!canBatchPay || batchProcessing}>
              <CheckCheck className="h-3.5 w-3.5" /> Pay & Generate Receipt
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())}>Cancel</Button>
          </div>
        </div>
      )}

      <div className={TABLE_CARD}>
        <div className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className={TABLE_HEAD_ROW}>
                <th className="p-3 w-10">
                  <Checkbox
                    checked={payments.length > 0 && selectedIds.size === payments.length}
                    onCheckedChange={toggleSelectAll}
                  />
                </th>
                <th className="text-left px-3 py-2.5 text-xs font-medium text-[#444746] dark:text-muted-foreground">Reference</th>
                <th className="text-left px-3 py-2.5 text-xs font-medium text-[#444746] dark:text-muted-foreground">Beneficiary</th>
                <th className="text-left px-3 py-2.5 text-xs font-medium text-[#444746] dark:text-muted-foreground">{type === 'dispatcher' ? 'Date' : 'Delivered Date'}</th>
                <th className="text-right px-3 py-2.5 text-xs font-medium text-[#444746] dark:text-muted-foreground">Rate</th>
                <th className="text-right px-3 py-2.5 text-xs font-medium text-[#444746] dark:text-muted-foreground">%</th>
                <th className="text-right px-3 py-2.5 text-xs font-medium text-[#444746] dark:text-muted-foreground">Base Amount</th>
                <th className="text-right px-3 py-2.5 text-xs font-medium text-[#444746] dark:text-muted-foreground">Adjustment</th>
                <th className="text-right px-3 py-2.5 text-xs font-medium text-[#444746] dark:text-muted-foreground">Total Amount</th>
                <th className="text-left px-3 py-2.5 text-xs font-medium text-[#444746] dark:text-muted-foreground">Status</th>
                <th className="text-left px-3 py-2.5 text-xs font-medium text-[#444746] dark:text-muted-foreground">Payment Date</th>
                <th className="text-right px-3 py-2.5 text-xs font-medium text-[#444746] dark:text-muted-foreground">Actions</th>
              </tr></thead>
              <tbody>
                {payments.length === 0 && !loading && (
                  <tr><td colSpan={12} className="p-6 text-center text-muted-foreground">No payments recorded</td></tr>
                )}
                {payments.map(p => (
                  <tr key={p.id} className={`${TABLE_ROW} last:border-0 border-l-4 ${PAYMENT_STATUS[p.status]?.border ?? 'border-l-transparent'} ${selectedIds.has(p.id) ? 'bg-[#e8f0fe] dark:bg-blue-950/40' : ''}`}>
                    <td className="px-3 py-2">
                      <Checkbox checked={selectedIds.has(p.id)} onCheckedChange={() => toggleSelect(p.id)} />
                    </td>
                    <td className="px-3 py-2 font-medium text-[#0b57d0] dark:text-blue-300">{p.load_reference}</td>
                    <td className="px-3 py-2">{p.recipient_name}</td>
                    <td className="px-3 py-2 text-muted-foreground">{formatDate(p.created_at)}</td>
                    <td className="px-3 py-2 text-right text-muted-foreground">${Number(p.total_rate).toLocaleString()}</td>
                    <td className="px-3 py-2 text-right text-muted-foreground">{p.percentage_applied}%</td>
                    <td className="px-3 py-2 text-right text-muted-foreground">${Number(p.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                    <td className="px-3 py-2 text-right">
                      {(adjMap[p.id] || 0) !== 0 ? (
                        <span className={`font-semibold ${(adjMap[p.id] || 0) > 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {(adjMap[p.id] || 0) > 0 ? '+' : ''}${(adjMap[p.id] || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </span>
                      ) : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="px-3 py-2 text-right font-semibold">${(Number(p.amount) + (adjMap[p.id] || 0)).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                    <td className="px-3 py-2" onClick={e => e.stopPropagation()}>
                      <Select value={p.status} onValueChange={(val) => handleStatusChange(p, val)}>
                        <SelectTrigger className="h-8 w-[155px] border-0 p-0 shadow-none focus:ring-0 [&>svg]:hidden bg-transparent">
                          <span className="flex items-center justify-between w-full gap-1">
                            {paymentPill(p.status)}
                            <span className="inline-flex h-5 w-5 items-center justify-center rounded border border-border bg-muted/40 text-muted-foreground ml-auto">
                              <ChevronDown className="h-3 w-3 shrink-0" />
                            </span>
                          </span>
                        </SelectTrigger>
                        <SelectContent className="bg-popover z-50">
                          <SelectItem value="pending">{paymentPill('pending')}</SelectItem>
                          <SelectItem value="in_process">{paymentPill('in_process')}</SelectItem>
                          <SelectItem value="paid">{paymentPill('paid')}</SelectItem>
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{p.payment_date ? formatDate(p.payment_date) : formatDate(p.created_at)}</td>
                    <td className="px-3 py-2 text-right">
                      <div className="flex items-center justify-end gap-0.5">
                        <button className="h-8 w-8 rounded-full inline-flex items-center justify-center text-[#0b57d0] hover:bg-[#e8f0fe] dark:text-blue-300" onClick={(e) => { e.stopPropagation(); setEditPayment(p); }} title="Edit">
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button className="h-8 w-8 rounded-full inline-flex items-center justify-center text-[#188038] hover:bg-[#e6f4ea] dark:text-emerald-400" onClick={(e) => { e.stopPropagation(); handleGenerateReceipt(p); }} title="Receipt">
                          <FileText className="h-4 w-4" />
                        </button>
                        <button className="h-8 w-8 rounded-full inline-flex items-center justify-center text-[#b3261e] hover:bg-[#fce8e6]" onClick={(e) => { e.stopPropagation(); setDeletePaymentId(p.id); }} title="Delete">
                          <Trash2 className="h-4 w-4" />
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

      {/* payments no está publicada en Realtime: al cerrar el editor se vuelve a pedir la lista */}
      {editPayment && (
        <PaymentEditDialog payment={editPayment} open={!!editPayment} onOpenChange={(o) => { if (!o) { setEditPayment(null); setAdjRefresh(r => r + 1); void refetch(); } }} />
      )}

      <Dialog open={!!deletePaymentId} onOpenChange={(o) => { if (!o) setDeletePaymentId(null); }}>
        <DialogContent className="rounded-[28px] border-0 bg-[#f8fafd] dark:bg-background [&_label]:text-xs [&_label]:font-medium [&_label]:text-[#444746] dark:[&_label]:text-muted-foreground [&_input]:rounded-lg [&_input]:shadow-none [&_input]:bg-white dark:[&_input]:bg-card [&_input]:border-[#c4c7c5] dark:[&_input]:border-border [&_input:focus-visible]:ring-1 [&_input:focus-visible]:ring-[#0b57d0] [&_input:focus-visible]:border-[#0b57d0] [&_button[role=combobox]]:rounded-lg [&_button[role=combobox]]:shadow-none [&_button[role=combobox]]:bg-white dark:[&_button[role=combobox]]:bg-card [&_button[role=combobox]]:border-[#c4c7c5] dark:[&_button[role=combobox]]:border-border [&_textarea]:rounded-lg [&_textarea]:shadow-none [&_textarea]:bg-white dark:[&_textarea]:bg-card [&_textarea]:border-[#c4c7c5]">
          <DialogHeader>
            <DialogTitle className="text-[22px] leading-7 font-normal text-[#1f1f1f] dark:text-foreground">Delete this payment?</DialogTitle>
            <DialogDescription>This action cannot be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button className="h-10 rounded-full px-5 text-[#0b57d0] hover:text-[#0b57d0] hover:bg-[#e8f0fe] dark:text-blue-300 font-medium" variant="ghost" onClick={() => setDeletePaymentId(null)}>Cancel</Button>
            <Button className="h-10 rounded-full px-6 bg-[#b3261e] hover:bg-[#8c1d18] text-white font-medium"  onClick={confirmDelete}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

const Payments = () => {
  const { payments: allP, refetch } = usePayments();
  const pendingDrivers = allP.filter(p => p.recipient_type === 'driver' && p.status === 'pending').length;
  const totalDrivers = allP.filter(p => p.recipient_type === 'driver').length;
  const pendingInvestors = allP.filter(p => p.recipient_type === 'investor' && p.status === 'pending').length;
  const totalInvestors = allP.filter(p => p.recipient_type === 'investor').length;
  const pendingDispatchers = allP.filter(p => p.recipient_type === 'dispatcher' && p.status === 'pending').length;
  const totalDispatchers = allP.filter(p => p.recipient_type === 'dispatcher').length;
  const [manualDialogOpen, setManualDialogOpen] = useState(false);
  const [manualDriverDialogOpen, setManualDriverDialogOpen] = useState(false);
  const [manualInvestorDialogOpen, setManualInvestorDialogOpen] = useState(false);
  const [recurringOpen, setRecurringOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [annualOpen, setAnnualOpen] = useState(false);

  const handleManualComplete = () => { refetch(); setRefreshKey(k => k + 1); };

  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="h-10 w-10 rounded-full bg-[#d3e3fd] dark:bg-blue-900/40 text-[#041e49] dark:text-blue-200 flex items-center justify-center shrink-0">
            <DollarSign className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-[24px] leading-8 font-normal text-[#1f1f1f] dark:text-foreground">Payments</h1>
            <p className="text-sm text-[#444746] dark:text-muted-foreground">Manage payments to drivers, investors, and dispatchers</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="h-10 rounded-full px-4 shadow-none border-[#747775] dark:border-border text-[#0b57d0] dark:text-blue-300 hover:bg-[#e8f0fe] hover:text-[#0b57d0] font-medium" onClick={() => setAnnualOpen(true)}>
            <FileText className="h-4 w-4 mr-1.5" /> Reporte anual (1099)
          </Button>
          <Button variant="outline" className="h-10 rounded-full px-4 shadow-none border-[#747775] dark:border-border text-[#0b57d0] dark:text-blue-300 hover:bg-[#e8f0fe] hover:text-[#0b57d0] font-medium" onClick={() => setRecurringOpen(true)}>
            <RefreshCw className="h-4 w-4 mr-1.5" /> Recurring Deductions
          </Button>
        </div>
      </div>


      {(() => {
        const money = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        const pending = allP.filter(p => p.status === 'pending');
        const inProcess = allP.filter(p => p.status === 'in_process');
        const totalPending = pending.reduce((s, p) => s + Number(p.amount), 0);
        const totalInProcess = inProcess.reduce((s, p) => s + Number(p.amount), 0);
        // Pagado este mes (hora del Este), por la fecha de pago
        const thisMonth = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' }).slice(0, 7);
        const paidThisMonth = allP.filter(p => p.status === 'paid' && (p.payment_date || '').slice(0, 7) === thisMonth);
        return (
          <StatTiles tiles={[
            { label: 'Total Pending', value: money(totalPending), hint: `${pending.length} payments`, icon: Clock, tint: 'bg-[#feefc3] text-[#3d2a00] dark:bg-amber-900/40 dark:text-amber-200' },
            { label: 'Total In Process', value: money(totalInProcess), hint: `${inProcess.length} payments`, icon: RefreshCw, tint: 'bg-[#c2e7ff] text-[#001d35] dark:bg-sky-900/40 dark:text-sky-200' },
            { label: 'Pending + In Process', value: money(totalPending + totalInProcess), hint: `${pending.length + inProcess.length} payments`, icon: DollarSign, tint: 'bg-[#d3e3fd] text-[#041e49] dark:bg-blue-900/40 dark:text-blue-200' },
            { label: 'Paid this month', value: money(paidThisMonth.reduce((s, p) => s + Number(p.amount), 0)), hint: `${paidThisMonth.length} payments`, icon: CheckCircle, tint: 'bg-[#c4eed0] text-[#072711] dark:bg-emerald-900/40 dark:text-emerald-200' },
          ]} />
        );
      })()}

      <Tabs defaultValue="drivers">
        <TabsList className="w-full justify-start rounded-none sm:rounded-none border-x-0 border-t-0 flex-nowrap border-b border-[#e3e3e3] dark:border-border bg-transparent h-12 p-0 px-1 overflow-x-auto overflow-y-hidden">
          <TabsTrigger className="h-12 rounded-none border-b-[3px] border-transparent px-4 gap-2 text-sm font-medium text-[#444746] dark:text-muted-foreground data-[state=active]:border-[#0b57d0] data-[state=active]:text-[#0b57d0] dark:data-[state=active]:text-blue-300 data-[state=active]:shadow-none data-[state=active]:bg-transparent" value="drivers">Drivers <span className={`inline-flex items-center justify-center rounded-full text-[11px] font-medium min-w-[20px] h-5 px-1.5 ${pendingDrivers > 0 ? 'bg-[#b3261e] text-white' : 'bg-[#f0f4f9] dark:bg-muted text-[#444746] dark:text-muted-foreground'}`}>{pendingDrivers > 0 ? pendingDrivers : totalDrivers}</span></TabsTrigger>
          <TabsTrigger className="h-12 rounded-none border-b-[3px] border-transparent px-4 gap-2 text-sm font-medium text-[#444746] dark:text-muted-foreground data-[state=active]:border-[#0b57d0] data-[state=active]:text-[#0b57d0] dark:data-[state=active]:text-blue-300 data-[state=active]:shadow-none data-[state=active]:bg-transparent" value="investors">Investors <span className={`inline-flex items-center justify-center rounded-full text-[11px] font-medium min-w-[20px] h-5 px-1.5 ${pendingInvestors > 0 ? 'bg-[#b3261e] text-white' : 'bg-[#f0f4f9] dark:bg-muted text-[#444746] dark:text-muted-foreground'}`}>{pendingInvestors > 0 ? pendingInvestors : totalInvestors}</span></TabsTrigger>
          <TabsTrigger className="h-12 rounded-none border-b-[3px] border-transparent px-4 gap-2 text-sm font-medium text-[#444746] dark:text-muted-foreground data-[state=active]:border-[#0b57d0] data-[state=active]:text-[#0b57d0] dark:data-[state=active]:text-blue-300 data-[state=active]:shadow-none data-[state=active]:bg-transparent" value="dispatchers">Dispatchers <span className={`inline-flex items-center justify-center rounded-full text-[11px] font-medium min-w-[20px] h-5 px-1.5 ${pendingDispatchers > 0 ? 'bg-[#b3261e] text-white' : 'bg-[#f0f4f9] dark:bg-muted text-[#444746] dark:text-muted-foreground'}`}>{pendingDispatchers > 0 ? pendingDispatchers : totalDispatchers}</span></TabsTrigger>
        </TabsList>
        <TabsContent value="drivers">
          <PaymentsSection key={`driver-${refreshKey}`} type="driver" refreshKey={refreshKey} onCreateManual={() => setManualDriverDialogOpen(true)} />
        </TabsContent>
        <TabsContent value="investors">
          <PaymentsSection key={`investor-${refreshKey}`} type="investor" refreshKey={refreshKey} onCreateManual={() => setManualInvestorDialogOpen(true)} />
        </TabsContent>
        <TabsContent value="dispatchers">
          <PaymentsSection key={`dispatcher-${refreshKey}`} type="dispatcher" refreshKey={refreshKey} onCreateManual={() => setManualDialogOpen(true)} createLabel="Generate Manual Payment" />
        </TabsContent>
      </Tabs>

      <ManualDispatcherPaymentDialog
        open={manualDialogOpen}
        onOpenChange={setManualDialogOpen}
        onComplete={handleManualComplete}
      />
      <ManualPaymentDialog
        open={manualDriverDialogOpen}
        onOpenChange={setManualDriverDialogOpen}
        recipientType="driver"
        onComplete={handleManualComplete}
      />
      <ManualPaymentDialog
        open={manualInvestorDialogOpen}
        onOpenChange={setManualInvestorDialogOpen}
        recipientType="investor"
        onComplete={handleManualComplete}
      />
      <RecurringDeductionDialog open={recurringOpen} onOpenChange={setRecurringOpen} />
      <AnnualPaymentsReportDialog open={annualOpen} onOpenChange={setAnnualOpen} />
    </div>
  );
};

export default Payments;
