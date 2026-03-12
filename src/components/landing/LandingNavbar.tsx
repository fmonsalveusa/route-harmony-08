import { useState, useEffect } from "react";
import { Menu, X, Phone } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import logo from "@/assets/logo.png";

const navLinks = [
  { label: "Servicios", href: "#servicios" },
  { label: "Ventajas", href: "#ventajas" },
  { label: "Vehículos", href: "#vehiculos" },
  { label: "FAQ", href: "#faq" },
  { label: "Contacto", href: "#contacto" },
];

export function LandingNavbar() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
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
          <span className="text-foreground font-bold text-lg tracking-tight">Dispatch Up</span>
        </a>

        <div className="hidden lg:flex items-center gap-8">
          {navLinks.map((l) => (
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
          <a
            href="tel:+19807668815"
            className="flex items-center gap-2 text-sm font-semibold text-foreground"
          >
            <Phone size={16} className="text-accent" />
            (980) 766-8815
          </a>
          <a
            href="/auth"
            className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors px-3 py-2"
          >
            Iniciar Sesión
          </a>
          <a
            href="#onboarding"
            className="bg-accent text-accent-foreground px-5 py-2 rounded-lg text-sm font-bold hover:brightness-110 transition shadow-sm"
          >
            🚛 Regístrate Gratis
          </a>
        </div>

        <button className="lg:hidden text-foreground" onClick={() => setOpen(!open)}>
          {open ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="lg:hidden bg-card overflow-hidden border-b border-border"
          >
            <div className="px-4 py-4 flex flex-col gap-3">
              {navLinks.map((l) => (
                <a
                  key={l.href}
                  href={l.href}
                  onClick={() => setOpen(false)}
                  className="text-foreground/80 hover:text-accent text-sm font-medium py-2"
                >
                  {l.label}
                </a>
              ))}
              <a
                href="/auth"
                onClick={() => setOpen(false)}
                className="text-foreground/80 hover:text-accent text-sm font-medium py-2"
              >
                Iniciar Sesión
              </a>
              <a
                href="#onboarding"
                onClick={() => setOpen(false)}
                className="bg-accent text-accent-foreground px-4 py-3 rounded-lg text-sm font-bold text-center hover:brightness-110 transition"
              >
                🚛 Regístrate Gratis
              </a>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}
