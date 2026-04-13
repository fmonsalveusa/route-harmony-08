import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { AnimatePresence, motion } from 'framer-motion';
import { X, CalendarClock, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { format, parse, differenceInMinutes } from 'date-fns';

interface MeetingAlert {
  id: string;
  driver_name: string;
  meeting_date: string;
  meeting_time: string;
  truck_type: string;
  phone: string;
  city: string;
  state: string;
  type: 'new' | 'reminder'; // nueva reunion o recordatorio 15 min
}

// Convierte "2026-04-14" + "5:00 PM" a objeto Date
function parseMeetingDateTime(date: string, time: string): Date | null {
  try {
    return parse(`${date} ${time}`, 'yyyy-MM-dd h:mm a', new Date());
  } catch {
    return null;
  }
}

// Formatea la fecha para mostrar al usuario
function formatMeetingDate(date: string, time: string): string {
  try {
    const d = parse(date, 'yyyy-MM-dd', new Date());
    return `${format(d, 'MM/dd/yyyy')} a las ${time}`;
  } catch {
    return `${date} ${time}`;
  }
}

export function MeetingAlertModal() {
  const { role, isMasterAdmin } = useAuth();
  const [alerts, setAlerts] = useState<MeetingAlert[]>([]);
  // Guarda IDs de recordatorios ya mostrados en esta sesión para no repetir
  const remindedIds = useRef<Set<string>>(new Set());

  // Solo mostrar para admin y master_admin
  const isAdminUser = role === 'admin' || isMasterAdmin;

  // ── REALTIME: nueva reunión agendada ─────────────────────────────────
  useEffect(() => {
    if (!isAdminUser) return;

    const channel = supabase
      .channel('meeting-requests-alerts')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'meeting_requests' },
        (payload) => {
          const m = payload.new as any;
          const alert: MeetingAlert = {
            id: m.id,
            driver_name: m.driver_name,
            meeting_date: m.meeting_date,
            meeting_time: m.meeting_time,
            truck_type: m.truck_type,
            phone: m.phone,
            city: m.city,
            state: m.state,
            type: 'new',
          };
          setAlerts(prev => [alert, ...prev]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isAdminUser]);

  // ── POLLING: recordatorio 15 min antes ───────────────────────────────
  useEffect(() => {
    if (!isAdminUser) return;

    const checkUpcomingMeetings = async () => {
      const today = format(new Date(), 'yyyy-MM-dd');
      const { data } = await supabase
        .from('meeting_requests' as any)
        .select('*')
        .gte('meeting_date', today)
        .neq('status', 'cancelled');

      if (!data) return;

      const now = new Date();
      for (const m of data as any[]) {
        const meetingDt = parseMeetingDateTime(m.meeting_date, m.meeting_time);
        if (!meetingDt) continue;

        const minutesUntil = differenceInMinutes(meetingDt, now);

        // Mostrar recordatorio si faltan entre 13 y 17 minutos (ventana ±2 min)
        if (minutesUntil >= 13 && minutesUntil <= 17 && !remindedIds.current.has(m.id)) {
          remindedIds.current.add(m.id);
          const alert: MeetingAlert = {
            id: `reminder-${m.id}`,
            driver_name: m.driver_name,
            meeting_date: m.meeting_date,
            meeting_time: m.meeting_time,
            truck_type: m.truck_type,
            phone: m.phone,
            city: m.city,
            state: m.state,
            type: 'reminder',
          };
          setAlerts(prev => [alert, ...prev]);
        }
      }
    };

    // Verificar inmediatamente y luego cada minuto
    checkUpcomingMeetings();
    const interval = setInterval(checkUpcomingMeetings, 60_000);
    return () => clearInterval(interval);
  }, [isAdminUser]);

  const dismiss = (id: string) => {
    setAlerts(prev => prev.filter(a => a.id !== id));
  };

  if (!isAdminUser || alerts.length === 0) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center pointer-events-none">
      <AnimatePresence>
        {alerts.map((alert) => (
          <motion.div
            key={alert.id}
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.85 }}
            transition={{ type: 'spring', stiffness: 350, damping: 28 }}
            className="pointer-events-auto w-full max-w-md mx-4"
          >
            {/* Overlay oscuro detrás del modal */}
            <div className="fixed inset-0 bg-black/40 -z-10" onClick={() => dismiss(alert.id)} />

            <div className={`relative rounded-2xl shadow-2xl border-2 bg-card p-6 ${
              alert.type === 'reminder'
                ? 'border-amber-500'
                : 'border-accent'
            }`}>
              {/* Botón cerrar */}
              <button
                onClick={() => dismiss(alert.id)}
                className="absolute top-3 right-3 p-1.5 rounded-full hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>

              {/* Header */}
              <div className="flex items-center gap-3 mb-4">
                <div className={`p-2.5 rounded-xl ${
                  alert.type === 'reminder'
                    ? 'bg-amber-500/10 text-amber-500'
                    : 'bg-accent/10 text-accent'
                }`}>
                  {alert.type === 'reminder'
                    ? <Clock className="h-6 w-6" />
                    : <CalendarClock className="h-6 w-6" />
                  }
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {alert.type === 'reminder' ? '⏰ Recordatorio — 15 minutos' : '📅 Nueva Reunión Agendada'}
                  </p>
                  <h3 className="text-lg font-bold text-foreground leading-tight">
                    {alert.driver_name}
                  </h3>
                </div>
              </div>

              {/* Detalles */}
              <div className="space-y-2 text-sm mb-5">
                <div className="flex items-center justify-between bg-muted/50 rounded-lg px-3 py-2">
                  <span className="text-muted-foreground">Fecha y hora</span>
                  <span className="font-semibold text-foreground">
                    {formatMeetingDate(alert.meeting_date, alert.meeting_time)}
                  </span>
                </div>
                <div className="flex items-center justify-between bg-muted/50 rounded-lg px-3 py-2">
                  <span className="text-muted-foreground">Tipo de camión</span>
                  <span className="font-semibold text-foreground">{alert.truck_type}</span>
                </div>
                <div className="flex items-center justify-between bg-muted/50 rounded-lg px-3 py-2">
                  <span className="text-muted-foreground">Ubicación</span>
                  <span className="font-semibold text-foreground">{alert.city}, {alert.state}</span>
                </div>
                <div className="flex items-center justify-between bg-muted/50 rounded-lg px-3 py-2">
                  <span className="text-muted-foreground">Teléfono</span>
                  <span className="font-semibold text-foreground">{alert.phone}</span>
                </div>
              </div>

              {/* Botón cerrar */}
              <Button
                onClick={() => dismiss(alert.id)}
                className="w-full"
                variant={alert.type === 'reminder' ? 'default' : 'default'}
              >
                Entendido
              </Button>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
