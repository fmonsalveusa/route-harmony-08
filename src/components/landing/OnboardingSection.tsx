import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UserPlus, Loader2, ArrowRight } from "lucide-react";
import { toast } from "sonner";

export function OnboardingSection() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", phone: "", truck_type: "Box Truck" });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.email || !form.phone) {
      toast.error("Por favor completa todos los campos requeridos");
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-onboarding-token", {
        body: { name: form.name, email: form.email, phone: form.phone, truck_type: form.truck_type },
      });

      if (error || !data?.token) {
        throw new Error(data?.error || "Error al crear el registro");
      }

      toast.success("¡Registro iniciado! Completa tu información.");
      navigate(`/onboarding/${data.token}`);
    } catch (err: any) {
      toast.error(err.message || "Error al procesar tu solicitud");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section id="onboarding" className="py-20 bg-[hsl(214,52%,12%)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <AnimatePresence mode="wait">
          {!showForm ? (
            <motion.div
              key="cta"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="text-center max-w-2xl mx-auto"
            >
              <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
                ¿Listo para <span className="text-accent">Empezar</span>?
              </h2>
              <p className="text-white/60 mb-8 leading-relaxed">
                Regístrate en menos de 2 minutos. Proceso 100% digital, sin costo de registro y con activación en 24-48 horas.
              </p>
              <ul className="flex flex-wrap justify-center gap-4 text-white/70 text-sm mb-10">
                <li>✅ Sin costo</li>
                <li>✅ 100% digital</li>
                <li>✅ Activación rápida</li>
                <li>✅ Soporte en español</li>
              </ul>
              <Button
                onClick={() => setShowForm(true)}
                className="bg-accent hover:bg-accent/90 text-accent-foreground font-semibold text-lg px-10 py-6 h-auto"
                size="lg"
              >
                Regístrate como Driver
                <ArrowRight className="ml-2" size={20} />
              </Button>
            </motion.div>
          ) : (
            <motion.div
              key="form"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="grid lg:grid-cols-2 gap-12 items-center"
            >
              <div>
                <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
                  ¿Listo para <span className="text-accent">Empezar</span>?
                </h2>
                <p className="text-white/60 mb-6 leading-relaxed">
                  Regístrate en menos de 2 minutos. Llena este formulario rápido y te redirigiremos al proceso completo de onboarding.
                </p>
                <ul className="space-y-3 text-white/70 text-sm">
                  <li className="flex items-center gap-2">✅ Sin costo de registro</li>
                  <li className="flex items-center gap-2">✅ Proceso 100% digital</li>
                  <li className="flex items-center gap-2">✅ Activación en 24-48 horas</li>
                  <li className="flex items-center gap-2">✅ Soporte en español</li>
                </ul>
              </div>

              <motion.form
                onSubmit={handleSubmit}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.15 }}
                className="bg-card rounded-2xl p-8 shadow-2xl border"
              >
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
                    <UserPlus className="text-accent" size={20} />
                  </div>
                  <h3 className="font-bold text-foreground text-lg">Registro Rápido</h3>
                </div>

                <div className="space-y-4">
                  <div>
                    <Label htmlFor="name">Nombre completo *</Label>
                    <Input id="name" placeholder="Tu nombre" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
                  </div>
                  <div>
                    <Label htmlFor="email">Email *</Label>
                    <Input id="email" type="email" placeholder="tu@email.com" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
                  </div>
                  <div>
                    <Label htmlFor="phone">Teléfono *</Label>
                    <Input id="phone" type="tel" placeholder="+1 (000) 000-0000" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} required />
                  </div>
                  <div>
                    <Label>Tipo de vehículo</Label>
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
                    {loading ? "Procesando..." : "Comenzar Registro"}
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
