import { useState, useEffect, useCallback, useMemo } from 'react';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear, isWithinInterval, parseISO } from 'date-fns';
import { formatDate } from '@/lib/dateUtils';
import { usePayments, type DbPayment } from '@/hooks/usePayments';
import { StatusBadge } from '@/components/StatusBadge';
import { StatCard } from '@/components/StatCard';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { PaymentEditDialog } from '@/components/PaymentEditDialog';
import { Input } from '@/components/ui/input';
import { DollarSign, CheckCircle, Clock, Download, Pencil, Trash2, FileText, CheckCheck, X, PlusCircle, Search, ChevronDown } from 'lucide-react';
import { generatePaymentReceipt, type DispatcherLoadItem } from '@/lib/paymentReceipt';
import { generateBatchPaymentReceipt } from '@/lib/batchPaymentReceipt';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

import { ManualDispatcherPaymentDialog } from '@/components/ManualDispatcherPaymentDialog';
import { ManualPaymentDialog } from '@/components/ManualPaymentDialog';
import { RecurringDeductionDialog } from '@/components/RecurringDeductionDialog';
import { RefreshCw } from 'lucide-react';

const handleGenerateReceipt = async (p: DbPayment) => {
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
    await generatePaymentReceipt(p, adjustments, totalAdj, Number(p.amount) + totalAdj, dispatcherItems, loadOrigin, loadDestination, (load as any)?.pickup_date, (load as any)?.delivery_date, companyName);
    return;
  }

  await generatePaymentReceipt(p, adjustments, totalAdj, Number(p.amount) + totalAdj, dispatcherItems, undefined, undefined, undefined, undefined, companyName);
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
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [batchProcessing, setBatchProcessing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [beneficiaryFilter, setBeneficiaryFilter] = useState('all');
  const [weekFilter, setWeekFilter] = useState('all');
  const [monthFilter, setMonthFilter] = useState('all');
  const [yearFilter, setYearFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Fetch all adjustments for payments of this type
  const fetchAdjustments = useCallback(async () => {
    const ids = allPayments.filter(p => p.recipient_type === type).map(p => p.id);
    if (ids.length === 0) return;
    const { data } = await supabase.from('payment_adjustments').select('payment_id, adjustment_type, amount').in('payment_id', ids);
    if (data) {
      const map: Record<string, number> = {};
      (data as any[]).forEach(a => {
        const val = a.adjustment_type === 'addition' ? Number(a.amount) : -Number(a.amount);
        map[a.payment_id] = (map[a.payment_id] || 0) + val;
      });
      setAdjMap(map);
    }
  }, [allPayments, type]);

  useEffect(() => { fetchAdjustments(); }, [fetchAdjustments]);

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

    // Sort newest first by created_at
    result.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
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
  // Use recipient_name (not recipient_id) — investor payments store driver.id as recipient_id
  // so two payments from the same investor via different drivers would fail the recipient_id check.
  const canBatchPay = selectedPayments.length > 0 && new Set(selectedPayments.map(p => p.recipient_name)).size === 1;
  const selectedTotal = selectedPayments.reduce((s, p) => s + Number(p.amount) + (adjMap[p.id] || 0), 0);

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
      await generateBatchPaymentReceipt(selectedPayments[0].recipient_name, selectedPayments[0].recipient_type, items);
      toast({ title: `${selectedPayments.length} payment(s) marked as paid`, description: 'Batch receipt generated.' });
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
    <div className="space-y-6">

      <Tabs value={statusFilter} onValueChange={setStatusFilter}>
        <div className="flex items-center gap-4 flex-wrap">
          <TabsList>
            <TabsTrigger value="pending">
              Pending
              <span className={`ml-1.5 inline-flex items-center justify-center rounded-full text-[11px] font-semibold min-w-[20px] h-5 px-1.5 ${pendingCount > 0 ? 'bg-destructive text-destructive-foreground' : 'bg-primary text-primary-foreground'}`}>{pendingCount}</span>
            </TabsTrigger>
            <TabsTrigger value="in_process">
              In Process
              <span className={`ml-1.5 inline-flex items-center justify-center rounded-full text-[11px] font-semibold min-w-[20px] h-5 px-1.5 ${inProcessCount > 0 ? 'bg-destructive text-destructive-foreground' : 'bg-primary text-primary-foreground'}`}>{inProcessCount}</span>
            </TabsTrigger>
            <TabsTrigger value="paid">
              Paid
              <span className="ml-1.5 inline-flex items-center justify-center rounded-full text-[11px] font-semibold min-w-[20px] h-5 px-1.5 bg-primary text-primary-foreground">{paidCount}</span>
            </TabsTrigger>
            <TabsTrigger value="all">
              All
              <span className="ml-1.5 inline-flex items-center justify-center rounded-full text-[11px] font-semibold min-w-[20px] h-5 px-1.5 bg-primary text-primary-foreground">{allTypePayments.length}</span>
            </TabsTrigger>
          </TabsList>
          {onCreateManual && (
            <div className="ml-24">
              <Button size="sm" className="gap-1.5" onClick={onCreateManual}>
                <PlusCircle className="h-4 w-4" /> {createLabel}
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
            className="pl-9 h-8 w-[180px] text-xs"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Beneficiary</label>
          <Select value={beneficiaryFilter} onValueChange={setBeneficiaryFilter}>
            <SelectTrigger className="h-8 w-[180px] text-xs">
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
          <label className="text-xs font-medium text-muted-foreground">Week</label>
          <Select value={weekFilter} onValueChange={setWeekFilter}>
            <SelectTrigger className="h-8 w-[140px] text-xs">
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
          <label className="text-xs font-medium text-muted-foreground">Month</label>
          <Select value={monthFilter} onValueChange={setMonthFilter}>
            <SelectTrigger className="h-8 w-[140px] text-xs">
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
          <label className="text-xs font-medium text-muted-foreground">Year</label>
          <Select value={yearFilter} onValueChange={setYearFilter}>
            <SelectTrigger className="h-8 w-[100px] text-xs">
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
          <label className="text-xs font-medium text-muted-foreground">From</label>
          <Input type="date" className="h-8 w-[150px] text-xs" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">To</label>
          <Input type="date" className="h-8 w-[150px] text-xs" value={dateTo} onChange={e => setDateTo(e.target.value)} />
        </div>

        {hasActiveFilters && (
          <Button variant="ghost" size="sm" className="h-8 gap-1 text-xs" onClick={clearFilters}>
            <X className="h-3.5 w-3.5" /> Clear
          </Button>
        )}
        <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs ml-auto" onClick={() => {
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
        <div className="flex items-center gap-3 p-3 rounded-lg border bg-primary/5 border-primary/20">
          <span className="text-sm font-medium">{selectedIds.size} selected</span>
          <span className="text-sm text-muted-foreground">•</span>
          <span className="text-sm font-semibold">${selectedTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
          {!canBatchPay && selectedPayments.length > 0 && (
            <span className="text-xs text-destructive ml-2">⚠ Select payments from the same beneficiary</span>
          )}
          <div className="ml-auto flex items-center gap-2">
            <Button size="sm" variant="outline" className="gap-1.5" onClick={handleBatchReceiptOnly} disabled={!canBatchPay}>
              <FileText className="h-3.5 w-3.5" /> Receipt
            </Button>
            <Button size="sm" className="gap-1.5" onClick={handleBatchPayAndReceipt} disabled={!canBatchPay || batchProcessing}>
              <CheckCheck className="h-3.5 w-3.5" /> Pay & Generate Receipt
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())}>Cancel</Button>
          </div>
        </div>
      )}

      <div className="glass-card overflow-hidden">
        <div className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-[15px]">
              <thead><tr className="border-b glass-table-header">
                <th className="p-3 w-10">
                  <Checkbox
                    checked={payments.length > 0 && selectedIds.size === payments.length}
                    onCheckedChange={toggleSelectAll}
                  />
                </th>
                <th className="text-left p-3 font-medium text-muted-foreground">Reference</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Beneficiary</th>
                <th className="text-left p-3 font-medium text-muted-foreground">{type === 'dispatcher' ? 'Date' : 'Delivered Date'}</th>
                <th className="text-right p-3 font-medium text-muted-foreground">Rate</th>
                <th className="text-right p-3 font-medium text-muted-foreground">%</th>
                <th className="text-right p-3 font-medium text-muted-foreground">Base Amount</th>
                <th className="text-right p-3 font-medium text-muted-foreground">Adjustment</th>
                <th className="text-right p-3 font-medium text-muted-foreground">Total Amount</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Status</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Payment Date</th>
                <th className="text-right p-3 font-medium text-muted-foreground">Actions</th>
              </tr></thead>
              <tbody>
                {payments.length === 0 && !loading && (
                  <tr><td colSpan={12} className="p-6 text-center text-muted-foreground">No payments recorded</td></tr>
                )}
                {payments.map(p => (
                  <tr key={p.id} className={`border-b last:border-0 glass-row ${selectedIds.has(p.id) ? 'bg-primary/5' : ''}`}>
                    <td className="p-3">
                      <Checkbox checked={selectedIds.has(p.id)} onCheckedChange={() => toggleSelect(p.id)} />
                    </td>
                    <td className="p-3 font-medium text-primary">{p.load_reference}</td>
                    <td className="p-3">{p.recipient_name}</td>
                    <td className="p-3 text-muted-foreground">{formatDate(p.created_at)}</td>
                    <td className="p-3 text-right text-muted-foreground">${Number(p.total_rate).toLocaleString()}</td>
                    <td className="p-3 text-right text-muted-foreground">{p.percentage_applied}%</td>
                    <td className="p-3 text-right text-muted-foreground">${Number(p.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                    <td className="p-3 text-right">
                      {(adjMap[p.id] || 0) !== 0 ? (
                        <span className={`font-semibold ${(adjMap[p.id] || 0) > 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {(adjMap[p.id] || 0) > 0 ? '+' : ''}${(adjMap[p.id] || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </span>
                      ) : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="p-3 text-right font-semibold">${(Number(p.amount) + (adjMap[p.id] || 0)).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                    <td className="p-3" onClick={e => e.stopPropagation()}>
                      <Select value={p.status} onValueChange={(val) => updatePaymentStatus(p.id, val)}>
                        <SelectTrigger className="h-8 w-[155px] border-0 p-0 shadow-none focus:ring-0 [&>svg]:hidden bg-transparent">
                          <span className="flex items-center justify-between w-full gap-1">
                            <StatusBadge status={p.status} className="text-[11px] px-3 py-1.5" />
                            <span className="inline-flex h-5 w-5 items-center justify-center rounded border border-border bg-muted/40 text-muted-foreground ml-auto">
                              <ChevronDown className="h-3 w-3 shrink-0" />
                            </span>
                          </span>
                        </SelectTrigger>
                        <SelectContent className="bg-popover z-50">
                          <SelectItem value="pending"><StatusBadge status="pending" /></SelectItem>
                          <SelectItem value="in_process"><StatusBadge status="in_process" /></SelectItem>
                          <SelectItem value="paid"><StatusBadge status="paid" /></SelectItem>
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="p-3 text-muted-foreground">{p.payment_date ? formatDate(p.payment_date) : formatDate(p.created_at)}</td>
                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button className="glass-action-btn tint-amber inline-flex items-center" onClick={(e) => { e.stopPropagation(); setEditPayment(p); }} title="Edit">
                          <Pencil className="h-4 w-4" /> Edit
                        </button>
                        <button className="glass-action-btn tint-green inline-flex items-center" onClick={(e) => { e.stopPropagation(); handleGenerateReceipt(p); }} title="Receipt">
                          <FileText className="h-4 w-4" /> Receipt
                        </button>
                        <button className="glass-action-btn tint-red inline-flex items-center" onClick={(e) => { e.stopPropagation(); setDeletePaymentId(p.id); }} title="Delete">
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

      {editPayment && (
        <PaymentEditDialog payment={editPayment} open={!!editPayment} onOpenChange={(o) => { if (!o) { setEditPayment(null); fetchAdjustments(); } }} />
      )}

      <Dialog open={!!deletePaymentId} onOpenChange={(o) => { if (!o) setDeletePaymentId(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this payment?</DialogTitle>
            <DialogDescription>This action cannot be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeletePaymentId(null)}>Cancel</Button>
            <Button variant="destructive" onClick={confirmDelete}>Delete</Button>
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

  const handleManualComplete = () => { refetch(); setRefreshKey(k => k + 1); };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="page-header">Payments</h1>
          <p className="page-description">Manage payments to drivers, investors, and dispatchers</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setRecurringOpen(true)}>
          <RefreshCw className="h-4 w-4 mr-1.5" /> Recurring Deductions
        </Button>
      </div>


      {(() => {
        const totalPending = allP.filter(p => p.status === 'pending' || p.status === 'in_process').reduce((s, p) => s + Number(p.amount), 0);
        const totalPaid = allP.filter(p => p.status === 'paid').reduce((s, p) => s + Number(p.amount), 0);
        return (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatCard title="Total Pending" value={`$${totalPending.toLocaleString('en-US', { minimumFractionDigits: 2 })}`} icon={Clock} iconClassName="bg-warning/10 text-warning" />
            <StatCard title="Total Paid" value={`$${totalPaid.toLocaleString('en-US', { minimumFractionDigits: 2 })}`} icon={CheckCircle} iconClassName="bg-success/10 text-success" />
            <StatCard title="Grand Total" value={`$${(totalPending + totalPaid).toLocaleString('en-US', { minimumFractionDigits: 2 })}`} icon={DollarSign} />
          </div>
        );
      })()}

      <Tabs defaultValue="drivers">
        <TabsList>
          <TabsTrigger value="drivers">Drivers <span className={`ml-1.5 inline-flex items-center justify-center rounded-full text-[11px] font-semibold min-w-[20px] h-5 px-1.5 ${pendingDrivers > 0 ? 'bg-destructive text-destructive-foreground' : 'bg-primary text-primary-foreground'}`}>{pendingDrivers > 0 ? pendingDrivers : totalDrivers}</span></TabsTrigger>
          <TabsTrigger value="investors">Investors <span className={`ml-1.5 inline-flex items-center justify-center rounded-full text-[11px] font-semibold min-w-[20px] h-5 px-1.5 ${pendingInvestors > 0 ? 'bg-destructive text-destructive-foreground' : 'bg-primary text-primary-foreground'}`}>{pendingInvestors > 0 ? pendingInvestors : totalInvestors}</span></TabsTrigger>
          <TabsTrigger value="dispatchers">Dispatchers <span className={`ml-1.5 inline-flex items-center justify-center rounded-full text-[11px] font-semibold min-w-[20px] h-5 px-1.5 ${pendingDispatchers > 0 ? 'bg-destructive text-destructive-foreground' : 'bg-primary text-primary-foreground'}`}>{pendingDispatchers > 0 ? pendingDispatchers : totalDispatchers}</span></TabsTrigger>
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
    </div>
  );
};

export default Payments;
