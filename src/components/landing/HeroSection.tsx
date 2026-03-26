import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowRight, CalendarIcon, Loader2, Truck } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import heroImg from "@/assets/landing-hero.jpg";
import { useLandingLang } from "@/contexts/LandingLanguageContext";
import t from "./landingTranslations";

export function HeroSection() {
  const { lang } = useLandingLang();
  const tr = t[lang];
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", phone: "", truck_type: "Box Truck" });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.email || !form.phone) {
      toast.error(tr.heroErrorRequired);
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-onboarding-token", {
        body: { name: form.name, email: form.email, phone: form.phone, truck_type: form.truck_type },
      });
      if (error || !data?.token) throw new Error(data?.error || tr.heroErrorCreate);
      toast.success(tr.heroSuccess);
      navigate(`/onboarding/${data.token}`);
    } catch (err: any) {
      toast.error(err.message || tr.heroErrorGeneric);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="relative pt-16 bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 lg:py-24">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <motion.div initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.6 }}>
            <div className="flex items-center gap-2 mb-6">
              <span className="inline-block bg-accent/10 text-accent px-3 py-1 rounded-full text-sm font-semibold border border-accent/20">
                {tr.heroBadge}
              </span>
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-[3.5rem] font-extrabold text-foreground leading-tight mb-6">
              {tr.heroTitle1}{" "}
              <span className="text-accent">{tr.heroTitle2}</span>
            </h1>

            <p className="text-lg text-muted-foreground mb-6 leading-relaxed max-w-lg">
              {tr.heroSubtitle}
            </p>


            <form onSubmit={handleSubmit} className="bg-card rounded-2xl border p-6 shadow-sm space-y-4">
              <h3 className="font-bold text-foreground text-base flex items-center gap-2">
                <Truck className="text-accent" size={20} />
                {tr.heroFormTitle}
              </h3>
              <div className="grid sm:grid-cols-2 gap-3">
                <Input placeholder={tr.heroName} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
                <Input type="email" placeholder={tr.heroEmail} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                <Input type="tel" placeholder={tr.heroPhone} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} required />
                <Select value={form.truck_type} onValueChange={(v) => setForm({ ...form, truck_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Box Truck">Box Truck</SelectItem>
                    <SelectItem value="Hotshot">Hotshot</SelectItem>
                    <SelectItem value="Dry Van">Dry Van</SelectItem>
                    <SelectItem value="Flatbed">Flatbed</SelectItem>
                    <SelectItem value="Reefer">Reefer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit" disabled={loading} className="w-full bg-accent hover:bg-accent/90 text-accent-foreground font-bold text-base py-3 h-auto">
                {loading ? <Loader2 className="animate-spin mr-2" size={18} /> : null}
                {loading ? tr.heroProcessing : tr.heroSubmit}
                {!loading && <ArrowRight className="ml-2" size={18} />}
              </Button>
            </form>

            <div className="flex flex-wrap gap-3 mt-6">
              {["Box Truck", "Hotshot", "Dry Van", "Flatbed"].map((v) => (
                <span key={v} className="inline-flex items-center gap-1.5 bg-secondary text-secondary-foreground px-3 py-1.5 rounded-full text-xs font-medium">
                  🚛 {v}
                </span>
              ))}
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.6, delay: 0.2 }} className="hidden lg:block">
            <div>
              <a
                href="#meeting"
                className="flex items-center justify-center gap-2 mb-4 bg-green-600 hover:bg-green-700 text-white font-bold px-6 py-3.5 rounded-xl text-lg transition-colors shadow-md"
              >
                <CalendarIcon size={20} className="text-primary-foreground" />
                {lang === "es" ? "📅 Agendar una Reunión" : "📅 Schedule a Meeting"}
              </a>
              <div className="rounded-2xl overflow-hidden shadow-2xl">
                <img src={heroImg} alt="Dispatch Up Fleet" className="w-full h-auto max-h-[65vh] object-cover" />
              </div>
              <div className="mt-4 bg-card rounded-xl p-4 border shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="text-center flex-1">
                    <p className="text-xs text-muted-foreground">{tr.heroOperating}</p>
                    <p className="font-bold text-foreground">{tr.heroStates}</p>
                  </div>
                  <div className="h-8 w-px bg-border" />
                  <div className="text-center flex-1">
                    <p className="text-xs text-muted-foreground">{tr.heroSupport}</p>
                    <p className="font-bold text-foreground">24/7</p>
                  </div>
                  <div className="h-8 w-px bg-border" />
                  <div className="text-center flex-1">
                    <p className="text-xs text-muted-foreground">{tr.heroLanguages}</p>
                    <p className="font-bold text-foreground">ES / EN</p>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
