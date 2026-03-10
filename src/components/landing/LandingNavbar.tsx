import { useState } from "react";
import { Menu, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import logo from "@/assets/logo.png";

const navLinks = [
  { label: "Servicios", href: "#servicios" },
  { label: "Cómo Funciona", href: "#como-funciona" },
  { label: "Vehículos", href: "#vehiculos" },
  { label: "Contacto", href: "#contacto" },
];

export function LandingNavbar() {
  const [open, setOpen] = useState(false);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-[hsl(214,52%,15%)]/95 backdrop-blur-md border-b border-white/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
        <a href="/" className="flex items-center gap-2">
          <img src={logo} alt="Dispatch Up" className="h-8 w-auto" />
          <span className="text-white font-bold text-lg tracking-tight">Dispatch Up</span>
        </a>

        <div className="hidden md:flex items-center gap-6">
          {navLinks.map((l) => (
            <a key={l.href} href={l.href} className="text-white/70 hover:text-accent text-sm font-medium transition-colors">
              {l.label}
            </a>
          ))}
          <a
            href="https://wa.me/19807668815?text=Hola,%20me%20interesa%20información%20sobre%20sus%20servicios"
            target="_blank"
            rel="noopener noreferrer"
            className="bg-accent text-accent-foreground px-4 py-2 rounded-md text-sm font-semibold hover:brightness-110 transition"
          >
            WhatsApp
          </a>
          <a
            href="/auth"
            className="border border-white/30 text-white px-4 py-2 rounded-md text-sm font-semibold hover:bg-white/10 transition"
          >
            Iniciar Sesión
          </a>
        </div>

        <button className="md:hidden text-white" onClick={() => setOpen(!open)}>
          {open ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="md:hidden bg-[hsl(214,52%,15%)] overflow-hidden"
          >
            <div className="px-4 py-4 flex flex-col gap-3">
              {navLinks.map((l) => (
                <a key={l.href} href={l.href} onClick={() => setOpen(false)} className="text-white/80 hover:text-accent text-sm font-medium py-2">
                  {l.label}
                </a>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}
