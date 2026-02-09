import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { useTruckFixedCosts, DbTruckFixedCost } from '@/hooks/useTruckFixedCosts';
import { DbTruck } from '@/hooks/useTrucks';
import { Plus, Trash2, Settings } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trucks: DbTruck[];
}

const fmt = (n: number) => '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function FixedCostsDialog({ open, onOpenChange, trucks }: Props) {
  const { fixedCosts, createFixedCost, updateFixedCost, deleteFixedCost } = useTruckFixedCosts();
  const [selectedTruckId, setSelectedTruckId] = useState<string>('');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [frequency, setFrequency] = useState('monthly');
  const [editing, setEditing] = useState<string | null>(null);

  const handleAdd = async () => {
    if (!selectedTruckId || !description || !amount) return;
    if (editing) {
      await updateFixedCost(editing, { description, amount: parseFloat(amount), frequency });
      setEditing(null);
    } else {
      await createFixedCost({ truck_id: selectedTruckId, description, amount: parseFloat(amount), frequency });
    }
    setDescription('');
    setAmount('');
    setFrequency('monthly');
  };

  const handleEdit = (fc: DbTruckFixedCost) => {
    setSelectedTruckId(fc.truck_id);
    setDescription(fc.description);
    setAmount(fc.amount.toString());
    setFrequency(fc.frequency);
    setEditing(fc.id);
  };

  const handleCancel = () => {
    setEditing(null);
    setDescription('');
    setAmount('');
    setFrequency('monthly');
  };

  // Group by truck
  const truckCosts = trucks.map(t => ({
    truck: t,
    costs: fixedCosts.filter(fc => fc.truck_id === t.id),
    monthlyTotal: fixedCosts
      .filter(fc => fc.truck_id === t.id)
      .reduce((sum, fc) => {
        switch (fc.frequency) {
          case 'weekly': return sum + fc.amount * 4.33;
          case 'yearly': return sum + fc.amount / 12;
          default: return sum + fc.amount;
        }
      }, 0),
  })).filter(tc => tc.costs.length > 0 || tc.truck.id === selectedTruckId);

  // Show all trucks if none selected
  const displayTrucks = selectedTruckId ? truckCosts : trucks.map(t => ({
    truck: t,
    costs: fixedCosts.filter(fc => fc.truck_id === t.id),
    monthlyTotal: fixedCosts
      .filter(fc => fc.truck_id === t.id)
      .reduce((sum, fc) => {
        switch (fc.frequency) {
          case 'weekly': return sum + fc.amount * 4.33;
          case 'yearly': return sum + fc.amount / 12;
          default: return sum + fc.amount;
        }
      }, 0),
  }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Fixed Costs Configuration
          </DialogTitle>
        </DialogHeader>

        {/* Add/Edit form */}
        <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 p-4 bg-muted/30 rounded-lg border">
          <div>
            <Label className="text-xs">Truck</Label>
            <Select value={selectedTruckId} onValueChange={setSelectedTruckId}>
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder="Select..." />
              </SelectTrigger>
              <SelectContent>
                {trucks.map(t => (
                  <SelectItem key={t.id} value={t.id}>#{t.unit_number}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="sm:col-span-2">
            <Label className="text-xs">Description</Label>
            <Input
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Insurance, Leasing, etc."
              className="h-9 text-xs"
            />
          </div>
          <div>
            <Label className="text-xs">Amount</Label>
            <Input
              type="number"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              placeholder="0.00"
              className="h-9 text-xs"
            />
          </div>
          <div className="flex flex-col">
            <Label className="text-xs">Frequency</Label>
            <div className="flex gap-1">
              <Select value={frequency} onValueChange={setFrequency}>
                <SelectTrigger className="h-9 text-xs flex-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="yearly">Yearly</SelectItem>
                </SelectContent>
              </Select>
              <Button size="sm" className="h-9" onClick={handleAdd} disabled={!selectedTruckId || !description || !amount}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            {editing && (
              <Button variant="ghost" size="sm" className="text-xs mt-1" onClick={handleCancel}>Cancel</Button>
            )}
          </div>
        </div>

        {/* Costs list by truck */}
        <div className="space-y-3 mt-2">
          {displayTrucks.map(tc => (
            <div key={tc.truck.id} className="border rounded-lg overflow-hidden">
              <div className="bg-muted/50 px-4 py-2 flex items-center justify-between">
                <span className="font-medium text-sm">
                  #{tc.truck.unit_number} — {tc.truck.make} {tc.truck.model}
                </span>
                <span className="text-sm font-bold text-primary">
                  {fmt(tc.monthlyTotal)}/mo
                </span>
              </div>
              {tc.costs.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Description</TableHead>
                      <TableHead className="text-xs text-right">Amount</TableHead>
                      <TableHead className="text-xs">Frequency</TableHead>
                      <TableHead className="text-xs text-right">Monthly Equiv.</TableHead>
                      <TableHead className="text-xs w-16"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tc.costs.map(fc => {
                      const monthly = fc.frequency === 'weekly' ? fc.amount * 4.33 : fc.frequency === 'yearly' ? fc.amount / 12 : fc.amount;
                      return (
                        <TableRow key={fc.id}>
                          <TableCell className="text-xs">{fc.description}</TableCell>
                          <TableCell className="text-xs text-right">{fmt(fc.amount)}</TableCell>
                          <TableCell className="text-xs capitalize">{fc.frequency}</TableCell>
                          <TableCell className="text-xs text-right font-medium">{fmt(monthly)}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex gap-1 justify-end">
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleEdit(fc)}>
                                <Settings className="h-3 w-3" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteFixedCost(fc.id)}>
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              ) : (
                <div className="px-4 py-3 text-xs text-muted-foreground">No fixed costs configured</div>
              )}
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
