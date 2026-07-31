import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Wrench } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const STORAGE_KEY = 'maintenance_reminder_last';
const INTERVAL_MS = 48 * 60 * 60 * 1000; // 48 horas

function getEasternHour(): number {
  return new Date().toLocaleString('en-US', { timeZone: 'America/New_York', hour: 'numeric', hour12: false }) as unknown as number;
}

export function MaintenanceReminder() {
  const [open, setOpen] = useState(false);
  const { role, isMasterAdmin } = useAuth();
  const navigate = useNavigate();
  const isAdmin = role === 'admin' || isMasterAdmin;

  useEffect(() => {
    if (!isAdmin) return;

    const check = () => {
      const now = Date.now();
      const last = Number(localStorage.getItem(STORAGE_KEY) || '0');
      const elapsed = now - last;
      const hour = getEasternHour();

      // Mostrar si: pasaron 48h+ Y la hora Este es >= 9 (para que aparezca a las 9 AM)
      if (elapsed >= INTERVAL_MS && hour >= 9) {
        setOpen(true);
      }
    };

    // Chequear al montar y cada minuto
    check();
    const timer = setInterval(check, 60 * 1000);
    return () => clearInterval(timer);
  }, [isAdmin]);

  const dismiss = () => {
    localStorage.setItem(STORAGE_KEY, String(Date.now()));
    setOpen(false);
  };

  const goToMaintenance = () => {
    localStorage.setItem(STORAGE_KEY, String(Date.now()));
    setOpen(false);
    navigate('/maintenance');
  };

  if (!isAdmin) return null;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) dismiss(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Wrench className="h-5 w-5 text-[#EF9F27]" />
            Maintenance Reminder
          </DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          It's been 48 hours since the last odometer update. Please update the truck odometers to keep maintenance tracking accurate.
        </p>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={dismiss}>Remind me later</Button>
          <Button onClick={goToMaintenance}>Go to Maintenance</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
