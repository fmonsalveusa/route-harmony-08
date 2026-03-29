import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Zap, ArrowUpRight } from 'lucide-react';
import { useSubscription } from '@/hooks/useSubscription';
import { toast } from 'sonner';

interface DriverLimitDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const DriverLimitDialog = ({ open, onOpenChange }: DriverLimitDialogProps) => {
  const { subscription, activeDriverCount, getPlanLabel, openCustomerPortal } = useSubscription();
  const [loading, setLoading] = useState(false);

  const handleUpgrade = async () => {
    setLoading(true);
    const url = await openCustomerPortal();
    if (url) {
      window.open(url, '_blank');
    } else {
      toast.error('Error al abrir el portal de facturación');
    }
    setLoading(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mx-auto mb-3 p-3 rounded-full bg-destructive/10">
            <AlertTriangle className="h-8 w-8 text-destructive" />
          </div>
          <DialogTitle className="text-center text-xl">Límite de drivers alcanzado</DialogTitle>
          <DialogDescription className="text-center">
            Tu plan <strong>{getPlanLabel()}</strong> permite hasta{' '}
            <strong>{subscription?.max_drivers}</strong> drivers activos.
            Actualmente tienes <strong>{activeDriverCount}</strong>.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 mt-4">
          <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
            <div className="flex items-center gap-2 mb-2">
              <Zap className="h-5 w-5 text-primary" />
              <span className="font-semibold text-foreground">Actualiza tu plan</span>
            </div>
            <p className="text-sm text-muted-foreground">
              Actualiza a un plan superior para agregar más drivers y desbloquear funciones avanzadas.
            </p>
          </div>
          <Button className="w-full gap-2" onClick={handleUpgrade} disabled={loading}>
            {loading ? 'Abriendo...' : (
              <>
                <ArrowUpRight className="h-4 w-4" /> Actualizar plan
              </>
            )}
          </Button>
          <Button variant="ghost" className="w-full" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
