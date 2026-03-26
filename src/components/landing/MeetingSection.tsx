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
import { useLandingLang } from "@/contexts/LandingLanguageContext";
import t from "./landingTranslations";

const TRUCK_TYPES = ["Box Truck", "Hotshot", "Dry Van", "Flatbed", "Reefer"];

function getTimeSlots() {
  return ["4:30 PM", "5:00 PM", "5:30 PM", "6:00 PM"];
}

export function MeetingSection() {
  const { lang } = useLandingLang();
  const tr = t[lang];
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ driver_name: "", phone: "", city: "", state: "", truck_type: "", meeting_time: "", service_interest: "", comments: "" });
  const [date, setDate] = useState<Date>();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.driver_name || !form.phone || !form.city || !form.state || !form.truck_type || !date || !form.meeting_time) {
      toast.error(tr.meetErrorFields);
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-meeting-request", {
        body: { ...form, driver_name: form.driver_name.trim(), phone: form.phone.trim(), city: form.city.trim(), meeting_date: format(date, "yyyy-MM-dd") },
      });
      if (error) throw new Error(tr.meetErrorSend);
      if (data?.error) throw new Error(data.error);
      toast.success(tr.meetSuccess);
      setForm({ driver_name: "", phone: "", city: "", state: "", truck_type: "", meeting_time: "", service_interest: "", comments: "" });
      setDate(undefined);
    } catch (err: any) {
      toast.error(err.message || tr.meetErrorGeneric);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section id="meeting" className="py-20 bg-secondary/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <motion.div initial={{ opacity: 0, x: -20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}>
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">
              {tr.meetTitle1} <span className="text-accent">{tr.meetTitle2}</span>
            </h2>
            <p className="text-muted-foreground mb-6 leading-relaxed">{tr.meetSubtitle}</p>
            <ul className="space-y-3 text-muted-foreground text-sm">
              <li className="flex items-center gap-2">{tr.meetBullet1}</li>
              <li className="flex items-center gap-2">{tr.meetBullet2}</li>
              <li className="flex items-center gap-2">{tr.meetBullet3}</li>
              <li className="flex items-center gap-2">{tr.meetBullet4}</li>
            </ul>
          </motion.div>

          <motion.form onSubmit={handleSubmit} initial={{ opacity: 0, x: 20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} className="bg-card rounded-2xl p-8 shadow-lg border">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
                <CalendarIcon className="text-accent" size={20} />
              </div>
              <h3 className="font-bold text-foreground text-lg">{tr.meetFormTitle}</h3>
            </div>

            <div className="space-y-4">
              <div>
                <Label htmlFor="meeting-name">{tr.meetName}</Label>
                <Input id="meeting-name" placeholder={tr.meetNamePh} maxLength={100} value={form.driver_name} onChange={(e) => setForm({ ...form, driver_name: e.target.value })} required />
              </div>
              <div>
                <Label htmlFor="meeting-phone">{tr.meetPhone}</Label>
                <Input id="meeting-phone" type="tel" placeholder={tr.heroPhone} maxLength={20} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="meeting-city">{tr.meetCity}</Label>
                  <Input id="meeting-city" placeholder={tr.meetCityPh} maxLength={100} value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} required />
                </div>
                <div>
                  <Label>{tr.meetState}</Label>
                  <Select value={form.state} onValueChange={(v) => setForm({ ...form, state: v })}>
                    <SelectTrigger><SelectValue placeholder={tr.meetStatePh} /></SelectTrigger>
                    <SelectContent className="max-h-[200px]">
                      {US_STATES.map((s) => (<SelectItem key={s} value={s}>{s}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>{tr.meetTruck}</Label>
                <Select value={form.truck_type} onValueChange={(v) => setForm({ ...form, truck_type: v })}>
                  <SelectTrigger><SelectValue placeholder={tr.meetSelectPh} /></SelectTrigger>
                  <SelectContent>
                    {TRUCK_TYPES.map((tt) => (<SelectItem key={tt} value={tt}>{tt}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>{tr.meetService}</Label>
                <Select value={form.service_interest} onValueChange={(v) => setForm({ ...form, service_interest: v })}>
                  <SelectTrigger><SelectValue placeholder={tr.meetServicePh} /></SelectTrigger>
                  <SelectContent className="bg-popover z-50">
                    {tr.meetSvcOptions.map((s) => (<SelectItem key={s} value={s}>{s}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>{tr.meetDate}</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !date && "text-muted-foreground")}>
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {date ? format(date, "MM/dd/yyyy") : tr.meetDatePh}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={date} onSelect={(d) => { setDate(d); setForm(f => ({ ...f, meeting_time: "" })); }} disabled={(d) => { const today = new Date(); today.setHours(0,0,0,0); return d < today || d.getDay() === 0; }} initialFocus className="p-3 pointer-events-auto" />
                    </PopoverContent>
                  </Popover>
                </div>
                <div>
                  <Label>{tr.meetTime}</Label>
                  <Select value={form.meeting_time} onValueChange={(v) => setForm({ ...form, meeting_time: v })}>
                    <SelectTrigger>
                      <Clock className="mr-2 h-4 w-4 text-muted-foreground" />
                      <SelectValue placeholder={tr.meetTimePh} />
                    </SelectTrigger>
                    <SelectContent className="max-h-[200px]">
                      {getTimeSlots(date).map((tt) => (<SelectItem key={tt} value={tt}>{tt}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label htmlFor="meeting-comments">{tr.meetComment}</Label>
                <Textarea id="meeting-comments" placeholder={tr.meetCommentPh} maxLength={500} rows={3} value={form.comments} onChange={(e) => setForm({ ...form, comments: e.target.value })} />
              </div>
              <Button type="submit" disabled={loading} className="w-full bg-accent hover:bg-accent/90 text-accent-foreground font-semibold py-3 text-base">
                {loading ? <Loader2 className="animate-spin mr-2" size={18} /> : null}
                {loading ? tr.meetSending : tr.meetSubmit}
              </Button>
            </div>
          </motion.form>
        </div>
      </div>
    </section>
  );
}
