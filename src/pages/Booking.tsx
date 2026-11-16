import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { CalendarCheck, CalendarX, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { BookingWidget } from "@/components/booking/BookingWidget";
import logo from "@/assets/logo.png";

type Lang = "es" | "en";

const L = {
  es: {
    title: "Agenda una llamada con Dispatch Up",
    sub: "Elige el día y la hora que te queden mejor. Te llamamos para hablar de nuestro servicio y resolver tus dudas.",
    yourCall: "Tu llamada", reschedule: "Reagendar", cancel: "Cancelar llamada", cancelling: "Cancelando...",
    confirmCancel: "¿Seguro que quieres cancelar esta llamada?", cancelled: "Esta llamada fue cancelada.",
    past: "Esta llamada ya pasó.", bookNew: "Agendar otra llamada", notFound: "No encontramos esa reunión.",
    rescheduled: "¡Listo! Te enviamos la invitación con el nuevo horario.", at: "a las",
  },
  en: {
    title: "Book a call with Dispatch Up",
    sub: "Pick the day and time that work best for you. We'll call you to go over our service and answer your questions.",
    yourCall: "Your call", reschedule: "Reschedule", cancel: "Cancel call", cancelling: "Cancelling...",
    confirmCancel: "Are you sure you want to cancel this call?", cancelled: "This call was cancelled.",
    past: "This call already took place.", bookNew: "Book another call", notFound: "We couldn't find that meeting.",
    rescheduled: "Done! We sent you the invite with the new time.", at: "at",
  },
};

function initialLang(): Lang {
  try {
    const stored = localStorage.getItem("landing-lang");
    if (stored === "en" || stored === "es") return stored;
  } catch { /* sin almacenamiento */ }
  return navigator.language?.toLowerCase().startsWith("es") ? "es" : "en";
}

interface Meeting { name: string; date: string; time: string; cancelled: boolean; past: boolean }

export default function Booking() {
  const { token } = useParams();
  const [lang, setLang] = useState<Lang>(initialLang);
  const s = L[lang];
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [loading, setLoading] = useState(!!token);
  const [mode, setMode] = useState<"view" | "reschedule">("view");
  const [cancelling, setCancelling] = useState(false);

  const toggleLang = () => setLang((l) => {
    const next = l === "es" ? "en" : "es";
    try { localStorage.setItem("landing-lang", next); } catch { /* sin almacenamiento */ }
    return next;
  });

  useEffect(() => {
    document.title = lang === "en" ? "Book a call · Dispatch Up" : "Agendar llamada · Dispatch Up";
  }, [lang]);

  useEffect(() => {
    if (!token) return;
    (async () => {
      const { data } = await supabase.functions.invoke("booking", { body: { action: "get", token } });
      setMeeting(data && !data.error ? data : null);
      setLoading(false);
    })();
  }, [token]);

  const cancel = async () => {
    if (!token || !window.confirm(s.confirmCancel)) return;
    setCancelling(true);
    const { data, error } = await supabase.functions.invoke("booking", { body: { action: "cancel", token, lang } });
    setCancelling(false);
    if (error || data?.error) { toast.error(data?.error ?? error?.message); return; }
    setMeeting((m) => (m ? { ...m, cancelled: true } : m));
  };

  const prettyDate = (d: string) => {
    const [y, mo, da] = d.split("-").map(Number);
    return new Date(y, mo - 1, da).toLocaleDateString(lang === "en" ? "en-US" : "es-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
  };

  return (
    <div className="min-h-screen bg-secondary/50">
      <header className="bg-card border-b">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link to="/"><img src={logo} alt="Dispatch Up" className="h-8 w-auto" /></Link>
          <Button variant="ghost" size="sm" onClick={toggleLang}>{lang === "es" ? "English" : "Español"}</Button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8 sm:py-12">
        {!token && (
          <>
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-2">{s.title}</h1>
            <p className="text-muted-foreground mb-6">{s.sub}</p>
            <BookingWidget lang={lang} />
          </>
        )}

        {token && loading && <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>}

        {token && !loading && !meeting && (
          <div className="bg-card rounded-2xl p-8 border text-center space-y-4">
            <CalendarX className="h-10 w-10 mx-auto text-muted-foreground" />
            <p>{s.notFound}</p>
            <Button asChild><Link to="/agendar">{s.bookNew}</Link></Button>
          </div>
        )}

        {token && meeting && mode === "view" && (
          <div className="bg-card rounded-2xl p-8 border space-y-5 max-w-lg mx-auto">
            <div className="flex items-center gap-3">
              {meeting.cancelled ? <CalendarX className="h-8 w-8 text-destructive" /> : <CalendarCheck className="h-8 w-8 text-accent" />}
              <div>
                <p className="text-sm text-muted-foreground">{s.yourCall} · {meeting.name}</p>
                <p className={`font-semibold capitalize ${meeting.cancelled ? "line-through text-muted-foreground" : ""}`}>
                  {prettyDate(meeting.date)} {s.at} {meeting.time} ET
                </p>
              </div>
            </div>
            {meeting.cancelled || meeting.past ? (
              <>
                <p className="text-sm text-muted-foreground">{meeting.cancelled ? s.cancelled : s.past}</p>
                <Button asChild className="w-full"><Link to="/agendar">{s.bookNew}</Link></Button>
              </>
            ) : (
              <div className="flex flex-col sm:flex-row gap-2">
                <Button className="flex-1 bg-accent hover:bg-accent/90 text-accent-foreground" onClick={() => setMode("reschedule")}>{s.reschedule}</Button>
                <Button variant="outline" className="flex-1" disabled={cancelling} onClick={cancel}>
                  {cancelling && <Loader2 className="h-4 w-4 animate-spin mr-2" />}{cancelling ? s.cancelling : s.cancel}
                </Button>
              </div>
            )}
          </div>
        )}

        {token && meeting && mode === "reschedule" && (
          <BookingWidget
            lang={lang}
            token={token}
            onDone={(r) => {
              toast.success(s.rescheduled);
              setMeeting((m) => (m ? { ...m, date: r.date, time: r.time } : m));
              setMode("view");
            }}
          />
        )}
      </main>
    </div>
  );
}
