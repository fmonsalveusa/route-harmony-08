import { useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UserPlus, Loader2, ArrowRight, CheckCircle2, Shield, Zap, Clock } from "lucide-react";
import { toast } from "sonner";
import { useLandingLang } from "@/contexts/LandingLanguageContext";
import t from "./landingTranslations";

export function OnboardingSection() {
  const { lang } = useLandingLang();
  const tr = t[lang];
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", phone: "", truck_type: "Box Truck" });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.email || !form.phone) {
      toast.error(tr.obErrorRequired);
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-onboarding-token", {
        body: { name: form.name, email: form.email, phone: form.phone, truck_type: form.truck_type },
      });
      if (error || !data?.token) throw new Error(data?.error || tr.obErrorCreate);
      toast.success(tr.obSuccess);
      navigate(`/onboarding/${data.token}`);
    } catch (err: any) {
      toast.error(err.message || tr.obErrorGeneric);
    } finally {
      setLoading(false);
    }
  };

  const trustItems = [
    { icon: Shield, text: lang === "es" ? "Sin costo" : "No cost" },
    { icon: Zap, text: lang === "es" ? "100% Digital" : "100% Digital" },
    { icon: Clock, text: lang === "es" ? "Activación 24-48h" : "24-48h Activation" },
  ];

  return (
    <section id="onboarding" className="py-20 bg-secondary/40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left side - CTA content */}
          <motion.div initial={{ opacity: 0, x: -20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}>
            <span className="text-sm font-semibold text-accent uppercase tracking-wider">
              {lang === "es" ? "Registro" : "Registration"}
            </span>
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground mt-2 mb-4">
              {tr.obTitle1} <span className="text-accent">{tr.obTitle2}</span>?
            </h2>
            <p className="text-muted-foreground mb-8 leading-relaxed">{tr.obSubtitle}</p>

            {/* Trust indicators */}
            <div className="flex flex-wrap gap-4 mb-8">
              {trustItems.map((item) => (
                <div key={item.text} className="flex items-center gap-2 bg-card border rounded-lg px-4 py-3">
                  <item.icon size={18} className="text-accent" />
                  <span className="text-sm font-semibold text-foreground">{item.text}</span>
                </div>
              ))}
            </div>

            {/* Benefits */}
            <ul className="space-y-3">
              {tr.obBenefits.map((b) => (
                <li key={b} className="flex items-center gap-2 text-muted-foreground text-sm">
                  <CheckCircle2 size={16} className="text-accent shrink-0" /> {b}
                </li>
              ))}
            </ul>
          </motion.div>

          {/* Right side - Form */}
          <motion.form
            onSubmit={handleSubmit}
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="bg-card rounded-2xl p-8 shadow-xl border"
          >
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
                <UserPlus className="text-accent" size={20} />
              </div>
              <h3 className="font-bold text-foreground text-lg">{tr.obFormTitle}</h3>
            </div>

            {/* Progress steps */}
            <div className="flex items-center gap-2 mb-6 text-xs">
              {[1, 2, 3].map((step) => (
                <div key={step} className="flex items-center gap-2 flex-1">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${step === 1 ? "bg-accent text-accent-foreground" : "bg-muted text-muted-foreground"}`}>
                    {step}
                  </div>
                  <span className="text-muted-foreground hidden sm:inline">
                    {step === 1 ? (lang === "es" ? "Datos" : "Info") : step === 2 ? (lang === "es" ? "Documentos" : "Documents") : (lang === "es" ? "Activación" : "Activation")}
                  </span>
                  {step < 3 && <div className="flex-1 h-px bg-border" />}
                </div>
              ))}
            </div>

            <div className="space-y-4">
              <div>
                <Label htmlFor="ob-name">{tr.obName}</Label>
                <Input id="ob-name" placeholder={tr.obNamePh} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
              </div>
              <div>
                <Label htmlFor="ob-email">{tr.obEmail}</Label>
                <Input id="ob-email" type="email" placeholder={tr.heroEmail} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
              </div>
              <div>
                <Label htmlFor="ob-phone">{tr.obPhone}</Label>
                <Input id="ob-phone" type="tel" placeholder={tr.heroPhone} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} required />
              </div>
              <div>
                <Label>{tr.obTruck}</Label>
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
              <Button type="submit" disabled={loading} className="w-full bg-accent hover:bg-accent/90 text-accent-foreground font-bold py-3.5 text-base h-auto">
                {loading ? <Loader2 className="animate-spin mr-2" size={18} /> : null}
                {loading ? tr.obProcessing : tr.obSubmit}
                {!loading && <ArrowRight className="ml-2" size={18} />}
              </Button>
            </div>
          </motion.form>
        </div>
      </div>
    </section>
  );
}
