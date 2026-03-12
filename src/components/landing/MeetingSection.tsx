import { useState } from "react";
import { motion } from "framer-motion";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { CalendarIcon, Loader2, Clock } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { US_STATES } from "@/lib/usStates";

const SERVICE_OPTIONS = [
  "Dispatching para MC# propio",
  "Leasing bajo nuestro MC#",
  "Curso de Dispatcher",
  "Tracking Up App",
  "Asesoría de Negocios",
  "Tramitación de Permisos",
  "Dispatch Up TMS",
  "Auditoría FMCSA",
];

const TRUCK_TYPES = ["Box Truck", "Hotshot", "Dry Van", "Flatbed", "Reefer"];

function getTimeSlots(selectedDate: Date | undefined) {
  if (!selectedDate) return [];
  const day = selectedDate.getDay();
  const startHour = day === 6 ? 9 : 10;
  const endHour = day === 6 ? 12 : 17;
  const slots: string[] = [];
  for (let h = startHour; h < endHour; h++) {
    for (const m of [0, 30]) {
      const period = h >= 12 ? "PM" : "AM";
      const displayHour = h > 12 ? h - 12 : h;
      slots.push(`${displayHour}:${String(m).padStart(2, "0")} ${period}`);
    }
  }
  return slots;
}

export function MeetingSection() {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    driver_name: "", phone: "", city: "", state: "", truck_type: "", meeting_time: "", service_interest: "", comments: "",
  });
  const [date, setDate] = useState<Date>();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.driver_name || !form.phone || !form.city || !form.state || !form.truck_type || !date || !form.meeting_time) {
      toast.error("Por favor completa todos los campos");
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-meeting-request", {
        body: { ...form, driver_name: form.driver_name.trim(), phone: form.phone.trim(), city: form.city.trim(), meeting_date: format(date, "yyyy-MM-dd") },
      });
      if (error) throw new Error("Error al enviar la solicitud");
      if (data?.error) throw new Error(data.error);
      toast.success("¡Reunión agendada! Te contactaremos para confirmar.");
      setForm({ driver_name: "", phone: "", city: "", state: "", truck_type: "", meeting_time: "", service_interest: "", comments: "" });
      setDate(undefined);
    } catch (err: any) {
      toast.error(err.message || "Error al procesar tu solicitud");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section id="meeting" className="py-20 bg-secondary/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">
              Agenda una <span className="text-accent">Reunión</span>
            </h2>
            <p className="text-muted-foreground mb-6 leading-relaxed">
              ¿Tienes preguntas sobre nuestros servicios? Agenda una reunión con nuestro equipo y te explicaremos cómo podemos ayudarte a crecer tu negocio de trucking.
            </p>
            <ul className="space-y-3 text-muted-foreground text-sm">
              <li className="flex items-center gap-2">📅 Elige la fecha y hora que mejor te convenga</li>
              <li className="flex items-center gap-2">📞 Te contactaremos para confirmar</li>
              <li className="flex items-center gap-2">💼 Consulta personalizada sin compromiso</li>
              <li className="flex items-center gap-2">🇺🇸 Atención en español e inglés</li>
            </ul>
          </motion.div>

          <motion.form
            onSubmit={handleSubmit}
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="bg-card rounded-2xl p-8 shadow-lg border"
          >
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
                <CalendarIcon className="text-accent" size={20} />
              </div>
              <h3 className="font-bold text-foreground text-lg">Agendar Reunión</h3>
            </div>

            <div className="space-y-4">
              <div>
                <Label htmlFor="meeting-name">Nombre completo *</Label>
                <Input id="meeting-name" placeholder="Tu nombre" maxLength={100} value={form.driver_name} onChange={(e) => setForm({ ...form, driver_name: e.target.value })} required />
              </div>
              <div>
                <Label htmlFor="meeting-phone">Teléfono *</Label>
                <Input id="meeting-phone" type="tel" placeholder="+1 (000) 000-0000" maxLength={20} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="meeting-city">Ciudad *</Label>
                  <Input id="meeting-city" placeholder="Tu ciudad" maxLength={100} value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} required />
                </div>
                <div>
                  <Label>Estado *</Label>
                  <Select value={form.state} onValueChange={(v) => setForm({ ...form, state: v })}>
                    <SelectTrigger><SelectValue placeholder="Estado" /></SelectTrigger>
                    <SelectContent className="max-h-[200px]">
                      {US_STATES.map((s) => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>Tipo de vehículo *</Label>
                <Select value={form.truck_type} onValueChange={(v) => setForm({ ...form, truck_type: v })}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                  <SelectContent>
                    {TRUCK_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Servicio de interés</Label>
                <Select value={form.service_interest} onValueChange={(v) => setForm({ ...form, service_interest: v })}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar servicio" /></SelectTrigger>
                  <SelectContent className="bg-popover z-50">
                    {SERVICE_OPTIONS.map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Fecha *</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !date && "text-muted-foreground")}>
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {date ? format(date, "MM/dd/yyyy") : "Seleccionar"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single" selected={date}
                        onSelect={(d) => { setDate(d); setForm(f => ({ ...f, meeting_time: "" })); }}
                        disabled={(d) => { const today = new Date(); today.setHours(0,0,0,0); return d < today || d.getDay() === 0; }}
                        initialFocus className="p-3 pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div>
                  <Label>Hora *</Label>
                  <Select value={form.meeting_time} onValueChange={(v) => setForm({ ...form, meeting_time: v })}>
                    <SelectTrigger>
                      <Clock className="mr-2 h-4 w-4 text-muted-foreground" />
                      <SelectValue placeholder="Hora" />
                    </SelectTrigger>
                    <SelectContent className="max-h-[200px]">
                      {getTimeSlots(date).map((t) => (
                        <SelectItem key={t} value={t}>{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label htmlFor="meeting-comments">Comentario</Label>
                <Textarea id="meeting-comments" placeholder="Algún comentario adicional..." maxLength={500} rows={3} value={form.comments} onChange={(e) => setForm({ ...form, comments: e.target.value })} />
              </div>
              <Button type="submit" disabled={loading} className="w-full bg-accent hover:bg-accent/90 text-accent-foreground font-semibold py-3 text-base">
                {loading ? <Loader2 className="animate-spin mr-2" size={18} /> : null}
                {loading ? "Enviando..." : "Agendar Reunión"}
              </Button>
            </div>
          </motion.form>
        </div>
      </div>
    </section>
  );
}
