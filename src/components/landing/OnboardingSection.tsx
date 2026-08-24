import { useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UserPlus, Loader2, ArrowRight, ArrowLeft, CheckCircle2, Shield, Zap, Clock, Truck as TruckIcon, Users, Briefcase } from "lucide-react";
import { toast } from "sonner";
import { useLandingLang } from "@/contexts/LandingLanguageContext";
import t from "./landingTranslations";
import { cn } from "@/lib/utils";

type ServiceType = "owner_operator" | "dispatch_service" | "company_driver";

interface ServiceOption {
  id: ServiceType;
  icon: any;
  titleEs: string;
  titleEn: string;
  descEs: string;
  descEn: string;
  bulletsEs: string[];
  bulletsEn: string[];
}

const SERVICE_OPTIONS: ServiceOption[] = [
  {
    id: "owner_operator",
    icon: TruckIcon,
    titleEs: "Owner Operator",
    titleEn: "Owner Operator",
    descEs: "Con tu camión propio, trabajas bajo nuestra autoridad (MC#) y nosotros nos encargamos de conseguirte las cargas y tú te enfocas en manejar.",
    descEn: "With your own truck, you work under our authority (MC#) and we handle finding loads for you so you can focus on driving.",
    bulletsEs: ["Trabajas bajo autoridad de 58 Logistics", "Firma de leasing + service agreement", "Cobros semanales"],
    bulletsEn: ["Work under 58 Logistics authority", "Leasing + service agreement signing", "Weekly payments"],
  },
  {
    id: "dispatch_service",
    icon: Briefcase,
    titleEs: "Dispatch Service",
    titleEn: "Dispatch Service",
    descEs: "Traes tu propio camión y operas bajo tu propia autoridad (MC#). Nosotros te mantenemos rodando.",
    descEn: "You bring your own truck and operate under your own authority (MC#). We keep you rolling.",
    bulletsEs: ["Tu propio camión y autoridad", "8% de comisión sobre gross rate", "Puedes salir cuando quieras"],
    bulletsEn: ["Your own truck and authority", "8% commission on gross rate", "You can leave anytime"],
  },
  {
    id: "company_driver",
    icon: Users,
    titleEs: "Company Driver",
    titleEn: "Company Driver",
    descEs: "Bienvenido a nuestro equipo de Conductores de 58 Logistics LLC. Manejas nuestros camiones y formas parte de un equipo profesional de conductores.",
    descEn: "Welcome to our 58 Logistics LLC driver team. You drive our trucks and are part of a professional driving team.",
    bulletsEs: ["Camión de la empresa", "Sueldo/porcentaje fijo", "Sin responsabilidad del vehículo"],
    bulletsEn: ["Company-provided truck", "Fixed salary/percentage", "No vehicle responsibility"],
  },
];

export function OnboardingSection() {
  const { lang } = useLandingLang();
  const tr = t[lang];
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [selectedService, setSelectedService] = useState<ServiceType | null>(null);
  const [form, setForm] = useState({ name: "", email: "", phone: "", truck_type: "Box Truck" });
  const [dispatchMode, setDispatchMode] = useState<"new" | "existing">("new");
  const [dispatchClientMc, setDispatchClientMc] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedService) return;
    if (!form.name || !form.email || !form.phone) {
      toast.error(tr.obErrorRequired);
      return;
    }
    if (selectedService === "dispatch_service" && dispatchMode === "existing" && !dispatchClientMc.trim()) {
      toast.error(lang === "es" ? "Ingresa el MC# de tu empresa" : "Enter your company MC#");
      return;
    }
    setLoading(true);
    try {
      const body: any = {
        name: form.name,
        email: form.email,
        phone: form.phone,
        truck_type: selectedService === "dispatch_service" ? null : form.truck_type,
        service_type: selectedService,
      };
      if (selectedService === "dispatch_service" && dispatchMode === "existing") {
        body.dispatch_service_client_mc = dispatchClientMc.trim();
      }
      const { data, error } = await supabase.functions.invoke("create-onboarding-token", { body });
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
    { icon: Clock, text: lang === "es" ? "Activación Inmediata" : "Immediate Activation" },
  ];

  return (
    <section id="onboarding" className="py-20 bg-secondary/40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-12 items-start">
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

          {/* Right side */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="bg-card rounded-2xl p-6 sm:p-8 shadow-xl border"
          >
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
                <UserPlus className="text-accent" size={20} />
              </div>
              <h3 className="font-bold text-foreground text-lg">
                {selectedService
                  ? (lang === "es" ? "Completa tus datos" : "Fill in your info")
                  : (lang === "es" ? "Selecciona tu tipo de servicio" : "Select your service type")}
              </h3>
            </div>

            {!selectedService ? (
              // PANTALLA 1: Cards de seleccion
              <div className="space-y-3">
                {SERVICE_OPTIONS.map((opt) => {
                  const Icon = opt.icon;
                  const title = lang === "es" ? opt.titleEs : opt.titleEn;
                  const desc = lang === "es" ? opt.descEs : opt.descEn;
                  const bullets = lang === "es" ? opt.bulletsEs : opt.bulletsEn;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setSelectedService(opt.id)}
                      className={cn(
                        "w-full text-left p-4 rounded-xl border-2 transition-all",
                        "border-border hover:border-accent hover:bg-accent/5 hover:shadow-md group"
                      )}
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-11 h-11 rounded-lg bg-accent/10 flex items-center justify-center shrink-0 group-hover:bg-accent group-hover:text-white transition-colors">
                          <Icon size={22} className="text-accent group-hover:text-white transition-colors" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <h4 className="font-bold text-foreground">{title}</h4>
                            <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-accent group-hover:translate-x-0.5 transition-all shrink-0" />
                          </div>
                          <p className="text-xs text-muted-foreground leading-relaxed mb-2">{desc}</p>
                          <ul className="space-y-0.5">
                            {bullets.map((b) => (
                              <li key={b} className="text-[11px] text-muted-foreground flex items-center gap-1">
                                <CheckCircle2 className="h-3 w-3 text-accent shrink-0" /> {b}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              // PANTALLA 2: Formulario segun servicio elegido
              <form onSubmit={handleSubmit}>
                {/* Header con servicio elegido + volver */}
                <button
                  type="button"
                  onClick={() => { setSelectedService(null); setDispatchMode("new"); setDispatchClientMc(""); }}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-4"
                >
                  <ArrowLeft className="h-3 w-3" /> {lang === "es" ? "Cambiar servicio" : "Change service"}
                </button>

                {(() => {
                  const opt = SERVICE_OPTIONS.find((o) => o.id === selectedService)!;
                  const Icon = opt.icon;
                  const title = lang === "es" ? opt.titleEs : opt.titleEn;
                  return (
                    <div className="flex items-center gap-2 p-3 rounded-lg bg-accent/5 border border-accent/20 mb-4">
                      <div className="w-8 h-8 rounded-md bg-accent/15 flex items-center justify-center shrink-0">
                        <Icon size={16} className="text-accent" />
                      </div>
                      <span className="text-sm font-semibold text-foreground">{title}</span>
                    </div>
                  );
                })()}

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

                  {selectedService === "owner_operator" && (
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
                  )}

                  {selectedService === "dispatch_service" && (
                    <>
                      <div>
                        <Label>{lang === "es" ? "¿Tu empresa ya está registrada?" : "Is your company already registered?"}</Label>
                        <Select value={dispatchMode} onValueChange={(v) => setDispatchMode(v as "new" | "existing")}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="new">{lang === "es" ? "No - Registrar nueva empresa" : "No - Register new company"}</SelectItem>
                            <SelectItem value="existing">{lang === "es" ? "Sí - Ya está registrada" : "Yes - Already registered"}</SelectItem>
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground mt-1">
                          {dispatchMode === "new"
                            ? (lang === "es" ? "Vas a completar todos los datos de la empresa y firmar el agreement." : "You will complete company info and sign the agreement.")
                            : (lang === "es" ? "Solo necesitas llenar tus datos y los del camión." : "You only need to fill your info and truck data.")}
                        </p>
                      </div>
                      {dispatchMode === "existing" && (
                        <div>
                          <Label>{lang === "es" ? "MC# de tu empresa" : "Your company MC#"}</Label>
                          <Input
                            placeholder={lang === "es" ? "Ej: 1234567" : "e.g. 1234567"}
                            value={dispatchClientMc}
                            onChange={(e) => setDispatchClientMc(e.target.value)}
                          />
                        </div>
                      )}
                    </>
                  )}

                  <Button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-accent hover:bg-accent/90 text-accent-foreground font-bold py-3.5 text-base h-auto"
                  >
                    {loading ? <Loader2 className="animate-spin mr-2" size={18} /> : null}
                    {loading ? tr.obProcessing : tr.obSubmit}
                    {!loading && <ArrowRight className="ml-2" size={18} />}
                  </Button>
                </div>
              </form>
            )}
          </motion.div>
        </div>
      </div>
    </section>
  );
}
