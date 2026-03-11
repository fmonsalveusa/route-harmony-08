import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, MessageCircle, DollarSign } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { services } from "./servicesData";
import { ServicePricingSection } from "./ServicePricingSection";

export function ServicesSection() {
  const [selectedService, setSelectedService] = useState<number | null>(null);
  const [showPricing, setShowPricing] = useState(false);
  const selected = selectedService !== null ? services[selectedService] : null;

  const handleClose = () => {
    setSelectedService(null);
    setShowPricing(false);
  };

  return (
    <section id="servicios" className="py-20 bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-14"
        >
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">Nuestros Servicios</h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Soluciones integrales para el transporte de carga. Desde dispatch hasta permisos federales.
          </p>
        </motion.div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {services.map((s, i) => (
            <motion.div
              key={s.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="group bg-card border rounded-xl overflow-hidden hover:shadow-lg hover:border-accent/40 transition-all duration-300 cursor-pointer"
              onClick={() => { setSelectedService(i); setShowPricing(false); }}
            >
              <div className="aspect-[2/1] overflow-hidden">
                <img
                  src={s.image}
                  alt={s.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  loading="lazy"
                />
              </div>
              <div className="p-6">
                <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center mb-3 group-hover:bg-accent/20 transition-colors">
                  <s.icon className="text-accent" size={20} />
                </div>
                <h3 className="font-bold text-foreground text-lg mb-2">{s.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{s.description}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Service Detail Modal */}
      <Dialog open={selectedService !== null} onOpenChange={(open) => !open && handleClose()}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          {selected && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-3 mb-1">
                  <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
                    <selected.icon className="text-accent" size={20} />
                  </div>
                  <DialogTitle className="text-xl">{selected.title}</DialogTitle>
                </div>
                <DialogDescription className="text-base leading-relaxed pt-2">
                  {selected.details}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-3 mt-2">
                <h4 className="font-semibold text-foreground text-sm">Beneficios</h4>
                <ul className="space-y-2">
                  {selected.benefits.map((b) => (
                    <li key={b} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <Check className="text-accent mt-0.5 shrink-0" size={16} />
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Pricing section */}
              <div className="mt-4 space-y-3">
                {selected.pricing.type === "page" ? (
                  <ServicePricingSection pricing={selected.pricing} whatsappHref={selected.cta.href} onClose={handleClose} />
                ) : (
                  <>
                    {!showPricing ? (
                      <Button className="w-full gap-2" variant="outline" onClick={() => setShowPricing(true)}>
                        <DollarSign size={18} />
                        Ver Precios
                      </Button>
                    ) : (
                      <AnimatePresence>
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.25 }}
                        >
                          <ServicePricingSection pricing={selected.pricing} whatsappHref={selected.cta.href} onClose={handleClose} />
                        </motion.div>
                      </AnimatePresence>
                    )}
                  </>
                )}

                {/* WhatsApp CTA */}
                <Button className="w-full gap-2" variant={selected.pricing.type === "page" ? "outline" : "default"} asChild>
                  <a href={selected.cta.href} target="_blank" rel="noopener noreferrer">
                    <MessageCircle size={18} />
                    {selected.cta.label}
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
