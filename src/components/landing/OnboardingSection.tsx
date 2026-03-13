import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UserPlus, Loader2, ArrowRight, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { useLandingLang } from "@/contexts/LandingLanguageContext";
import t from "./landingTranslations";

export function OnboardingSection() {
  const { lang } = useLandingLang();
  const tr = t[lang];
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
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

  return (
    <section id="onboarding" className="py-20 bg-secondary/60">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <AnimatePresence mode="wait">
          {!showForm ? (
            <motion.div key="cta" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="text-center max-w-2xl mx-auto">
              <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">
                {tr.obTitle1} <span className="text-accent">{tr.obTitle2}</span>?
              </h2>
              <p className="text-muted-foreground mb-8 leading-relaxed">{tr.obSubtitle}</p>
              <div className="flex flex-wrap justify-center gap-4 text-muted-foreground text-sm mb-10">
                {tr.obBenefits.map((b) => (
                  <span key={b} className="flex items-center gap-1.5">
                    <CheckCircle2 size={14} className="text-accent" /> {b}
                  </span>
                ))}
              </div>
              <Button onClick={() => setShowForm(true)} className="bg-accent hover:bg-accent/90 text-accent-foreground font-semibold text-lg px-10 py-6 h-auto" size="lg">
                {tr.obCta}
                <ArrowRight className="ml-2" size={20} />
              </Button>
            </motion.div>
          ) : (
            <motion.div key="form" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="grid lg:grid-cols-2 gap-12 items-center">
              <div>
                <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">
                  {tr.obTitle1} <span className="text-accent">{tr.obTitle2}</span>?
                </h2>
                <p className="text-muted-foreground mb-6 leading-relaxed">{tr.obFormSubtitle}</p>
                <ul className="space-y-3 text-muted-foreground text-sm">
                  {tr.obBenefits.map((b) => (
                    <li key={b} className="flex items-center gap-2">
                      <CheckCircle2 size={14} className="text-accent" /> {b}
                    </li>
                  ))}
                </ul>
              </div>

              <motion.form onSubmit={handleSubmit} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15 }} className="bg-card rounded-2xl p-8 shadow-2xl border">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
                    <UserPlus className="text-accent" size={20} />
                  </div>
                  <h3 className="font-bold text-foreground text-lg">{tr.obFormTitle}</h3>
                </div>

                <div className="space-y-4">
                  <div>
                    <Label htmlFor="name">{tr.obName}</Label>
                    <Input id="name" placeholder={tr.obNamePh} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
                  </div>
                  <div>
                    <Label htmlFor="email">{tr.obEmail}</Label>
                    <Input id="email" type="email" placeholder={tr.heroEmail} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
                  </div>
                  <div>
                    <Label htmlFor="phone">{tr.obPhone}</Label>
                    <Input id="phone" type="tel" placeholder={tr.heroPhone} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} required />
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
                  <Button type="submit" disabled={loading} className="w-full bg-accent hover:bg-accent/90 text-accent-foreground font-semibold py-3 text-base">
                    {loading ? <Loader2 className="animate-spin mr-2" size={18} /> : null}
                    {loading ? tr.obProcessing : tr.obSubmit}
                  </Button>
                </div>
              </motion.form>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </section>
  );
}
