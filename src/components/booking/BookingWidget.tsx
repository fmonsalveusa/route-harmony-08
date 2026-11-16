import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, CalendarCheck, Clock, Loader2, Phone } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { US_STATES } from "@/lib/usStates";
import t from "@/components/landing/landingTranslations";

const TRUCK_TYPES = ["Box Truck", "Hotshot", "Dry Van", "Flatbed", "Reefer"];

type Lang = "es" | "en";
interface Availability { duration: number; days: Record<string, string[]> }

const L = {
  es: {
    pick: "Elige día y hora", tz: "Hora del Este (ET)", noDays: "No hay horarios disponibles por ahora. Escríbenos y te contactamos.",
    pickDay: "Selecciona un día para ver los horarios", minutes: "min", call: "Llamada telefónica", next: "Continuar",
    email: "Email *", emailPh: "tu@email.com", back: "Cambiar horario", confirm: "Confirmar llamada", confirming: "Agendando...",
    done: "¡Listo! Tu llamada está agendada", doneSub: "Te enviamos la invitación a tu email. Desde ahí puedes reagendar o cancelar.",
    newTime: "Confirmar nuevo horario", localTime: "tu hora",
  },
  en: {
    pick: "Pick a day and time", tz: "Eastern Time (ET)", noDays: "No times available right now. Message us and we'll reach out.",
    pickDay: "Select a day to see the times", minutes: "min", call: "Phone call", next: "Continue",
    email: "Email *", emailPh: "you@email.com", back: "Change time", confirm: "Confirm call", confirming: "Booking...",
    done: "Done! Your call is booked", doneSub: "We sent the invite to your email. You can reschedule or cancel from there.",
    newTime: "Confirm new time", localTime: "your time",
  },
};

const toKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const fromKey = (k: string) => { const [y, m, d] = k.split("-").map(Number); return new Date(y, m - 1, d); };

/** "4:30 PM" del día en ET → hora local de quien mira, si su zona es otra */
function localHint(date: string, time: string, lang: Lang): string | null {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  if (!tz || tz === "America/New_York") return null;
  const m = time.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!m) return null;
  let h = Number(m[1]) % 12;
  if (m[3].toUpperCase() === "PM") h += 12;
  const [y, mo, d] = date.split("-").map(Number);
  // Instante: se prueba la hora como UTC y se corrige con el desfase de Nueva York en ese momento
  const guess = Date.UTC(y, mo - 1, d, h, Number(m[2]));
  const ny = new Date(new Date(guess).toLocaleString("en-US", { timeZone: "America/New_York" }));
  const utc = new Date(new Date(guess).toLocaleString("en-US", { timeZone: "UTC" }));
  const instant = new Date(guess - (ny.getTime() - utc.getTime()));
  return instant.toLocaleTimeString(lang === "en" ? "en-US" : "es-US", { hour: "numeric", minute: "2-digit" });
}

async function call(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke("booking", { body });
  // Los 4xx traen el motivo en el cuerpo
  if (error) {
    let msg = error.message;
    try { msg = (await (error as any).context?.json())?.error ?? msg; } catch { /* sin cuerpo */ }
    throw new Error(msg);
  }
  if (data?.error) throw new Error(data.error);
  return data;
}

export function BookingWidget({ lang, token, onDone, className }: {
  lang: Lang;
  /** Reagendar: solo se elige el nuevo horario */
  token?: string;
  onDone?: (r: { date: string; time: string }) => void;
  className?: string;
}) {
  const tr = t[lang];
  const s = L[lang];
  const [avail, setAvail] = useState<Availability | null>(null);
  const [loading, setLoading] = useState(true);
  const [day, setDay] = useState<string | null>(null);
  const [time, setTime] = useState<string | null>(null);
  const [step, setStep] = useState<"pick" | "form" | "done">("pick");
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", email: "", city: "", state: "", truck_type: "", service_interest: "", comments: "" });

  const load = async () => {
    setLoading(true);
    try {
      const r = await call({ action: "availability", exclude_token: token });
      setAvail(r);
      const first = Object.keys(r.days ?? {})[0];
      setDay((d) => (d && r.days[d] ? d : first ?? null));
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { void load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const days = avail?.days ?? {};
  const dayKeys = Object.keys(days);
  const slots = day ? days[day] ?? [] : [];
  const lastDay = dayKeys.length ? fromKey(dayKeys[dayKeys.length - 1]) : undefined;
  const prettyDay = useMemo(
    () => (day ? fromKey(day).toLocaleDateString(lang === "en" ? "en-US" : "es-US", { weekday: "long", month: "long", day: "numeric" }) : ""),
    [day, lang],
  );

  const slotTaken = async (msg: string) => {
    toast.error(msg);
    setTime(null);
    setStep("pick");
    await load();
  };

  const confirmReschedule = async () => {
    if (!day || !time || !token) return;
    setSaving(true);
    try {
      const r = await call({ action: "reschedule", token, date: day, time, lang });
      onDone?.(r);
    } catch (e: any) {
      await slotTaken(e.message);
    } finally {
      setSaving(false);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.phone || !form.email || !form.city || !form.state || !form.truck_type) {
      toast.error(tr.meetErrorFields);
      return;
    }
    setSaving(true);
    try {
      const r = await call({ action: "book", ...form, date: day, time, lang });
      setStep("done");
      onDone?.(r);
    } catch (err: any) {
      if (/horario|time/i.test(err.message)) await slotTaken(err.message);
      else toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const summary = day && time && (
    <div className="rounded-lg border bg-muted/40 p-3 text-sm space-y-1">
      <p className="font-semibold capitalize flex items-center gap-2"><CalendarCheck className="h-4 w-4 text-accent" /> {prettyDay}</p>
      <p className="flex items-center gap-2 text-muted-foreground">
        <Clock className="h-4 w-4" /> {time} ET · {avail?.duration ?? 30} {s.minutes}
        {localHint(day, time, lang) && <span>({localHint(day, time, lang)} {s.localTime})</span>}
      </p>
      <p className="flex items-center gap-2 text-muted-foreground"><Phone className="h-4 w-4" /> {s.call}</p>
    </div>
  );

  if (step === "done") {
    return (
      <div className={cn("bg-card rounded-2xl p-8 shadow-lg border text-center space-y-4", className)}>
        <CalendarCheck className="h-12 w-12 text-accent mx-auto" />
        <h3 className="text-xl font-bold">{s.done}</h3>
        {summary}
        <p className="text-sm text-muted-foreground">{s.doneSub}</p>
      </div>
    );
  }

  return (
    <div className={cn("bg-card rounded-2xl p-6 sm:p-8 shadow-lg border", className)}>
      {step === "pick" && (
        <>
          <div className="flex items-start justify-between gap-3 mb-4">
            <div>
              <h3 className="font-bold text-foreground text-lg">{s.pick}</h3>
              <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
                <Clock className="h-3.5 w-3.5" /> {avail?.duration ?? 30} {s.minutes} · {s.call} · {s.tz}
              </p>
            </div>
          </div>
          {loading ? (
            <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : dayKeys.length === 0 ? (
            <p className="text-sm text-muted-foreground py-10 text-center">{s.noDays}</p>
          ) : (
            <div className="grid sm:grid-cols-[auto_1fr] gap-4">
              <Calendar
                mode="single"
                selected={day ? fromKey(day) : undefined}
                onSelect={(d) => { if (d) { setDay(toKey(d)); setTime(null); } }}
                disabled={(d) => !days[toKey(d)]}
                fromDate={new Date()}
                toDate={lastDay}
                defaultMonth={day ? fromKey(day) : undefined}
                className="p-0 mx-auto pointer-events-auto"
              />
              <div className="min-w-0">
                {day ? (
                  <>
                    <p className="text-sm font-semibold capitalize mb-2">{prettyDay}</p>
                    <div className="grid grid-cols-2 sm:grid-cols-1 gap-2 max-h-[300px] overflow-y-auto pr-1">
                      {slots.map((sl) => (
                        <Button
                          key={sl}
                          type="button"
                          variant={time === sl ? "default" : "outline"}
                          className={cn("w-full", time === sl && "bg-accent hover:bg-accent/90 text-accent-foreground")}
                          onClick={() => setTime(sl)}
                        >
                          {sl}
                        </Button>
                      ))}
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">{s.pickDay}</p>
                )}
              </div>
            </div>
          )}
          {time && (
            <div className="mt-5 space-y-3">
              {summary}
              {token ? (
                <Button className="w-full bg-accent hover:bg-accent/90 text-accent-foreground" disabled={saving} onClick={confirmReschedule}>
                  {saving && <Loader2 className="animate-spin mr-2 h-4 w-4" />} {s.newTime}
                </Button>
              ) : (
                <Button className="w-full bg-accent hover:bg-accent/90 text-accent-foreground" onClick={() => setStep("form")}>{s.next}</Button>
              )}
            </div>
          )}
        </>
      )}

      {step === "form" && (
        <form onSubmit={submit} className="space-y-4">
          <button type="button" onClick={() => setStep("pick")} className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1">
            <ArrowLeft className="h-4 w-4" /> {s.back}
          </button>
          {summary}
          <div>
            <Label htmlFor="bk-name">{tr.meetName}</Label>
            <Input id="bk-name" placeholder={tr.meetNamePh} maxLength={100} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <Label htmlFor="bk-phone">{tr.meetPhone}</Label>
              <Input id="bk-phone" type="tel" placeholder={tr.heroPhone} maxLength={20} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} required />
            </div>
            <div>
              <Label htmlFor="bk-email">{s.email}</Label>
              <Input id="bk-email" type="email" placeholder={s.emailPh} maxLength={120} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="bk-city">{tr.meetCity}</Label>
              <Input id="bk-city" placeholder={tr.meetCityPh} maxLength={100} value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} required />
            </div>
            <div>
              <Label>{tr.meetState}</Label>
              <Select value={form.state} onValueChange={(v) => setForm({ ...form, state: v })}>
                <SelectTrigger><SelectValue placeholder={tr.meetStatePh} /></SelectTrigger>
                <SelectContent className="max-h-[200px]">
                  {US_STATES.map((st) => (<SelectItem key={st} value={st}>{st}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <Label>{tr.meetTruck}</Label>
              <Select value={form.truck_type} onValueChange={(v) => setForm({ ...form, truck_type: v })}>
                <SelectTrigger><SelectValue placeholder={tr.meetSelectPh} /></SelectTrigger>
                <SelectContent>{TRUCK_TYPES.map((tt) => (<SelectItem key={tt} value={tt}>{tt}</SelectItem>))}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>{tr.meetService}</Label>
              <Select value={form.service_interest} onValueChange={(v) => setForm({ ...form, service_interest: v })}>
                <SelectTrigger><SelectValue placeholder={tr.meetServicePh} /></SelectTrigger>
                <SelectContent className="bg-popover z-50">{tr.meetSvcOptions.map((o) => (<SelectItem key={o} value={o}>{o}</SelectItem>))}</SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label htmlFor="bk-comments">{tr.meetComment}</Label>
            <Textarea id="bk-comments" placeholder={tr.meetCommentPh} maxLength={500} rows={3} value={form.comments} onChange={(e) => setForm({ ...form, comments: e.target.value })} />
          </div>
          <Button type="submit" disabled={saving} className="w-full bg-accent hover:bg-accent/90 text-accent-foreground font-semibold py-3 text-base">
            {saving && <Loader2 className="animate-spin mr-2" size={18} />}
            {saving ? s.confirming : s.confirm}
          </Button>
        </form>
      )}
    </div>
  );
}
