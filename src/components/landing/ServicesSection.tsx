import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, MessageCircle, DollarSign } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { services } from "./servicesData";
import { ServicePricingSection } from "./ServicePricingSection";
import { useLandingLang } from "@/contexts/LandingLanguageContext";
import t from "./landingTranslations";

const svcKeys = ["dispatching", "leasing", "tms", "tracking", "asesoria", "permisos", "curso", "auditoria"] as const;

export function ServicesSection() {
  const { lang } = useLandingLang();
  const tr = t[lang];

  const categories = [
    { label: tr.svcAll, filter: () => true },
    { label: tr.svcDispatching, filter: (t: string) => t.includes("Dispatching") || t.includes("Leasing") },
    { label: tr.svcSoftware, filter: (t: string) => t.includes("TMS") || t.includes("Tracking") },
    { label: tr.svcCompliance, filter: (t: string) => t.includes("Permisos") || t.includes("Permit") || t.includes("Auditoría") || t.includes("Audit") },
    { label: tr.svcTraining, filter: (t: string) => t.includes("Curso") || t.includes("Course") || t.includes("Asesoría") || t.includes("Consulting") },
  ];

  const [selectedService, setSelectedService] = useState<number | null>(null);
  const [showPricing, setShowPricing] = useState(false);
  const [activeTab, setActiveTab] = useState(0);
  const selected = selectedService !== null ? services[selectedService] : null;
  const localizedService = selectedService !== null ? tr.svcData[svcKeys[selectedService]] : null;

  const filteredServices = useMemo(() => {
    const cat = categories[activeTab];
    return services
      .map((s, i) => ({ ...s, originalIndex: i, localTitle: tr.svcData[svcKeys[i]]?.title || s.title, localDesc: tr.svcData[svcKeys[i]]?.description || s.description }))
      .filter((s) => cat.filter(s.title));
  }, [activeTab, lang]);

  const handleClose = () => { setSelectedService(null); setShowPricing(false); };

  return (
    <section id="servicios" className="py-20 bg-secondary/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-10">
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">{tr.svcTitle}</h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">{tr.svcSubtitle}</p>
        </motion.div>

        <div className="flex flex-wrap justify-center gap-2 mb-10">
          {categories.map((cat, i) => (
            <button key={cat.label} onClick={() => setActiveTab(i)} className={`px-5 py-2 rounded-full text-sm font-medium transition-all ${activeTab === i ? "bg-accent text-accent-foreground shadow-sm" : "bg-card text-muted-foreground hover:text-foreground border border-border"}`}>
              {cat.label}
            </button>
          ))}
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredServices.map((s, i) => (
            <motion.div key={s.title} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.08 }}
              className="group bg-card border rounded-xl overflow-hidden hover:shadow-lg hover:border-accent/30 transition-all duration-300 cursor-pointer"
              onClick={() => { setSelectedService(s.originalIndex); setShowPricing(false); }}
            >
              <div className="aspect-[2/1] overflow-hidden">
                <img src={s.image} alt={s.localTitle} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy" />
              </div>
              <div className="p-5">
                <div className="w-9 h-9 rounded-lg bg-accent/10 flex items-center justify-center mb-3 group-hover:bg-accent/20 transition-colors">
                  <s.icon className="text-accent" size={18} />
                </div>
                <h3 className="font-bold text-foreground text-base mb-1.5">{s.localTitle}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed line-clamp-2">{s.localDesc}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      <Dialog open={selectedService !== null} onOpenChange={(open) => !open && handleClose()}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          {selected && localizedService && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-3 mb-1">
                  <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
                    <selected.icon className="text-accent" size={20} />
                  </div>
                  <DialogTitle className="text-xl">{localizedService.title}</DialogTitle>
                </div>
                <DialogDescription className="text-base leading-relaxed pt-2">{localizedService.details}</DialogDescription>
              </DialogHeader>

              <div className="space-y-3 mt-2">
                <h4 className="font-semibold text-foreground text-sm">{tr.svcBenefits}</h4>
                <ul className="space-y-2">
                  {localizedService.benefits.map((b) => (
                    <li key={b} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <Check className="text-accent mt-0.5 shrink-0" size={16} /><span>{b}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="mt-4 space-y-3">
                {selected.pricing.type === "page" ? (
                  <ServicePricingSection pricing={selected.pricing} whatsappHref={selected.cta.href} onClose={handleClose} stripeConfig={selected.stripeConfig} />
                ) : (selected.pricing.fixedPrice || selected.pricing.plans) ? (
                  <>
                    {!showPricing ? (
                      <Button className="w-full gap-2" variant="outline" onClick={() => setShowPricing(true)}>
                        <DollarSign size={18} />{tr.svcViewPrices}
                      </Button>
                    ) : (
                      <AnimatePresence>
                        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.25 }}>
                          <ServicePricingSection pricing={selected.pricing} whatsappHref={selected.cta.href} onClose={handleClose} stripeConfig={selected.stripeConfig} />
                        </motion.div>
                      </AnimatePresence>
                    )}
                  </>
                ) : null}

                <Button className="w-full gap-2" variant={selected.pricing.type === "page" ? "outline" : "default"} asChild>
                  <a href={selected.cta.href} target="_blank" rel="noopener noreferrer">
                    <MessageCircle size={18} />{localizedService.cta}
                  </a>
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}
