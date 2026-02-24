import { useState, useMemo } from 'react';
import { useExpenses } from '@/hooks/useExpenses';
import { useTrucks } from '@/hooks/useTrucks';
import { useDrivers } from '@/hooks/useDrivers';
import { ExpenseFormDialog } from '@/components/expenses/ExpenseFormDialog';
import { FuelImportWizard } from '@/components/expenses/FuelImportWizard';
import { ExpenseSummaryDashboard } from '@/components/expenses/ExpenseSummaryDashboard';
import {
  EXPENSE_TYPE_LABELS, EXPENSE_TYPE_COLORS, PAYMENT_METHOD_LABELS,
} from '@/components/expenses/expenseConstants';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import {
  Plus, Upload, Search, Filter, Trash2, Pencil, Eye,
  Receipt, Download, FileText, DollarSign, Fuel,
} from 'lucide-react';
import type { DbExpense } from '@/hooks/useExpenses';

const PAGE_SIZES = [25, 50, 100];

const Expenses = () => {
  const { expenses, loading, createExpense, createExpensesBatch, updateExpense, deleteExpense, deleteExpensesBatch } = useExpenses();
  const { trucks } = useTrucks();
  const { drivers } = useDrivers();

  const [search, setSearch] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editExpense, setEditExpense] = useState<DbExpense | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DbExpense | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [sortBy, setSortBy] = useState<'expense_date' | 'amount' | 'expense_type'>('expense_date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  // Filters
  const [filterType, setFilterType] = useState('all');
  const [filterTruck, setFilterTruck] = useState('all');
  const [filterPayment, setFilterPayment] = useState('all');
  const [filterSource, setFilterSource] = useState('all');
  const [filterDateQuick, setFilterDateQuick] = useState('all');

  const driverList = useMemo(() => drivers.map(d => ({
    id: d.id, name: d.name, service_type: d.service_type, truck_id: d.truck_id,
  })), [drivers]);

  // Only trucks with company drivers assigned (for the expense form)
  const companyDriverTrucks = useMemo(() => {
    return trucks.filter(t => {
      const driver = drivers.find(d => d.truck_id === t.id);
      return driver && driver.service_type === 'company_driver';
    });
  }, [trucks, drivers]);

  const filtered = useMemo(() => {
    let result = [...expenses];

    // Search
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(e =>
        e.description.toLowerCase().includes(q) ||
        (e.vendor || '').toLowerCase().includes(q) ||
        trucks.find(t => t.id === e.truck_id)?.license_plate?.toLowerCase().includes(q) ||
        trucks.find(t => t.id === e.truck_id)?.unit_number?.toLowerCase().includes(q)
      );
    }

    // Type filter
    if (filterType !== 'all') result = result.filter(e => e.expense_type === filterType);
    // Truck filter
    if (filterTruck !== 'all') result = result.filter(e => e.truck_id === filterTruck);
    // Payment filter
    if (filterPayment !== 'all') result = result.filter(e => e.payment_method === filterPayment);
    // Source filter
    if (filterSource !== 'all') result = result.filter(e => e.source === filterSource);

    // Date quick filters
    if (filterDateQuick !== 'all') {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      let startDate: Date;

      switch (filterDateQuick) {
        case 'this_week': {
          const day = today.getDay();
          startDate = new Date(today);
          startDate.setDate(today.getDate() - ((day + 6) % 7));
          break;
        }
        case 'this_month':
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          break;
        case 'this_year':
          startDate = new Date(now.getFullYear(), 0, 1);
          break;
        case 'last_30':
          startDate = new Date(today);
          startDate.setDate(today.getDate() - 30);
          break;
        default:
          startDate = new Date(0);
      }
      result = result.filter(e => new Date(e.expense_date) >= startDate);
    }

    // Sort
    result.sort((a, b) => {
      const dir = sortDir === 'asc' ? 1 : -1;
      if (sortBy === 'expense_date') return (a.expense_date > b.expense_date ? 1 : -1) * dir;
      if (sortBy === 'amount') return (a.amount - b.amount) * dir;
      return (a.expense_type > b.expense_type ? 1 : -1) * dir;
    });

    return result;
  }, [expenses, search, filterType, filterTruck, filterPayment, filterSource, filterDateQuick, sortBy, sortDir, trucks]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paged = filtered.slice((page - 1) * pageSize, page * pageSize);
  const totalAmount = filtered.reduce((s, e) => s + e.total_amount, 0);

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedIds.size === paged.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(paged.map(e => e.id)));
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    await deleteExpensesBatch(Array.from(selectedIds));
    setSelectedIds(new Set());
  };

  const handleSort = (col: typeof sortBy) => {
    if (sortBy === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortBy(col); setSortDir('desc'); }
  };

  const hasActiveFilters = filterType !== 'all' || filterTruck !== 'all' || filterPayment !== 'all' || filterSource !== 'all' || filterDateQuick !== 'all';

  // Empty state
  if (!loading && expenses.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="page-header">Expenses</h1>
        <Card>
          <CardContent className="p-12 text-center">
            <Receipt className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <h2 className="text-xl font-semibold mb-2">No expenses recorded yet</h2>
            <p className="text-muted-foreground mb-6">Start by importing fuel data or adding expenses manually</p>
            <div className="flex gap-3 justify-center">
              <Button onClick={() => setImportOpen(true)} className="bg-green-600 hover:bg-green-700 gap-2">
                <Upload className="h-4 w-4" /> Import Fuel Data
              </Button>
              <Button variant="outline" onClick={() => { setEditExpense(null); setFormOpen(true); }} className="gap-2">
                <Plus className="h-4 w-4" /> Add Expense
              </Button>
            </div>
          </CardContent>
        </Card>
        <ExpenseFormDialog open={formOpen} onOpenChange={setFormOpen} onSubmit={createExpense} trucks={companyDriverTrucks} drivers={driverList} />
        <FuelImportWizard open={importOpen} onOpenChange={setImportOpen} onImport={createExpensesBatch} trucks={trucks} drivers={driverList} existingExpenses={expenses} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="page-header">Expenses</h1>
          <p className="page-description">Track and manage all truck expenses</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => { setEditExpense(null); setFormOpen(true); }} className="gap-2" size="sm">
            <Plus className="h-4 w-4" /> Add Expense
          </Button>
          <Button onClick={() => setImportOpen(true)} className="bg-green-600 hover:bg-green-700 gap-2" size="sm">
            <Upload className="h-4 w-4" /> Import Fuel Data
          </Button>
        </div>
      </div>

      {/* Search + Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search..." value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }} className="pl-9 h-8 text-xs" />
        </div>
        <Filter className="h-4 w-4 text-muted-foreground" />
          <Select value={filterDateQuick} onValueChange={v => { setFilterDateQuick(v); setPage(1); }}>
            <SelectTrigger className="w-[130px] h-8 text-xs"><SelectValue placeholder="Date" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Dates</SelectItem>
              <SelectItem value="this_week">This Week</SelectItem>
              <SelectItem value="this_month">This Month</SelectItem>
              <SelectItem value="this_year">This Year</SelectItem>
              <SelectItem value="last_30">Last 30 Days</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterType} onValueChange={v => { setFilterType(v); setPage(1); }}>
            <SelectTrigger className="w-[140px] h-8 text-xs"><SelectValue placeholder="Type" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              {Object.entries(EXPENSE_TYPE_LABELS).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterTruck} onValueChange={v => { setFilterTruck(v); setPage(1); }}>
            <SelectTrigger className="w-[140px] h-8 text-xs"><SelectValue placeholder="Truck" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Trucks</SelectItem>
              {trucks.map(t => (
                <SelectItem key={t.id} value={t.id}>#{t.unit_number} {t.license_plate || ''}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterPayment} onValueChange={v => { setFilterPayment(v); setPage(1); }}>
            <SelectTrigger className="w-[140px] h-8 text-xs"><SelectValue placeholder="Payment" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Methods</SelectItem>
              {Object.entries(PAYMENT_METHOD_LABELS).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterSource} onValueChange={v => { setFilterSource(v); setPage(1); }}>
            <SelectTrigger className="w-[120px] h-8 text-xs"><SelectValue placeholder="Source" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Sources</SelectItem>
              <SelectItem value="manual">Manual</SelectItem>
              <SelectItem value="csv_import">CSV Import</SelectItem>
            </SelectContent>
          </Select>
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => {
              setFilterType('all'); setFilterTruck('all'); setFilterPayment('all'); setFilterSource('all'); setFilterDateQuick('all'); setPage(1);
            }}>Clear filters</Button>
          )}
      </div>

      {/* Expense Summary Dashboard */}
      <ExpenseSummaryDashboard
        expenses={filtered}
        trucks={trucks}
        drivers={driverList}
      />

      {/* Bulk actions */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
          <span className="text-sm font-medium">{selectedIds.size} selected</span>
          <Button variant="destructive" size="sm" onClick={handleBulkDelete} className="gap-1">
            <Trash2 className="h-3.5 w-3.5" /> Delete Selected
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setSelectedIds(new Set())}>Cancel</Button>
        </div>
      )}

      {/* Table */}
      <div className="glass-card overflow-hidden">
        <div className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b glass-table-header">
                  <th className="p-3 w-10">
                    <Checkbox checked={paged.length > 0 && selectedIds.size === paged.length}
                      onCheckedChange={toggleAll} />
                  </th>
                  <th className="p-3 text-left font-medium text-muted-foreground cursor-pointer hover:text-foreground"
                    onClick={() => handleSort('expense_date')}>
                    Date {sortBy === 'expense_date' && (sortDir === 'desc' ? '↓' : '↑')}
                  </th>
                  <th className="p-3 text-left font-medium text-muted-foreground">Truck</th>
                  <th className="p-3 text-left font-medium text-muted-foreground cursor-pointer hover:text-foreground"
                    onClick={() => handleSort('expense_type')}>
                    Type {sortBy === 'expense_type' && (sortDir === 'desc' ? '↓' : '↑')}
                  </th>
                  <th className="p-3 text-left font-medium text-muted-foreground hidden lg:table-cell">Description</th>
                  <th className="p-3 text-right font-medium text-muted-foreground cursor-pointer hover:text-foreground"
                    onClick={() => handleSort('amount')}>
                    Amount {sortBy === 'amount' && (sortDir === 'desc' ? '↓' : '↑')}
                  </th>
                  <th className="p-3 text-left font-medium text-muted-foreground hidden md:table-cell">Driver</th>
                  <th className="p-3 text-left font-medium text-muted-foreground hidden lg:table-cell">Payment</th>
                  <th className="p-3 text-left font-medium text-muted-foreground hidden lg:table-cell">Source</th>
                  <th className="p-3 text-right font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={10} className="p-8 text-center text-muted-foreground">Loading...</td></tr>
                ) : paged.length === 0 ? (
                  <tr><td colSpan={10} className="p-8 text-center text-muted-foreground">No expenses found</td></tr>
                ) : paged.map(expense => {
                  const truck = trucks.find(t => t.id === expense.truck_id);
                  return (
                    <tr key={expense.id} className="border-b glass-row">
                      <td className="p-3">
                        <Checkbox checked={selectedIds.has(expense.id)}
                          onCheckedChange={() => toggleSelect(expense.id)} />
                      </td>
                      <td className="p-3 font-medium">
                        {new Date(expense.expense_date + 'T00:00:00').toLocaleDateString('en-US')}
                      </td>
                      <td className="p-3">
                        {truck ? (
                          <div>
                            <span className="font-medium">#{truck.unit_number}</span>
                            <span className="text-muted-foreground text-xs ml-1">{truck.model || truck.make || ''}</span>
                          </div>
                        ) : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="p-3">
                        <Badge className={`text-xs ${EXPENSE_TYPE_COLORS[expense.expense_type] || 'bg-gray-100 text-gray-800'}`}>
                          {EXPENSE_TYPE_LABELS[expense.expense_type] || expense.expense_type}
                        </Badge>
                      </td>
                      <td className="p-3 hidden lg:table-cell max-w-[200px] truncate text-muted-foreground">
                        {expense.description}
                      </td>
                      <td className="p-3 text-right font-semibold">
                        ${expense.total_amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="p-3 hidden md:table-cell text-muted-foreground">
                        {expense.driver_name || '—'}
                      </td>
                      <td className="p-3 hidden lg:table-cell text-muted-foreground text-xs">
                        {PAYMENT_METHOD_LABELS[expense.payment_method] || expense.payment_method}
                      </td>
                      <td className="p-3 hidden lg:table-cell">
                        <Badge variant="outline" className="text-xs">
                          {expense.source === 'csv_import' ? 'CSV Import' : 'Manual'}
                        </Badge>
                      </td>
                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button className="glass-action-btn tint-amber inline-flex items-center"
                            onClick={() => { setEditExpense(expense); setFormOpen(true); }}>
                            <Pencil className="h-3.5 w-3.5" /> Edit
                          </button>
                          <button className="glass-action-btn tint-red inline-flex items-center"
                            onClick={() => setDeleteTarget(expense)}>
                            <Trash2 className="h-3.5 w-3.5" /> Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Footer: Total + Pagination */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-4 border-t">
            <div className="text-sm font-medium">
              Total: <span className="text-primary">${totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
              <span className="text-muted-foreground ml-2">({filtered.length} expenses)</span>
            </div>
            <div className="flex items-center gap-3 mt-2 sm:mt-0">
              <Select value={String(pageSize)} onValueChange={v => { setPageSize(Number(v)); setPage(1); }}>
                <SelectTrigger className="w-[80px] h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PAGE_SIZES.map(s => <SelectItem key={s} value={String(s)}>{s}/page</SelectItem>)}
                </SelectContent>
              </Select>
              <div className="flex items-center gap-1">
                <Button variant="outline" size="sm" className="h-8" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Prev</Button>
                <span className="text-sm px-2">{page}/{totalPages}</span>
                <Button variant="outline" size="sm" className="h-8" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Next</Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Dialogs */}
      <ExpenseFormDialog
        open={formOpen}
        onOpenChange={(o) => { setFormOpen(o); if (!o) setEditExpense(null); }}
        onSubmit={editExpense ? (input) => updateExpense(editExpense.id, input).then(() => null) : createExpense}
        trucks={companyDriverTrucks}
        drivers={driverList}
        editExpense={editExpense}
      />

      <FuelImportWizard
        open={importOpen}
        onOpenChange={setImportOpen}
        onImport={createExpensesBatch}
        trucks={trucks}
        drivers={driverList}
        existingExpenses={expenses}
      />

      {/* Delete confirmation */}
      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Expense</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Are you sure you want to delete this expense of <strong>${deleteTarget?.total_amount.toFixed(2)}</strong>?
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="destructive" onClick={async () => {
              if (deleteTarget) await deleteExpense(deleteTarget.id);
              setDeleteTarget(null);
            }}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Expenses;
