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
      <DialogContent className="sm:max-w-md rounded-[28px] border-0 bg-[#f8fafd] dark:bg-background [&_label]:text-xs [&_label]:font-medium [&_label]:text-[#444746] dark:[&_label]:text-muted-foreground [&_input:not([type=checkbox]):not([type=radio]):not([type=file])]:rounded-lg [&_input]:shadow-none [&_input:not([type=checkbox]):not([type=radio])]:bg-white dark:[&_input]:bg-card [&_input]:border-[#c4c7c5] dark:[&_input]:border-border [&_input:focus-visible]:ring-1 [&_input:focus-visible]:ring-[#0b57d0] [&_input:focus-visible]:border-[#0b57d0] [&_button[role=combobox]]:rounded-lg [&_button[role=combobox]]:shadow-none [&_button[role=combobox]]:bg-white dark:[&_button[role=combobox]]:bg-card [&_button[role=combobox]]:border-[#c4c7c5] dark:[&_button[role=combobox]]:border-border [&_textarea]:rounded-lg [&_textarea]:shadow-none [&_textarea]:bg-white dark:[&_textarea]:bg-card [&_textarea]:border-[#c4c7c5]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2  text-[22px] leading-7 font-normal text-[#1f1f1f] dark:text-foreground">
            <Wrench className="h-5 w-5 text-[#EF9F27]" />
            Maintenance Reminder
          </DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          It's been 48 hours since the last odometer update. Please update the truck odometers to keep maintenance tracking accurate.
        </p>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button className="rounded-full px-4 shadow-none border-[#747775] dark:border-border text-[#0b57d0] dark:text-blue-300 hover:bg-[#e8f0fe] hover:text-[#0b57d0] font-medium bg-transparent" variant="outline" onClick={dismiss}>Remind me later</Button>
          <Button className="rounded-full px-5 bg-[#0b57d0] hover:bg-[#0842a0] text-white font-medium shadow-none" onClick={goToMaintenance}>Go to Maintenance</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
