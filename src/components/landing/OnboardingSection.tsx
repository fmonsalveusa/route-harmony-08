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
  const [loadingId, setLoadingId] = useState<ServiceType | null>(null);
  // Dispatch Service: si el card esta expandido pidiendo nueva/existente + MC#
  const [dispatchExpanded, setDispatchExpanded] = useState(false);
  const [dispatchMode, setDispatchMode] = useState<"new" | "existing">("new");
  const [dispatchClientMc, setDispatchClientMc] = useState("");

  const createTokenAndGo = async (serviceType: ServiceType, extra: any = {}) => {
    setLoadingId(serviceType);
    try {
      const body: any = { service_type: serviceType, ...extra };
      // El edge function requiere name/email/phone; enviamos placeholders (se sobreescriben en el onboarding).
      body.name = body.name || "Pending";
      body.email = body.email || "pending@onboarding.local";
      body.phone = body.phone || "000-000-0000";
      const { data, error } = await supabase.functions.invoke("create-onboarding-token", { body });
      if (error || !data?.token) throw new Error(data?.error || tr.obErrorCreate);
      navigate(`/onboarding/${data.token}`);
    } catch (err: any) {
      toast.error(err.message || tr.obErrorGeneric);
      setLoadingId(null);
    }
  };

  const handleCardClick = (id: ServiceType) => {
    if (id === "dispatch_service") {
      // Expandir card para preguntar nueva/existente + MC#
      setDispatchExpanded(true);
      return;
    }
    // OO y CD: crear token directo y avanzar
    createTokenAndGo(id);
  };

  const handleDispatchContinue = () => {
    if (dispatchMode === "existing" && !dispatchClientMc.trim()) {
      toast.error(lang === "es" ? "Ingresa el MC# de tu empresa" : "Enter your company MC#");
      return;
    }
    const extra: any = {};
    if (dispatchMode === "existing") extra.dispatch_service_client_mc = dispatchClientMc.trim();
    createTokenAndGo("dispatch_service", extra);
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

            <div className="flex flex-wrap gap-4 mb-8">
              {trustItems.map((item) => (
                <div key={item.text} className="flex items-center gap-2 bg-card border rounded-lg px-4 py-3">
                  <item.icon size={18} className="text-accent" />
                  <span className="text-sm font-semibold text-foreground">{item.text}</span>
                </div>
              ))}
            </div>

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
                {lang === "es" ? "Selecciona tu tipo de servicio" : "Select your service type"}
              </h3>
            </div>

            <div className="space-y-3">
              {SERVICE_OPTIONS.map((opt) => {
                const Icon = opt.icon;
                const title = lang === "es" ? opt.titleEs : opt.titleEn;
                const desc = lang === "es" ? opt.descEs : opt.descEn;
                const bullets = lang === "es" ? opt.bulletsEs : opt.bulletsEn;
                const isLoading = loadingId === opt.id;
                const isDispatchExpandedNow = opt.id === "dispatch_service" && dispatchExpanded;
                return (
                  <div key={opt.id}>
                    <button
                      type="button"
                      disabled={loadingId !== null && loadingId !== opt.id}
                      onClick={() => handleCardClick(opt.id)}
                      className={cn(
                        "w-full text-left p-4 rounded-xl border-2 transition-all group",
                        isDispatchExpandedNow
                          ? "border-accent bg-accent/5"
                          : "border-border hover:border-accent hover:bg-accent/5 hover:shadow-md",
                        loadingId !== null && loadingId !== opt.id ? "opacity-50" : ""
                      )}
                    >
                      <div className="flex items-start gap-3">
                        <div className={cn(
                          "w-11 h-11 rounded-lg flex items-center justify-center shrink-0 transition-colors",
                          isDispatchExpandedNow ? "bg-accent text-white" : "bg-accent/10 group-hover:bg-accent group-hover:text-white"
                        )}>
                          {isLoading ? (
                            <Loader2 className="h-5 w-5 animate-spin text-accent" />
                          ) : (
                            <Icon size={22} className={isDispatchExpandedNow ? "text-white" : "text-accent group-hover:text-white transition-colors"} />
                          )}
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

                    {/* Sub-formulario para Dispatch Service (nueva/existente + MC#) */}
                    {isDispatchExpandedNow && (
                      <div className="mt-2 p-4 rounded-xl border-2 border-dashed border-accent/40 bg-accent/[0.03] space-y-3">
                        <div>
                          <Label className="text-xs">
                            {lang === "es" ? "¿Tu empresa ya está registrada?" : "Is your company already registered?"}
                          </Label>
                          <Select value={dispatchMode} onValueChange={(v) => setDispatchMode(v as "new" | "existing")}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="new">{lang === "es" ? "No - Registrar nueva empresa" : "No - Register new company"}</SelectItem>
                              <SelectItem value="existing">{lang === "es" ? "Sí - Ya está registrada" : "Yes - Already registered"}</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        {dispatchMode === "existing" && (
                          <div>
                            <Label className="text-xs">{lang === "es" ? "MC# de tu empresa" : "Your company MC#"}</Label>
                            <Input
                              placeholder={lang === "es" ? "Ej: 1234567" : "e.g. 1234567"}
                              value={dispatchClientMc}
                              onChange={(e) => setDispatchClientMc(e.target.value)}
                            />
                          </div>
                        )}
                        <div className="flex gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => { setDispatchExpanded(false); setDispatchMode("new"); setDispatchClientMc(""); }}
                            className="gap-1 text-xs"
                          >
                            <ArrowLeft className="h-3.5 w-3.5" /> {lang === "es" ? "Cancelar" : "Cancel"}
                          </Button>
                          <Button
                            onClick={handleDispatchContinue}
                            disabled={loadingId !== null}
                            className="flex-1 bg-accent hover:bg-accent/90 text-accent-foreground gap-1"
                            size="sm"
                          >
                            {loadingId === "dispatch_service" ? (
                              <><Loader2 className="h-4 w-4 animate-spin" /> {lang === "es" ? "Creando..." : "Creating..."}</>
                            ) : (
                              <>{lang === "es" ? "Continuar" : "Continue"} <ArrowRight className="h-4 w-4" /></>
                            )}
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
