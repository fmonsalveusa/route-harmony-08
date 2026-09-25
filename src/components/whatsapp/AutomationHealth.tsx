import { useCallback, useEffect, useState } from 'react';
import { RefreshCw, Loader2, CheckCircle2, AlertTriangle, XCircle, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface JobRow {
  jobname: string;
  schedule: string;
  active: boolean;
  last_run: string | null;
  last_status: string | null;
  last_error: string | null;
  failures_24h: number;
}

interface EmailFailure {
  reference: string | null;
  kind: string;
  stop_type: string | null;
  attempts: number;
  status: string;
  error: string | null;
  created_at: string;
}

interface WaFailure {
  template_key: string;
  recipient_name: string | null;
  reference: string | null;
  error: string | null;
  created_at: string;
}

interface UnlinkedThread {
  reference: string | null;
  status: string;
  thread_status: string;
}

interface Health {
  generated_at: string;
  jobs: JobRow[];
  broker_email: {
    counts: Record<string, number>;
    stuck: number;
    last_sent: string | null;
    failures: EmailFailure[];
  };
  whatsapp: {
    counts: Record<string, number>;
    last_sent: string | null;
    failures: WaFailure[];
  };
  unlinked_threads: UnlinkedThread[];
}

interface AccountCheck { user: string; ok: boolean; error?: string }

/** Qué hace cada trabajo agendado, para no tener que adivinar por el nombre */
const JOB_LABELS: Record<string, string> = {
  'broker-email-queue': 'Emails al broker (reintentos de la cola)',
  'clean-load-routes': 'Borrar rutas de mapa viejas',
  'update-diesel-price': 'Precio del diésel',
  'whatsapp-admin-report': 'Reporte diario de administración',
  'whatsapp-daily': 'Avisos de WhatsApp del día',
  'whatsapp-meeting-reminders': 'Recordatorio de reuniones',
  'whatsapp-pod-reminders': 'Recordatorio de POD a los drivers',
};

const formatET = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleString('en-US', {
        timeZone: 'America/New_York', month: '2-digit', day: '2-digit', hour: 'numeric', minute: '2-digit',
      })
    : '—';

const hoursSince = (iso: string | null) =>
  iso ? (Date.now() - new Date(iso).getTime()) / 3_600_000 : Infinity;

function Dot({ level }: { level: 'ok' | 'warn' | 'bad' }) {
  if (level === 'ok') return <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" />;
  if (level === 'warn') return <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0" />;
  return <XCircle className="h-4 w-4 text-red-600 flex-shrink-0" />;
}

function Section({ title, level, children }: { title: string; level: 'ok' | 'warn' | 'bad'; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border p-3 space-y-2">
      <div className="flex items-center gap-2">
        <Dot level={level} />
        <h3 className="text-sm font-semibold">{title}</h3>
      </div>
      {children}
    </div>
  );
}

/** Estado de todo lo que corre solo: trabajos agendados, emails al broker, WhatsApp y Gmail */
export function AutomationHealth() {
  const [health, setHealth] = useState<Health | null>(null);
  const [loading, setLoading] = useState(false);
  const [accounts, setAccounts] = useState<AccountCheck[] | null>(null);
  const [checking, setChecking] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc('automation_health' as any);
    if (error) toast.error(`No se pudo leer el estado: ${error.message}`);
    else setHealth(data as unknown as Health);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const checkGmail = async () => {
    setChecking(true);
    try {
      const { data, error } = await supabase.functions.invoke('broker-email', { body: { action: 'gmail_check' } });
      if (error) throw new Error(error.message);
      setAccounts((data?.accounts ?? []) as AccountCheck[]);
      if (data?.error) toast.warning(data.error);
    } catch (e: any) {
      toast.error(`No se pudo probar Gmail: ${e.message}`);
    } finally {
      setChecking(false);
    }
  };

  if (!health) {
    return (
      <p className="text-sm text-muted-foreground py-8 text-center">
        {loading ? 'Leyendo el estado...' : 'Sin datos'}
      </p>
    );
  }

  const jobsBad = health.jobs.filter(
    j => j.active && ((!!j.last_status && j.last_status !== 'succeeded') || j.failures_24h > 0),
  );
  const jobsOff = health.jobs.filter(j => !j.active);
  const email = health.broker_email;
  const wa = health.whatsapp;

  const emailLevel = email.failures.length > 0 || email.stuck > 0 ? 'warn' : 'ok';
  const waLevel = wa.failures.length > 0 ? 'warn' : 'ok';
  const jobsLevel = jobsBad.length > 0 ? 'bad' : jobsOff.length > 0 ? 'warn' : 'ok';
  const gmailLevel = accounts === null ? 'warn' : accounts.every(a => a.ok) ? 'ok' : 'bad';

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <p className="text-xs text-muted-foreground">Al {formatET(health.generated_at)} (hora del Este)</p>
        <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs ml-auto" onClick={load} disabled={loading}>
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />} Actualizar
        </Button>
      </div>

      {/* ─── Cuentas de Gmail ─── */}
      <Section title="Cuentas de Gmail" level={gmailLevel}>
        {accounts === null ? (
          <p className="text-xs text-muted-foreground">
            Prueba entrar a cada cuenta para confirmar que la App Password sigue activa. Si Google la revocó,
            los emails al broker dejan de salir sin más aviso.
          </p>
        ) : (
          <div className="space-y-1">
            {accounts.map(a => (
              <div key={a.user} className="flex items-start gap-2 text-xs">
                <Dot level={a.ok ? 'ok' : 'bad'} />
                <span className="font-medium">{a.user}</span>
                <span className={a.ok ? 'text-green-700' : 'text-red-700'}>{a.ok ? 'Entra bien' : a.error}</span>
              </div>
            ))}
            {accounts.length === 0 && <p className="text-xs text-red-700">No hay ninguna cuenta configurada.</p>}
          </div>
        )}
        <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={checkGmail} disabled={checking}>
          {checking ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Mail className="h-3.5 w-3.5" />}
          {checking ? 'Probando...' : 'Probar cuentas'}
        </Button>
      </Section>

      {/* ─── Emails al broker ─── */}
      <Section title="Emails al broker (últimos 7 días)" level={emailLevel}>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
          <span>Enviados: <b>{email.counts.sent ?? 0}</b></span>
          <span>Pendientes: <b>{(email.counts.pending ?? 0) + (email.counts.waiting_thread ?? 0)}</b></span>
          <span className={email.failures.length > 0 ? 'text-red-700' : ''}>
            Fallaron: <b>{(email.counts.failed ?? 0) + (email.counts.skipped ?? 0)}</b>
          </span>
          <span className="text-muted-foreground">Último enviado: {formatET(email.last_sent)}</span>
        </div>
        {email.stuck > 0 && (
          <p className="text-xs text-amber-700">
            {email.stuck} email(es) llevan más de una hora esperando. Míralos en la pestaña Emails al broker.
          </p>
        )}
        {email.failures.length > 0 && (
          <div className="rounded-md border divide-y">
            {email.failures.map((f, i) => (
              <div key={i} className="px-2 py-1.5 text-xs">
                <div className="flex flex-wrap gap-x-2">
                  <span className="text-muted-foreground w-24 flex-shrink-0">{formatET(f.created_at)}</span>
                  <span className="font-medium">Carga #{f.reference ?? '—'}</span>
                  <span className="text-muted-foreground">
                    {f.kind === 'arrival' ? 'Llegada' : 'Documentos'}
                    {f.stop_type ? ` · ${f.stop_type === 'pickup' ? 'Pickup' : 'Entrega'}` : ''}
                    {f.attempts > 0 ? ` · ${f.attempts} intento(s)` : ''}
                  </span>
                </div>
                {f.error && <p className="text-red-700 mt-0.5">{f.error}</p>}
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* ─── WhatsApp ─── */}
      <Section title="WhatsApp (últimos 7 días)" level={waLevel}>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
          <span>Enviados: <b>{wa.counts.sent ?? 0}</b></span>
          <span className={wa.failures.length > 0 ? 'text-red-700' : ''}>Fallaron: <b>{wa.counts.failed ?? 0}</b></span>
          <span>No enviados: <b>{wa.counts.skipped ?? 0}</b></span>
          <span className="text-muted-foreground">Último enviado: {formatET(wa.last_sent)}</span>
        </div>
        {hoursSince(wa.last_sent) > 48 && (
          <p className="text-xs text-amber-700">Hace más de 2 días que no sale ningún mensaje. Revisa la conexión del número.</p>
        )}
        {wa.failures.length > 0 && (
          <div className="rounded-md border divide-y">
            {wa.failures.map((f, i) => (
              <div key={i} className="px-2 py-1.5 text-xs">
                <div className="flex flex-wrap gap-x-2">
                  <span className="text-muted-foreground w-24 flex-shrink-0">{formatET(f.created_at)}</span>
                  <span className="font-medium">{f.recipient_name ?? f.template_key}</span>
                  {f.reference && <span className="text-muted-foreground">Carga #{f.reference}</span>}
                </div>
                {f.error && <p className="text-red-700 mt-0.5">{f.error}</p>}
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* ─── Trabajos agendados ─── */}
      <Section title="Trabajos agendados" level={jobsLevel}>
        <div className="rounded-md border divide-y">
          {health.jobs.map(j => {
            const failed = j.last_status && j.last_status !== 'succeeded';
            const level = !j.active ? 'warn' : failed || j.failures_24h > 0 ? 'bad' : 'ok';
            return (
              <div key={j.jobname} className="px-2 py-1.5 text-xs">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                  <Dot level={level} />
                  <span className="font-medium">{JOB_LABELS[j.jobname] ?? j.jobname}</span>
                  <code className="text-[10px] text-muted-foreground">{j.schedule}</code>
                  {!j.active && <span className="text-amber-700">apagado</span>}
                  <span className="text-muted-foreground ml-auto">Última: {formatET(j.last_run)}</span>
                </div>
                {j.last_error && <p className="text-red-700 mt-0.5">{j.last_error}</p>}
                {!j.last_error && j.failures_24h > 0 && (
                  <p className="text-red-700 mt-0.5">{j.failures_24h} falla(s) en las últimas 24 horas.</p>
                )}
              </div>
            );
          })}
          {health.jobs.length === 0 && <p className="text-xs text-muted-foreground px-2 py-3">No hay trabajos agendados.</p>}
        </div>
        <p className="text-[11px] text-muted-foreground">Los horarios están en UTC: son 4 o 5 horas más que la hora del Este.</p>
      </Section>

      {/* ─── Hilos sin enlazar ─── */}
      <Section title="Cargas activas sin hilo de Gmail" level={health.unlinked_threads.length > 0 ? 'warn' : 'ok'}>
        {health.unlinked_threads.length === 0 ? (
          <p className="text-xs text-muted-foreground">Todas las cargas activas tienen su hilo enlazado.</p>
        ) : (
          <>
            <p className="text-xs text-muted-foreground">
              Estas cargas no van a recibir los emails automáticos hasta que se elija el hilo en el detalle de la carga.
            </p>
            <div className="flex flex-wrap gap-1.5">
              {health.unlinked_threads.map((t, i) => (
                <span key={i} className="text-xs rounded-full bg-amber-100 text-amber-900 px-2 py-0.5">
                  #{t.reference ?? '—'}
                </span>
              ))}
            </div>
          </>
        )}
      </Section>
    </div>
  );
}
