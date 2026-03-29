import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, MessageCircle, DollarSign, ArrowRight } from "lucide-react";
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

  const [activeService, setActiveService] = useState(0);
  const [selectedService, setSelectedService] = useState<number | null>(null);
  const [showPricing, setShowPricing] = useState(false);

  const selected = selectedService !== null ? services[selectedService] : null;
  const localizedService = selectedService !== null ? tr.svcData[svcKeys[selectedService]] : null;

  const activeData = services[activeService];
  const activeLocalized = tr.svcData[svcKeys[activeService]];

  const handleClose = () => { setSelectedService(null); setShowPricing(false); };

  return (
    <section id="servicios" className="py-20 bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-14">
          <span className="text-sm font-semibold text-accent uppercase tracking-wider">{lang === "es" ? "Soluciones" : "Solutions"}</span>
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground mt-2 mb-4">{tr.svcTitle}</h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">{tr.svcSubtitle}</p>
        </motion.div>

        {/* Tabbed showcase */}
        <div className="grid lg:grid-cols-[320px_1fr] gap-8">
          {/* Tab list */}
          <div className="flex lg:flex-col gap-2 overflow-x-auto lg:overflow-visible pb-2 lg:pb-0 scrollbar-hide">
            {services.map((s, i) => {
              const loc = tr.svcData[svcKeys[i]];
              return (
                <button
                  key={s.title}
                  onClick={() => setActiveService(i)}
                  className={`flex items-center gap-3 px-4 py-3.5 rounded-xl text-left transition-all whitespace-nowrap lg:whitespace-normal min-w-[200px] lg:min-w-0 ${
                    activeService === i
                      ? "bg-accent text-accent-foreground shadow-md"
                      : "bg-card border text-foreground hover:bg-muted/50"
                  }`}
                >
                  <s.icon size={18} className={activeService === i ? "text-accent-foreground" : "text-accent"} />
                  <span className="font-medium text-sm">{loc?.title || s.title}</span>
                </button>
              );
            })}
          </div>

          {/* Active service showcase */}
          <AnimatePresence mode="wait">
            <motion.div
              key={activeService}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
              className="bg-card border rounded-2xl overflow-hidden shadow-sm"
            >
              <div className="grid md:grid-cols-2">
                {/* Image */}
                <div className="aspect-[4/3] md:aspect-auto overflow-hidden">
                  <img
                    src={activeData.image}
                    alt={activeLocalized?.title || activeData.title}
                    className="w-full h-full object-cover"
                  />
                </div>

                {/* Content */}
                <div className="p-6 sm:p-8 flex flex-col justify-center">
                  <div className="flex items-center gap-2 mb-3">
                    <activeData.icon size={20} className="text-accent" />
                    <h3 className="text-xl font-bold text-foreground">{activeLocalized?.title}</h3>
                  </div>
                  <p className="text-muted-foreground text-sm leading-relaxed mb-5">
                    {activeLocalized?.description}
                  </p>

                  {/* Price preview */}
                  {activeData.pricing.fixedPrice && (
                    <div className="bg-muted/50 rounded-lg px-4 py-3 mb-5 inline-flex items-baseline gap-2">
                      <span className="text-2xl font-extrabold text-foreground">
                        ${activeData.pricing.fixedPrice.amount}
                      </span>
                      <span className="text-muted-foreground text-sm">
                        {activeData.pricing.fixedPrice.period}
                      </span>
                    </div>
                  )}

                  {/* Benefits preview (first 3) */}
                  <ul className="space-y-2 mb-6">
                    {activeLocalized?.benefits.slice(0, 3).map((b) => (
                      <li key={b} className="flex items-start gap-2 text-sm text-muted-foreground">
                        <Check className="text-accent mt-0.5 shrink-0" size={14} />
                        <span>{b}</span>
                      </li>
                    ))}
                  </ul>

                  <div className="flex flex-col sm:flex-row gap-3">
                    <Button
                      onClick={() => { setSelectedService(activeService); setShowPricing(false); }}
                      className="gap-2"
                    >
                      {lang === "es" ? "Ver Detalles" : "View Details"}
                      <ArrowRight size={16} />
                    </Button>
                    <Button variant="outline" className="gap-2" asChild>
                      <a href={activeData.cta.href} target="_blank" rel="noopener noreferrer">
                        <MessageCircle size={16} />
                        WhatsApp
                      </a>
                    </Button>
                  </div>
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* Detail dialog (kept from original) */}
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
