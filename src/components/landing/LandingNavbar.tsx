import { useState, useEffect } from "react";
import { Menu, X, Phone, ChevronDown, Check, MessageCircle, DollarSign, Truck, Package, Globe, CalendarIcon } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import logo from "@/assets/logo.png";
import { services } from "./servicesData";
import { ServicePricingSection } from "./ServicePricingSection";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import boxtruckImg from "@/assets/landing-boxtruck.jpg";
import hotshotImg from "@/assets/landing-hotshot.jpg";
import { useLandingLang } from "@/contexts/LandingLanguageContext";
import t from "./landingTranslations";

export function LandingNavbar() {
  const { lang, toggleLang } = useLandingLang();
  const tr = t[lang];

  const vehicles = [
    {
      img: boxtruckImg,
      title: "Box Truck",
      icon: Package,
      desc: tr.vehBoxTruckDesc,
      details: tr.vehBoxTruckDetails,
      cargas: tr.vehBoxTruckCargas,
      benefits: tr.vehBoxTruckBenefits,
    },
    {
      img: hotshotImg,
      title: "Hotshot",
      icon: Truck,
      desc: tr.vehHotshotDesc,
      details: tr.vehHotshotDetails,
      cargas: tr.vehHotshotCargas,
      benefits: tr.vehHotshotBenefits,
    },
  ];

  const staticLinks = [
    { label: tr.navAdvantages, href: "#ventajas" },
    { label: tr.navFaq, href: "#faq" },
    { label: tr.navContact, href: "#contacto" },
  ];

  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [servicesOpen, setServicesOpen] = useState(false);
  const [vehiclesOpen, setVehiclesOpen] = useState(false);
  const [selectedService, setSelectedService] = useState<number | null>(null);
  const [showPricing, setShowPricing] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState<number | null>(null);
  const [mobileServicesOpen, setMobileServicesOpen] = useState(false);
  const [mobileVehiclesOpen, setMobileVehiclesOpen] = useState(false);

  const selected = selectedService !== null ? services[selectedService] : null;
  const selectedVeh = selectedVehicle !== null ? vehicles[selectedVehicle] : null;

  // Get localized service data
  const svcKeys = ["dispatching", "leasing", "tms", "tracking", "asesoria", "permisos", "curso", "auditoria"] as const;
  const localizedService = selectedService !== null ? tr.svcData[svcKeys[selectedService]] : null;

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const handleServiceClose = () => {
    setSelectedService(null);
    setShowPricing(false);
  };

  const LangToggle = () => (
    <button
      onClick={toggleLang}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border text-xs font-semibold text-muted-foreground hover:text-foreground hover:border-accent/40 transition-colors"
      aria-label="Toggle language"
    >
      <Globe size={14} />
      {lang === "es" ? "EN" : "ES"}
    </button>
  );

  return (
    <>
      <nav
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          scrolled
            ? "bg-card/95 backdrop-blur-md shadow-md border-b border-border"
            : "bg-card/80 backdrop-blur-sm"
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
          <a href="/" className="flex items-center gap-2">
            <img src={logo} alt="Dispatch Up" className="h-8 w-auto" />
            <span className="text-foreground font-bold text-lg tracking-tight whitespace-nowrap">Dispatch Up</span>
          </a>

          {/* Desktop nav */}
          <div className="hidden lg:flex items-center gap-6">
            {/* Servicios dropdown */}
            <div
              className="relative"
              onMouseEnter={() => setServicesOpen(true)}
              onMouseLeave={() => setServicesOpen(false)}
            >
              <button className="flex items-center gap-1 text-muted-foreground hover:text-foreground text-sm font-medium transition-colors">
                {tr.navServices} <ChevronDown size={14} className={`transition-transform ${servicesOpen ? "rotate-180" : ""}`} />
              </button>
              <AnimatePresence>
                {servicesOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 8 }}
                    transition={{ duration: 0.15 }}
                    className="absolute top-full left-1/2 -translate-x-1/2 pt-2 w-72"
                  >
                    <div className="bg-card border border-border rounded-xl shadow-lg p-2">
                      {services.map((s, i) => {
                        const localTitle = tr.svcData[svcKeys[i]]?.title || s.title;
                        return (
                          <button
                            key={s.title}
                            onClick={() => { setSelectedService(i); setServicesOpen(false); setShowPricing(false); }}
                            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left hover:bg-accent/10 transition-colors"
                          >
                            <div className="w-8 h-8 rounded-md bg-accent/10 flex items-center justify-center shrink-0">
                              <s.icon className="text-accent" size={16} />
                            </div>
                            <span className="text-sm font-medium text-foreground leading-tight">{localTitle}</span>
                          </button>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Vehículos dropdown */}
            <div
              className="relative"
              onMouseEnter={() => setVehiclesOpen(true)}
              onMouseLeave={() => setVehiclesOpen(false)}
            >
              <button className="flex items-center gap-1 text-muted-foreground hover:text-foreground text-sm font-medium transition-colors">
                {tr.navVehicles} <ChevronDown size={14} className={`transition-transform ${vehiclesOpen ? "rotate-180" : ""}`} />
              </button>
              <AnimatePresence>
                {vehiclesOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 8 }}
                    transition={{ duration: 0.15 }}
                    className="absolute top-full left-1/2 -translate-x-1/2 pt-2 w-64"
                  >
                    <div className="bg-card border border-border rounded-xl shadow-lg p-2">
                      {vehicles.map((v, i) => (
                        <button
                          key={v.title}
                          onClick={() => { setSelectedVehicle(i); setVehiclesOpen(false); }}
                          className="w-full flex items-center gap-3 px-3 py-3 rounded-lg text-left hover:bg-accent/10 transition-colors"
                        >
                          <div className="w-8 h-8 rounded-md bg-accent/10 flex items-center justify-center shrink-0">
                            <v.icon className="text-accent" size={16} />
                          </div>
                          <div>
                            <span className="text-sm font-medium text-foreground">{v.title}</span>
                            <p className="text-xs text-muted-foreground leading-tight mt-0.5">{v.desc.slice(0, 50)}…</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {staticLinks.map((l) => (
              <a
                key={l.href}
                href={l.href}
                className="text-muted-foreground hover:text-foreground text-sm font-medium transition-colors"
              >
                {l.label}
              </a>
            ))}
          </div>

          <div className="hidden lg:flex items-center gap-3">
            <a href="tel:+19807668815" className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Phone size={16} className="text-accent" />
              (980) 766-8815
            </a>
            <LangToggle />
            <a href="/auth" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors px-3 py-2">
              {tr.navLogin}
            </a>
            <a
              href="#meeting"
              className="inline-flex items-center gap-1.5 border border-[hsl(152,60%,40%)] text-[hsl(152,60%,40%)] hover:bg-[hsl(152,60%,40%)] hover:text-white px-4 py-2 rounded-lg text-sm font-bold transition-all"
            >
              <CalendarIcon size={14} />
              {lang === "es" ? "Agendar Reunión" : "Schedule Meeting"}
            </a>
            <a href="#onboarding" className="bg-accent text-accent-foreground px-5 py-2 rounded-lg text-sm font-bold hover:brightness-110 transition shadow-sm">
              {tr.navRegister}
            </a>
          </div>

          <button className="lg:hidden text-foreground" onClick={() => setOpen(!open)}>
            {open ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        {/* Mobile menu */}
        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="lg:hidden bg-card overflow-hidden border-b border-border"
            >
              <div className="px-4 py-4 flex flex-col gap-1">
                {/* Mobile lang toggle */}
                <div className="flex justify-end mb-2">
                  <LangToggle />
                </div>

                {/* Mobile Servicios */}
                <button
                  onClick={() => setMobileServicesOpen(!mobileServicesOpen)}
                  className="flex items-center justify-between text-foreground/80 hover:text-accent text-sm font-medium py-2"
                >
                  {tr.navServices} <ChevronDown size={14} className={`transition-transform ${mobileServicesOpen ? "rotate-180" : ""}`} />
                </button>
                <AnimatePresence>
                  {mobileServicesOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden pl-3"
                    >
                      {services.map((s, i) => {
                        const localTitle = tr.svcData[svcKeys[i]]?.title || s.title;
                        return (
                          <button
                            key={s.title}
                            onClick={() => { setSelectedService(i); setOpen(false); setShowPricing(false); }}
                            className="w-full flex items-center gap-2 py-2 text-left text-sm text-muted-foreground hover:text-accent"
                          >
                            <s.icon size={14} className="text-accent shrink-0" />
                            {localTitle}
                          </button>
                        );
                      })}
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Mobile Vehículos */}
                <button
                  onClick={() => setMobileVehiclesOpen(!mobileVehiclesOpen)}
                  className="flex items-center justify-between text-foreground/80 hover:text-accent text-sm font-medium py-2"
                >
                  {tr.navVehicles} <ChevronDown size={14} className={`transition-transform ${mobileVehiclesOpen ? "rotate-180" : ""}`} />
                </button>
                <AnimatePresence>
                  {mobileVehiclesOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden pl-3"
                    >
                      {vehicles.map((v, i) => (
                        <button
                          key={v.title}
                          onClick={() => { setSelectedVehicle(i); setOpen(false); }}
                          className="w-full flex items-center gap-2 py-2 text-left text-sm text-muted-foreground hover:text-accent"
                        >
                          <v.icon size={14} className="text-accent shrink-0" />
                          {v.title}
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>

                {staticLinks.map((l) => (
                  <a
                    key={l.href}
                    href={l.href}
                    onClick={() => setOpen(false)}
                    className="text-foreground/80 hover:text-accent text-sm font-medium py-2"
                  >
                    {l.label}
                  </a>
                ))}
                <a href="/auth" onClick={() => setOpen(false)} className="text-foreground/80 hover:text-accent text-sm font-medium py-2">
                  {tr.navLogin}
                </a>
                <a
                  href="#meeting"
                  onClick={() => setOpen(false)}
                  className="inline-flex items-center justify-center gap-1.5 border border-[hsl(152,60%,40%)] text-[hsl(152,60%,40%)] px-4 py-3 rounded-lg text-sm font-bold text-center transition mt-2"
                >
                  <CalendarIcon size={14} />
                  {lang === "es" ? "Agendar Reunión" : "Schedule Meeting"}
                </a>
                <a
                  href="#onboarding"
                  onClick={() => setOpen(false)}
                  className="bg-accent text-accent-foreground px-4 py-3 rounded-lg text-sm font-bold text-center hover:brightness-110 transition"
                >
                  {tr.navRegister}
                </a>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>

      {/* Service Detail Modal */}
      <Dialog open={selectedService !== null} onOpenChange={(o) => !o && handleServiceClose()}>
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
                <DialogDescription className="text-base leading-relaxed pt-2">
                  {localizedService.details}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-3 mt-2">
                <h4 className="font-semibold text-foreground text-sm">{tr.svcBenefits}</h4>
                <ul className="space-y-2">
                  {localizedService.benefits.map((b) => (
                    <li key={b} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <Check className="text-accent mt-0.5 shrink-0" size={16} />
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="mt-4 space-y-3">
                {selected.pricing.type === "page" ? (
                  <ServicePricingSection pricing={selected.pricing} whatsappHref={selected.cta.href} onClose={handleServiceClose} stripeConfig={selected.stripeConfig} />
                ) : (selected.pricing.fixedPrice || selected.pricing.plans) ? (
                  <>
                    {!showPricing ? (
                      <Button className="w-full gap-2" variant="outline" onClick={() => setShowPricing(true)}>
                        <DollarSign size={18} />
                        {tr.svcViewPrices}
                      </Button>
                    ) : (
                      <AnimatePresence>
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.25 }}
                        >
                          <ServicePricingSection pricing={selected.pricing} whatsappHref={selected.cta.href} onClose={handleServiceClose} stripeConfig={selected.stripeConfig} />
                        </motion.div>
                      </AnimatePresence>
                    )}
                  </>
                ) : null}

                <Button className="w-full gap-2" variant={selected.pricing.type === "page" ? "outline" : "default"} asChild>
                  <a href={selected.cta.href} target="_blank" rel="noopener noreferrer">
                    <MessageCircle size={18} />
                    {localizedService.cta}
                  </a>
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Vehicle Detail Modal */}
      <Dialog open={selectedVehicle !== null} onOpenChange={(o) => !o && setSelectedVehicle(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          {selectedVeh && (
            <>
              <DialogHeader>
                <div className="overflow-hidden rounded-lg mb-3">
                  <img src={selectedVeh.img} alt={selectedVeh.title} className="w-full h-48 object-cover" />
                </div>
                <div className="flex items-center gap-3 mb-1">
                  <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
                    <selectedVeh.icon className="text-accent" size={20} />
                  </div>
                  <DialogTitle className="text-xl">{selectedVeh.title}</DialogTitle>
                </div>
                <DialogDescription className="text-base leading-relaxed pt-2">
                  {selectedVeh.details}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 mt-2">
                <div>
                  <h4 className="font-semibold text-foreground text-sm mb-2">{tr.vehLoadTypes}</h4>
                  <ul className="space-y-2">
                    {selectedVeh.cargas.map((c) => (
                      <li key={c} className="flex items-start gap-2 text-sm text-muted-foreground">
                        <Package className="text-accent mt-0.5 shrink-0" size={14} />
                        <span>{c}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div>
                  <h4 className="font-semibold text-foreground text-sm mb-2">{tr.vehAdvantages}</h4>
                  <ul className="space-y-2">
                    {selectedVeh.benefits.map((b) => (
                      <li key={b} className="flex items-start gap-2 text-sm text-muted-foreground">
                        <Check className="text-accent mt-0.5 shrink-0" size={14} />
                        <span>{b}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="mt-4">
                <Button className="w-full gap-2" asChild>
                  <a
                    href={`https://wa.me/19807668815?text=Hola%2C%20me%20interesa%20el%20servicio%20de%20dispatching%20para%20${encodeURIComponent(selectedVeh.title)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <MessageCircle size={18} />
                    {tr.navConsult} {selectedVeh.title}
                  </a>
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
